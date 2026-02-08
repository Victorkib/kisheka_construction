/**
 * Expense Rejection API Route
 * POST: Reject an expense submission
 * 
 * POST /api/expenses/[id]/reject
 * Auth: PM, OWNER, ACCOUNTANT
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
 * POST /api/expenses/[id]/reject
 * Rejects an expense submission
 * Creates rejection record and updates expense status
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
    const hasRejectPermission = await hasPermission(user.id, 'reject_expense');
    if (!hasRejectPermission) {
      return errorResponse('Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can reject expenses.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid expense ID', 400);
    }

    const body = await request.json();
    const { reason, notes, rejectionReason } = body;

    // Require rejection reason
    const rejectionReasonText = reason || rejectionReason || notes;
    if (!rejectionReasonText || rejectionReasonText.trim().length === 0) {
      return errorResponse('Rejection reason is required', 400);
    }

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);

    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Get existing expense
    const existingExpense = await db.collection('expenses').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingExpense) {
      return errorResponse('Expense not found', 404);
    }

    // Check if expense can be rejected
    const rejectableStatuses = ['PENDING', 'APPROVED'];
    if (!rejectableStatuses.includes(existingExpense.status)) {
      return errorResponse(
        `Cannot reject expense with status "${existingExpense.status}". Expense must be PENDING or APPROVED.`,
        400
      );
    }

    // Create rejection entry
    const rejectionEntry = {
      approverId: new ObjectId(userProfile._id),
      approverName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      status: 'rejected',
      notes: rejectionReasonText.trim(),
      approvedAt: new Date(),
    };

    // Update expense
    const previousStatus = existingExpense.status;
    const result = await db.collection('expenses').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $push: { approvalChain: rejectionEntry },
        $set: {
          status: 'REJECTED',
          approvedBy: new ObjectId(userProfile._id),
          approvalNotes: rejectionReasonText.trim(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    // Create approval record in approvals collection
    await db.collection('approvals').insertOne({
      relatedId: new ObjectId(id),
      relatedModel: 'EXPENSE',
      action: 'REJECTED',
      approvedBy: new ObjectId(userProfile._id),
      reason: rejectionReasonText.trim(),
      timestamp: new Date(),
      previousStatus,
      newStatus: 'REJECTED',
      createdAt: new Date(),
    });

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'REJECTED',
      entityType: 'EXPENSE',
      entityId: id,
      projectId: existingExpense.projectId?.toString(),
      changes: {
        status: {
          oldValue: previousStatus,
          newValue: 'REJECTED',
        },
        rejectionReason: {
          oldValue: null,
          newValue: rejectionReasonText.trim(),
        },
      },
    });

    // Create notification for submitter
    if (existingExpense.submittedBy?._id) {
      await createNotification({
        userId: existingExpense.submittedBy._id.toString(),
        type: 'approval_status',
        title: 'Expense Rejected',
        message: `Your expense "${existingExpense.expenseCode || existingExpense.description}" has been rejected. Reason: ${rejectionReasonText.trim()}`,
        projectId: existingExpense.projectId?.toString(),
        relatedModel: 'EXPENSE',
        relatedId: id,
        createdBy: userProfile._id.toString(),
      });
    }

    return successResponse(
      {
        expense: result.value,
        rejection: rejectionEntry,
      },
      'Expense rejected successfully'
    );
  } catch (error) {
    console.error('Reject expense error:', error);
    return errorResponse('Failed to reject expense', 500);
  }
}

