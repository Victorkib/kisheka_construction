/**
 * Bulk Material Request Batch Rejection API Route
 * POST /api/material-requests/bulk/[batchId]/reject
 * Bulk reject material requests in a batch
 * Auth: PM, OWNER, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotifications } from '@/lib/notifications';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getBatchWithRequests, updateBatchStatus } from '@/lib/helpers/batch-helpers';

/**
 * POST /api/material-requests/bulk/[batchId]/reject
 * Bulk reject material requests in a batch
 * Auth: PM, OWNER, ACCOUNTANT
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canApprove = await hasPermission(user.id, 'bulk_approve_material_requests');
    if (!canApprove) {
      return errorResponse(
        'Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can reject bulk material requests.',
        403
      );
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { batchId } = await params;
    if (!batchId || !ObjectId.isValid(batchId)) {
      return errorResponse('Invalid batch ID', 400);
    }

    const body = await request.json();
    const { rejectionReason, rejectAll = true, materialRequestIds = [] } = body || {};

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return errorResponse('Rejection reason is required', 400);
    }

    const db = await getDatabase();

    // Get batch with requests
    const batch = await getBatchWithRequests(batchId);

    if (!batch) {
      return errorResponse('Batch not found', 404);
    }

    // Check if batch status allows rejection
    if (!['draft', 'submitted', 'pending_approval'].includes(batch.status)) {
      return errorResponse(
        `Cannot reject batch with status: ${batch.status}. Batch must be in draft, submitted, or pending_approval status.`,
        400
      );
    }

    // Determine which requests to reject
    let requestsToReject = [];
    if (rejectAll) {
      // Get all pending requests in batch
      requestsToReject = batch.materialRequests.filter(
        (req) => ['requested', 'pending_approval'].includes(req.status)
      );
    } else {
      // Validate that provided request IDs belong to batch
      const providedIds = materialRequestIds.map((id) => new ObjectId(id));
      requestsToReject = batch.materialRequests.filter(
        (req) =>
          providedIds.some((id) => id.equals(req._id)) &&
          ['requested', 'pending_approval'].includes(req.status)
      );

      if (requestsToReject.length !== materialRequestIds.length) {
        return errorResponse(
          'Some request IDs are invalid or do not belong to this batch',
          400
        );
      }
    }

    if (requestsToReject.length === 0) {
      return errorResponse('No rejectable requests found in batch', 400);
    }

    // Reject each request
    const rejectedIds = [];
    const failedRejections = [];

    for (const request of requestsToReject) {
      try {
        // Update request status
        await db.collection('material_requests').updateOne(
          { _id: request._id },
          {
            $set: {
              status: 'rejected',
              approvedBy: new ObjectId(userProfile._id),
              approvedByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
              approvalDate: new Date(),
              rejectionReason: rejectionReason.trim(),
              updatedAt: new Date(),
            },
          }
        );

        rejectedIds.push(request._id.toString());

        // Create audit log for each request
        await createAuditLog({
          userId: userProfile._id.toString(),
          action: 'REJECTED',
          entityType: 'MATERIAL_REQUEST',
          entityId: request._id.toString(),
          projectId: request.projectId.toString(),
          changes: {
            batchRejection: true,
            batchId: batchId,
            rejectionReason: rejectionReason.trim(),
          },
        });
      } catch (error) {
        console.error(`Error rejecting request ${request._id}:`, error);
        failedRejections.push({
          requestId: request._id.toString(),
          reason: error.message || 'Unknown error',
        });
      }
    }

    // Determine new batch status
    const allRequests = batch.materialRequests;
    const rejectedCount = allRequests.filter((req) => req.status === 'rejected' || rejectedIds.includes(req._id.toString())).length;
    const approvedCount = allRequests.filter((req) => req.status === 'approved').length;
    
    let newBatchStatus = 'pending_approval';
    if (rejectedCount === allRequests.length) {
      newBatchStatus = 'cancelled'; // All rejected
    } else if (approvedCount === allRequests.length) {
      newBatchStatus = 'approved'; // All approved (shouldn't happen if we're rejecting)
    } else if (approvedCount > 0) {
      newBatchStatus = 'pending_approval'; // Mixed status
    }

    // Update batch status
    await updateBatchStatus(
      batchId,
      newBatchStatus,
      userProfile,
      {
        approvalNotes: `Bulk rejection: ${rejectionReason.trim()}`,
      }
    );

    // Create notifications for requesters
    const requesterIds = new Set(requestsToReject.map((req) => req.requestedBy.toString()));
    const notifications = Array.from(requesterIds).map((requesterId) => ({
      userId: requesterId,
      type: 'approval_status',
      title: 'Bulk Material Request Rejected',
      message: `${rejectedIds.length} material request(s) in batch ${batch.batchNumber} have been rejected. Reason: ${rejectionReason.trim()}`,
      projectId: batch.projectId.toString(),
      relatedModel: 'MATERIAL_REQUEST_BATCH',
      relatedId: batchId,
      createdBy: userProfile._id.toString(),
    }));

    await createNotifications(notifications);

    // Create audit log for batch
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'REJECTED',
      entityType: 'MATERIAL_REQUEST_BATCH',
      entityId: batchId,
      projectId: batch.projectId.toString(),
      changes: {
        rejectedRequests: rejectedIds.length,
        totalRequests: requestsToReject.length,
        rejectionReason: rejectionReason.trim(),
      },
    });

    return successResponse(
      {
        batchId,
        batchNumber: batch.batchNumber,
        rejectedCount: rejectedIds.length,
        totalCount: requestsToReject.length,
        failedCount: failedRejections.length,
        failedRejections: failedRejections.length > 0 ? failedRejections : undefined,
        newBatchStatus,
      },
      `Successfully rejected ${rejectedIds.length} of ${requestsToReject.length} request(s)`
    );
  } catch (error) {
    console.error('Bulk reject error:', error);
    return errorResponse('Failed to reject bulk material requests', 500);
  }
}

