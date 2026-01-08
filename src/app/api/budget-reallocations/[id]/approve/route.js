/**
 * Budget Reallocation Approve API Route
 * POST: Approve a budget reallocation request
 * 
 * POST /api/budget-reallocations/[id]/approve
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { REALLOCATION_STATUSES, REALLOCATION_TYPES } from '@/lib/schemas/budget-reallocation-schema';
import { getBudgetTotal, updateBudgetTotal } from '@/lib/schemas/budget-schema';
import { recalculatePhaseSpending, calculateTotalPhaseBudgets } from '@/lib/phase-helpers';
import { validateCapitalAvailability } from '@/lib/financial-helpers';

/**
 * POST /api/budget-reallocations/[id]/approve
 * Approves a budget reallocation request and executes it
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
    const hasApprovePermission = await hasPermission(user.id, 'approve_budget_reallocation');
    if (!hasApprovePermission) {
      return errorResponse('Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can approve budget reallocations.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid reallocation ID', 400);
    }

    const body = await request.json();
    const { approvalNotes } = body;

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Get reallocation request
    const reallocation = await db.collection('budget_reallocations').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!reallocation) {
      return errorResponse('Budget reallocation request not found', 404);
    }

    if (reallocation.status !== REALLOCATION_STATUSES.PENDING) {
      return errorResponse(`Cannot approve reallocation with status: ${reallocation.status}`, 400);
    }

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: reallocation.projectId,
      deletedAt: null
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Validate budget availability again (in case it changed)
    let sourcePhase = null;
    let targetPhase = null;

    if (reallocation.reallocationType === REALLOCATION_TYPES.PHASE_TO_PHASE) {
      [sourcePhase, targetPhase] = await Promise.all([
        db.collection('phases').findOne({ _id: reallocation.fromPhaseId, deletedAt: null }),
        db.collection('phases').findOne({ _id: reallocation.toPhaseId, deletedAt: null })
      ]);

      if (!sourcePhase || !targetPhase) {
        return errorResponse('Source or target phase not found', 404);
      }

      const sourceAllocation = sourcePhase.budgetAllocation?.total || 0;
      const sourceActual = sourcePhase.actualSpending?.total || 0;
      const sourceCommitted = sourcePhase.financialStates?.committed || 0;
      const sourceAvailable = Math.max(0, sourceAllocation - sourceActual - sourceCommitted);

      if (reallocation.amount > sourceAvailable) {
        return errorResponse(
          `Insufficient budget in source phase. Available: ${sourceAvailable.toLocaleString()}, Requested: ${reallocation.amount.toLocaleString()}`,
          400
        );
      }
    } else if (reallocation.reallocationType === REALLOCATION_TYPES.PROJECT_TO_PHASE) {
      targetPhase = await db.collection('phases').findOne({
        _id: reallocation.toPhaseId,
        deletedAt: null
      });

      if (!targetPhase) {
        return errorResponse('Target phase not found', 404);
      }

      const projectBudgetTotal = getBudgetTotal(project.budget);
      const totalPhaseBudgets = await calculateTotalPhaseBudgets(reallocation.projectId.toString());
      const projectAvailable = projectBudgetTotal - totalPhaseBudgets;

      if (reallocation.amount > projectAvailable) {
        return errorResponse(
          `Insufficient project budget. Available: ${projectAvailable.toLocaleString()}, Requested: ${reallocation.amount.toLocaleString()}`,
          400
        );
      }

      // Validate: after reallocation, total phase budgets must not exceed project budget
      const newTotalPhaseBudgets = totalPhaseBudgets + reallocation.amount;
      if (newTotalPhaseBudgets > projectBudgetTotal) {
        return errorResponse(
          `Budget reallocation would cause total phase budgets (${newTotalPhaseBudgets.toLocaleString()}) to exceed project budget (${projectBudgetTotal.toLocaleString()})`,
          400
        );
      }
    } else if (reallocation.reallocationType === REALLOCATION_TYPES.PHASE_TO_PROJECT) {
      sourcePhase = await db.collection('phases').findOne({
        _id: reallocation.fromPhaseId,
        deletedAt: null
      });

      if (!sourcePhase) {
        return errorResponse('Source phase not found', 404);
      }

      const sourceAllocation = sourcePhase.budgetAllocation?.total || 0;
      const sourceActual = sourcePhase.actualSpending?.total || 0;
      const sourceCommitted = sourcePhase.financialStates?.committed || 0;
      const sourceAvailable = Math.max(0, sourceAllocation - sourceActual - sourceCommitted);

      if (reallocation.amount > sourceAvailable) {
        return errorResponse(
          `Insufficient budget in source phase. Available: ${sourceAvailable.toLocaleString()}, Requested: ${reallocation.amount.toLocaleString()}`,
          400
        );
      }
    }

    // Validate capital availability (informational - budget reallocation is planning, not spending)
    // We check to warn if reallocation amount is significant compared to available capital
    const capitalValidation = await validateCapitalAvailability(
      reallocation.projectId.toString(),
      0 // Check available capital (reallocation doesn't directly spend)
    );

    // Warn if reallocation amount is large compared to available capital (but don't block)
    // This helps prevent unrealistic budget allocations when capital is low
    if (capitalValidation.available > 0 && reallocation.amount > capitalValidation.available * 0.8) {
      // Warning: Reallocating more than 80% of available capital
      // This is logged but doesn't block the reallocation
      console.warn(`Budget reallocation warning: Reallocating ${reallocation.amount.toLocaleString()} when available capital is ${capitalValidation.available.toLocaleString()}`);
    }

    // Execute reallocation
    const amount = reallocation.amount;
    const now = new Date();

    if (reallocation.reallocationType === REALLOCATION_TYPES.PHASE_TO_PHASE) {
      // Decrease source phase budget
      const sourceNewTotal = (sourcePhase.budgetAllocation?.total || 0) - amount;
      const sourceNewRemaining = Math.max(0, sourceNewTotal - (sourcePhase.actualSpending?.total || 0) - (sourcePhase.financialStates?.committed || 0));

      await db.collection('phases').findOneAndUpdate(
        { _id: reallocation.fromPhaseId },
        {
          $set: {
            'budgetAllocation.total': sourceNewTotal,
            'financialStates.remaining': sourceNewRemaining,
            updatedAt: now
          }
        }
      );

      // Increase target phase budget
      const targetNewTotal = (targetPhase.budgetAllocation?.total || 0) + amount;
      const targetNewRemaining = Math.max(0, targetNewTotal - (targetPhase.actualSpending?.total || 0) - (targetPhase.financialStates?.committed || 0));

      await db.collection('phases').findOneAndUpdate(
        { _id: reallocation.toPhaseId },
        {
          $set: {
            'budgetAllocation.total': targetNewTotal,
            'financialStates.remaining': targetNewRemaining,
            updatedAt: now
          }
        }
      );

      // Recalculate both phases
      await Promise.all([
        recalculatePhaseSpending(reallocation.fromPhaseId.toString()),
        recalculatePhaseSpending(reallocation.toPhaseId.toString())
      ]);
    } else if (reallocation.reallocationType === REALLOCATION_TYPES.PROJECT_TO_PHASE) {
      // Increase target phase budget
      const targetNewTotal = (targetPhase.budgetAllocation?.total || 0) + amount;
      const targetNewRemaining = Math.max(0, targetNewTotal - (targetPhase.actualSpending?.total || 0) - (targetPhase.financialStates?.committed || 0));

      await db.collection('phases').findOneAndUpdate(
        { _id: reallocation.toPhaseId },
        {
          $set: {
            'budgetAllocation.total': targetNewTotal,
            'financialStates.remaining': targetNewRemaining,
            updatedAt: now
          }
        }
      );

      await recalculatePhaseSpending(reallocation.toPhaseId.toString());

      // Update project budget: decrease by amount (moving from project to phase)
      const updatedProjectBudget = updateBudgetTotal(project.budget, -amount);
      await db.collection('projects').findOneAndUpdate(
        { _id: reallocation.projectId },
        {
          $set: {
            budget: updatedProjectBudget,
            updatedAt: now
          }
        }
      );
    } else if (reallocation.reallocationType === REALLOCATION_TYPES.PHASE_TO_PROJECT) {
      // Decrease source phase budget
      const sourceNewTotal = (sourcePhase.budgetAllocation?.total || 0) - amount;
      const sourceNewRemaining = Math.max(0, sourceNewTotal - (sourcePhase.actualSpending?.total || 0) - (sourcePhase.financialStates?.committed || 0));

      await db.collection('phases').findOneAndUpdate(
        { _id: reallocation.fromPhaseId },
        {
          $set: {
            'budgetAllocation.total': sourceNewTotal,
            'financialStates.remaining': sourceNewRemaining,
            updatedAt: now
          }
        }
      );

      await recalculatePhaseSpending(reallocation.fromPhaseId.toString());

      // Update project budget: increase by amount (moving from phase to project)
      const updatedProjectBudget = updateBudgetTotal(project.budget, amount);
      await db.collection('projects').findOneAndUpdate(
        { _id: reallocation.projectId },
        {
          $set: {
            budget: updatedProjectBudget,
            updatedAt: now
          }
        }
      );
    }

    // Update reallocation request
    const updatedReallocation = await db.collection('budget_reallocations').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: REALLOCATION_STATUSES.EXECUTED,
          approvedBy: new ObjectId(userProfile._id),
          approvalNotes: approvalNotes?.trim() || null,
          approvedAt: now,
          executedAt: now,
          updatedAt: now
        }
      },
      { returnDocument: 'after' }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'APPROVED',
      entityType: 'BUDGET_REALLOCATION',
      entityId: id,
      projectId: reallocation.projectId.toString(),
      changes: {
        status: { oldValue: REALLOCATION_STATUSES.PENDING, newValue: REALLOCATION_STATUSES.EXECUTED },
        approvedBy: userProfile._id.toString(),
        approvalNotes: approvalNotes?.trim() || null
      },
    });

    return successResponse(
      updatedReallocation,
      'Budget reallocation approved and executed successfully'
    );
  } catch (error) {
    console.error('Approve budget reallocation error:', error);
    return errorResponse(error.message || 'Failed to approve budget reallocation', 500);
  }
}

