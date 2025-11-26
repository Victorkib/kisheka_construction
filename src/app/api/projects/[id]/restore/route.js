/**
 * Restore Project API Route
 * POST /api/projects/[id]/restore
 * Restores an archived project
 * Auth: OWNER only
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { recalculateProjectFinances } from '@/lib/financial-helpers';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can restore projects
    const hasRestorePermission = await hasPermission(user.id, 'delete_project');
    if (!hasRestorePermission) {
      return errorResponse('Insufficient permissions. Only OWNER can restore projects.', 403);
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

    // Check if project is archived
    if (existingProject.status !== 'archived') {
      return errorResponse('Project is not archived', 400);
    }

    const now = new Date();

    // Restore related entities
    // Restore materials
    await db.collection('materials').updateMany(
      {
        projectId: new ObjectId(id),
        deletedAt: { $ne: null },
      },
      {
        $unset: {
          deletedAt: '',
        },
        $set: {
          updatedAt: now,
        },
      }
    );

    // Restore expenses
    await db.collection('expenses').updateMany(
      {
        projectId: new ObjectId(id),
        status: 'ARCHIVED',
      },
      {
        $unset: {
          deletedAt: '',
        },
        $set: {
          status: 'PENDING', // Default status for restored expenses
          updatedAt: now,
        },
      }
    );

    // Restore initial expenses
    await db.collection('initial_expenses').updateMany(
      {
        projectId: new ObjectId(id),
        status: 'deleted',
      },
      {
        $set: {
          status: 'pending', // Default status for restored initial expenses
          updatedAt: now,
        },
      }
    );

    // Restore project
    const result = await db.collection('projects').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'active', // Default to active, user can change later
          updatedAt: now,
        },
        $unset: {
          deletedAt: '',
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Project not found or restore failed', 404);
    }

    // Recalculate project finances
    try {
      await recalculateProjectFinances(id);
    } catch (error) {
      console.error('Error recalculating project finances after restore:', error);
      // Don't fail the restore if finances recalculation fails
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'RESTORED',
      entityType: 'PROJECT',
      entityId: id,
      changes: {
        status: {
          oldValue: 'archived',
          newValue: 'active',
        },
        deletedAt: {
          oldValue: existingProject.deletedAt,
          newValue: null,
        },
      },
    });

    return successResponse(
      {
        projectId: id,
        restored: true,
      },
      'Project restored successfully. All dependencies have been restored.'
    );
  } catch (error) {
    console.error('Restore project error:', error);
    return errorResponse('Failed to restore project', 500);
  }
}

