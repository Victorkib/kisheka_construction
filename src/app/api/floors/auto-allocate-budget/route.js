/**
 * Floor Budget Auto-Allocation API
 * POST: Auto-allocate phase budget to floors based on floor type weights
 *
 * POST /api/floors/auto-allocate-budget
 * Body: {
 *   phaseId: string,
 *   projectId: string,
 *   strategy: 'weighted' | 'even' | 'custom',
 *   customWeights?: object
 * }
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/floors/auto-allocate-budget
 * Auto-allocate phase budget to floors
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    const allowedRoles = ['owner', 'pm', 'project_manager', 'accountant'];
    if (!allowedRoles.includes(userRole)) {
      return errorResponse('Insufficient permissions to auto-allocate budgets', 403);
    }

    const body = await request.json();
    const {
      phaseId,
      projectId,
      strategy = 'weighted',
      customWeights = {},
      onlyZeroBudgets = false // Only allocate to floors with no budget
    } = body;

    // Validation
    if (!phaseId || !ObjectId.isValid(phaseId)) {
      return errorResponse('Valid phaseId required', 400);
    }

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId required', 400);
    }

    const db = await getDatabase();
    const phaseObjectId = new ObjectId(phaseId);
    const projectObjectId = new ObjectId(projectId);

    // Get phase
    const phase = await db.collection('phases').findOne({
      _id: phaseObjectId,
      projectId: projectObjectId,
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found or does not belong to project', 404);
    }

    const phaseBudget = phase.budgetAllocation?.total || 0;
    const phaseCode = phase.phaseCode;

    if (phaseBudget === 0) {
      return errorResponse('Phase has no budget to allocate', 400);
    }

    // Get all floors for the project
    const floors = await db.collection('floors').find({
      projectId: projectObjectId,
      deletedAt: null
    }).toArray();

    if (floors.length === 0) {
      return errorResponse('No floors found for this project', 404);
    }

    // Determine target floors based on phase code
    const targetFloors = getTargetFloorsForPhase(phaseCode, floors);

    if (targetFloors.length === 0) {
      return errorResponse('No target floors found for this phase', 400);
    }

    // Filter to only zero-budget floors if requested
    const floorsToAllocate = onlyZeroBudgets
      ? targetFloors.filter(f => {
          const phaseBudget = f.budgetAllocation?.byPhase?.[phaseCode]?.total || 0;
          return phaseBudget === 0;
        })
      : targetFloors;

    if (floorsToAllocate.length === 0) {
      return errorResponse(
        onlyZeroBudgets 
          ? 'All target floors already have budget for this phase'
          : 'No floors to allocate budget to',
        400
      );
    }

    // Calculate allocations based on strategy
    let allocations = [];

    if (strategy === 'even') {
      // Even distribution
      const perFloorBudget = Math.floor(phaseBudget / floorsToAllocate.length);
      const remainder = phaseBudget - (perFloorBudget * floorsToAllocate.length);

      allocations = floorsToAllocate.map((floor, index) => ({
        floorId: floor._id,
        floorName: floor.name || `Floor ${floor.floorNumber}`,
        floorNumber: floor.floorNumber,
        floorType: getFloorType(floor.floorNumber),
        allocatedBudget: perFloorBudget + (index === floorsToAllocate.length - 1 ? remainder : 0),
        categoryBreakdown: {
          materials: Math.round((perFloorBudget + (index === floorsToAllocate.length - 1 ? remainder : 0)) * 0.65),
          labour: Math.round((perFloorBudget + (index === floorsToAllocate.length - 1 ? remainder : 0)) * 0.25),
          equipment: Math.round((perFloorBudget + (index === floorsToAllocate.length - 1 ? remainder : 0)) * 0.05),
          subcontractors: Math.round((perFloorBudget + (index === floorsToAllocate.length - 1 ? remainder : 0)) * 0.03),
          contingency: Math.round((perFloorBudget + (index === floorsToAllocate.length - 1 ? remainder : 0)) * 0.02)
        }
      }));
    } else if (strategy === 'weighted') {
      // Weighted distribution based on floor type
      const weights = getPhaseFloorWeights(phaseCode);
      
      const totalWeight = floorsToAllocate.reduce((sum, floor) => {
        const floorType = getFloorType(floor.floorNumber);
        return sum + (weights[floorType] || 1.0);
      }, 0);

      allocations = floorsToAllocate.map((floor, index) => {
        const floorType = getFloorType(floor.floorNumber);
        const weight = weights[floorType] || 1.0;
        const floorShare = (weight / totalWeight) * phaseBudget;
        
        return {
          floorId: floor._id,
          floorName: floor.name || `Floor ${floor.floorNumber}`,
          floorNumber: floor.floorNumber,
          floorType,
          weight,
          allocatedBudget: Math.round(floorShare),
          categoryBreakdown: {
            materials: Math.round(floorShare * 0.65),
            labour: Math.round(floorShare * 0.25),
            equipment: Math.round(floorShare * 0.05),
            subcontractors: Math.round(floorShare * 0.03),
            contingency: Math.round(floorShare * 0.02)
          }
        };
      });

      // Adjust for rounding errors
      const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedBudget, 0);
      const difference = phaseBudget - totalAllocated;
      if (difference !== 0) {
        allocations[allocations.length - 1].allocatedBudget += difference;
        // Recalculate category breakdown for last floor
        const lastAlloc = allocations[allocations.length - 1];
        const budget = lastAlloc.allocatedBudget;
        lastAlloc.categoryBreakdown = {
          materials: Math.round(budget * 0.65),
          labour: Math.round(budget * 0.25),
          equipment: Math.round(budget * 0.05),
          subcontractors: Math.round(budget * 0.03),
          contingency: Math.round(budget * 0.02)
        };
      }
    } else if (strategy === 'custom' && Object.keys(customWeights).length > 0) {
      // Custom weights per floor
      const totalWeight = Object.values(customWeights).reduce((sum, w) => sum + (w || 0), 0);
      
      if (totalWeight === 0) {
        return errorResponse('Custom weights must sum to a value greater than 0', 400);
      }

      allocations = floorsToAllocate.map(floor => {
        const weight = customWeights[floor._id.toString()] || 0;
        const floorShare = (weight / totalWeight) * phaseBudget;
        
        return {
          floorId: floor._id,
          floorName: floor.name || `Floor ${floor.floorNumber}`,
          floorNumber: floor.floorNumber,
          floorType: getFloorType(floor.floorNumber),
          weight,
          allocatedBudget: Math.round(floorShare),
          categoryBreakdown: {
            materials: Math.round(floorShare * 0.65),
            labour: Math.round(floorShare * 0.25),
            equipment: Math.round(floorShare * 0.05),
            subcontractors: Math.round(floorShare * 0.03),
            contingency: Math.round(floorShare * 0.02)
          }
        };
      });
    } else {
      return errorResponse('Invalid strategy. Must be "weighted", "even", or "custom" with customWeights', 400);
    }

    // Execute allocations
    const updateResults = [];
    
    for (const allocation of allocations) {
      const floor = await db.collection('floors').findOne({
        _id: allocation.floorId
      });

      if (!floor) continue;

      // Get existing budget allocation
      const existingBudget = floor.budgetAllocation || {
        total: floor.totalBudget || 0,
        byPhase: {},
        materials: 0,
        labour: 0,
        equipment: 0,
        subcontractors: 0,
        contingency: 0
      };

      // Update phase-specific budget
      const existingPhaseBudget = existingBudget.byPhase?.[phaseCode] || {
        total: 0,
        materials: 0,
        labour: 0,
        equipment: 0,
        subcontractors: 0,
        contingency: 0
      };

      const newPhaseBudget = {
        total: existingPhaseBudget.total + allocation.allocatedBudget,
        materials: existingPhaseBudget.materials + allocation.categoryBreakdown.materials,
        labour: existingPhaseBudget.labour + allocation.categoryBreakdown.labour,
        equipment: existingPhaseBudget.equipment + allocation.categoryBreakdown.equipment,
        subcontractors: existingPhaseBudget.subcontractors + allocation.categoryBreakdown.subcontractors,
        contingency: existingPhaseBudget.contingency + allocation.categoryBreakdown.contingency
      };

      // Update floor budget
      const newBudgetAllocation = {
        ...existingBudget,
        total: (existingBudget.total || 0) + allocation.allocatedBudget,
        byPhase: {
          ...existingBudget.byPhase,
          [phaseCode]: newPhaseBudget
        },
        materials: (existingBudget.materials || 0) + allocation.categoryBreakdown.materials,
        labour: (existingBudget.labour || 0) + allocation.categoryBreakdown.labour,
        equipment: (existingBudget.equipment || 0) + allocation.categoryBreakdown.equipment,
        subcontractors: (existingBudget.subcontractors || 0) + allocation.categoryBreakdown.subcontractors,
        contingency: (existingBudget.contingency || 0) + allocation.categoryBreakdown.contingency
      };

      await db.collection('floors').updateOne(
        { _id: allocation.floorId },
        {
          $set: {
            budgetAllocation: newBudgetAllocation,
            totalBudget: newBudgetAllocation.total,
            updatedAt: new Date()
          }
        }
      );

      updateResults.push({
        floorId: allocation.floorId.toString(),
        floorName: allocation.floorName,
        previousBudget: existingPhaseBudget.total,
        newBudget: newPhaseBudget.total,
        allocated: allocation.allocatedBudget
      });

      // Create audit log
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'BUDGET_AUTO_ALLOCATED',
        entityType: 'FLOOR',
        entityId: allocation.floorId.toString(),
        projectId,
        changes: {
          phaseCode,
          previousBudget: existingPhaseBudget.total,
          newBudget: newPhaseBudget.total,
          allocated: allocation.allocatedBudget,
          strategy
        },
        description: `Auto-allocated ${formatCurrency(allocation.allocatedBudget)} to floor ${allocation.floorName} for phase ${phaseCode} using ${strategy} strategy`
      });
    }

    return successResponse({
      phaseId,
      phaseCode,
      phaseBudget,
      strategy,
      allocatedFloors: updateResults.length,
      totalAllocated: updateResults.reduce((sum, r) => sum + r.allocated, 0),
      allocations: updateResults,
      message: `Successfully allocated ${formatCurrency(phaseBudget)} to ${updateResults.length} floor(s) for phase ${phaseCode}`
    }, 'Budget auto-allocated successfully');
  } catch (error) {
    console.error('Auto-allocate budget error:', error);
    return errorResponse('Failed to auto-allocate budget', 500);
  }
}

/**
 * Get target floors for a phase based on phase code
 */
