/**
 * Budget Adjustment Approval API Route
 * POST: Approve or reject a budget adjustment request
 * 
 * POST /api/projects/[id]/budget/adjustment/[adjustmentId]/approve
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
  updateBudgetAdjustmentStatus,
  executeBudgetAdjustment,
  validateBudgetAdjustment,
} from '@/lib/budget-adjustment-helpers';

/**
 * POST /api/projects/[id]/budget/adjustment/[adjustmentId]/approve
 * Approves or rejects a budget adjustment request
 * Auth: OWNER only (budget adjustments require owner approval)
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

    // Check permission - only OWNER can approve budget adjustments
    const canApprove = await hasPermission(user.id, 'approve_budget_adjustment');
    if (!canApprove) {
      // Fallback to role check
      const userRole = userProfile.role?.toLowerCase();
      if (userRole !== 'owner') {
        return errorResponse(
          'Insufficient permissions. Only OWNER can approve budget adjustments.',
          403
        );
      }
    }

    const { id, adjustmentId } = await params;

    if (!ObjectId.isValid(id) || !ObjectId.isValid(adjustmentId)) {
      return errorResponse('Invalid project ID or adjustment ID', 400);
    }

    const body = await request.json();
    const { approved, notes } = body;

    if (typeof approved !== 'boolean') {
      return errorResponse('approved field must be a boolean', 400);
    }

    const db = await getDatabase();

    // Get existing adjustment
    const existingAdjustment = await db.collection('budget_adjustments').findOne({
      _id: new ObjectId(adjustmentId),
      projectId: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingAdjustment) {
      return errorResponse('Budget adjustment not found', 404);
    }

    if (existingAdjustment.status !== 'pending') {
      return errorResponse(
        `Cannot approve/reject budget adjustment with status "${existingAdjustment.status}". Only pending adjustments can be approved/rejected.`,
        400
      );
    }

    // If approving, validate adjustment again (in case budget changed)
    if (approved) {
      const validation = await validateBudgetAdjustment(
        id,
        existingAdjustment.category,
        existingAdjustment.adjustmentAmount,
        existingAdjustment.adjustmentType
      );

      if (!validation.isValid) {
        return errorResponse(
          `Cannot approve budget adjustment: ${validation.message}`,
          400
        );
      }
    }

    // Update adjustment status
    const updatedAdjustment = await updateBudgetAdjustmentStatus(
      adjustmentId,
      approved ? 'approved' : 'rejected',
      userProfile._id.toString(),
      notes
    );

    // If approved, execute the adjustment (update project budget)
    if (approved) {
      try {
        await executeBudgetAdjustment(id, updatedAdjustment);
      } catch (executeError) {
        console.error('Error executing budget adjustment:', executeError);
        // Revert adjustment status if execution fails
        await updateBudgetAdjustmentStatus(
          adjustmentId,
          'pending',
          userProfile._id.toString(),
          `Execution failed: ${executeError.message}. Reverted to pending.`
        );
        return errorResponse(
          `Failed to execute budget adjustment: ${executeError.message}`,
          500
        );
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: approved ? 'APPROVED' : 'REJECTED',
      entityType: 'BUDGET_ADJUSTMENT',
      entityId: adjustmentId,
      projectId: id,
      changes: {
        status: {
          oldValue: existingAdjustment.status,
          newValue: updatedAdjustment.status,
        },
        approvalNotes: notes || (approved ? 'Approved' : 'Rejected'),
      },
    });

    // Notify requester about approval/rejection
    if (existingAdjustment.requestedBy) {
      const project = await db.collection('projects').findOne({
        _id: new ObjectId(id),
      });

      await createNotification({
        userId: existingAdjustment.requestedBy.toString(),
        type: 'budget_adjustment_status',
        title: approved ? 'Budget Adjustment Approved' : 'Budget Adjustment Rejected',
        message: `Your budget adjustment request to ${existingAdjustment.adjustmentType} ${existingAdjustment.category} by ${existingAdjustment.adjustmentAmount.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} has been ${approved ? 'approved' : 'rejected'} by ${userProfile.firstName || userProfile.email}.${notes ? ` Notes: ${notes}` : ''}`,
        projectId: id,
        relatedModel: 'BUDGET_ADJUSTMENT',
        relatedId: adjustmentId,
        createdBy: userProfile._id.toString(),
      });
    }

    return successResponse(
      updatedAdjustment,
      `Budget adjustment ${approved ? 'approved' : 'rejected'} successfully`
    );
  } catch (error) {
    console.error('Approve budget adjustment error:', error);
    return errorResponse('Failed to approve/reject budget adjustment', 500);
  }
}
