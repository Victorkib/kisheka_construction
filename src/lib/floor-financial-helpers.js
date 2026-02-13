/**
 * Floor Financial Helper Functions
 * Utilities for calculating floor budgets and actual spending
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { MATERIAL_APPROVED_STATUSES } from '@/lib/status-constants';

/**
 * Calculate actual spending for a floor from materials and labour
 * @param {string} floorId - Floor ID
 * @returns {Promise<Object>} Actual spending breakdown
 */
export async function calculateFloorActualSpending(floorId) {
  const db = await getDatabase();
  
  if (!floorId || !ObjectId.isValid(floorId)) {
    throw new Error('Invalid floor ID');
  }
  
  const floorObjectId = new ObjectId(floorId);
  
  // Calculate materials spending (approved/received materials)
  const materialsAggregation = await db.collection('materials').aggregate([
    {
      $match: {
        floor: floorObjectId,
        deletedAt: null,
        status: { $in: MATERIAL_APPROVED_STATUSES },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalCost' },
      },
    },
  ]).toArray();
  
  const materialsSpending = materialsAggregation[0]?.total || 0;
  
  // Calculate labour spending (approved labour entries)
  const labourAggregation = await db.collection('labour_entries').aggregate([
    {
      $match: {
        floorId: floorObjectId,
        deletedAt: null,
        status: { $in: ['approved', 'paid'] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalCost' },
      },
    },
  ]).toArray();
  
  const labourSpending = labourAggregation[0]?.total || 0;
  
  // Calculate equipment spending (if equipment is linked to floors)
  // Note: Equipment might not be directly linked to floors, so this might be 0
  const equipmentSpending = 0; // Placeholder for future implementation
  
  // Calculate subcontractor spending (if subcontractors are linked to floors)
  // Note: Subcontractors might not be directly linked to floors, so this might be 0
  const subcontractorSpending = 0; // Placeholder for future implementation
  
  const totalSpending = materialsSpending + labourSpending + equipmentSpending + subcontractorSpending;
  
  return {
    total: totalSpending,
    materials: materialsSpending,
    labour: labourSpending,
    equipment: equipmentSpending,
    subcontractors: subcontractorSpending,
  };
}

/**
 * Calculate committed costs for a floor (from pending material requests and purchase orders)
 * @param {string} floorId - Floor ID
 * @returns {Promise<Object>} Committed costs breakdown
 */
export async function calculateFloorCommittedCosts(floorId) {
  const db = await getDatabase();
  
  if (!floorId || !ObjectId.isValid(floorId)) {
    throw new Error('Invalid floor ID');
  }
  
  const floorObjectId = new ObjectId(floorId);
  
  // Calculate committed from material requests (pending/approved but not received)
  const materialRequestsAggregation = await db.collection('material_requests').aggregate([
    {
      $match: {
        floorId: floorObjectId,
        deletedAt: null,
        status: { $in: ['pending', 'approved'] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$estimatedCost' },
      },
    },
  ]).toArray();
  
  const materialRequestsCommitted = materialRequestsAggregation[0]?.total || 0;
  
  // Calculate committed from purchase orders (pending/approved but not received)
  const purchaseOrdersAggregation = await db.collection('purchase_orders').aggregate([
    {
      $match: {
        floorId: floorObjectId,
        deletedAt: null,
        status: { $in: ['pending', 'approved', 'ordered'] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalAmount' },
      },
    },
  ]).toArray();
  
  const purchaseOrdersCommitted = purchaseOrdersAggregation[0]?.total || 0;
  
  const totalCommitted = materialRequestsCommitted + purchaseOrdersCommitted;
  
  return {
    total: totalCommitted,
    materialRequests: materialRequestsCommitted,
    purchaseOrders: purchaseOrdersCommitted,
  };
}

/**
 * Update floor financial states (remaining budget, etc.)
 * @param {string} floorId - Floor ID
 * @returns {Promise<Object>} Updated financial states
 */
export async function updateFloorFinancials(floorId) {
  const db = await getDatabase();
  
  if (!floorId || !ObjectId.isValid(floorId)) {
    throw new Error('Invalid floor ID');
  }
  
  const floor = await db.collection('floors').findOne({
    _id: new ObjectId(floorId),
    deletedAt: null,
  });
  
  if (!floor) {
    throw new Error('Floor not found');
  }
  
  // Calculate actual spending
  const actualSpending = await calculateFloorActualSpending(floorId);
  
  // Calculate committed costs
  const committedCosts = await calculateFloorCommittedCosts(floorId);
  
  // Get budget allocation (new structure)
  const budgetAllocation = floor.budgetAllocation || { total: floor.totalBudget || 0 };
  const budgetTotal = budgetAllocation.total || 0;
  
  // Calculate remaining budget
  const remaining = Math.max(0, budgetTotal - actualSpending.total - committedCosts.total);
  
  // Update floor with financial states
  await db.collection('floors').updateOne(
    { _id: new ObjectId(floorId) },
    {
      $set: {
        actualSpending: actualSpending,
        'financialStates.committed': committedCosts.total,
        'financialStates.remaining': remaining,
        updatedAt: new Date(),
      },
    }
  );
  
  return {
    budgetAllocation: budgetAllocation,
    actualSpending: actualSpending,
    committedCosts: committedCosts,
    remaining: remaining,
  };
}

/**
 * Calculate total floor budgets for a phase
 * @param {string} phaseId - Phase ID
 * @returns {Promise<number>} Total floor budgets for the phase
 */
export async function calculateTotalFloorBudgetsForPhase(phaseId) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    throw new Error('Invalid phase ID');
  }
  
  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null,
  });
  
  if (!phase) {
    throw new Error('Phase not found');
  }
  
  const projectId = phase.projectId;
  
  // Get all floors for the project
  const floors = await db.collection('floors').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).toArray();
  
  // Sum up floor budgets
  const total = floors.reduce((sum, floor) => {
    const budgetAllocation = floor.budgetAllocation || { total: floor.totalBudget || 0 };
    return sum + (budgetAllocation.total || 0);
  }, 0);
  
  return total;
}

