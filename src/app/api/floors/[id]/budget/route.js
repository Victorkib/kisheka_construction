/**
 * Floor Budget API Route
 * GET: Get floor budget allocation and financial summary
 * POST: Set/allocate budget to floor
 * PATCH: Update floor budget allocation
 * 
 * GET /api/floors/[id]/budget
 * POST /api/floors/[id]/budget
 * PATCH /api/floors/[id]/budget
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
  calculateFloorActualSpending,
  calculateFloorCommittedCosts,
  updateFloorFinancials,
} from '@/lib/floor-financial-helpers';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/floors/[id]/budget
 * Returns floor budget allocation and financial summary
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
      return errorResponse('Invalid floor ID', 400);
    }

    const db = await getDatabase();
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    // Calculate actual spending and committed costs
    const actualSpending = await calculateFloorActualSpending(id);
    const committedCosts = await calculateFloorCommittedCosts(id);

    // Get budget allocation (new structure or legacy)
    const budgetAllocation = floor.budgetAllocation || {
      total: floor.totalBudget || 0,
      materials: 0,
      labour: 0,
      equipment: 0,
      subcontractors: 0,
    };

    const budgetTotal = budgetAllocation.total || 0;
    const remaining = Math.max(0, budgetTotal - actualSpending.total - committedCosts.total);

    return successResponse({
      floorId: id,
      floorName: floor.name,
      floorNumber: floor.floorNumber,
      budgetAllocation: budgetAllocation,
      actualSpending: actualSpending,
      committedCosts: committedCosts,
      remaining: remaining,
      financialStates: {
        remaining: remaining,
        committed: committedCosts.total,
      },
    }, 'Floor budget retrieved successfully');
  } catch (error) {
    console.error('Get floor budget error:', error);
    return errorResponse('Failed to retrieve floor budget', 500);
  }
}

/**
 * POST /api/floors/[id]/budget
 * Sets/allocates budget to floor
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
        return errorResponse('Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can manage floor budgets.', 403);
      }
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid floor ID', 400);
    }

    const body = await request.json();
    const {
      total,
      materials,
      labour,
      equipment,
      subcontractors,
    } = body;

    if (total === undefined || total === null) {
      return errorResponse('Total budget allocation is required', 400);
    }

    if (typeof total !== 'number' || total < 0) {
      return errorResponse('Total budget allocation must be a non-negative number', 400);
    }

    const db = await getDatabase();

    // Get floor
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    // Build budget allocation object
    const budgetAllocation = {
      total: total,
      materials: materials || 0,
      labour: labour || 0,
      equipment: equipment || 0,
      subcontractors: subcontractors || 0,
    };

    // Calculate remaining budget
    const actualSpending = await calculateFloorActualSpending(id);
    const committedCosts = await calculateFloorCommittedCosts(id);
    const remaining = Math.max(0, total - actualSpending.total - committedCosts.total);

    // Update floor
    const updateResult = await db.collection('floors').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          budgetAllocation: budgetAllocation,
          totalBudget: total, // Maintain legacy field for backward compatibility
          'financialStates.remaining': remaining,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!updateResult.value) {
      return errorResponse('Failed to update floor budget', 500);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'BUDGET_ALLOCATED',
      entityType: 'FLOOR',
      entityId: id,
      projectId: floor.projectId.toString(),
      changes: {
        oldBudget: floor.budgetAllocation || { total: floor.totalBudget || 0 },
        newBudget: budgetAllocation,
      },
    });

    return successResponse({
      floor: updateResult.value,
      allocation: budgetAllocation,
      remaining: remaining,
    }, 'Budget allocated to floor successfully');
  } catch (error) {
    console.error('Allocate floor budget error:', error);
    return errorResponse('Failed to allocate budget to floor', 500);
  }
}

/**
 * PATCH /api/floors/[id]/budget
 * Updates floor budget allocation
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
      return errorResponse('Invalid floor ID', 400);
    }

    const body = await request.json();
    const {
      total,
      materials,
      labour,
      equipment,
      subcontractors,
    } = body;

    const db = await getDatabase();

    // Get floor
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    // Build updated budget allocation
    const currentAllocation = floor.budgetAllocation || {
      total: floor.totalBudget || 0,
      materials: 0,
      labour: 0,
      equipment: 0,
      subcontractors: 0,
    };

    const updatedAllocation = {
      total: total !== undefined ? total : currentAllocation.total,
      materials: materials !== undefined ? materials : currentAllocation.materials,
      labour: labour !== undefined ? labour : currentAllocation.labour,
      equipment: equipment !== undefined ? equipment : currentAllocation.equipment,
      subcontractors: subcontractors !== undefined ? subcontractors : currentAllocation.subcontractors,
    };

    // Validate total
    if (updatedAllocation.total < 0) {
      return errorResponse('Total budget allocation cannot be negative', 400);
    }

    // Calculate remaining budget
    const actualSpending = await calculateFloorActualSpending(id);
    const committedCosts = await calculateFloorCommittedCosts(id);
    const remaining = Math.max(0, updatedAllocation.total - actualSpending.total - committedCosts.total);

    // Update floor
    const updateResult = await db.collection('floors').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          budgetAllocation: updatedAllocation,
          totalBudget: updatedAllocation.total, // Maintain legacy field
          'financialStates.remaining': remaining,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!updateResult.value) {
      return errorResponse('Failed to update floor budget', 500);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'BUDGET_UPDATED',
      entityType: 'FLOOR',
      entityId: id,
      projectId: floor.projectId.toString(),
      changes: {
        oldBudget: currentAllocation,
        newBudget: updatedAllocation,
      },
    });

    return successResponse({
      floor: updateResult.value,
      allocation: updatedAllocation,
      remaining: remaining,
    }, 'Floor budget updated successfully');
  } catch (error) {
    console.error('Update floor budget error:', error);
    return errorResponse('Failed to update floor budget', 500);
  }
}
