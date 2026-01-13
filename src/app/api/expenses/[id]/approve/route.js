/**
 * Expense Approval API Route
 * POST: Approve an expense submission
 * 
 * POST /api/expenses/[id]/approve
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
import { validateCapitalAvailability, recalculateProjectFinances } from '@/lib/financial-helpers';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';
import { updateIndirectCostsSpending, validateIndirectCostsBudget } from '@/lib/indirect-costs-helpers';

/**
 * POST /api/expenses/[id]/approve
 * Approves an expense submission
 * Creates approval record and updates expense status
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
    const hasApprovePermission = await hasPermission(user.id, 'approve_expense');
    if (!hasApprovePermission) {
      return errorResponse('Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can approve expenses.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid expense ID', 400);
    }

    const body = await request.json();
    const { notes, approvalNotes } = body;

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

    // Check if expense can be approved
    const approvableStatuses = ['PENDING', 'REJECTED'];
    if (!approvableStatuses.includes(existingExpense.status)) {
      return errorResponse(
        `Cannot approve expense with status "${existingExpense.status}". Expense must be PENDING or REJECTED.`,
        400
      );
    }

    // Validate capital availability and indirect costs budget before approval
    if (existingExpense.projectId) {
      const expenseAmount = existingExpense.amount || 0;
      
      // Validate capital availability
      try {
        const capitalValidation = await validateCapitalAvailability(
          existingExpense.projectId.toString(),
          expenseAmount
        );

        if (!capitalValidation.isValid) {
          const availableFormatted = capitalValidation.available.toLocaleString('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0,
          });
          const requiredFormatted = capitalValidation.required.toLocaleString('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0,
          });
          
          return errorResponse(
            {
              message: `Cannot approve expense: ${capitalValidation.message}`,
              available: capitalValidation.available,
              required: capitalValidation.required,
              shortfall: capitalValidation.required - capitalValidation.available,
            },
            `Cannot approve expense: ${capitalValidation.message}. Available capital: ${availableFormatted}, Required: ${requiredFormatted}. Shortfall: ${(capitalValidation.required - capitalValidation.available).toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 })}`,
            400
          );
        }
      } catch (validationError) {
        console.error('Capital validation error:', validationError);
        return errorResponse(
          'Unable to validate capital availability. Please try again or contact support if the issue persists.',
          500
        );
      }

      // Validate indirect costs budget if expense is marked as indirect cost
      if (existingExpense.isIndirectCost && existingExpense.indirectCostCategory) {
        try {
          const budgetValidation = await validateIndirectCostsBudget(
            existingExpense.projectId.toString(),
            expenseAmount,
            existingExpense.indirectCostCategory
          );

          // If budget validation fails, return error (unless it's just a warning)
          if (!budgetValidation.isValid) {
            return errorResponse(
              `Cannot approve expense: ${budgetValidation.message}`,
              400
            );
          }

          // If budget validation shows a warning, log it but allow approval
          if (budgetValidation.warning) {
            console.warn(`Indirect costs budget warning for project ${existingExpense.projectId}:`, budgetValidation.message);
          }
        } catch (validationError) {
          console.error('Indirect costs budget validation error:', validationError);
          // Don't fail approval if budget validation fails - just log it
        }
      }
    }

    // Validate phase budget if expense is linked to a phase AND is a direct cost
    // CRITICAL: Indirect costs are NOT charged to phase budget, so skip validation for them
    if (existingExpense.phaseId && ObjectId.isValid(existingExpense.phaseId) && !existingExpense.isIndirectCost) {
      const db = await getDatabase();
      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(existingExpense.phaseId),
        deletedAt: null
      });

      if (phase) {
        const expenseAmount = existingExpense.amount || 0;
        const phaseBudget = phase.budgetAllocation?.total || 0;
        const phaseActual = phase.actualSpending?.total || 0;
        const phaseCommitted = phase.financialStates?.committed || 0;
        const phaseAvailable = Math.max(0, phaseBudget - phaseActual - phaseCommitted);

        if (expenseAmount > phaseAvailable) {
          // Allow PM/OWNER to override with warning
          const userRole = userProfile?.role?.toLowerCase();
          const isOwnerOrPM = ['owner', 'pm', 'project_manager'].includes(userRole);

          if (!isOwnerOrPM) {
            return errorResponse(
              `Cannot approve expense: Exceeds phase budget. Phase budget: ${phaseBudget.toLocaleString()}, Available: ${phaseAvailable.toLocaleString()}, Required: ${expenseAmount.toLocaleString()}`,
              400
            );
          }
          // For PM/OWNER, continue but this will be logged in audit
        }
      }
    }
    
    // Validate indirect costs budget if expense is an indirect cost
    if (existingExpense.isIndirectCost && existingExpense.indirectCostCategory) {
      const { getIndirectCostsRemaining } = await import('@/lib/indirect-costs-helpers');
      const indirectRemaining = await getIndirectCostsRemaining(existingExpense.projectId.toString());
      const expenseAmount = existingExpense.amount || 0;
      
      if (expenseAmount > indirectRemaining) {
        const userRole = userProfile?.role?.toLowerCase();
        const isOwnerOrPM = ['owner', 'pm', 'project_manager'].includes(userRole);
        
        if (!isOwnerOrPM) {
          return errorResponse(
            `Cannot approve expense: Exceeds indirect costs budget. Available: ${indirectRemaining.toLocaleString()} KES, Required: ${expenseAmount.toLocaleString()} KES`,
            400
          );
        }
        // For PM/OWNER, continue but this will be logged in audit
      }
    }

    // Create approval entry
    const approvalEntry = {
      approverId: new ObjectId(userProfile._id),
      approverName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      status: 'approved',
      notes: notes || approvalNotes || '',
      approvedAt: new Date(),
    };

    // Update expense
    const previousStatus = existingExpense.status;
    const result = await db.collection('expenses').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $push: { approvalChain: approvalEntry },
        $set: {
          status: 'APPROVED',
          approvedBy: new ObjectId(userProfile._id),
          approvalNotes: notes || approvalNotes || '',
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    // Create approval record in approvals collection
    await db.collection('approvals').insertOne({
      relatedId: new ObjectId(id),
      relatedModel: 'EXPENSE',
      action: 'APPROVED',
      approvedBy: new ObjectId(userProfile._id),
      reason: notes || approvalNotes || 'Expense approved',
      timestamp: new Date(),
      previousStatus,
      newStatus: 'APPROVED',
      createdAt: new Date(),
    });

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'APPROVED',
      entityType: 'EXPENSE',
      entityId: id,
      projectId: existingExpense.projectId?.toString(),
      changes: {
        status: {
          oldValue: previousStatus,
          newValue: 'APPROVED',
        },
        approvedBy: {
          oldValue: existingExpense.approvedBy,
          newValue: userProfile._id.toString(),
        },
      },
    });

    // Create notification for submitter
    if (existingExpense.submittedBy?._id) {
      await createNotification({
        userId: existingExpense.submittedBy._id.toString(),
        type: 'approval_status',
        title: 'Expense Approved',
        message: `Your expense "${existingExpense.expenseCode || existingExpense.description}" has been approved by ${userProfile.firstName || userProfile.email}.`,
        projectId: existingExpense.projectId?.toString(),
        relatedModel: 'EXPENSE',
        relatedId: id,
        createdBy: userProfile._id.toString(),
      });
    }

    // Charge to indirect costs budget if expense is an indirect cost
    if (existingExpense.isIndirectCost && existingExpense.indirectCostCategory) {
      try {
        await updateIndirectCostsSpending(
          existingExpense.projectId.toString(),
          existingExpense.indirectCostCategory,
          existingExpense.amount || 0
        );
        console.log(`✅ Indirect costs updated for project ${existingExpense.projectId}`);
      } catch (indirectError) {
        console.error(`❌ Error updating indirect costs:`, indirectError);
        // Don't fail the approval if indirect costs update fails
      }
    }
    
    // Auto-recalculate project finances after approval (async, non-blocking)
    if (existingExpense.projectId) {
      recalculateProjectFinances(existingExpense.projectId.toString())
        .then(() => {
          console.log(`✅ Project finances updated for project ${existingExpense.projectId}`);
        })
        .catch((error) => {
          console.error(`❌ Error updating project finances for project ${existingExpense.projectId}:`, error);
          // Log detailed error for debugging
          console.error('Error details:', {
            projectId: existingExpense.projectId.toString(),
            expenseId: id,
            errorMessage: error.message,
            errorStack: error.stack,
          });
          // Don't fail the approval if finances update fails, but log it for manual review
        });
    }

    // Recalculate phase spending if expense is linked to a phase AND is a direct cost
    // CRITICAL: Indirect costs are NOT included in phase spending
    if (existingExpense.phaseId && ObjectId.isValid(existingExpense.phaseId) && !existingExpense.isIndirectCost) {
      try {
        await recalculatePhaseSpending(existingExpense.phaseId.toString());
      } catch (phaseError) {
        console.error('Error recalculating phase spending after expense approval:', phaseError);
        // Don't fail the request, just log the error
      }
    }

    return successResponse(
      {
        expense: result.value,
        approval: approvalEntry,
      },
      'Expense approved successfully'
    );
  } catch (error) {
    console.error('Approve expense error:', error);
    return errorResponse('Failed to approve expense', 500);
  }
}

