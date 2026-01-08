/**
 * Initial Expense Approval API Route
 * POST: Approve or reject an initial expense
 * 
 * POST /api/initial-expenses/[id]/approve
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
import { validateCapitalAvailability, recalculateProjectFinances, updatePreConstructionSpending } from '@/lib/financial-helpers';

/**
 * POST /api/initial-expenses/[id]/approve
 * Approves or rejects an initial expense
 * Auth: PM, OWNER
 * Body: { approved: boolean, notes?: string }
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

    // Check permission
    const canApprove = await hasPermission(user.id, 'approve_initial_expense');
    if (!canApprove) {
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['pm', 'project_manager', 'owner', 'accountant'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse(
          'Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can approve initial expenses.',
          403
        );
      }
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid initial expense ID', 400);
    }

    const body = await request.json();
    const { approved, notes } = body;

    if (typeof approved !== 'boolean') {
      return errorResponse('approved field must be a boolean', 400);
    }

    const db = await getDatabase();
    const existingExpense = await db
      .collection('initial_expenses')
      .findOne({ _id: new ObjectId(id) });

    if (!existingExpense) {
      return errorResponse('Initial expense not found', 404);
    }

    if (existingExpense.status !== 'pending_approval') {
      return errorResponse(
        'Can only approve/reject initial expenses with pending_approval status',
        400
      );
    }

    // Validate capital availability before approval (only if approving)
    if (approved && existingExpense.projectId) {
      const expenseAmount = existingExpense.amount || 0;
      const capitalValidation = await validateCapitalAvailability(
        existingExpense.projectId.toString(),
        expenseAmount
      );

      if (!capitalValidation.isValid) {
        return errorResponse(
          `Cannot approve initial expense: ${capitalValidation.message}. Available capital: ${capitalValidation.available.toLocaleString()}, Required: ${capitalValidation.required.toLocaleString()}`,
          400
        );
      }
    }

    const updateData = {
      status: approved ? 'approved' : 'rejected',
      approvedBy: new ObjectId(userProfile._id),
      approvalNotes: notes?.trim() || (approved ? 'Approved' : 'Rejected'),
      updatedAt: new Date(),
    };

    const result = await db
      .collection('initial_expenses')
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: 'after' }
      );

    await createAuditLog({
      userId: userProfile._id.toString(),
      action: approved ? 'APPROVED' : 'REJECTED',
      entityType: 'INITIAL_EXPENSE',
      entityId: id,
      changes: {
        status: {
          oldValue: existingExpense.status,
          newValue: updateData.status,
        },
        approvalNotes: updateData.approvalNotes,
      },
    });

    // Create notification for submitter
    if (existingExpense.submittedBy?._id) {
      await createNotification({
        userId: existingExpense.submittedBy._id.toString(),
        type: 'approval_status',
        title: approved ? 'Initial Expense Approved' : 'Initial Expense Rejected',
        message: `Your initial expense "${existingExpense.expenseCode || existingExpense.itemName}" has been ${approved ? 'approved' : 'rejected'} by ${userProfile.firstName || userProfile.email}.${!approved && updateData.approvalNotes ? ` Reason: ${updateData.approvalNotes}` : ''}`,
        projectId: existingExpense.projectId?.toString(),
        relatedModel: 'INITIAL_EXPENSE',
        relatedId: id,
        createdBy: userProfile._id.toString(),
      });
    }

    // Auto-recalculate project finances after approval (async, non-blocking)
    // Only if approved (rejections don't affect finances)
    if (approved && existingExpense.projectId) {
      // Charge to pre-construction budget if budgetSource exists
      if (existingExpense.budgetSource && existingExpense.budgetSource.subCategory) {
        updatePreConstructionSpending(
          existingExpense.projectId.toString(),
          existingExpense.budgetSource.subCategory,
          existingExpense.amount || 0
        ).catch((error) => {
          console.error(`❌ Error updating pre-construction spending:`, error);
          // Don't fail the approval if budget update fails
        });
      }
      
      recalculateProjectFinances(existingExpense.projectId.toString())
        .then(() => {
          console.log(`✅ Project finances updated for project ${existingExpense.projectId}`);
        })
        .catch((error) => {
          console.error(`❌ Error updating project finances:`, error);
          // Don't fail the approval if finances update fails
        });
    }

    return successResponse(
      result.value,
      `Initial expense ${approved ? 'approved' : 'rejected'} successfully`
    );
  } catch (error) {
    console.error('Approve initial expense error:', error);
    return errorResponse('Failed to approve/reject initial expense', 500);
  }
}