/**
 * Get floor budget allocation suggestions (even distribution)
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Array>} Array of suggested floor budgets
 */
export async function getEvenDistributionFloorBudgets(phaseId) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    throw new Error('Invalid phase ID');
  }
  
  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null,
  });
  
  if (!phase) {
    throw new Error('Phase not found');
  }
  
  const projectId = phase.projectId;
  const phaseBudget = phase.budgetAllocation?.total || 0;
  
  // Get all floors for the project
  const floors = await db.collection('floors').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).sort({ floorNumber: 1 }).toArray();
  
  if (floors.length === 0) {
    return [];
  }
  
  // Even distribution: divide phase budget equally among floors
  const budgetPerFloor = Math.floor(phaseBudget / floors.length);
  const remainder = phaseBudget - (budgetPerFloor * floors.length);
  
  return floors.map((floor, index) => ({
    floorId: floor._id.toString(),
    floorNumber: floor.floorNumber,
    floorName: floor.name,
    suggestedBudget: budgetPerFloor + (index === floors.length - 1 ? remainder : 0), // Add remainder to last floor
  }));
}

/**
 * Validate floor budget for material or labour spending
 * @param {string} floorId - Floor ID
 * @param {number} amount - Amount to validate
 * @param {string} category - 'materials' | 'labour' | 'equipment' | 'subcontractors'
 * @param {string} excludeId - Optional ID to exclude from committed costs (e.g., materialRequestId, labourEntryId)
 * @returns {Promise<Object>} Validation result
 */
