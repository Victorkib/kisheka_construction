/**
 * Professional Fee Reject API Route
 * POST /api/professional-fees/[id]/reject
 * Rejects a professional fee
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
 * POST /api/professional-fees/[id]/reject
 * Reject a professional fee
 * Auth: PM, OWNER, ACCOUNTANT
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
    const canReject = await hasPermission(user.id, 'approve_professional_fee'); // Same permission as approve
    if (!canReject) {
      return errorResponse('Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can reject professional fees.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid fee ID', 400);
    }

    const body = await request.json();
    const { rejectionReason } = body || {};

    if (!rejectionReason || rejectionReason.trim().length < 1) {
      return errorResponse('Rejection reason is required', 400);
    }

    const db = await getDatabase();

    // Get existing fee
    const fee = await db.collection('professional_fees').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!fee) {
      return errorResponse('Professional fee not found', 404);
    }

    // Check if status allows rejection
    if (fee.status !== 'PENDING') {
      return errorResponse(`Cannot reject fee with status: ${fee.status}. Fee must be in 'PENDING' status.`, 400);
    }

    // Update fee status
    const previousStatus = fee.status;
    const feeUpdate = {
      status: 'REJECTED',
      approvedBy: new ObjectId(userProfile._id), // Store rejector info
      approvedAt: new Date(),
      approvalNotes: rejectionReason.trim(),
      updatedAt: new Date(),
    };

    // Update approval chain
    const approvalEntry = {
      approverId: new ObjectId(userProfile._id),
      approverName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      status: 'rejected',
      notes: rejectionReason.trim(),
      approvedAt: new Date(),
    };

    feeUpdate.approvalChain = [...(fee.approvalChain || []), approvalEntry];

    const result = await db.collection('professional_fees').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: feeUpdate },
      { returnDocument: 'after' }
    );

    // Update professional service assignment financial statistics
    await db.collection('professional_services').findOneAndUpdate(
      { _id: fee.professionalServiceId },
      {
        $inc: {
          feesPending: -fee.amount,
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    );

    // Create approval record in approvals collection
    await db.collection('approvals').insertOne({
      relatedId: new ObjectId(id),
      relatedModel: 'PROFESSIONAL_FEE',
      action: 'REJECTED',
      approvedBy: new ObjectId(userProfile._id),
      reason: rejectionReason.trim(),
      timestamp: new Date(),
      previousStatus,
      newStatus: 'REJECTED',
      createdAt: new Date(),
    });

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'REJECTED',
      entityType: 'PROFESSIONAL_FEE',
      entityId: id,
      projectId: fee.projectId.toString(),
      changes: {
        status: {
          oldValue: previousStatus,
          newValue: 'REJECTED',
        },
        approvedBy: {
          oldValue: fee.approvedBy,
          newValue: userProfile._id.toString(),
        },
        rejectionReason: rejectionReason.trim(),
      },
    });

    // Create notification for creator
    await createNotification({
      userId: fee.createdBy.toString(),
      type: 'approval_status',
      title: 'Professional Fee Rejected',
      message: `Your professional fee "${fee.feeCode}" (${fee.amount.toLocaleString()} ${fee.currency}) has been rejected. Reason: ${rejectionReason.trim()}`,
      projectId: fee.projectId.toString(),
      relatedModel: 'PROFESSIONAL_FEE',
      relatedId: id,
      createdBy: userProfile._id.toString(),
    });

    return successResponse({
      fee: result.value,
    }, 'Professional fee rejected successfully');
  } catch (error) {
    console.error('Reject professional fee error:', error);
    return errorResponse('Failed to reject professional fee', 500);
  }
}





