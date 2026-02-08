/**
 * Bulk Assignment API Route
 * POST /api/work-items/assign
 * Assigns multiple work items to a worker (or multiple workers)
 * Auth: PM, OWNER only
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/work-items/assign
 * Bulk assign work items to worker(s)
 * Body: { workItemIds: string[], workerIds: string[] }
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const hasEditPermission = await hasPermission(user.id, 'edit_work_item');
    if (!hasEditPermission) {
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['owner', 'pm', 'project_manager'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse('Insufficient permissions. Only PM and OWNER can assign work items.', 403);
      }
    }

    const body = await request.json();
    const { workItemIds, workerIds } = body;

    // Validation
    if (!workItemIds || !Array.isArray(workItemIds) || workItemIds.length === 0) {
      return errorResponse('workItemIds array is required and must not be empty', 400);
    }

    if (!workerIds || !Array.isArray(workerIds) || workerIds.length === 0) {
      return errorResponse('workerIds array is required and must not be empty', 400);
    }

    // Validate all IDs
    const validWorkItemIds = workItemIds.filter(id => ObjectId.isValid(id));
    const validWorkerIds = workerIds.filter(id => ObjectId.isValid(id));

    if (validWorkItemIds.length === 0) {
      return errorResponse('No valid work item IDs provided', 400);
    }

    if (validWorkerIds.length === 0) {
      return errorResponse('No valid worker IDs provided', 400);
    }

    const db = await getDatabase();

    // Verify work items exist
    const workItems = await db.collection('work_items').find({
      _id: { $in: validWorkItemIds.map(id => new ObjectId(id)) },
      deletedAt: null
    }).toArray();

    if (workItems.length !== validWorkItemIds.length) {
      return errorResponse('Some work items not found', 400);
    }

    // Verify workers exist
    const workers = await db.collection('worker_profiles').find({
      $or: [
        { _id: { $in: validWorkerIds.map(id => new ObjectId(id)) } },
        { userId: { $in: validWorkerIds.map(id => new ObjectId(id)) } }
      ],
      deletedAt: null
    }).toArray();

    if (workers.length === 0) {
      return errorResponse('No valid workers found', 400);
    }

    // Get worker IDs (both _id and userId)
    const effectiveWorkerIds = new Set();
    workers.forEach(worker => {
      effectiveWorkerIds.add(worker._id.toString());
      if (worker.userId) {
        effectiveWorkerIds.add(worker.userId.toString());
      }
    });

    const workerObjectIds = Array.from(effectiveWorkerIds)
      .filter(id => validWorkerIds.includes(id))
      .map(id => new ObjectId(id));

    if (workerObjectIds.length === 0) {
      return errorResponse('No matching worker IDs found', 400);
    }

    // Update work items
    const results = {
      assigned: 0,
      failed: 0,
      workItems: []
    };

    for (const workItem of workItems) {
      try {
        // Get existing assigned workers
        const existingAssignedTo = workItem.assignedTo || [];
        const existingIds = Array.isArray(existingAssignedTo)
          ? existingAssignedTo.map(id => id?.toString()).filter(Boolean).sort()
          : existingAssignedTo
          ? [existingAssignedTo.toString()].sort()
          : [];

        // Merge with new workers (avoid duplicates)
        const newWorkerIds = workerObjectIds.map(id => id.toString());
        const allWorkerIds = [...new Set([...existingIds, ...newWorkerIds])]
          .map(id => new ObjectId(id))
          .sort((a, b) => a.toString().localeCompare(b.toString()));

        const newIds = allWorkerIds.map(id => id.toString()).sort();

        // Check if assignment changed
        const assignmentChanged = JSON.stringify(existingIds) !== JSON.stringify(newIds);

        if (assignmentChanged) {
          // Track assignment history
          const existingHistory = workItem.assignmentHistory || [];
          const historyEntry = {
            previousWorkers: existingIds,
            assignedWorkers: newIds,
            assignedBy: userProfile._id.toString(),
            assignedAt: new Date(),
            action: existingIds.length === 0 ? 'assigned' : 'reassigned'
          };

          // Update work item
          await db.collection('work_items').updateOne(
            { _id: workItem._id },
            {
              $set: {
                assignedTo: allWorkerIds,
                assignmentHistory: [...existingHistory, historyEntry],
                updatedAt: new Date()
              }
            }
          );

          results.assigned++;
          results.workItems.push({
            _id: workItem._id,
            name: workItem.name,
            assigned: true
          });
        } else {
          // Already assigned to these workers
          results.workItems.push({
            _id: workItem._id,
            name: workItem.name,
            assigned: false,
            reason: 'Already assigned to these workers'
          });
        }
      } catch (err) {
        console.error(`Error assigning work item ${workItem._id}:`, err);
        results.failed++;
        results.workItems.push({
          _id: workItem._id,
          name: workItem.name,
          assigned: false,
          error: err.message
        });
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'BULK_ASSIGNED',
      entityType: 'WORK_ITEM',
      entityId: validWorkItemIds.join(','),
      changes: {
        workItemIds: validWorkItemIds,
        workerIds: validWorkerIds,
        assigned: results.assigned
      },
    });

    return successResponse(results, `Successfully assigned ${results.assigned} work item(s) to ${workerIds.length} worker(s)`);
  } catch (error) {
    console.error('Bulk assignment error:', error);
    return errorResponse('Failed to assign work items', 500);
  }
}