export async function validateFloorBudget(floorId, amount, category = 'materials', excludeId = null) {
  const db = await getDatabase();
  
  if (!floorId || !ObjectId.isValid(floorId)) {
    return {
      isValid: false,
      message: 'Invalid floor ID',
      floorBudget: 0,
      available: 0,
      required: amount,
      shortfall: amount,
      budgetNotSet: false,
    };
  }
  
  if (!amount || amount <= 0) {
    return {
      isValid: true,
      message: 'Amount is zero or negative',
      floorBudget: 0,
      available: 0,
      required: amount,
      shortfall: 0,
      budgetNotSet: false,
    };
  }
  
  // Get floor
  const floor = await db.collection('floors').findOne({
    _id: new ObjectId(floorId),
    deletedAt: null,
  });
  
  if (!floor) {
    return {
      isValid: false,
      message: 'Floor not found',
      floorBudget: 0,
      available: 0,
      required: amount,
      shortfall: amount,
      budgetNotSet: false,
    };
  }
  
  // Get budget allocation (new structure or legacy)
  const budgetAllocation = floor.budgetAllocation || { total: floor.totalBudget || 0 };
  
  // Get category-specific budget
  let categoryBudget = 0;
  if (category === 'materials') {
    categoryBudget = budgetAllocation.materials || budgetAllocation.total || 0;
  } else if (category === 'labour') {
    categoryBudget = budgetAllocation.labour || budgetAllocation.total || 0;
  } else if (category === 'equipment') {
    categoryBudget = budgetAllocation.equipment || budgetAllocation.total || 0;
  } else if (category === 'subcontractors') {
    categoryBudget = budgetAllocation.subcontractors || budgetAllocation.total || 0;
  } else {
    // Default to total budget
    categoryBudget = budgetAllocation.total || 0;
  }
  
  // OPTIONAL BUDGET: If budget is zero, allow operation and track spending
  if (categoryBudget === 0) {
    return {
      isValid: true,
      available: 0,
      required: amount,
      shortfall: 0,
      floorBudget: 0,
      message: 'No floor budget set for this category. Operation allowed - spending will be tracked. Set floor budget later to enable floor budget validation.',
      budgetNotSet: true,
    };
  }
  
  // Calculate current spending for this category
  let currentSpending = 0;
  
  if (category === 'materials') {
    // Get materials spending
    const materialsAgg = await db.collection('materials').aggregate([
      {
        $match: {
          floor: new ObjectId(floorId),
          deletedAt: null,
          status: { $in: MATERIAL_APPROVED_STATUSES },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalCost' },
        },
      },
    ]).toArray();
    
    currentSpending = materialsAgg[0]?.total || 0;
    
    // Add committed costs from material requests (excluding current request if provided)
    const matchQuery = {
      floorId: new ObjectId(floorId),
      deletedAt: null,
      status: { $in: ['pending', 'approved'] },
    };
    
    if (excludeId && ObjectId.isValid(excludeId)) {
      matchQuery._id = { $ne: new ObjectId(excludeId) };
    }
    
    const requestsAgg = await db.collection('material_requests').aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: '$estimatedCost' },
        },
      },
    ]).toArray();
    
    currentSpending += requestsAgg[0]?.total || 0;
  } else if (category === 'labour') {
    // Get labour spending
    const matchQuery = {
      floorId: new ObjectId(floorId),
      deletedAt: null,
      status: { $in: ['approved', 'paid'] },
    };
    
    if (excludeId && ObjectId.isValid(excludeId)) {
      matchQuery._id = { $ne: new ObjectId(excludeId) };
    }
    
    const labourAgg = await db.collection('labour_entries').aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalCost' },
        },
      },
    ]).toArray();
    
    currentSpending = labourAgg[0]?.total || 0;
  }
  
  // Calculate available budget
  const available = Math.max(0, categoryBudget - currentSpending);
  const shortfall = amount > available ? amount - available : 0;
  
  return {
    isValid: available >= amount,
    available: available,
    required: amount,
    shortfall: shortfall,
    floorBudget: categoryBudget,
    currentSpending: currentSpending,
    message: available >= amount
      ? `Floor budget sufficient. Available: ${available.toLocaleString()}, Required: ${amount.toLocaleString()}`
      : `Floor budget exceeded. Available: ${available.toLocaleString()}, Required: ${amount.toLocaleString()}, Shortfall: ${shortfall.toLocaleString()}`,
    budgetNotSet: false,
  };
}

