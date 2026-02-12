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
