/**
 * Phase Floors Budget API Route
 * POST: Allocate budgets to multiple floors for a phase
 * GET: Get floor budget suggestions for a phase
 * 
 * POST /api/phases/[id]/floors/budget
 * GET /api/phases/[id]/floors/budget?strategy=even|weighted
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
  getEvenDistributionFloorBudgets,
  getWeightedDistributionFloorBudgets,
  calculateTotalFloorBudgetsForPhase,
} from '@/lib/floor-financial-helpers';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/phases/[id]/floors/budget
 * Returns floor budget suggestions for a phase
 * Auth: All authenticated users
 * Query params: strategy (even|weighted), weights (optional JSON)
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
      return errorResponse('Invalid phase ID', 400);
    }

    const { searchParams } = new URL(request.url);
    const strategy = searchParams.get('strategy') || 'even';
    const weightsParam = searchParams.get('weights');

    let weights = {};
    if (weightsParam) {
      try {
        weights = JSON.parse(weightsParam);
      } catch (e) {
        return errorResponse('Invalid weights parameter. Must be valid JSON.', 400);
      }
    }

    let suggestions = [];
    if (strategy === 'weighted') {
      suggestions = await getWeightedDistributionFloorBudgets(id, weights);
    } else {
      suggestions = await getEvenDistributionFloorBudgets(id);
    }

    return successResponse({
      strategy,
      suggestions,
    }, 'Floor budget suggestions retrieved successfully');
  } catch (error) {
    console.error('Get floor budget suggestions error:', error);
    return errorResponse('Failed to retrieve floor budget suggestions', 500);
  }
}

/**
 * POST /api/phases/[id]/floors/budget
 * Allocates budgets to multiple floors for a phase
 * Auth: PM, OWNER, ACCOUNTANT only
 * Body: { allocations: [{ floorId, total, materials?, labour?, equipment?, subcontractors? }] }
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
        return errorResponse('Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can manage floor budgets.', 403);
      }
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const body = await request.json();
    const { allocations } = body;

    if (!allocations || !Array.isArray(allocations)) {
      return errorResponse('allocations array is required', 400);
    }

    if (allocations.length === 0) {
      return errorResponse('At least one floor allocation is required', 400);
    }

    const db = await getDatabase();

    // Get phase
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    const phaseBudget = phase.budgetAllocation?.total || 0;

    // Validate allocations
    let totalAllocated = 0;
    const validAllocations = [];

    for (const allocation of allocations) {
      const { floorId, total, materials, labour, equipment, subcontractors } = allocation;

      if (!floorId || !ObjectId.isValid(floorId)) {
        return errorResponse(`Invalid floor ID: ${floorId}`, 400);
      }

      if (total === undefined || total === null) {
        return errorResponse(`Total budget is required for floor ${floorId}`, 400);
      }

      if (typeof total !== 'number' || total < 0) {
        return errorResponse(`Total budget must be a non-negative number for floor ${floorId}`, 400);
      }

      // Verify floor exists and belongs to the same project
      const floor = await db.collection('floors').findOne({
        _id: new ObjectId(floorId),
        projectId: phase.projectId,
        deletedAt: null,
      });

      if (!floor) {
        return errorResponse(`Floor ${floorId} not found or does not belong to this project`, 404);
      }

      totalAllocated += total;
      validAllocations.push({
        floorId,
        floor,
        budgetAllocation: {
          total,
          materials: materials || 0,
          labour: labour || 0,
          equipment: equipment || 0,
          subcontractors: subcontractors || 0,
        },
      });
    }

    // Validate total allocations don't exceed phase budget
    if (totalAllocated > phaseBudget) {
      return errorResponse(
        `Total floor allocations (${totalAllocated.toLocaleString()}) exceed phase budget (${phaseBudget.toLocaleString()})`,
        400
      );
    }

    // Update all floors
    const updatedFloors = [];
    for (const allocation of validAllocations) {
      const { floorId, budgetAllocation } = allocation;

      // Calculate remaining budget
      const { calculateFloorActualSpending, calculateFloorCommittedCosts } = await import('@/lib/floor-financial-helpers');
      const actualSpending = await calculateFloorActualSpending(floorId);
      const committedCosts = await calculateFloorCommittedCosts(floorId);
      const remaining = Math.max(0, budgetAllocation.total - actualSpending.total - committedCosts.total);

      const updateResult = await db.collection('floors').findOneAndUpdate(
        { _id: new ObjectId(floorId) },
        {
          $set: {
            budgetAllocation: budgetAllocation,
            totalBudget: budgetAllocation.total, // Maintain legacy field
            'financialStates.remaining': remaining,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      if (updateResult.value) {
        updatedFloors.push(updateResult.value);

        // Create audit log for each floor
        await createAuditLog({
          userId: userProfile._id.toString(),
          action: 'BUDGET_ALLOCATED',
          entityType: 'FLOOR',
          entityId: floorId,
          projectId: phase.projectId.toString(),
          changes: {
            reason: 'Batch allocation from phase',
            phaseId: id,
            newBudget: budgetAllocation,
          },
        });
      }
    }

    return successResponse({
      phaseId: id,
      totalAllocated,
      phaseBudget,
      remainingUnallocated: phaseBudget - totalAllocated,
      floors: updatedFloors,
    }, `Budget allocated to ${updatedFloors.length} floors successfully`);
  } catch (error) {
    console.error('Allocate floor budgets error:', error);
    return errorResponse('Failed to allocate budgets to floors', 500);
  }
}
