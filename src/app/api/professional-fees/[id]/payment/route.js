/**
 * Professional Fee Payment API Route
 * PUT /api/professional-fees/[id]/payment
 * Records payment for a professional fee
 * Auth: PM, OWNER, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotification } from '@/lib/notifications';
import { recalculateProjectFinances } from '@/lib/financial-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { PAYMENT_METHODS } from '@/lib/constants/professional-fees-constants';

/**
 * PUT /api/professional-fees/[id]/payment
 * Record payment for a professional fee
 * Auth: PM, OWNER, ACCOUNTANT
 */
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canRecordPayment = await hasPermission(user.id, 'record_professional_fee_payment');
    if (!canRecordPayment) {
      return errorResponse('Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can record payments.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid fee ID', 400);
    }

    const body = await request.json();
    const {
      paymentMethod,
      paymentDate,
      referenceNumber,
      receiptUrl,
    } = body;

    // Validation
    if (!paymentMethod || !PAYMENT_METHODS.includes(paymentMethod)) {
      return errorResponse(`Payment method is required and must be one of: ${PAYMENT_METHODS.join(', ')}`, 400);
    }

    if (!paymentDate) {
      return errorResponse('Payment date is required', 400);
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

    // Check if fee is approved
    if (fee.status !== 'APPROVED') {
      return errorResponse(`Cannot record payment for fee with status: ${fee.status}. Fee must be approved first.`, 400);
    }

    // Check if already paid
    if (fee.status === 'PAID') {
      return errorResponse('Fee is already marked as paid', 400);
    }

    // Update fee status to PAID
    const previousStatus = fee.status;
    const feeUpdate = {
      status: 'PAID',
      paymentMethod: paymentMethod,
      paymentDate: new Date(paymentDate),
      referenceNumber: referenceNumber?.trim() || null,
      receiptUrl: receiptUrl || null,
      updatedAt: new Date(),
    };

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
          feesPaid: fee.amount,
          feesPending: -fee.amount,
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    );

    // Update linked expense if exists
    if (fee.expenseId) {
      await db.collection('expenses').findOneAndUpdate(
        { _id: fee.expenseId },
        {
          $set: {
            status: 'PAID',
            paymentMethod: paymentMethod,
            date: new Date(paymentDate),
            referenceNumber: referenceNumber?.trim() || null,
            receiptFileUrl: receiptUrl || null,
            updatedAt: new Date(),
          },
        }
      );
    }

    // Update linked activity if exists
    if (fee.activityId) {
      await db.collection('professional_activities').findOneAndUpdate(
        { _id: fee.activityId },
        {
          $set: {
            paymentStatus: 'paid',
            updatedAt: new Date(),
          },
        }
      );
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'PAYMENT_RECORDED',
      entityType: 'PROFESSIONAL_FEE',
      entityId: id,
      projectId: fee.projectId.toString(),
      changes: {
        status: {
          oldValue: previousStatus,
          newValue: 'PAID',
        },
        paymentMethod: {
          oldValue: fee.paymentMethod,
          newValue: paymentMethod,
        },
        paymentDate: {
          oldValue: fee.paymentDate,
          newValue: new Date(paymentDate),
        },
        referenceNumber: {
          oldValue: fee.referenceNumber,
          newValue: referenceNumber?.trim() || null,
        },
      },
    });

    // Create notification for creator
    await createNotification({
      userId: fee.createdBy.toString(),
      type: 'payment_status',
      title: 'Professional Fee Payment Recorded',
      message: `Payment for professional fee "${fee.feeCode}" (${fee.amount.toLocaleString()} ${fee.currency}) has been recorded. Payment method: ${paymentMethod}`,
      projectId: fee.projectId.toString(),
      relatedModel: 'PROFESSIONAL_FEE',
      relatedId: id,
      createdBy: userProfile._id.toString(),
    });

    // Recalculate project finances (async, non-blocking)
    recalculateProjectFinances(fee.projectId.toString())
      .then(() => {
        console.log(`✅ Project finances updated for project ${fee.projectId}`);
      })
      .catch((error) => {
        console.error(`❌ Error updating project finances:`, error);
      });

    return successResponse({
      fee: result.value,
    }, 'Payment recorded successfully');
  } catch (error) {
    console.error('Record payment error:', error);
    return errorResponse('Failed to record payment', 500);
  }
}