/**
 * Get floor budget allocation suggestions (weighted by floor type)
 * @param {string} phaseId - Phase ID
 * @param {Object} weights - Optional weights: { basement: 1.2, typical: 1.0, penthouse: 1.3 }
 * @returns {Promise<Array>} Array of suggested floor budgets
 */
export async function getWeightedDistributionFloorBudgets(phaseId, weights = {}) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    throw new Error('Invalid phase ID');
  }
  
  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null,
  });
  
  if (!phase) {
    throw new Error('Phase not found');
  }
  
  const projectId = phase.projectId;
  const phaseBudget = phase.budgetAllocation?.total || 0;
  
  // Default weights
  const defaultWeights = {
    basement: weights.basement || 1.2,
    typical: weights.typical || 1.0,
    penthouse: weights.penthouse || 1.3,
  };
  
  // Get all floors for the project
  const floors = await db.collection('floors').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).sort({ floorNumber: 1 }).toArray();
  
  if (floors.length === 0) {
    return [];
  }
  
  // Determine floor type and assign weight
  const floorsWithWeights = floors.map((floor) => {
    let floorType = 'typical';
    let weight = defaultWeights.typical;
    
    if (floor.floorNumber < 0) {
      floorType = 'basement';
      weight = defaultWeights.basement;
    } else if (floor.floorNumber >= 10) { // Assuming top floor/penthouse is floor 10+
      floorType = 'penthouse';
      weight = defaultWeights.penthouse;
    }
    
    return {
      floorId: floor._id.toString(),
      floorNumber: floor.floorNumber,
      floorName: floor.name,
      floorType,
      weight,
    };
  });
  
  // Calculate total weight
  const totalWeight = floorsWithWeights.reduce((sum, f) => sum + f.weight, 0);
  
  // Calculate budget per weight unit
  const budgetPerWeightUnit = phaseBudget / totalWeight;
  
  // Assign budgets based on weights
  return floorsWithWeights.map((floor) => ({
    ...floor,
    suggestedBudget: Math.round(floor.weight * budgetPerWeightUnit),
  }));
}

/**
 * Allocate Superstructure phase budget to floors automatically
 * Supports both even and weighted distribution strategies
 * @param {string} phaseId - Phase ID (should be Superstructure phase)
 * @param {string} strategy - 'even' | 'weighted' (default: 'weighted')
 * @param {string} userId - User ID performing the operation (for audit log)
 * @param {Object} weights - Optional weights for weighted strategy: { basement: 1.2, typical: 1.0, penthouse: 1.3 }
 * @returns {Promise<Object>} Summary of allocated floors
 */
