/**
 * Bulk Floor Budget Allocation API
 * Allocates phase budgets to floors for all phases in a project
 * 
 * Route: /api/projects/[id]/floors/budget
 * Methods: POST
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { errorResponse, successResponse } from '@/lib/api-response';
import { allocatePhaseBudgetToFloors } from '@/lib/floor-financial-helpers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/floors/budget
 * Allocates phase budgets to floors for all phases in the project
 * Auth: PM, OWNER, ACCOUNTANT only
 */
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

    const hasManagePermission = await hasPermission(user.id, 'manage_floor_budget');
    if (!hasManagePermission) {
      // Fallback to role check
      const userRole = userProfile.role?.toLowerCase();
      const allowedRoles = ['pm', 'project_manager', 'owner', 'accountant'];
      if (!allowedRoles.includes(userRole)) {
        return errorResponse('Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can allocate floor budgets.', 403);
      }
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const body = await request.json();
    const {
      strategy = 'weighted', // 'even' | 'weighted' (default: 'weighted')
      onlyZeroBudgets = true, // Only allocate to floors with zero budgets for the phase
      phaseIds = null // Optional: specific phase IDs to allocate (null = all phases)
    } = body;

    const db = await getDatabase();

    // Get project
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Get phases
    const phaseQuery = {
      projectId: new ObjectId(id),
      deletedAt: null
    };

    if (phaseIds && Array.isArray(phaseIds) && phaseIds.length > 0) {
      phaseQuery._id = { $in: phaseIds.map(id => new ObjectId(id)) };
    }

    const phases = await db.collection('phases').find(phaseQuery).sort({ sequence: 1 }).toArray();

    if (phases.length === 0) {
      return errorResponse('No phases found for this project', 404);
    }

    // Filter phases with budgets
    const phasesWithBudgets = phases.filter(phase => {
      const phaseBudget = phase.budgetAllocation?.total || 0;
      return phaseBudget > 0;
    });

    if (phasesWithBudgets.length === 0) {
      return errorResponse('No phases with allocated budgets found. Allocate budgets to phases first.', 400);
    }

    // Allocate budgets to floors for each phase
    const allocationResults = [];
    const errors = [];
    const warnings = [];

    for (const phase of phasesWithBudgets) {
      try {
        const floorResult = await allocatePhaseBudgetToFloors(
          phase._id.toString(),
          strategy,
          userProfile._id.toString(),
          { onlyZeroBudgets }
        );

        if (floorResult.allocated > 0) {
          allocationResults.push({
            phaseId: phase._id.toString(),
            phaseCode: phase.phaseCode,
            phaseName: phase.phaseName || phase.phaseCode,
            ...floorResult
          });
        }

        if (floorResult.warnings && floorResult.warnings.length > 0) {
          warnings.push(...floorResult.warnings.map(w => ({
            phaseId: phase._id.toString(),
            phaseCode: phase.phaseCode,
            ...w
          })));
        }
      } catch (phaseError) {
        console.error(`Error allocating floors for phase ${phase._id}:`, phaseError);
        errors.push({
          phaseId: phase._id.toString(),
          phaseCode: phase.phaseCode,
          phaseName: phase.phaseName || phase.phaseCode,
          error: phaseError.message || 'Failed to allocate floors'
        });
      }
    }

    // Calculate totals
    const totalFloorsAllocated = allocationResults.reduce((sum, r) => sum + r.allocated, 0);
    const totalFloorsSkipped = allocationResults.reduce((sum, r) => sum + (r.skipped || 0), 0);

    // Build response
    const responseData = {
      projectId: id,
      strategy,
      totalPhases: phasesWithBudgets.length,
      phasesAllocated: allocationResults.length,
      totalFloorsAllocated,
      totalFloorsSkipped,
      phaseResults: allocationResults,
      warnings: warnings.length > 0 ? warnings : undefined,
      errors: errors.length > 0 ? errors : undefined
    };

    let successMessage = `Floor budgets allocated successfully. ${totalFloorsAllocated} floor(s) allocated across ${allocationResults.length} phase(s).`;
    if (totalFloorsSkipped > 0) {
      successMessage += ` ${totalFloorsSkipped} floor(s) skipped (already have budgets).`;
    }
    if (warnings.length > 0) {
      successMessage += ` ${warnings.length} warning(s) generated.`;
    }
    if (errors.length > 0) {
      successMessage += ` ${errors.length} error(s) occurred.`;
    }

    return successResponse(responseData, successMessage);
  } catch (error) {
    console.error('Bulk floor allocation error:', error);
    return errorResponse('Failed to allocate floor budgets', 500);
  }
}
