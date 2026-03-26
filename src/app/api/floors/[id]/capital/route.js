/**
 * Floor Capital Allocation API Route
 * GET: Get capital allocation details for a floor
 * POST: Allocate capital to a floor
 * PATCH: Update capital allocation for a floor
 * 
 * GET /api/floors/[id]/capital
 * POST /api/floors/[id]/capital
 * PATCH /api/floors/[id]/capital
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { allocateCapitalToFloors } from '@/lib/floor-financial-helpers';
import { getProjectFinances } from '@/lib/financial-helpers';
import { calculateFloorActualSpending, calculateFloorCommittedCosts } from '@/lib/floor-financial-helpers';
import { checkCapitalAuthorization, CAPITAL_OPERATION_TYPES } from '@/lib/capital-authorization';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/floors/[id]/capital
 * Returns capital allocation details for a floor
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
    
    // Get floor
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    // Get project finances for context
    const projectFinances = await getProjectFinances(floor.projectId.toString());
    
    // Get floor's actual spending and committed costs
    const actualSpending = await calculateFloorActualSpending(id, true);
    const committedCosts = await calculateFloorCommittedCosts(id, true);

    // Get capital allocation
    const capitalAllocation = floor.capitalAllocation || {
      total: 0,
      byPhase: {},
      used: actualSpending.total || 0,
      committed: committedCosts.total || 0,
      remaining: 0
    };

    // Calculate remaining if not set
    if (capitalAllocation.remaining === undefined || capitalAllocation.remaining === null) {
      capitalAllocation.remaining = Math.max(0, capitalAllocation.total - capitalAllocation.used - capitalAllocation.committed);
    }

    return successResponse({
      floorId: id,
      capitalAllocation: capitalAllocation,
      actualSpending: actualSpending,
      committedCosts: committedCosts,
      projectAvailableCapital: projectFinances?.capitalBalance || 0,
      projectTotalInvested: projectFinances?.totalInvested || 0,
    }, 'Capital allocation retrieved successfully');
  } catch (error) {
    console.error('Get floor capital allocation error:', error);
    return errorResponse('Failed to retrieve capital allocation', 500);
  }
}

/**
 * POST /api/floors/[id]/capital
 * Allocates capital to a floor
 * Auth: OWNER, PM, ACCOUNTANT only
 * Body: { total, strategy?, manualAllocations? }
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

    const userRole = userProfile.role?.toLowerCase();
    const allowedRoles = ['owner', 'pm', 'project_manager', 'accountant'];
    if (!allowedRoles.includes(userRole)) {
      return errorResponse('Insufficient permissions. Only OWNER, PM, and ACCOUNTANT can allocate capital to floors.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid floor ID', 400);
    }

    const body = await request.json();
    const {
      total,
      strategy = 'proportional', // 'proportional' | 'even' | 'manual'
      manualAllocations = {}, // For manual strategy: { phaseCode: amount }
      byPhase, // Optional: direct phase allocations
    } = body;

    if (total === undefined || total === null) {
      return errorResponse('Total capital allocation is required', 400);
    }

    if (typeof total !== 'number' || total <= 0) {
      return errorResponse('Total capital allocation must be a positive number', 400);
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

    const projectId = floor.projectId.toString();

    // Get project finances
    const projectFinances = await getProjectFinances(projectId);
    const availableCapital = projectFinances?.capitalBalance || 0;

    if (total > availableCapital) {
      return errorResponse(
        `Insufficient capital. Available: ${formatCurrency(availableCapital)}, Requested: ${formatCurrency(total)}`,
        400
      );
    }

    // Check authorization level
    const auth = checkCapitalAuthorization(userRole, total);

    // For large amounts requiring approval from non-owners, create a request instead
    if (auth.requiresApproval) {
      // Create capital allocation request
      const capitalRequest = {
        projectId: new ObjectId(projectId),
        floorId: new ObjectId(id),
        requestedBy: userProfile._id,
        requestedByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
        requestedByRole: userProfile.role,
        amount: total,
        operationType: CAPITAL_OPERATION_TYPES.ALLOCATION,
        description: `Capital allocation for floor ${floor.name || `Floor ${floor.floorNumber}`}`,
        metadata: { strategy, byPhase, manualAllocations },
        status: 'pending',
        authLevel: auth.authLevel.name,
        requiresApproval: true,
        autoApproved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        projectFinancesSnapshot: {
          availableCapital,
          totalInvested: projectFinances?.totalInvested || 0
        }
      };

      const result = await db.collection('capital_allocation_requests').insertOne(capitalRequest);

      // Create audit log
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'CAPITAL_REQUESTED',
        entityType: 'CAPITAL_ALLOCATION_REQUEST',
        entityId: result.insertedId.toString(),
        projectId,
        changes: {
          amount: total,
          floorId: id,
          authLevel: auth.authLevel.name
        },
        description: `Capital allocation request created: ${formatCurrency(total)} for floor ${floor.name || `Floor ${floor.floorNumber}`}. Requires approval.`
      });

      return successResponse({
        requestId: result.insertedId.toString(),
        status: 'pending',
        requiresApproval: true,
        requiresConfirmation: auth.requiresConfirmation,
        authLevel: auth.authLevel.name,
        message: auth.message
      }, 'Capital allocation request submitted for approval');
    }

    // Calculate actual spending and committed costs
    const actualSpending = await calculateFloorActualSpending(id, true);
    const committedCosts = await calculateFloorCommittedCosts(id, true);

    // Get existing capital allocation
    const existingCapital = floor.capitalAllocation || {
      total: 0,
      byPhase: {},
      used: 0,
      committed: 0,
      remaining: 0
    };

    // Build new capital allocation
    let newCapitalAllocation;
    
    if (byPhase && typeof byPhase === 'object') {
      // Direct phase allocations provided
      const capitalByPhase = {};
      let totalCapital = 0;

      Object.keys(byPhase).forEach(phaseCode => {
        const phaseCapital = parseFloat(byPhase[phaseCode]) || 0;
        if (phaseCapital > 0) {
          capitalByPhase[phaseCode] = {
            total: phaseCapital,
            used: actualSpending.byPhase?.[phaseCode]?.total || 0,
            committed: committedCosts.byPhase?.[phaseCode]?.total || 0,
            remaining: Math.max(0, phaseCapital - (actualSpending.byPhase?.[phaseCode]?.total || 0) - (committedCosts.byPhase?.[phaseCode]?.total || 0))
          };
          totalCapital += phaseCapital;
        }
      });

      newCapitalAllocation = {
        total: totalCapital,
        byPhase: capitalByPhase,
        used: actualSpending.total,
        committed: committedCosts.total,
        remaining: Math.max(0, totalCapital - actualSpending.total - committedCosts.total)
      };
    } else {
      // Use strategy-based allocation
      const floorBudget = floor.budgetAllocation || { total: floor.totalBudget || 0, byPhase: {} };
      const budgetByPhase = floorBudget.byPhase || {};
      const totalBudget = floorBudget.total || 0;

      // Distribute capital by phase proportionally based on budget
      const capitalByPhase = existingCapital.byPhase || {};
      
      if (strategy === 'even') {
        // Even distribution across phases that have budgets
        const phasesWithBudgets = Object.keys(budgetByPhase).filter(phaseCode => (budgetByPhase[phaseCode]?.total || 0) > 0);
        const capitalPerPhase = phasesWithBudgets.length > 0 ? total / phasesWithBudgets.length : 0;
        
        phasesWithBudgets.forEach(phaseCode => {
          const phaseCapital = (capitalByPhase[phaseCode]?.total || 0) + capitalPerPhase;
          capitalByPhase[phaseCode] = {
            total: phaseCapital,
            used: actualSpending.byPhase?.[phaseCode]?.total || 0,
            committed: committedCosts.byPhase?.[phaseCode]?.total || 0,
            remaining: Math.max(0, phaseCapital - (actualSpending.byPhase?.[phaseCode]?.total || 0) - (committedCosts.byPhase?.[phaseCode]?.total || 0))
          };
        });
      } else if (strategy === 'manual' && Object.keys(manualAllocations).length > 0) {
        // Manual allocation per phase
        Object.keys(manualAllocations).forEach(phaseCode => {
          const phaseCapital = parseFloat(manualAllocations[phaseCode]) || 0;
          if (phaseCapital > 0) {
            capitalByPhase[phaseCode] = {
              total: (capitalByPhase[phaseCode]?.total || 0) + phaseCapital,
              used: actualSpending.byPhase?.[phaseCode]?.total || 0,
              committed: committedCosts.byPhase?.[phaseCode]?.total || 0,
              remaining: Math.max(0, ((capitalByPhase[phaseCode]?.total || 0) + phaseCapital) - (actualSpending.byPhase?.[phaseCode]?.total || 0) - (committedCosts.byPhase?.[phaseCode]?.total || 0))
            };
          }
        });
      } else {
        // Proportional distribution (default)
        if (totalBudget > 0 && Object.keys(budgetByPhase).length > 0) {
          Object.keys(budgetByPhase).forEach(phaseCode => {
            const phaseBudget = budgetByPhase[phaseCode]?.total || 0;
            const phaseBudgetShare = phaseBudget / totalBudget;
            const phaseCapitalAllocation = total * phaseBudgetShare;
            
            capitalByPhase[phaseCode] = {
              total: (capitalByPhase[phaseCode]?.total || 0) + phaseCapitalAllocation,
              used: actualSpending.byPhase?.[phaseCode]?.total || 0,
              committed: committedCosts.byPhase?.[phaseCode]?.total || 0,
              remaining: Math.max(0, ((capitalByPhase[phaseCode]?.total || 0) + phaseCapitalAllocation) - (actualSpending.byPhase?.[phaseCode]?.total || 0) - (committedCosts.byPhase?.[phaseCode]?.total || 0))
            };
          });
        } else {
          // No budget - allocate all to PHASE-02 (legacy behavior)
          capitalByPhase['PHASE-02'] = {
            total: (capitalByPhase['PHASE-02']?.total || 0) + total,
            used: actualSpending.total || 0,
            committed: committedCosts.total || 0,
            remaining: Math.max(0, ((capitalByPhase['PHASE-02']?.total || 0) + total) - actualSpending.total - committedCosts.total)
          };
        }
      }

      newCapitalAllocation = {
        total: existingCapital.total + total,
        byPhase: capitalByPhase,
        used: actualSpending.total,
        committed: committedCosts.total,
        remaining: Math.max(0, (existingCapital.total + total) - actualSpending.total - committedCosts.total)
      };
    }

    // Update floor
    const updateResult = await db.collection('floors').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          capitalAllocation: newCapitalAllocation,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!updateResult.value) {
      return errorResponse('Failed to update floor capital allocation', 500);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CAPITAL_ALLOCATED',
      entityType: 'FLOOR',
      entityId: id,
      projectId: projectId,
      changes: {
        oldCapital: existingCapital.total,
        newCapital: newCapitalAllocation.total,
        strategy: strategy,
        byPhase: newCapitalAllocation.byPhase,
      },
      description: `Capital allocated to floor ${floor.name || `Floor ${floor.floorNumber}`}. Added: ${total.toLocaleString()}, Total: ${newCapitalAllocation.total.toLocaleString()} (Strategy: ${strategy})`
    });

    return successResponse({
      floor: updateResult.value,
      capitalAllocation: newCapitalAllocation,
      strategy: strategy,
    }, 'Capital allocated to floor successfully');
  } catch (error) {
    console.error('Allocate floor capital error:', error);
    return errorResponse('Failed to allocate capital to floor', 500);
  }
}

/**
 * PATCH /api/floors/[id]/capital
 * Updates capital allocation for a floor
 * Auth: OWNER, PM, ACCOUNTANT only
 * Body: { total?, byPhase? }
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

    const userRole = userProfile.role?.toLowerCase();
    const allowedRoles = ['owner', 'pm', 'project_manager', 'accountant'];
    if (!allowedRoles.includes(userRole)) {
      return errorResponse('Insufficient permissions. Only OWNER, PM, and ACCOUNTANT can update floor capital allocation.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid floor ID', 400);
    }

    const body = await request.json();
    const { total, byPhase } = body;

    const db = await getDatabase();

    // Get floor
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    const projectId = floor.projectId.toString();
    const existingCapital = floor.capitalAllocation || {
      total: 0,
      byPhase: {},
      used: 0,
      committed: 0,
      remaining: 0
    };

    // Calculate actual spending and committed costs
    const actualSpending = await calculateFloorActualSpending(id, true);
    const committedCosts = await calculateFloorCommittedCosts(id, true);

    // Build updated capital allocation
    let updatedCapitalAllocation;

    if (byPhase && typeof byPhase === 'object') {
      // Update by phase
      const capitalByPhase = {};
      let totalCapital = 0;

      Object.keys(byPhase).forEach(phaseCode => {
        const phaseCapital = parseFloat(byPhase[phaseCode]) || 0;
        capitalByPhase[phaseCode] = {
          total: phaseCapital,
          used: actualSpending.byPhase?.[phaseCode]?.total || 0,
          committed: committedCosts.byPhase?.[phaseCode]?.total || 0,
          remaining: Math.max(0, phaseCapital - (actualSpending.byPhase?.[phaseCode]?.total || 0) - (committedCosts.byPhase?.[phaseCode]?.total || 0))
        };
        totalCapital += phaseCapital;
      });

      updatedCapitalAllocation = {
        total: totalCapital,
        byPhase: capitalByPhase,
        used: actualSpending.total,
        committed: committedCosts.total,
        remaining: Math.max(0, totalCapital - actualSpending.total - committedCosts.total)
      };
    } else if (total !== undefined) {
      // Update total (proportional distribution)
      const floorBudget = floor.budgetAllocation || { total: floor.totalBudget || 0, byPhase: {} };
      const budgetByPhase = floorBudget.byPhase || {};
      const totalBudget = floorBudget.total || 0;

      const capitalByPhase = {};
      
      if (totalBudget > 0 && Object.keys(budgetByPhase).length > 0) {
        Object.keys(budgetByPhase).forEach(phaseCode => {
          const phaseBudget = budgetByPhase[phaseCode]?.total || 0;
          const phaseBudgetShare = phaseBudget / totalBudget;
          const phaseCapital = total * phaseBudgetShare;
          
          capitalByPhase[phaseCode] = {
            total: phaseCapital,
            used: actualSpending.byPhase?.[phaseCode]?.total || 0,
            committed: committedCosts.byPhase?.[phaseCode]?.total || 0,
            remaining: Math.max(0, phaseCapital - (actualSpending.byPhase?.[phaseCode]?.total || 0) - (committedCosts.byPhase?.[phaseCode]?.total || 0))
          };
        });
      } else {
        // No budget - allocate all to PHASE-02
        capitalByPhase['PHASE-02'] = {
          total: total,
          used: actualSpending.total || 0,
          committed: committedCosts.total || 0,
          remaining: Math.max(0, total - actualSpending.total - committedCosts.total)
        };
      }

      updatedCapitalAllocation = {
        total: total,
        byPhase: capitalByPhase,
        used: actualSpending.total,
        committed: committedCosts.total,
        remaining: Math.max(0, total - actualSpending.total - committedCosts.total)
      };
    } else {
      return errorResponse('Either total or byPhase must be provided', 400);
    }

    // Validate against available project capital
    const projectFinances = await getProjectFinances(projectId);
    const availableCapital = projectFinances?.capitalBalance || 0;
    const capitalChange = updatedCapitalAllocation.total - existingCapital.total;

    if (capitalChange > 0 && capitalChange > availableCapital) {
      return errorResponse(
        `Insufficient capital. Available: ${availableCapital.toLocaleString()} KES, Additional needed: ${capitalChange.toLocaleString()} KES`,
        400
      );
    }

    // Update floor
    const updateResult = await db.collection('floors').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          capitalAllocation: updatedCapitalAllocation,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!updateResult.value) {
      return errorResponse('Failed to update floor capital allocation', 500);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CAPITAL_ALLOCATION_UPDATED',
      entityType: 'FLOOR',
      entityId: id,
      projectId: projectId,
      changes: {
        oldCapital: existingCapital,
        newCapital: updatedCapitalAllocation,
      },
      description: `Capital allocation updated for floor ${floor.name || `Floor ${floor.floorNumber}`}. Old: ${existingCapital.total.toLocaleString()}, New: ${updatedCapitalAllocation.total.toLocaleString()}`
    });

    return successResponse({
      floor: updateResult.value,
      capitalAllocation: updatedCapitalAllocation,
    }, 'Capital allocation updated successfully');
  } catch (error) {
    console.error('Update floor capital allocation error:', error);
    return errorResponse('Failed to update capital allocation', 500);
  }
}

/**
 * Format currency helper
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}