export async function allocateSuperstructureBudgetToFloors(phaseId, strategy = 'weighted', userId = null, weights = {}) {
  const db = await getDatabase();
  const { createAuditLog } = await import('@/lib/audit-log');
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    throw new Error('Invalid phase ID');
  }
  
  // Get phase
  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null,
  });
  
  if (!phase) {
    throw new Error('Phase not found');
  }
  
  // Verify this is Superstructure phase
  if (phase.phaseCode !== 'PHASE-02') {
    throw new Error('Floor budget allocation is only available for Superstructure phase (PHASE-02)');
  }
  
  const projectId = phase.projectId;
  const phaseBudget = phase.budgetAllocation?.total || 0;
  
  if (phaseBudget <= 0) {
    return {
      allocated: 0,
      skipped: 0,
      floors: [],
      message: 'Phase has no budget allocated. Allocate phase budget first.'
    };
  }
  
  // Get all floors for the project
  const floors = await db.collection('floors').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).sort({ floorNumber: 1 }).toArray();
  
  if (floors.length === 0) {
    return {
      allocated: 0,
      skipped: 0,
      floors: [],
      message: 'No floors found for this project'
    };
  }
  
  // Filter floors that need allocation (zero budgets)
  const floorsNeedingAllocation = floors.filter(floor => {
    const currentBudget = floor.budgetAllocation?.total || floor.totalBudget || 0;
    return currentBudget === 0;
  });
  
  if (floorsNeedingAllocation.length === 0) {
    return {
      allocated: 0,
      skipped: floors.length,
      floors: [],
      message: 'All floors already have budget allocations'
    };
  }
  
  // Calculate floor allocations based on strategy
  let floorAllocations = [];
  
  if (strategy === 'even') {
    // Even distribution: divide phase budget equally among floors
    const budgetPerFloor = Math.floor(phaseBudget / floorsNeedingAllocation.length);
    const remainder = phaseBudget - (budgetPerFloor * floorsNeedingAllocation.length);
    
    floorAllocations = floorsNeedingAllocation.map((floor, index) => ({
      floorId: floor._id.toString(),
      floorNumber: floor.floorNumber,
      floorName: floor.name,
      suggestedBudget: budgetPerFloor + (index === floorsNeedingAllocation.length - 1 ? remainder : 0),
    }));
  } else {
    // Weighted distribution (default)
    const defaultWeights = {
      basement: weights.basement || 1.2,
      typical: weights.typical || 1.0,
      penthouse: weights.penthouse || 1.3,
    };
    
    // Determine floor type and assign weight
    const floorsWithWeights = floorsNeedingAllocation.map((floor) => {
      let floorType = 'typical';
      let weight = defaultWeights.typical;
      
      if (floor.floorNumber < 0) {
        floorType = 'basement';
        weight = defaultWeights.basement;
      } else if (floor.floorNumber >= 10) { // Assuming top floor/penthouse is floor 10+
        floorType = 'penthouse';
        weight = defaultWeights.penthouse;
      }
      
      return {
        floorId: floor._id.toString(),
        floorNumber: floor.floorNumber,
        floorName: floor.name,
        floorType,
        weight,
      };
    });
    
    // Calculate total weight
    const totalWeight = floorsWithWeights.reduce((sum, f) => sum + f.weight, 0);
    
    // Calculate budget per weight unit
    const budgetPerWeightUnit = phaseBudget / totalWeight;
    
    // Assign budgets based on weights
    floorAllocations = floorsWithWeights.map((floor) => ({
      ...floor,
      suggestedBudget: Math.round(floor.weight * budgetPerWeightUnit),
    }));
  }
  
  const allocatedFloors = [];
  const skippedFloors = [];
  const warnings = [];
  
  // Allocate budgets to floors
  for (const allocation of floorAllocations) {
    const floor = floorsNeedingAllocation.find(f => f._id.toString() === allocation.floorId);
    if (!floor) {
      skippedFloors.push({
        floorId: allocation.floorId,
        floorName: allocation.floorName,
        reason: 'Floor not found'
      });
      continue;
    }
    
    const suggestedBudget = allocation.suggestedBudget || 0;
    
    if (suggestedBudget <= 0) {
      skippedFloors.push({
        floorId: allocation.floorId,
        floorName: allocation.floorName,
        reason: 'Suggested budget is zero or negative'
      });
      continue;
    }
    
    // CRITICAL FIX: Calculate actual spending and committed costs before allocation
    let actualSpending = { total: 0, materials: 0, labour: 0, equipment: 0, subcontractors: 0 };
    let committedCosts = { total: 0 };
    
    try {
      // Calculate actual spending
      actualSpending = await calculateFloorActualSpending(floor._id.toString());
      
      // Calculate committed costs
      committedCosts = await calculateFloorCommittedCosts(floor._id.toString());
      
    } catch (spendingError) {
      console.error(`Error calculating spending for floor ${floor._id}:`, spendingError);
      // Continue with allocation but log warning
      warnings.push({
        floorId: floor._id.toString(),
        floorName: floor.name || `Floor ${floor.floorNumber}`,
        message: 'Could not calculate actual spending. Proceeding with allocation.'
      });
    }
    
    // Calculate minimum required budget
    const minimumRequired = actualSpending.total + committedCosts.total;
    
    // Validate allocation against minimum required
    let finalBudget = suggestedBudget;
    let allocationAdjusted = false;
    
    if (suggestedBudget < minimumRequired) {
      // Allocate minimum required instead of suggested amount
      finalBudget = minimumRequired;
      allocationAdjusted = true;
      
      warnings.push({
        floorId: floor._id.toString(),
        floorName: floor.name || `Floor ${floor.floorNumber}`,
        message: `Suggested allocation (${suggestedBudget.toLocaleString()}) was less than required minimum (${minimumRequired.toLocaleString()}). Allocated minimum required instead.`,
        actualSpending: actualSpending.total,
        committedCosts: committedCosts.total,
        minimumRequired: minimumRequired,
        suggestedBudget: suggestedBudget
      });
    }
    
    // Build new budget allocation
    const newBudgetAllocation = {
      total: Math.round(finalBudget * 100) / 100,
      materials: Math.round(finalBudget * 0.65 * 100) / 100,
      labour: Math.round(finalBudget * 0.25 * 100) / 100,
      equipment: Math.round(finalBudget * 0.05 * 100) / 100,
      subcontractors: Math.round(finalBudget * 0.03 * 100) / 100,
      contingency: 0
    };
    
    // Calculate remaining budget
    const remaining = Math.max(0, newBudgetAllocation.total - actualSpending.total - committedCosts.total);
    
    // Update floor with budget allocation and financial states
    await db.collection('floors').updateOne(
      { _id: floor._id },
      {
        $set: {
          budgetAllocation: newBudgetAllocation,
          totalBudget: newBudgetAllocation.total, // Maintain legacy field
          'financialStates.remaining': remaining,
          'financialStates.actual': actualSpending.total,
          'financialStates.committed': committedCosts.total,
          updatedAt: new Date()
        }
      }
    );
    
    allocatedFloors.push({
      floorId: floor._id.toString(),
      floorNumber: floor.floorNumber,
      floorName: floor.name,
      oldTotal: 0,
      newTotal: newBudgetAllocation.total,
      actualSpending: actualSpending.total,
      committedCosts: committedCosts.total,
      minimumRequired: minimumRequired,
      allocationAdjusted: allocationAdjusted,
      strategy: strategy
    });
    
    // Create audit log
    if (userId) {
      try {
        await createAuditLog({
          userId: userId,
          action: 'update',
          entityType: 'floor',
          entityId: floor._id.toString(),
          changes: {
            budgetAllocation: {
              oldValue: { total: 0 },
              newValue: newBudgetAllocation
            },
            actualSpending: {
              oldValue: 0,
              newValue: actualSpending.total
            }
          },
          description: `Budget allocated to floor: ${floor.name || `Floor ${floor.floorNumber}`}. Total: ${newBudgetAllocation.total.toLocaleString()} (Strategy: ${strategy}${allocationAdjusted ? ', adjusted to meet minimum requirement' : ''})`
        });
      } catch (auditError) {
        console.error(`Failed to create audit log for floor ${floor._id}:`, auditError);
      }
    }
  }
  
  // Build result message
  let message = `Successfully allocated budgets to ${allocatedFloors.length} floor(s) using ${strategy} distribution`;
  if (warnings.length > 0) {
    message += `. ${warnings.length} warning(s) generated.`;
  }
  
  return {
    allocated: allocatedFloors.length,
    skipped: skippedFloors.length + (floors.length - floorsNeedingAllocation.length),
    floors: allocatedFloors,
    skippedFloors: skippedFloors,
    warnings: warnings,
    strategy: strategy,
    message: message
  };
}

