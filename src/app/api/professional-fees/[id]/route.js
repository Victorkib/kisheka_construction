/**
 * Professional Fees API Route (by ID)
 * GET: Get single professional fee
 * PATCH: Update professional fee
 * DELETE: Delete professional fee (soft delete)
 * 
 * GET /api/professional-fees/[id]
 * PATCH /api/professional-fees/[id]
 * DELETE /api/professional-fees/[id]
 * Auth: All authenticated users (GET), OWNER/PM/ACCOUNTANT (PATCH), OWNER only (DELETE)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  validateProfessionalFee,
} from '@/lib/schemas/professional-fees-schema';
import {
  FEE_STATUSES,
  FEE_TYPES,
  PAYMENT_METHODS,
  CURRENCIES,
} from '@/lib/constants/professional-fees-constants';

/**
 * GET /api/professional-fees/[id]
 * Get single professional fee by ID
 * Auth: All authenticated users
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid professional fee ID', 400);
    }

    const db = await getDatabase();
    const fee = await db.collection('professional_fees').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!fee) {
      return errorResponse('Professional fee not found', 404);
    }

    // Populate related data
    const professionalService = await db.collection('professional_services').findOne({
      _id: fee.professionalServiceId,
    });

    const library = professionalService?.libraryId
      ? await db.collection('professional_services_library').findOne({
          _id: professionalService.libraryId,
        })
      : null;

    const project = await db.collection('projects').findOne({
      _id: fee.projectId,
    });

    const phase = fee.phaseId
      ? await db.collection('phases').findOne({
          _id: fee.phaseId,
        })
      : null;

    const activity = fee.activityId
      ? await db.collection('professional_activities').findOne({
          _id: fee.activityId,
        })
      : null;

    const expense = fee.expenseId
      ? await db.collection('expenses').findOne({
          _id: fee.expenseId,
        })
      : null;

    return successResponse({
      ...fee,
      professionalService: professionalService
        ? {
            _id: professionalService._id.toString(),
            professionalCode: professionalService.professionalCode,
            type: professionalService.type,
          }
        : null,
      library: library
        ? {
            _id: library._id.toString(),
            name: library.name,
            type: library.type,
          }
        : null,
      project: project
        ? {
            _id: project._id.toString(),
            projectCode: project.projectCode,
            projectName: project.projectName,
          }
        : null,
      phase: phase
        ? {
            _id: phase._id.toString(),
            phaseName: phase.phaseName,
            phaseCode: phase.phaseCode,
          }
        : null,
      activity: activity
        ? {
            _id: activity._id.toString(),
            activityCode: activity.activityCode,
            activityType: activity.activityType,
          }
        : null,
      expense: expense
        ? {
            _id: expense._id.toString(),
            expenseCode: expense.expenseCode,
            amount: expense.amount,
            status: expense.status,
          }
        : null,
    });
  } catch (error) {
    console.error('Get professional fee error:', error);
    return errorResponse('Failed to retrieve professional fee', 500);
  }
}

/**
 * PATCH /api/professional-fees/[id]
 * Update professional fee
 * Auth: OWNER/PM/ACCOUNTANT
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canEdit = await hasPermission(user.id, 'edit_professional_fee');
    if (!canEdit) {
      return errorResponse('Insufficient permissions. Only OWNER, PM, and ACCOUNTANT can edit professional fees.', 403);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid professional fee ID', 400);
    }

    const body = await request.json();
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();

    // Get existing fee
    const existing = await db.collection('professional_fees').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existing) {
      return errorResponse('Professional fee not found', 404);
    }

    // Cannot edit if already paid (unless OWNER)
    const userRole = userProfile.role?.toLowerCase();
    const isOwner = userRole === 'owner';
    if (existing.status === 'PAID' && !isOwner) {
      return errorResponse('Cannot edit paid fee. Only OWNER can edit paid fees.', 403);
    }

    // Get professional service for validation
    const professionalService = await db.collection('professional_services').findOne({
      _id: existing.professionalServiceId,
    });

    if (!professionalService) {
      return errorResponse('Professional service assignment not found', 404);
    }

    // Build update data
    const updateData = {
      updatedAt: new Date(),
    };

    const changes = {};
    let amountChanged = false;
    const oldAmount = existing.amount;

    // Update fee type
    if (body.feeType !== undefined) {
      if (!FEE_TYPES.ALL.includes(body.feeType)) {
        return errorResponse(`Fee type must be one of: ${FEE_TYPES.ALL.join(', ')}`, 400);
      }
      updateData.feeType = body.feeType;
      changes.feeType = { oldValue: existing.feeType, newValue: body.feeType };
    }

    // Update amount
    if (body.amount !== undefined) {
      const amount = parseFloat(body.amount);
      if (isNaN(amount) || amount <= 0) {
        return errorResponse('Amount must be greater than 0', 400);
      }
      
      // Validate contract value - check if new total fees would exceed contract value
      const contractValue = professionalService.contractValue || 0;
      if (contractValue > 0) {
        const currentTotalFees = professionalService.totalFees || 0;
        const oldFeeAmount = existing.amount || 0;
        // Calculate new total: current total - old fee amount + new fee amount
        const newTotalFees = currentTotalFees - oldFeeAmount + amount;
        
        if (newTotalFees > contractValue) {
          return errorResponse(
            `Fee amount would exceed contract value. Contract: ${contractValue.toLocaleString()} ${existing.currency || 'KES'}, Current total fees: ${currentTotalFees.toLocaleString()} ${existing.currency || 'KES'}, New fee amount: ${amount.toLocaleString()} ${existing.currency || 'KES'}, New total would be: ${newTotalFees.toLocaleString()} ${existing.currency || 'KES'}`,
            400
          );
        }
        
        // Warn if approaching contract limit (90% utilization)
        const contractUtilization = (newTotalFees / contractValue) * 100;
        if (contractUtilization > 90) {
          console.warn(
            `⚠️ Contract utilization at ${contractUtilization.toFixed(1)}% for assignment ${professionalService.professionalCode} (Contract: ${contractValue.toLocaleString()}, New Total Fees: ${newTotalFees.toLocaleString()})`
          );
        }
      }
      
      updateData.amount = amount;
      amountChanged = true;
      changes.amount = { oldValue: existing.amount, newValue: amount };
    }

    // Update description
    if (body.description !== undefined) {
      updateData.description = body.description || null;
      changes.description = { oldValue: existing.description, newValue: updateData.description };
    }

    // Update currency
    if (body.currency !== undefined) {
      if (!CURRENCIES.includes(body.currency)) {
        return errorResponse(`Currency must be one of: ${CURRENCIES.join(', ')}`, 400);
      }
      updateData.currency = body.currency;
      changes.currency = { oldValue: existing.currency, newValue: body.currency };
    }

    // Update invoice fields
    if (body.invoiceNumber !== undefined) {
      updateData.invoiceNumber = body.invoiceNumber || null;
      changes.invoiceNumber = { oldValue: existing.invoiceNumber, newValue: updateData.invoiceNumber };
    }

    if (body.invoiceDate !== undefined) {
      updateData.invoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : null;
      changes.invoiceDate = { oldValue: existing.invoiceDate, newValue: updateData.invoiceDate };
    }

    if (body.invoiceUrl !== undefined) {
      updateData.invoiceUrl = body.invoiceUrl || null;
      changes.invoiceUrl = { oldValue: existing.invoiceUrl, newValue: updateData.invoiceUrl };
    }

    if (body.dueDate !== undefined) {
      updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      changes.dueDate = { oldValue: existing.dueDate, newValue: updateData.dueDate };
    }

    // Validate dates
    if (updateData.invoiceDate && updateData.dueDate) {
      if (updateData.dueDate < updateData.invoiceDate) {
        return errorResponse('Due date must be after or equal to invoice date', 400);
      }
    }

    // Update payment method
    if (body.paymentMethod !== undefined) {
      if (body.paymentMethod && !PAYMENT_METHODS.includes(body.paymentMethod)) {
        return errorResponse(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`, 400);
      }
      updateData.paymentMethod = body.paymentMethod || null;
      changes.paymentMethod = { oldValue: existing.paymentMethod, newValue: updateData.paymentMethod };
    }

    // Update reference number
    if (body.referenceNumber !== undefined) {
      updateData.referenceNumber = body.referenceNumber || null;
      changes.referenceNumber = { oldValue: existing.referenceNumber, newValue: updateData.referenceNumber };
    }

    // Update receipt URL
    if (body.receiptUrl !== undefined) {
      updateData.receiptUrl = body.receiptUrl || null;
      changes.receiptUrl = { oldValue: existing.receiptUrl, newValue: updateData.receiptUrl };
    }

    // Cannot update: professionalServiceId, projectId, feeCode, createdBy, status (use approve/reject endpoints), expenseId (auto-set)

    // Update
    const result = await db.collection('professional_fees').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Professional fee not found', 404);
    }

    // Update professional service assignment financial statistics if amount changed
    if (amountChanged) {
      const amountDiff = updateData.amount - oldAmount;
      const updatedAssignment = await db.collection('professional_services').findOneAndUpdate(
        { _id: existing.professionalServiceId },
        {
          $inc: {
            totalFees: amountDiff,
            feesPending: existing.status === 'PENDING' ? amountDiff : 0,
            feesPaid: existing.status === 'PAID' ? amountDiff : 0,
          },
          $set: {
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      // Update committed cost: when fee amount changes, remaining commitment changes
      // Only update if assignment is active (counts as commitment)
      if (professionalService.status === 'active' && professionalService.contractValue > 0) {
        try {
          const { updateCommittedCost } = await import('@/lib/financial-helpers');
          // If amount increased, remaining commitment decreases (subtract)
          // If amount decreased, remaining commitment increases (add)
          if (amountDiff > 0) {
            await updateCommittedCost(
              existing.projectId.toString(),
              amountDiff,
              'subtract'
            );
          } else if (amountDiff < 0) {
            await updateCommittedCost(
              existing.projectId.toString(),
              Math.abs(amountDiff),
              'add'
            );
          }
        } catch (financialError) {
          console.error('Error updating committed cost after fee amount update:', financialError);
          // Don't fail the request, just log the error
        }
      }
    }

    // Create audit log
    if (Object.keys(changes).length > 0) {
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'UPDATED',
        entityType: 'PROFESSIONAL_FEE',
        entityId: id,
        projectId: existing.projectId.toString(),
        changes,
      });
    }

    return successResponse(result.value, 'Professional fee updated successfully');
  } catch (error) {
    console.error('Update professional fee error:', error);
    return errorResponse('Failed to update professional fee', 500);
  }
}

/**
 * DELETE /api/professional-fees/[id]
 * Delete professional fee (soft delete)
 * Auth: OWNER only
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - OWNER only
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    if (userRole !== 'owner') {
      return errorResponse('Insufficient permissions. Only OWNER can delete professional fees.', 403);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid professional fee ID', 400);
    }

    const db = await getDatabase();

    // Check if fee exists
    const existing = await db.collection('professional_fees').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existing) {
      return errorResponse('Professional fee not found', 404);
    }

    // Check if linked to approved expense
    if (existing.expenseId) {
      const expense = await db.collection('expenses').findOne({
        _id: existing.expenseId,
        status: { $in: ['APPROVED', 'PAID'] },
      });
      if (expense) {
        return errorResponse('Cannot delete fee linked to approved or paid expense. Please handle the expense first.', 400);
      }
    }

    // Soft delete
    const result = await db.collection('professional_fees').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          deletedAt: new Date(),
          updatedAt: new Date(),
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Professional fee not found', 404);
    }

    // Update professional service assignment financial statistics
    await db.collection('professional_services').findOneAndUpdate(
      { _id: existing.professionalServiceId },
      {
        $inc: {
          totalFees: -existing.amount,
          feesPending: existing.status === 'PENDING' ? -existing.amount : 0,
          feesPaid: existing.status === 'PAID' ? -existing.amount : 0,
        },
        $set: {
          updatedAt: new Date(),
        },
      }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'PROFESSIONAL_FEE',
      entityId: id,
      projectId: existing.projectId.toString(),
      changes: { deleted: result.value },
    });

    return successResponse(null, 'Professional fee deleted successfully');
  } catch (error) {
    console.error('Delete professional fee error:', error);
    return errorResponse('Failed to delete professional fee', 500);
  }
}

