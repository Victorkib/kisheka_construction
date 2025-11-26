/**
 * Material Request Reject API Route
 * POST /api/material-requests/[id]/reject
 * Rejects a material request
 * Auth: PM, OWNER
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotification } from '@/lib/notifications';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/material-requests/[id]/reject
 * Reject a material request
 * Auth: PM, OWNER
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canReject = await hasPermission(user.id, 'reject_material_request');
    if (!canReject) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can reject material requests.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid request ID', 400);
    }

    const body = await request.json();
    const { rejectionReason } = body || {};

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return errorResponse('Rejection reason is required', 400);
    }

    const db = await getDatabase();

    // Get existing request
    const materialRequest = await db.collection('material_requests').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!materialRequest) {
      return errorResponse('Material request not found', 404);
    }

    // Check if status allows rejection
    if (materialRequest.status !== 'pending_approval') {
      return errorResponse(`Cannot reject request with status: ${materialRequest.status}`, 400);
    }

    // Update request status
    const updateData = {
      status: 'rejected',
      rejectedBy: new ObjectId(userProfile._id),
      rejectedByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      rejectionDate: new Date(),
      rejectionReason: rejectionReason.trim(),
      updatedAt: new Date(),
    };

    await db.collection('material_requests').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Get updated request
    const updatedRequest = await db.collection('material_requests').findOne({
      _id: new ObjectId(id),
    });

    // Create notification for requester
    await createNotification({
      userId: materialRequest.requestedBy.toString(),
      type: 'approval_status',
      title: 'Material Request Rejected',
      message: `Your request for ${materialRequest.quantityNeeded} ${materialRequest.unit} of ${materialRequest.materialName} has been rejected. Reason: ${rejectionReason.trim()}`,
      projectId: materialRequest.projectId.toString(),
      relatedModel: 'MATERIAL_REQUEST',
      relatedId: id,
      createdBy: userProfile._id.toString(),
    });

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'REJECTED',
      entityType: 'MATERIAL_REQUEST',
      entityId: id,
      projectId: materialRequest.projectId.toString(),
      changes: {
        before: materialRequest,
        after: updatedRequest,
      },
    });

    return successResponse(updatedRequest, 'Material request rejected successfully');
  } catch (error) {
    console.error('Reject material request error:', error);
    return errorResponse('Failed to reject material request', 500);
  }
}

