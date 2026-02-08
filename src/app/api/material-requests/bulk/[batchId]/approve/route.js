/**
 * Bulk Material Request Batch Approval API Route
 * POST /api/material-requests/bulk/[batchId]/approve
 * Bulk approve material requests in a batch
 * Auth: PM, OWNER, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotifications } from '@/lib/notifications';
import { validateCapitalAvailability, recalculateProjectFinances } from '@/lib/financial-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getBatchWithRequests, updateBatchStatus } from '@/lib/helpers/batch-helpers';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';

/**
 * POST /api/material-requests/bulk/[batchId]/approve
 * Bulk approve material requests in a batch
 * Auth: PM, OWNER, ACCOUNTANT
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

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
        'Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can approve bulk material requests.',
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
    const { approvalNotes, approveAll = true, materialRequestIds = [] } = body || {};

    const db = await getDatabase();

    // Get batch with requests
    const batch = await getBatchWithRequests(batchId);

    if (!batch) {
      return errorResponse('Batch not found', 404);
    }

    // Check if batch status allows approval
    if (!['draft', 'submitted', 'pending_approval'].includes(batch.status)) {
      return errorResponse(
        `Cannot approve batch with status: ${batch.status}. Batch must be in draft, submitted, or pending_approval status.`,
        400
      );
    }

    // Determine which requests to approve
    let requestsToApprove = [];
    if (approveAll) {
      // Get all pending requests in batch
      requestsToApprove = batch.materialRequests.filter(
        (req) => ['requested', 'pending_approval'].includes(req.status)
      );
    } else {
      // Validate that provided request IDs belong to batch
      const providedIds = materialRequestIds.map((id) => new ObjectId(id));
      requestsToApprove = batch.materialRequests.filter(
        (req) =>
          providedIds.some((id) => id.equals(req._id)) &&
          ['requested', 'pending_approval'].includes(req.status)
      );

      if (requestsToApprove.length !== materialRequestIds.length) {
        return errorResponse(
          'Some request IDs are invalid or do not belong to this batch',
          400
        );
      }
    }

    if (requestsToApprove.length === 0) {
      return errorResponse('No approvable requests found in batch', 400);
    }

    // Pre-validate financial constraints (before transaction)
    const financialWarnings = [];
    const totalCost = requestsToApprove.reduce((sum, req) => sum + (req.estimatedCost || 0), 0);
    
    // Check aggregate capital availability - BLOCK if exceeds capital
    if (totalCost > 0) {
      const aggregateCapitalCheck = await validateCapitalAvailability(
        batch.projectId.toString(),
        totalCost
      );
      
      if (!aggregateCapitalCheck.isValid) {
        return errorResponse(
          `Cannot approve requests: Total cost (${totalCost.toLocaleString()} KES) exceeds available capital (${aggregateCapitalCheck.available.toLocaleString()} KES). Shortfall: ${(totalCost - aggregateCapitalCheck.available).toLocaleString()} KES.`,
          400
        );
      }
    }

    // Collect financial warnings for individual requests (for reporting)
    for (const request of requestsToApprove) {
      if (request.estimatedCost && request.estimatedCost > 0) {
        const capitalCheck = await validateCapitalAvailability(
          request.projectId.toString(),
          request.estimatedCost
        );

        if (!capitalCheck.isValid) {
          financialWarnings.push({
            requestId: request._id.toString(),
            message: `Estimated cost (${request.estimatedCost.toLocaleString()}) exceeds available capital (${capitalCheck.available.toLocaleString()})`,
            available: capitalCheck.available,
            required: request.estimatedCost,
            shortfall: request.estimatedCost - capitalCheck.available,
          });
        }
      }
    }

    console.log('[POST /api/material-requests/bulk/[batchId]/approve] Starting transaction for atomic approval');

    // Wrap all approval operations in transaction for atomicity
    const approvalResult = await withTransaction(async ({ db: transactionDb, session }) => {
      const approvedIds = [];
      const requestFinancialWarnings = [];

      // Approve each request (atomic)
      for (const request of requestsToApprove) {
        // Find matching financial warning
        const financialWarning = financialWarnings.find(w => w.requestId === request._id.toString());

        // Update request status (atomic)
        await transactionDb.collection('material_requests').updateOne(
          { _id: request._id },
          {
            $set: {
              status: 'approved',
              approvedBy: new ObjectId(userProfile._id),
              approvedByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
              approvalDate: new Date(),
              updatedAt: new Date(),
              ...(approvalNotes && { approvalNotes: approvalNotes.trim() }),
            },
          },
          { session }
        );

        approvedIds.push(request._id.toString());
        if (financialWarning) {
          requestFinancialWarnings.push(financialWarning);
        }
      }

      // Determine new batch status (accounting for rejected/cancelled requests)
      const allRequests = batch.materialRequests;
      const rejectedCount = allRequests.filter((req) => req.status === 'rejected').length;
      const cancelledCount = allRequests.filter((req) => req.status === 'cancelled').length;
      const approvedCount = allRequests.filter((req) => 
        req.status === 'approved' || approvedIds.includes(req._id.toString())
      ).length;
      
      // Batch is approved when: approvedCount === (totalRequests - rejectedCount - cancelledCount)
      const approvableCount = allRequests.length - rejectedCount - cancelledCount;
      const newBatchStatus = approvedCount === approvableCount && approvableCount > 0 
        ? 'approved' 
        : 'pending_approval';

      // Update batch status (atomic)
      await transactionDb.collection('material_request_batches').updateOne(
        { _id: new ObjectId(batchId) },
        {
          $set: {
            status: newBatchStatus,
            approvedBy: new ObjectId(userProfile._id),
            approvedAt: new Date(),
            approvalNotes: approvalNotes?.trim() || null,
            updatedAt: new Date(),
          },
        },
        { session }
      );

      return {
        approvedIds,
        newBatchStatus,
        requestFinancialWarnings,
      };
    });

    console.log('[POST /api/material-requests/bulk/[batchId]/approve] Transaction completed successfully');

    const { approvedIds, newBatchStatus, requestFinancialWarnings } = approvalResult;

    // Create audit logs (idempotent, can happen outside transaction)
    for (const request of requestsToApprove) {
      const financialWarning = requestFinancialWarnings.find(w => w.requestId === request._id.toString());
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'APPROVED',
        entityType: 'MATERIAL_REQUEST',
        entityId: request._id.toString(),
        projectId: request.projectId.toString(),
        changes: {
          batchApproval: true,
          batchId: batchId,
          financialWarning,
        },
      });
    }

    // Trigger financial recalculation for project
    if (batch.projectId) {
      await recalculateProjectFinances(batch.projectId.toString());
    }

    // Create notifications for requesters
    const requesterIds = new Set(requestsToApprove.map((req) => req.requestedBy.toString()));
    const isFullyApproved = newBatchStatus === 'approved';
    const notifications = Array.from(requesterIds).map((requesterId) => ({
      userId: requesterId,
      type: 'approval_status',
      title: isFullyApproved 
        ? 'Batch Fully Approved - Ready for Supplier Assignment'
        : 'Bulk Material Request Partially Approved',
      message: isFullyApproved
        ? `Your bulk material request batch ${batch.batchNumber} has been fully approved. All ${approvedIds.length} material request(s) are ready for supplier assignment.`
        : `${approvedIds.length} material request(s) in batch ${batch.batchNumber} have been approved${financialWarnings.length > 0 ? ' (some with financial warnings)' : ''}.`,
      projectId: batch.projectId.toString(),
      relatedModel: 'MATERIAL_REQUEST_BATCH',
      relatedId: batchId,
      createdBy: userProfile._id.toString(),
    }));

    await createNotifications(notifications);

    // Create audit log for batch
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'APPROVED',
      entityType: 'MATERIAL_REQUEST_BATCH',
      entityId: batchId,
      projectId: batch.projectId.toString(),
      changes: {
        approvedRequests: approvedIds.length,
        totalRequests: requestsToApprove.length,
        financialWarnings: financialWarnings.length,
      },
    });

    return successResponse(
      {
        batchId,
        batchNumber: batch.batchNumber,
        approvedCount: approvedIds.length,
        totalCount: requestsToApprove.length,
        financialWarnings: requestFinancialWarnings.length > 0 ? requestFinancialWarnings : undefined,
        newBatchStatus,
        batchFullyApproved: newBatchStatus === 'approved',
        redirectToSupplierAssignment: newBatchStatus === 'approved',
      },
      `Successfully approved ${approvedIds.length} of ${requestsToApprove.length} request(s)${newBatchStatus === 'approved' ? '. Batch is ready for supplier assignment.' : ''}`
    );
  } catch (error) {
    console.error('Bulk approve error:', error);
    return errorResponse('Failed to approve bulk material requests', 500);
  }
}