/**
 * Rescale floor budgets proportionally when phase budget changes
 * @param {string} phaseId - Phase ID
 * @param {number} oldBudget - Previous phase budget
 * @param {number} newBudget - New phase budget
 * @param {string} userId - User ID performing the operation (for audit log)
 * @returns {Promise<Object>} Summary of rescaled floors
 */
export async function rescaleFloorBudgetsForPhase(phaseId, oldBudget, newBudget, userId) {
  const db = await getDatabase();
  const { createAuditLog } = await import('@/lib/audit-log');
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    throw new Error('Invalid phase ID');
  }
  
  if (oldBudget <= 0 || newBudget <= 0) {
    throw new Error('Both oldBudget and newBudget must be greater than 0 to rescale floor budgets');
  }
  
  // Get phase
  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null,
  });
  
  if (!phase) {
    throw new Error('Phase not found');
  }
  
  // Verify this is Superstructure phase
  if (phase.phaseCode !== 'PHASE-02') {
    return {
      rescaled: 0,
      skipped: 0,
      floors: [],
      message: 'Floor budget rescaling is only available for Superstructure phase (PHASE-02)'
    };
  }
  
  const projectId = phase.projectId;
  
  // Get all floors for the project
  const floors = await db.collection('floors').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).sort({ floorNumber: 1 }).toArray();
  
  if (floors.length === 0) {
    return {
      rescaled: 0,
      skipped: 0,
      floors: [],
      message: 'No floors found for this project'
    };
  }
  
  // Calculate scaling factor
  const scaleFactor = newBudget / oldBudget;
  
  const rescaledFloors = [];
  const skippedFloors = [];
  
  // Rescale each floor budget
  for (const floor of floors) {
    const currentBudget = floor.budgetAllocation || { total: floor.totalBudget || 0 };
    const currentTotal = currentBudget.total || 0;
    
    // Skip floors with no budget allocation
    if (currentTotal === 0) {
      skippedFloors.push({
        floorId: floor._id.toString(),
        floorNumber: floor.floorNumber,
        floorName: floor.name,
        reason: 'No budget allocated'
      });
      continue;
    }
    
    // Calculate new budget values
    const newTotal = Math.round(currentTotal * scaleFactor * 100) / 100;
    const newMaterials = currentBudget.materials ? Math.round(currentBudget.materials * scaleFactor * 100) / 100 : 0;
    const newLabour = currentBudget.labour ? Math.round(currentBudget.labour * scaleFactor * 100) / 100 : 0;
    const newEquipment = currentBudget.equipment ? Math.round(currentBudget.equipment * scaleFactor * 100) / 100 : 0;
    const newSubcontractors = currentBudget.subcontractors ? Math.round(currentBudget.subcontractors * scaleFactor * 100) / 100 : 0;
    
    // Build new budget allocation
    const newBudgetAllocation = {
      total: newTotal,
      materials: newMaterials,
      labour: newLabour,
      equipment: newEquipment,
      subcontractors: newSubcontractors,
      contingency: 0
    };
    
    // Update floor
    await db.collection('floors').updateOne(
      { _id: floor._id },
      {
        $set: {
          budgetAllocation: newBudgetAllocation,
          totalBudget: newTotal, // Maintain legacy field
          updatedAt: new Date()
        }
      }
    );
    
    rescaledFloors.push({
      floorId: floor._id.toString(),
      floorNumber: floor.floorNumber,
      floorName: floor.name,
      oldTotal: currentTotal,
      newTotal: newTotal,
      scaleFactor: scaleFactor.toFixed(4)
    });
    
    // Create audit log
    if (userId) {
      try {
        await createAuditLog({
          userId: userId,
          action: 'update',
          entityType: 'floor',
          entityId: floor._id.toString(),
          changes: {
            budgetAllocation: {
              oldValue: currentBudget,
              newValue: newBudgetAllocation
            }
          },
          description: `Floor budget rescaled: ${floor.name || `Floor ${floor.floorNumber}`}. Old: ${currentTotal.toLocaleString()}, New: ${newTotal.toLocaleString()} (Scale: ${scaleFactor.toFixed(4)})`
        });
      } catch (auditError) {
        console.error(`Failed to create audit log for floor ${floor._id}:`, auditError);
      }
    }
  }
  
  return {
    rescaled: rescaledFloors.length,
    skipped: skippedFloors.length,
    floors: rescaledFloors,
    skippedFloors: skippedFloors,
    message: `Successfully rescaled budgets for ${rescaledFloors.length} floor(s)`
  };
}