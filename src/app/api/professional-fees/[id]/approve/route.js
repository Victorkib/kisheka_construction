/**
 * Professional Fee Approve API Route
 * POST /api/professional-fees/[id]/approve
 * Approves a professional fee and automatically creates an expense record
 * Auth: PM, OWNER, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotification } from '@/lib/notifications';
import { validateCapitalAvailability, recalculateProjectFinances } from '@/lib/financial-helpers';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/professional-fees/[id]/approve
 * Approve a professional fee
 * Automatically creates an expense record when approved
 * Auth: PM, OWNER, ACCOUNTANT
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canApprove = await hasPermission(user.id, 'approve_professional_fee');
    if (!canApprove) {
      return errorResponse('Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can approve professional fees.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid fee ID', 400);
    }

    const body = await request.json();
    const { approvalNotes } = body || {};

    const db = await getDatabase();

    // Get existing fee
    const fee = await db.collection('professional_fees').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!fee) {
      return errorResponse('Professional fee not found', 404);
    }

    // Check if status allows approval
    if (fee.status !== 'PENDING') {
      return errorResponse(`Cannot approve fee with status: ${fee.status}. Fee must be in 'PENDING' status.`, 400);
    }

    // Get professional service and library for expense creation
    const professionalService = await db.collection('professional_services').findOne({
      _id: fee.professionalServiceId,
    });

    if (!professionalService) {
      return errorResponse('Professional service assignment not found', 404);
    }

    const library = await db.collection('professional_services_library').findOne({
      _id: professionalService.libraryId,
    });

    if (!library) {
      return errorResponse('Professional library entry not found', 404);
    }

    // Get project
    const project = await db.collection('projects').findOne({
      _id: fee.projectId,
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Financial validation (warning only, don't block)
    let financialWarning = null;
    const capitalCheck = await validateCapitalAvailability(
      fee.projectId.toString(),
      fee.amount
    );

    if (!capitalCheck.isValid && !capitalCheck.capitalNotSet) {
      financialWarning = {
        message: `Fee amount (${fee.amount.toLocaleString()}) exceeds available capital (${capitalCheck.available.toLocaleString()}).`,
        available: capitalCheck.available,
        required: fee.amount,
        shortfall: fee.amount - capitalCheck.available,
        type: 'capital_warning',
      };
      // Don't block approval - just warn
    } else if (capitalCheck.capitalNotSet) {
      financialWarning = {
        message: `No capital invested. Fee amount: ${fee.amount.toLocaleString()}. Spending will be tracked. Add capital later to enable capital validation.`,
        available: 0,
        required: fee.amount,
        shortfall: 0,
        type: 'info',
      };
    }

    // Create expense record automatically
    const expenseCount = await db.collection('expenses').countDocuments({
      projectId: fee.projectId,
    });
    const expenseCode = `EXP-${project.projectCode.substring(0, 8)}-${String(expenseCount + 1).padStart(4, '0')}`;

    // Determine vendor name
    const vendorName = library.companyName || library.name || `${library.firstName || ''} ${library.lastName || ''}`.trim();

    // Create expense document
    const expense = {
      projectId: fee.projectId,
      expenseCode,
      amount: fee.amount,
      currency: fee.currency || 'KES',
      category: 'construction_services', // Professional services category
      description: fee.description || `Professional fee: ${fee.feeType} - ${vendorName}`,
      vendor: vendorName,
      date: fee.invoiceDate || fee.createdAt || new Date(),
      status: 'APPROVED', // Auto-approved since fee is approved
      paymentMethod: fee.paymentMethod || 'CASH',
      referenceNumber: fee.referenceNumber || null,
      receiptFileUrl: fee.receiptUrl || null,
      phaseId: fee.phaseId || null,
      submittedBy: {
        userId: fee.createdBy,
        name: fee.createdByName,
        email: userProfile.email,
      },
      approvedBy: new ObjectId(userProfile._id),
      approvalNotes: `Auto-created from approved professional fee ${fee.feeCode}. ${approvalNotes || ''}`.trim(),
      approvalChain: [
        {
          approverId: new ObjectId(userProfile._id),
          approverName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
          status: 'approved',
          notes: `Auto-created from approved professional fee ${fee.feeCode}`,
          approvedAt: new Date(),
        },
      ],
      notes: `Professional fee: ${fee.feeCode} - ${fee.feeType}. ${fee.description || ''}`.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Insert expense
    const expenseResult = await db.collection('expenses').insertOne(expense);

    // Update fee status and link to expense
    const previousStatus = fee.status;
    const feeUpdate = {
      status: 'APPROVED',
      approvedBy: new ObjectId(userProfile._id),
      approvedAt: new Date(),
      approvalNotes: approvalNotes?.trim() || null,
      expenseId: expenseResult.insertedId,
      updatedAt: new Date(),
    };

    // Update approval chain
    const approvalEntry = {
      approverId: new ObjectId(userProfile._id),
      approverName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      status: 'approved',
      notes: approvalNotes?.trim() || null,
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
          feesPaid: 0, // Not paid yet, just approved
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
      action: 'APPROVED',
      approvedBy: new ObjectId(userProfile._id),
      reason: approvalNotes || 'Professional fee approved',
      timestamp: new Date(),
      previousStatus,
      newStatus: 'APPROVED',
      createdAt: new Date(),
    });

    // Create audit log for fee
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'APPROVED',
      entityType: 'PROFESSIONAL_FEE',
      entityId: id,
      projectId: fee.projectId.toString(),
      changes: {
        status: {
          oldValue: previousStatus,
          newValue: 'APPROVED',
        },
        approvedBy: {
          oldValue: fee.approvedBy,
          newValue: userProfile._id.toString(),
        },
        expenseId: {
          oldValue: null,
          newValue: expenseResult.insertedId.toString(),
        },
      },
    });

    // Create audit log for expense
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'EXPENSE',
      entityId: expenseResult.insertedId.toString(),
      projectId: fee.projectId.toString(),
      changes: {
        created: expense,
        source: 'PROFESSIONAL_FEE',
        sourceId: id,
      },
    });

    // Create notification for creator
    await createNotification({
      userId: fee.createdBy.toString(),
      type: 'approval_status',
      title: 'Professional Fee Approved',
      message: `Your professional fee "${fee.feeCode}" (${fee.amount.toLocaleString()} ${fee.currency}) has been approved${financialWarning ? ' (with financial warning)' : ''}. An expense record has been created automatically.`,
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

    // Recalculate phase spending if fee is linked to a phase
    if (fee.phaseId && ObjectId.isValid(fee.phaseId)) {
      try {
        await recalculatePhaseSpending(fee.phaseId.toString());
      } catch (phaseError) {
        console.error('Error recalculating phase spending after fee approval:', phaseError);
      }
    }

    return successResponse({
      fee: result.value,
      expense: { ...expense, _id: expenseResult.insertedId },
      financialWarning, // Include warning in response
    }, 'Professional fee approved successfully. Expense record created automatically.');
  } catch (error) {
    console.error('Approve professional fee error:', error);
    return errorResponse('Failed to approve professional fee', 500);
  }
}





