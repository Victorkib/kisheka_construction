/**
 * Worker Profile API Route (Individual Worker)
 * GET: Get single worker profile with statistics
 * PATCH: Update worker profile
 * 
 * GET /api/labour/workers/[id]
 * PATCH /api/labour/workers/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateWorkerProfile, createWorkerProfile } from '@/lib/schemas/worker-profile-schema';

/**
 * GET /api/labour/workers/[id]
 * Get single worker profile with detailed statistics
 * Auth: All authenticated users
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid worker ID is required', 400);
    }

    const db = await getDatabase();

    const worker = await db.collection('worker_profiles').findOne({
      _id: new ObjectId(id),
      deletedAt: null, // Exclude soft-deleted workers
    });

    if (!worker) {
      return errorResponse('Worker profile not found', 404);
    }

    // Get detailed statistics
    // Match by both userId and _id to handle both cases
    const stats = await db.collection('labour_entries').aggregate([
      {
        $match: {
          $or: [
            { workerId: worker.userId },
            { workerId: worker._id },
          ],
          status: { $in: ['approved', 'paid'] },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$totalHours' },
          totalEarned: { $sum: '$totalCost' },
          entryCount: { $sum: 1 },
          averageRating: { $avg: '$qualityRating' },
          averageProductivity: { $avg: '$productivityRating' },
        },
      },
    ]).toArray();

    const workerStats = stats[0] || {
      totalHours: 0,
      totalEarned: 0,
      entryCount: 0,
      averageRating: 0,
      averageProductivity: 0,
    };

    // Get recent entries
    const recentEntries = await db
      .collection('labour_entries')
      .find({
        $or: [
          { workerId: worker.userId },
          { workerId: worker._id },
        ],
        deletedAt: null,
      })
      .sort({ entryDate: -1 })
      .limit(10)
      .toArray();

    // Get project assignments
    const projectAssignments = await db
      .collection('labour_entries')
      .distinct('projectId', {
        $or: [
          { workerId: worker.userId },
          { workerId: worker._id },
        ],
        deletedAt: null,
      });

    const populatedWorker = {
      ...worker,
      statistics: {
        totalHoursWorked: workerStats.totalHours,
        totalEarned: workerStats.totalEarned,
        entryCount: workerStats.entryCount,
        averageRating: workerStats.averageRating || 0,
        averageProductivity: workerStats.averageProductivity || 0,
      },
      recentEntries,
      projectAssignments: projectAssignments.map((pid) => pid.toString()),
    };

    return successResponse(populatedWorker, 'Worker profile retrieved successfully');
  } catch (error) {
    console.error('GET /api/labour/workers/[id] error:', error);
    return errorResponse('Failed to retrieve worker profile', 500);
  }
}

/**
 * PATCH /api/labour/workers/[id]
 * Update worker profile
 * Auth: OWNER only
 */
export async function PATCH(request, { params }) {
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

    const hasAccess = await hasPermission(user.id, 'edit_worker_profile');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to update worker profiles.', 403);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid worker ID is required', 400);
    }

    const body = await request.json();
    const db = await getDatabase();

    // Get existing worker
    const existingWorker = await db.collection('worker_profiles').findOne({
      _id: new ObjectId(id),
    });

    if (!existingWorker) {
      return errorResponse('Worker profile not found', 404);
    }

    // Merge updates
    const updatedData = {
      ...existingWorker,
      ...body,
      updatedAt: new Date(),
    };

    // Validate updated worker
    const validation = validateWorkerProfile(updatedData);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Check if employeeId is being changed and if new one already exists
    if (body.employeeId && body.employeeId !== existingWorker.employeeId) {
      const existing = await db.collection('worker_profiles').findOne({
        employeeId: body.employeeId,
        _id: { $ne: new ObjectId(id) },
      });

      if (existing) {
        return errorResponse('Worker with this employee ID already exists', 400);
      }
    }

    // Update worker profile
    await db.collection('worker_profiles').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: updatedData,
      }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'WORKER_PROFILE',
      entityId: id,
      projectId: null,
      changes: {
        before: existingWorker,
        after: updatedData,
      },
    });

    // Get updated worker
    const updatedWorker = await db.collection('worker_profiles').findOne({
      _id: new ObjectId(id),
    });

    return successResponse(updatedWorker, 'Worker profile updated successfully');
  } catch (error) {
    console.error('PATCH /api/labour/workers/[id] error:', error);
    return errorResponse(error.message || 'Failed to update worker profile', 500);
  }
}

/**
 * DELETE /api/labour/workers/[id]
 * Delete worker profile (soft delete)
 * Auth: OWNER only
 */
export async function DELETE(request, { params }) {
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

    const hasAccess = await hasPermission(user.id, 'delete_worker_profile');
    if (!hasAccess) {
      return errorResponse('Insufficient permissions. You do not have permission to delete worker profiles.', 403);
    }    const { id } = await params;    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid worker ID is required', 400);
    }    const db = await getDatabase();    // Get existing worker
    const existingWorker = await db.collection('worker_profiles').findOne({
      _id: new ObjectId(id),
    });    if (!existingWorker) {
      return errorResponse('Worker profile not found', 404);
    }    // Soft delete - set deletedAt timestamp
    await db.collection('worker_profiles').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          deletedAt: new Date(),
          status: 'terminated',
          updatedAt: new Date(),
        },
      }
    );    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'WORKER_PROFILE',
      entityId: id,
      projectId: null,
      changes: {
        deleted: existingWorker,
      },
    });    return successResponse(null, 'Worker profile deleted successfully');
  } catch (error) {
    console.error('DELETE /api/labour/workers/[id] error:', error);
    return errorResponse(error.message || 'Failed to delete worker profile', 500);
  }
}