function getTargetFloorsForPhase(phaseCode, allFloors) {
  switch (phaseCode) {
    case 'PHASE-01':
      // Basement phase: Only basement floors
      return allFloors.filter(f => f.floorNumber < 0);
    case 'PHASE-02':
      // Superstructure: Ground + Upper floors
      return allFloors.filter(f => f.floorNumber >= 0);
    case 'PHASE-03':
    case 'PHASE-04':
      // Finishing/Final: All floors
      return allFloors;
    default:
      return allFloors;
  }
}

/**
 * Get floor type from floor number
 */
function getFloorType(floorNumber) {
  if (floorNumber === undefined || floorNumber === null) return 'unknown';
  if (floorNumber < 0) return 'basement';
  if (floorNumber === 0) return 'ground';
  return 'typical';
}

/**
 * Get phase-specific floor weights
 */
function getPhaseFloorWeights(phaseCode) {
  const weights = {
    'PHASE-01': {
      basement: 1.2, // Basements get 20% more of basement phase budget
      ground: 0,
      typical: 0,
      unknown: 0
    },
    'PHASE-02': {
      basement: 0,
      ground: 1.3, // Ground floor gets 30% more of superstructure
      typical: 1.0,
      penthouse: 1.5,
      rooftop: 0,
      unknown: 1.0
    },
    'PHASE-03': {
      basement: 0.8,
      ground: 1.2,
      typical: 1.0,
      penthouse: 1.3,
      rooftop: 1.2,
      unknown: 1.0
    },
    'PHASE-04': {
      basement: 0.5,
      ground: 1.0,
      typical: 1.0,
      penthouse: 1.2,
      rooftop: 1.5,
      unknown: 1.0
    }
  };

  return weights[phaseCode] || { basement: 1.0, ground: 1.0, typical: 1.0, unknown: 1.0 };
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}
