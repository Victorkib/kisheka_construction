/**
 * Bulk Material Request Batch Detail API Route
 * GET: Get batch details with all material requests
 * PATCH: Update batch (limited fields)
 * DELETE: Cancel batch (soft delete)
 * 
 * GET /api/material-requests/bulk/[batchId]
 * PATCH /api/material-requests/bulk/[batchId]
 * DELETE /api/material-requests/bulk/[batchId]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getBatchWithRequests, updateBatchStatus } from '@/lib/helpers/batch-helpers';
import { VALID_BATCH_STATUSES } from '@/lib/schemas/material-request-batch-schema';
import { normalizeUserRole, isRole } from '@/lib/role-constants';

/**
 * GET /api/material-requests/bulk/[batchId]
 * Get batch details with all material requests populated
 * Auth: CLERK, PM, OWNER, SUPERVISOR, ACCOUNTANT
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canView = await hasPermission(user.id, 'view_bulk_material_requests');
    if (!canView) {
      return errorResponse('Insufficient permissions to view bulk material requests', 403);
    }

    const { batchId } = await params;
    if (!batchId || !ObjectId.isValid(batchId)) {
      return errorResponse('Invalid batch ID', 400);
    }

    const batch = await getBatchWithRequests(batchId);

    if (!batch) {
      return errorResponse('Batch not found', 404);
    }

    return successResponse(batch);
  } catch (error) {
    console.error('Get batch detail error:', error);
    return errorResponse('Failed to retrieve batch details', 500);
  }
}

/**
 * PATCH /api/material-requests/bulk/[batchId]
 * Update batch (limited fields: batchName, default settings)
 * Cannot update material requests - create new batch instead
 * Auth: CLERK, PM, OWNER, SUPERVISOR (only their own batches)
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canCreate = await hasPermission(user.id, 'create_bulk_material_request');
    if (!canCreate) {
      return errorResponse('Insufficient permissions to update bulk material requests', 403);
    }

    const { batchId } = await params;
    if (!batchId || !ObjectId.isValid(batchId)) {
      return errorResponse('Invalid batch ID', 400);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const db = await getDatabase();

    // Get existing batch
    const existingBatch = await db.collection('material_request_batches').findOne({
      _id: new ObjectId(batchId),
      deletedAt: null,
    });

    if (!existingBatch) {
      return errorResponse('Batch not found', 404);
    }

    // Check if user can edit (must be creator or OWNER/PM)
    const userRole = normalizeUserRole(userProfile.role);
    const isCreator = existingBatch.createdBy.toString() === userProfile._id.toString();
    const canEdit = isCreator || isRole(userRole, ['owner', 'pm', 'project_manager']);

    if (!canEdit) {
      return errorResponse('You can only edit batches you created', 403);
    }

    // Only allow editing if status is draft or pending_approval
    if (!['draft', 'pending_approval'].includes(existingBatch.status)) {
      return errorResponse(
        `Cannot edit batch with status: ${existingBatch.status}. Only draft or pending_approval batches can be edited.`,
        400
      );
    }

    // Build update data (only allowed fields)
    const updateData = {
      updatedAt: new Date(),
    };

    const changes = {};

    if (body.batchName !== undefined) {
      updateData.batchName = body.batchName?.trim() || null;
      changes.batchName = { oldValue: existingBatch.batchName, newValue: updateData.batchName };
    }

    if (body.defaultFloorId !== undefined) {
      if (body.defaultFloorId && ObjectId.isValid(body.defaultFloorId)) {
        updateData.defaultFloorId = new ObjectId(body.defaultFloorId);
      } else {
        updateData.defaultFloorId = null;
      }
      changes.defaultFloorId = { oldValue: existingBatch.defaultFloorId, newValue: updateData.defaultFloorId };
    }

    if (body.defaultCategoryId !== undefined) {
      if (body.defaultCategoryId && ObjectId.isValid(body.defaultCategoryId)) {
        updateData.defaultCategoryId = new ObjectId(body.defaultCategoryId);
      } else {
        updateData.defaultCategoryId = null;
      }
      changes.defaultCategoryId = { oldValue: existingBatch.defaultCategoryId, newValue: updateData.defaultCategoryId };
    }

    if (body.defaultUrgency !== undefined) {
      if (!['low', 'medium', 'high', 'critical'].includes(body.defaultUrgency)) {
        return errorResponse('defaultUrgency must be one of: low, medium, high, critical', 400);
      }
      updateData.defaultUrgency = body.defaultUrgency;
      changes.defaultUrgency = { oldValue: existingBatch.defaultUrgency, newValue: body.defaultUrgency };
    }

    if (body.defaultReason !== undefined) {
      updateData.defaultReason = body.defaultReason?.trim() || null;
      changes.defaultReason = { oldValue: existingBatch.defaultReason, newValue: updateData.defaultReason };
    }

    // Update batch
    const result = await db.collection('material_request_batches').findOneAndUpdate(
      { _id: new ObjectId(batchId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Batch not found', 404);
    }

    // Create audit log
    if (Object.keys(changes).length > 0) {
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'UPDATED',
        entityType: 'MATERIAL_REQUEST_BATCH',
        entityId: batchId,
        projectId: existingBatch.projectId.toString(),
        changes,
      });
    }

    return successResponse(result.value, 'Batch updated successfully');
  } catch (error) {
    console.error('Update batch error:', error);
    return errorResponse('Failed to update batch', 500);
  }
}

/**
 * DELETE /api/material-requests/bulk/[batchId]
 * Cancel batch (soft delete)
 * Only if status is draft or pending_approval
 * Cancels all linked material requests
 * Auth: CLERK, PM, OWNER, SUPERVISOR (only their own batches)
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canCreate = await hasPermission(user.id, 'create_bulk_material_request');
    if (!canCreate) {
      return errorResponse('Insufficient permissions to delete bulk material requests', 403);
    }

    const { batchId } = await params;
    if (!batchId || !ObjectId.isValid(batchId)) {
      return errorResponse('Invalid batch ID', 400);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();

    // Get existing batch
    const existingBatch = await db.collection('material_request_batches').findOne({
      _id: new ObjectId(batchId),
      deletedAt: null,
    });

    if (!existingBatch) {
      return errorResponse('Batch not found', 404);
    }

    // Check if user can delete (must be creator or OWNER/PM)
    const userRole = normalizeUserRole(userProfile.role);
    const isCreator = existingBatch.createdBy.toString() === userProfile._id.toString();
    const canDelete = isCreator || isRole(userRole, ['owner', 'pm', 'project_manager']);

    if (!canDelete) {
      return errorResponse('You can only delete batches you created', 403);
    }

    // Only allow deletion if status is draft or pending_approval
    if (!['draft', 'pending_approval'].includes(existingBatch.status)) {
      return errorResponse(
        `Cannot delete batch with status: ${existingBatch.status}. Only draft or pending_approval batches can be deleted.`,
        400
      );
    }

    // Soft delete batch
    const result = await db.collection('material_request_batches').findOneAndUpdate(
      { _id: new ObjectId(batchId) },
      {
        $set: {
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Batch not found', 404);
    }

    // Cancel all linked material requests (if they're still pending)
    await db.collection('material_requests').updateMany(
      {
        _id: { $in: existingBatch.materialRequestIds },
        status: { $in: ['requested', 'pending_approval'] },
      },
      {
        $set: {
          status: 'cancelled',
          updatedAt: new Date(),
        },
      }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'MATERIAL_REQUEST_BATCH',
      entityId: batchId,
      projectId: existingBatch.projectId.toString(),
      changes: { deleted: result.value },
    });

    return successResponse(null, 'Batch cancelled successfully');
  } catch (error) {
    console.error('Delete batch error:', error);
    return errorResponse('Failed to cancel batch', 500);
  }
}

