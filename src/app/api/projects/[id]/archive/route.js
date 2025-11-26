/**
 * Archive Project API Route
 * POST /api/projects/[id]/archive
 * Archives a project (soft delete)
 * Auth: OWNER only
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can archive projects
    const hasArchivePermission = await hasPermission(user.id, 'delete_project');
    if (!hasArchivePermission) {
      return errorResponse('Insufficient permissions. Only OWNER can archive projects.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);

    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Get existing project
    const existingProject = await db.collection('projects').findOne({
      _id: new ObjectId(id),
    });

    if (!existingProject) {
      return errorResponse('Project not found', 404);
    }

    // Check if project is already archived
    if (existingProject.status === 'archived') {
      return errorResponse('Project is already archived', 400);
    }

    // Check dependencies for summary
    const materialsCount = await db.collection('materials').countDocuments({
      projectId: new ObjectId(id),
      deletedAt: null,
    });

    const expensesCount = await db.collection('expenses').countDocuments({
      projectId: new ObjectId(id),
      deletedAt: null,
    });

    const initialExpensesCount = await db.collection('initial_expenses').countDocuments({
      projectId: new ObjectId(id),
      status: { $ne: 'deleted' },
    });

    const floorsCount = await db.collection('floors').countDocuments({
      projectId: new ObjectId(id),
    });

    const investorsWithAllocations = await db
      .collection('investors')
      .find({
        status: 'ACTIVE',
        'projectAllocations.projectId': new ObjectId(id),
      })
      .toArray();

    const allocationsCount = investorsWithAllocations.length;

    const now = new Date();

    // Soft delete related entities
    // Soft delete materials
    if (materialsCount > 0) {
      await db.collection('materials').updateMany(
        {
          projectId: new ObjectId(id),
          deletedAt: null,
        },
        {
          $set: {
            deletedAt: now,
            updatedAt: now,
          },
        }
      );
    }

    // Soft delete expenses
    if (expensesCount > 0) {
      await db.collection('expenses').updateMany(
        {
          projectId: new ObjectId(id),
          deletedAt: null,
        },
        {
          $set: {
            deletedAt: now,
            status: 'ARCHIVED',
            updatedAt: now,
          },
        }
      );
    }

    // Soft delete initial expenses
    if (initialExpensesCount > 0) {
      await db.collection('initial_expenses').updateMany(
        {
          projectId: new ObjectId(id),
          status: { $ne: 'deleted' },
        },
        {
          $set: {
            status: 'deleted',
            updatedAt: now,
          },
        }
      );
    }

    // Archive project (soft delete)
    const result = await db.collection('projects').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'archived',
          deletedAt: now,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Project not found or archive failed', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'ARCHIVED',
      entityType: 'PROJECT',
      entityId: id,
      changes: {
        status: {
          oldValue: existingProject.status,
          newValue: 'archived',
        },
        deletedAt: {
          oldValue: null,
          newValue: now,
        },
      },
    });

    return successResponse(
      {
        projectId: id,
        archived: true,
        dependencies: {
          materials: materialsCount,
          expenses: expensesCount,
          initialExpenses: initialExpensesCount,
          floors: floorsCount,
          investorAllocations: allocationsCount,
        },
      },
      'Project archived successfully. All financial records and dependencies have been preserved.'
    );
  } catch (error) {
    console.error('Archive project error:', error);
    return errorResponse('Failed to archive project', 500);
  }
}

