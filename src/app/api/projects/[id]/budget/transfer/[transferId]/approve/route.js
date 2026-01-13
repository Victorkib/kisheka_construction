/**
 * Budget Transfer Approval API Route
 * POST: Approve or reject a budget transfer request
 * 
 * POST /api/projects/[id]/budget/transfer/[transferId]/approve
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
import {
  updateBudgetTransferStatus,
  executeBudgetTransfer,
  validateBudgetTransfer,
} from '@/lib/budget-transfer-helpers';

/**
 * POST /api/projects/[id]/budget/transfer/[transferId]/approve
 * Approves or rejects a budget transfer request
 * Auth: OWNER only (budget transfers require owner approval)
 */
export async function POST(request, { params }) {
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

    // Check permission - only OWNER can approve budget transfers
    const canApprove = await hasPermission(user.id, 'approve_budget_transfer');
    if (!canApprove) {
      // Fallback to role check
      const userRole = userProfile.role?.toLowerCase();
      if (userRole !== 'owner') {
        return errorResponse(
          'Insufficient permissions. Only OWNER can approve budget transfers.',
          403
        );
      }
    }

    const { id, transferId } = await params;

    if (!ObjectId.isValid(id) || !ObjectId.isValid(transferId)) {
      return errorResponse('Invalid project ID or transfer ID', 400);
    }

    const body = await request.json();
    const { approved, notes } = body;

    if (typeof approved !== 'boolean') {
      return errorResponse('approved field must be a boolean', 400);
    }

    const db = await getDatabase();

    // Get existing transfer
    const existingTransfer = await db.collection('budget_transfers').findOne({
      _id: new ObjectId(transferId),
      projectId: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingTransfer) {
      return errorResponse('Budget transfer not found', 404);
    }

    if (existingTransfer.status !== 'pending') {
      return errorResponse(
        `Cannot approve/reject budget transfer with status "${existingTransfer.status}". Only pending transfers can be approved/rejected.`,
        400
      );
    }

    // If approving, validate transfer again (in case budget changed)
    if (approved) {
      const validation = await validateBudgetTransfer(
        id,
        existingTransfer.fromCategory,
        existingTransfer.toCategory,
        existingTransfer.amount
      );

      if (!validation.isValid) {
        return errorResponse(
          `Cannot approve budget transfer: ${validation.message}`,
          400
        );
      }
    }

    // Update transfer status
    const updatedTransfer = await updateBudgetTransferStatus(
      transferId,
      approved ? 'approved' : 'rejected',
      userProfile._id.toString(),
      notes
    );

    // If approved, execute the transfer (update project budget)
    if (approved) {
      try {
        await executeBudgetTransfer(id, updatedTransfer);
      } catch (executeError) {
        console.error('Error executing budget transfer:', executeError);
        // Revert transfer status if execution fails
        await updateBudgetTransferStatus(
          transferId,
          'pending',
          userProfile._id.toString(),
          `Execution failed: ${executeError.message}. Reverted to pending.`
        );
        return errorResponse(
          `Failed to execute budget transfer: ${executeError.message}`,
          500
        );
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: approved ? 'APPROVED' : 'REJECTED',
      entityType: 'BUDGET_TRANSFER',
      entityId: transferId,
      projectId: id,
      changes: {
        status: {
          oldValue: existingTransfer.status,
          newValue: updatedTransfer.status,
        },
        approvalNotes: notes || (approved ? 'Approved' : 'Rejected'),
      },
    });

    // Notify requester about approval/rejection
    if (existingTransfer.requestedBy) {
      const project = await db.collection('projects').findOne({
        _id: new ObjectId(id),
      });

      await createNotification({
        userId: existingTransfer.requestedBy.toString(),
        type: 'budget_transfer_status',
        title: approved ? 'Budget Transfer Approved' : 'Budget Transfer Rejected',
        message: `Your budget transfer request of ${existingTransfer.amount.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} from ${existingTransfer.fromCategory} to ${existingTransfer.toCategory} has been ${approved ? 'approved' : 'rejected'} by ${userProfile.firstName || userProfile.email}.${notes ? ` Notes: ${notes}` : ''}`,
        projectId: id,
        relatedModel: 'BUDGET_TRANSFER',
        relatedId: transferId,
        createdBy: userProfile._id.toString(),
      });
    }

    return successResponse(
      updatedTransfer,
      `Budget transfer ${approved ? 'approved' : 'rejected'} successfully`
    );
  } catch (error) {
    console.error('Approve budget transfer error:', error);
    return errorResponse('Failed to approve/reject budget transfer', 500);
  }
}
