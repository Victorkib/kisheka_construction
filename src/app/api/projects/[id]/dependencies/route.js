/**
 * Project Dependency Map API Route
 * GET: Return a dependency map for a project
 *
 * GET /api/projects/[id]/dependencies
 * Auth: All authenticated users with project access
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateProjectAccess } from '@/lib/middleware/project-context';
import { getProjectDependencyCounts } from '@/lib/project-dependencies';
import { getCurrentTotalUsed } from '@/lib/financial-helpers';

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const accessResult = await validateProjectAccess(userProfile._id, id, { allowArchived: true });
    if (!accessResult.hasAccess) {
      return errorResponse(accessResult.error || 'Access denied to this project', 403);
    }

    const db = await getDatabase();
    const projectObjectId = new ObjectId(id);

    const project = await db.collection('projects').findOne({
      _id: projectObjectId,
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    const dependencies = await getProjectDependencyCounts(db, projectObjectId);

    const investorsWithAllocations = await db
      .collection('investors')
      .find({
        status: 'ACTIVE',
        'projectAllocations.projectId': projectObjectId,
      })
      .toArray();

    const allocationsCount = investorsWithAllocations.length;

    const projectFinances = await db
      .collection('project_finances')
      .findOne({ projectId: projectObjectId });

    const totalUsed = projectFinances?.totalUsed || await getCurrentTotalUsed(id);
    const totalInvested = projectFinances?.totalInvested || 0;
    const capitalBalance = totalInvested - totalUsed;

    return successResponse({
      projectId: id,
      status: project.status || 'active',
      deletedAt: project.deletedAt || null,
      archivedAt: project.archivedAt || null,
      dependencies,
      investorAllocations: allocationsCount,
      finances: {
        totalUsed,
        totalInvested,
        capitalBalance,
        hasSpending: totalUsed > 0,
      },
    });
  } catch (error) {
    console.error('Get project dependency map error:', error);
    return errorResponse('Failed to retrieve project dependency map', 500);
  }
}
