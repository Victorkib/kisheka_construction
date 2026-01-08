/**
 * Single Quality Checkpoint API Route
 * GET: Get single quality checkpoint
 * PATCH: Update quality checkpoint (status, inspection results, etc.)
 * DELETE: Delete quality checkpoint
 * 
 * GET /api/phases/[id]/quality-checkpoints/[checkpointId]
 * PATCH /api/phases/[id]/quality-checkpoints/[checkpointId]
 * DELETE /api/phases/[id]/quality-checkpoints/[checkpointId]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateQualityCheckpoint, QUALITY_CHECKPOINT_STATUSES } from '@/lib/quality-checkpoint-helpers';

/**
 * GET /api/phases/[id]/quality-checkpoints/[checkpointId]
 * Returns a single quality checkpoint
 * Auth: All authenticated users
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id, checkpointId } = await params;
    
    if (!ObjectId.isValid(id) || !ObjectId.isValid(checkpointId)) {
      return errorResponse('Invalid phase ID or checkpoint ID', 400);
    }

    const db = await getDatabase();
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    const checkpoint = (phase.qualityCheckpoints || []).find(
      c => c.checkpointId?.toString() === checkpointId
    );

    if (!checkpoint) {
      return errorResponse('Quality checkpoint not found', 404);
    }

    return successResponse(checkpoint, 'Quality checkpoint retrieved successfully');
  } catch (error) {
    console.error('Get quality checkpoint error:', error);
    return errorResponse('Failed to retrieve quality checkpoint', 500);
  }
}

/**
 * PATCH /api/phases/[id]/quality-checkpoints/[checkpointId]
 * Updates a quality checkpoint
 * Auth: PM, OWNER, INSPECTOR only
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

    const userRole = userProfile.role?.toLowerCase();
    const allowedRoles = ['owner', 'pm', 'project_manager', 'inspector', 'quality_control'];
    if (!allowedRoles.includes(userRole)) {
      return errorResponse('Insufficient permissions. Only PM, OWNER, and INSPECTOR can update quality checkpoints.', 403);
    }

    const { id, checkpointId } = await params;
    
    if (!ObjectId.isValid(id) || !ObjectId.isValid(checkpointId)) {
      return errorResponse('Invalid phase ID or checkpoint ID', 400);
    }

    const body = await request.json();
    const {
      name,
      description,
      required,
      status,
      inspectedBy,
      inspectedAt,
      notes,
      photos
    } = body;

    const db = await getDatabase();

    // Get phase
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    const checkpoints = phase.qualityCheckpoints || [];
    const checkpointIndex = checkpoints.findIndex(
      c => c.checkpointId?.toString() === checkpointId
    );

    if (checkpointIndex === -1) {
      return errorResponse('Quality checkpoint not found', 404);
    }

    const existingCheckpoint = checkpoints[checkpointIndex];

    // Validate status if provided
    if (status && !QUALITY_CHECKPOINT_STATUSES.includes(status)) {
      return errorResponse(`Invalid status. Must be one of: ${QUALITY_CHECKPOINT_STATUSES.join(', ')}`, 400);
    }

    // Update checkpoint
    const updatedCheckpoint = {
      ...existingCheckpoint,
      name: name !== undefined ? name.trim() : existingCheckpoint.name,
      description: description !== undefined ? description.trim() : existingCheckpoint.description,
      required: required !== undefined ? required === true : existingCheckpoint.required,
      status: status !== undefined ? status : existingCheckpoint.status,
      inspectedBy: inspectedBy !== undefined ? (inspectedBy && ObjectId.isValid(inspectedBy) ? new ObjectId(inspectedBy) : null) : existingCheckpoint.inspectedBy,
      inspectedAt: inspectedAt !== undefined ? (inspectedAt ? new Date(inspectedAt) : null) : existingCheckpoint.inspectedAt,
      notes: notes !== undefined ? notes.trim() : existingCheckpoint.notes,
      photos: photos !== undefined ? (Array.isArray(photos) ? photos : existingCheckpoint.photos) : existingCheckpoint.photos,
      updatedAt: new Date()
    };

    // If status is being set to passed/failed/waived, ensure inspectedBy and inspectedAt are set
    if (status && ['passed', 'failed', 'waived'].includes(status)) {
      if (!updatedCheckpoint.inspectedBy) {
        updatedCheckpoint.inspectedBy = new ObjectId(userProfile._id);
      }
      if (!updatedCheckpoint.inspectedAt) {
        updatedCheckpoint.inspectedAt = new Date();
      }
    }

    // Update checkpoints array
    checkpoints[checkpointIndex] = updatedCheckpoint;

    // Update phase
    const result = await db.collection('phases').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          qualityCheckpoints: checkpoints,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return errorResponse('Phase not found', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'QUALITY_CHECKPOINT',
      entityId: checkpointId,
      projectId: phase.projectId.toString(),
      changes: { old: existingCheckpoint, new: updatedCheckpoint },
    });

    return successResponse(updatedCheckpoint, 'Quality checkpoint updated successfully');
  } catch (error) {
    console.error('Update quality checkpoint error:', error);
    return errorResponse('Failed to update quality checkpoint', 500);
  }
}

/**
 * DELETE /api/phases/[id]/quality-checkpoints/[checkpointId]
 * Deletes a quality checkpoint
 * Auth: OWNER only
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can delete
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    if (userRole !== 'owner') {
      return errorResponse('Insufficient permissions. Only OWNER can delete quality checkpoints.', 403);
    }

    const { id, checkpointId } = await params;
    
    if (!ObjectId.isValid(id) || !ObjectId.isValid(checkpointId)) {
      return errorResponse('Invalid phase ID or checkpoint ID', 400);
    }

    const db = await getDatabase();

    // Get phase
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    const checkpoints = phase.qualityCheckpoints || [];
    const checkpointIndex = checkpoints.findIndex(
      c => c.checkpointId?.toString() === checkpointId
    );

    if (checkpointIndex === -1) {
      return errorResponse('Quality checkpoint not found', 404);
    }

    const deletedCheckpoint = checkpoints[checkpointIndex];

    // Remove checkpoint from array
    checkpoints.splice(checkpointIndex, 1);

    // Update phase
    const result = await db.collection('phases').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          qualityCheckpoints: checkpoints,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return errorResponse('Phase not found', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'QUALITY_CHECKPOINT',
      entityId: checkpointId,
      projectId: phase.projectId.toString(),
      changes: { deleted: deletedCheckpoint },
    });

    return successResponse(null, 'Quality checkpoint deleted successfully');
  } catch (error) {
    console.error('Delete quality checkpoint error:', error);
    return errorResponse('Failed to delete quality checkpoint', 500);
  }
}


