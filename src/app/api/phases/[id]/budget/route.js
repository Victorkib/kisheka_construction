/**
 * Phase Budget Allocation API Route
 * POST: Allocate budget to phase from project budget
 * PATCH: Update phase budget allocation
 * 
 * POST /api/phases/[id]/budget
 * PATCH /api/phases/[id]/budget
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getBudgetTotal, isEnhancedBudget } from '@/lib/schemas/budget-schema';
import { calculateTotalPhaseBudgets } from '@/lib/phase-helpers';

/**
 * POST /api/phases/[id]/budget
 * Allocates budget to phase from project budget
 * Auth: PM, OWNER, ACCOUNTANT only
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
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const hasManagePermission = await hasPermission(user.id, 'manage_phase_budget');
    if (!hasManagePermission) {
      return errorResponse('Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can manage phase budgets.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const body = await request.json();
    const {
      total,
      materials,
      labour,
      equipment,
      subcontractors,
      contingency
    } = body;

    if (total === undefined || total === null) {
      return errorResponse('Total budget allocation is required', 400);
    }

    if (typeof total !== 'number' || total < 0) {
      return errorResponse('Total budget allocation must be a non-negative number', 400);
    }

    const db = await getDatabase();

    // Get phase
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    // Get project
    const project = await db.collection('projects').findOne({
      _id: phase.projectId,
      deletedAt: null
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // OPTIONAL BUDGET: Allow phase budget allocation even when project budget is 0
    // Validate against Direct Construction Costs (DCC) only, not total budget
    // Pre-construction, indirect costs, and contingency are NOT available for phase allocation
    const projectBudget = project.budget || {};
    let dccBudget = 0;
    
    if (isEnhancedBudget(projectBudget)) {
      // Enhanced budget: Use directConstructionCosts
      dccBudget = projectBudget.directConstructionCosts || 0;
    } else {
      // Legacy budget: Estimate DCC (total - estimated pre-construction - indirect - contingency)
      const projectBudgetTotal = getBudgetTotal(projectBudget);
      const estimatedPreConstruction = projectBudgetTotal * 0.05;
      const estimatedIndirect = projectBudgetTotal * 0.05;
      const estimatedContingency = projectBudget.contingency || (projectBudgetTotal * 0.05);
      dccBudget = Math.max(0, projectBudgetTotal - estimatedPreConstruction - estimatedIndirect - estimatedContingency);
    }
    
    const currentPhaseTotal = phase.budgetAllocation?.total || 0;
    
    // OPTIONAL BUDGET: If project budget is 0, allow phase budget allocation without validation
    if (dccBudget === 0) {
      // Allow phase budget allocation even when project budget is 0
      // This enables users to allocate budget to phases before setting project budget
      console.info(
        `[Phase Budget API] Allowing phase budget allocation for phase ${id} even though project DCC budget is 0. ` +
        `This enables budget allocation before project budget is set.`
      );
    } else {
      // Project has budget - validate against DCC budget
      // Calculate total phase budgets using helper function
      const totalPhaseBudgets = await calculateTotalPhaseBudgets(phase.projectId.toString());
      const allocatedToOtherPhases = totalPhaseBudgets - currentPhaseTotal;
      const availableDCC = dccBudget - allocatedToOtherPhases;
      const requestedAllocation = total;

      // Validate: requested allocation must not exceed available DCC
      if (requestedAllocation > availableDCC + currentPhaseTotal) {
        return errorResponse(
          `Insufficient Direct Construction Costs (DCC) budget. Available DCC: ${availableDCC.toLocaleString()} KES, ` +
          `Requested: ${requestedAllocation.toLocaleString()} KES, Current phase budget: ${currentPhaseTotal.toLocaleString()} KES. ` +
          `Note: Only Direct Construction Costs are allocated to phases. Pre-construction, indirect costs, and contingency are tracked separately.`,
          400
        );
      }

      // Validate: total phase budgets (after update) must not exceed DCC budget
      const newTotalPhaseBudgets = allocatedToOtherPhases + requestedAllocation;
      if (newTotalPhaseBudgets > dccBudget) {
        return errorResponse(
          `Phase budget allocation would exceed Direct Construction Costs (DCC). DCC budget: ${dccBudget.toLocaleString()} KES, ` +
          `Total phase budgets after update: ${newTotalPhaseBudgets.toLocaleString()} KES. ` +
          `Note: Only Direct Construction Costs are allocated to phases.`,
          400
        );
      }
    }

    // Update phase budget allocation
    const budgetAllocation = {
      total: requestedAllocation,
      materials: materials || 0,
      labour: labour || 0,
      equipment: equipment || 0,
      subcontractors: subcontractors || 0,
      contingency: 0  // Contingency NOT allocated to phases - stays at project level
    };

    // Recalculate remaining budget
    const currentActual = phase.actualSpending?.total || 0;
    const currentCommitted = phase.financialStates?.committed || 0;
    const remaining = Math.max(0, requestedAllocation - currentActual - currentCommitted);

    const updateResult = await db.collection('phases').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          budgetAllocation,
          'financialStates.remaining': remaining,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!updateResult) {
      return errorResponse('Failed to update phase budget', 500);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'BUDGET_ALLOCATED',
      entityType: 'PHASE',
      entityId: id,
      projectId: phase.projectId.toString(),
      changes: {
        oldBudget: phase.budgetAllocation,
        newBudget: budgetAllocation
      },
    });

    return successResponse({
      phase: updateResult,
      allocation: budgetAllocation,
      availableBudget: availableBudget + currentPhaseTotal - requestedAllocation
    }, 'Budget allocated successfully');
  } catch (error) {
    console.error('Allocate phase budget error:', error);
    return errorResponse('Failed to allocate budget to phase', 500);
  }
}

/**
 * PATCH /api/phases/[id]/budget
 * Updates phase budget allocation
 * Auth: PM, OWNER, ACCOUNTANT only
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const hasManagePermission = await hasPermission(user.id, 'manage_phase_budget');
    if (!hasManagePermission) {
      return errorResponse('Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can manage phase budgets.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const body = await request.json();
    const {
      total,
      materials,
      labour,
      equipment,
      subcontractors,
      contingency
    } = body;

    const db = await getDatabase();

    // Get phase
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    // Get project
    const project = await db.collection('projects').findOne({
      _id: phase.projectId,
      deletedAt: null
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Build updated budget allocation
    const currentAllocation = phase.budgetAllocation || {};
    const updatedAllocation = {
      total: total !== undefined ? total : currentAllocation.total,
      materials: materials !== undefined ? materials : currentAllocation.materials,
      labour: labour !== undefined ? labour : currentAllocation.labour,
      equipment: equipment !== undefined ? equipment : currentAllocation.equipment,
      subcontractors: subcontractors !== undefined ? subcontractors : currentAllocation.subcontractors,
      contingency: 0  // Contingency NOT allocated to phases - stays at project level
    };

    // Validate new total if provided
    if (total !== undefined) {
      if (typeof total !== 'number' || total < 0) {
        return errorResponse('Total budget allocation must be a non-negative number', 400);
      }

      // CRITICAL FIX: Validate against Direct Construction Costs (DCC) only
      const projectBudget = project.budget || {};
      let dccBudget = 0;
      
      if (isEnhancedBudget(projectBudget)) {
        dccBudget = projectBudget.directConstructionCosts || 0;
      } else {
        const projectBudgetTotal = getBudgetTotal(projectBudget);
        const estimatedPreConstruction = projectBudgetTotal * 0.05;
        const estimatedIndirect = projectBudgetTotal * 0.05;
        const estimatedContingency = projectBudget.contingency || (projectBudgetTotal * 0.05);
        dccBudget = Math.max(0, projectBudgetTotal - estimatedPreConstruction - estimatedIndirect - estimatedContingency);
      }
      
      const currentPhaseTotal = currentAllocation.total || 0;
      const otherPhasesTotal = await db.collection('phases').aggregate([
        {
          $match: {
            projectId: phase.projectId,
            _id: { $ne: new ObjectId(id) },
            deletedAt: null
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$budgetAllocation.total' }
          }
        }
      ]).toArray();

      const allocatedToOtherPhases = otherPhasesTotal[0]?.total || 0;
      const availableDCC = dccBudget - allocatedToOtherPhases;
      const requestedAllocation = total;

      if (requestedAllocation > availableDCC + currentPhaseTotal) {
        return errorResponse(
          `Insufficient Direct Construction Costs (DCC) budget. Available DCC: ${availableDCC.toLocaleString()} KES, ` +
          `Requested: ${requestedAllocation.toLocaleString()} KES, Current phase budget: ${currentPhaseTotal.toLocaleString()} KES. ` +
          `Note: Only Direct Construction Costs are allocated to phases.`,
          400
        );
      }
      
      // Validate total phase budgets don't exceed DCC
      const newTotalPhaseBudgets = allocatedToOtherPhases + requestedAllocation;
      if (newTotalPhaseBudgets > dccBudget) {
        return errorResponse(
          `Phase budget allocation would exceed Direct Construction Costs (DCC). DCC budget: ${dccBudget.toLocaleString()} KES, ` +
          `Total phase budgets after update: ${newTotalPhaseBudgets.toLocaleString()} KES.`,
          400
        );
      }
    }

    // Recalculate remaining budget
    const currentActual = phase.actualSpending?.total || 0;
    const currentCommitted = phase.financialStates?.committed || 0;
    const remaining = Math.max(0, updatedAllocation.total - currentActual - currentCommitted);

    // Update phase
    const updateResult = await db.collection('phases').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          budgetAllocation: updatedAllocation,
          'financialStates.remaining': remaining,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!updateResult) {
      return errorResponse('Failed to update phase budget', 500);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'BUDGET_UPDATED',
      entityType: 'PHASE',
      entityId: id,
      projectId: phase.projectId.toString(),
      changes: {
        oldBudget: currentAllocation,
        newBudget: updatedAllocation
      },
    });

    return successResponse({
      phase: updateResult,
      allocation: updatedAllocation
    }, 'Phase budget updated successfully');
  } catch (error) {
    console.error('Update phase budget error:', error);
    return errorResponse('Failed to update phase budget', 500);
  }
}

