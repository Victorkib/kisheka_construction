/**
 * Floor Financial Helper Functions
 * Utilities for calculating floor budgets and actual spending
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { MATERIAL_APPROVED_STATUSES } from '@/lib/status-constants';

/**
 * Floor Type Detection and Classification
 */

/**
 * Detect floor type based on floor number and total floors
 * @param {number} floorNumber - Floor number (negative = basement, 0 = ground, positive = upper)
 * @param {number} totalFloors - Total number of floors in project (optional)
 * @returns {string} Floor type: 'basement' | 'ground' | 'typical' | 'penthouse' | 'rooftop'
 */
export function detectFloorType(floorNumber, totalFloors = null, maxFloorNumber = null) {
  if (floorNumber < 0) {
    return 'basement';
  }
  if (floorNumber === 0) {
    return 'ground';
  }
  // Use maxFloorNumber if provided (more accurate than totalFloors)
  const topFloor = maxFloorNumber !== null ? maxFloorNumber : (totalFloors !== null ? totalFloors - 1 : null);
  if (topFloor !== null && floorNumber === topFloor) {
    return 'rooftop';
  }
  if (topFloor !== null && floorNumber === topFloor - 1) {
    return 'penthouse';
  }
  return 'typical';
}

/**
 * Get floor category for phase mapping
 * @param {number} floorNumber - Floor number
 * @returns {string} Floor category: 'basement' | 'superstructure'
 */
export function getFloorCategory(floorNumber) {
  return floorNumber < 0 ? 'basement' : 'superstructure';
}

/**
 * Get target floors for a phase based on phase code
 * @param {string} phaseCode - Phase code (PHASE-01, PHASE-02, etc.)
 * @param {Array} allFloors - Array of all floors for the project
 * @returns {Array} Filtered array of floors applicable to the phase
 */
export function getTargetFloorsForPhase(phaseCode, allFloors) {
  if (phaseCode === 'PHASE-01') {
    // Basement phase: Only basement floors
    return allFloors.filter(f => f.floorNumber < 0);
  } else if (phaseCode === 'PHASE-02') {
    // Superstructure: Ground + Upper floors (not basement, not rooftop if separate)
    return allFloors.filter(f => f.floorNumber >= 0);
  } else if (phaseCode === 'PHASE-03' || phaseCode === 'PHASE-04') {
    // Finishing/Final: All floors
    return allFloors;
  }
  return [];
}

/**
 * Get phase-specific weights for floor allocation
 * @param {string} floorType - Floor type
 * @param {string} phaseCode - Phase code
 * @returns {number} Weight multiplier
 */
export function getPhaseFloorWeight(floorType, phaseCode) {
  const weights = {
    basement: {
      'PHASE-01': 1.0,  // Basement floors in basement phase
      'PHASE-02': 0,    // Not applicable
      'PHASE-03': 0.8,  // Less finishing in basement
      'PHASE-04': 0.5   // Fewer systems in basement
    },
    ground: {
      'PHASE-01': 0,    // Not applicable
      'PHASE-02': 1.2,  // Ground floor typically more complex
      'PHASE-03': 1.1,  // More finishing (lobby, etc.)
      'PHASE-04': 1.0
    },
    typical: {
      'PHASE-01': 0,
      'PHASE-02': 1.0,  // Standard weight
      'PHASE-03': 1.0,
      'PHASE-04': 1.0
    },
    penthouse: {
      'PHASE-01': 0,
      'PHASE-02': 1.5,  // Higher complexity
      'PHASE-03': 1.3,  // Premium finishing
      'PHASE-04': 1.2   // More systems
    },
    rooftop: {
      'PHASE-01': 0,
      'PHASE-02': 0,    // Rooftop not part of superstructure
      'PHASE-03': 1.2,  // Rooftop finishing
      'PHASE-04': 1.5   // Rooftop systems (HVAC, etc.)
    }
  };

  return weights[floorType]?.[phaseCode] || 1.0;
}

/**
 * Initialize floor budget allocation structure with byPhase
 * @param {Object} floor - Floor object
 * @param {number} totalFloors - Total floors in project (optional)
 * @returns {Object} Initialized budget allocation structure
 */
export function initializeFloorBudgetAllocation(floor, totalFloors = null) {
  const floorType = detectFloorType(floor.floorNumber, totalFloors);
  const existingBudget = floor.budgetAllocation || { total: floor.totalBudget || 0 };
  
  // Initialize byPhase structure
  const byPhase = {
    'PHASE-01': {
      total: 0,
      materials: 0,
      labour: 0,
      equipment: 0,
      subcontractors: 0,
      contingency: 0
    },
    'PHASE-02': {
      total: 0,
      materials: 0,
      labour: 0,
      equipment: 0,
      subcontractors: 0,
      contingency: 0
    },
    'PHASE-03': {
      total: 0,
      materials: 0,
      labour: 0,
      equipment: 0,
      subcontractors: 0,
      contingency: 0
    },
    'PHASE-04': {
      total: 0,
      materials: 0,
      labour: 0,
      equipment: 0,
      subcontractors: 0,
      contingency: 0
    }
  };

  // If floor has existing budget but no byPhase, migrate it to PHASE-02 (legacy)
  if (existingBudget.total > 0 && !existingBudget.byPhase) {
    byPhase['PHASE-02'] = {
      total: existingBudget.total || 0,
      materials: existingBudget.materials || Math.round(existingBudget.total * 0.65),
      labour: existingBudget.labour || Math.round(existingBudget.total * 0.25),
      equipment: existingBudget.equipment || Math.round(existingBudget.total * 0.05),
      subcontractors: existingBudget.subcontractors || Math.round(existingBudget.total * 0.03),
      contingency: existingBudget.contingency || 0
    };
  } else if (existingBudget.byPhase) {
    // Merge existing byPhase structure
    Object.keys(byPhase).forEach(phaseCode => {
      if (existingBudget.byPhase[phaseCode]) {
        byPhase[phaseCode] = { ...existingBudget.byPhase[phaseCode] };
      }
    });
  }

  // Calculate total from byPhase
  const total = Object.values(byPhase).reduce((sum, phase) => sum + (phase.total || 0), 0);
  
  // Calculate category totals
  const materials = Object.values(byPhase).reduce((sum, phase) => sum + (phase.materials || 0), 0);
  const labour = Object.values(byPhase).reduce((sum, phase) => sum + (phase.labour || 0), 0);
  const equipment = Object.values(byPhase).reduce((sum, phase) => sum + (phase.equipment || 0), 0);
  const subcontractors = Object.values(byPhase).reduce((sum, phase) => sum + (phase.subcontractors || 0), 0);
  const contingency = Object.values(byPhase).reduce((sum, phase) => sum + (phase.contingency || 0), 0);

  return {
    total,
    byPhase,
    materials,
    labour,
    equipment,
    subcontractors,
    contingency,
    floorType, // Add floor type for reference
    floorCategory: getFloorCategory(floor.floorNumber)
  };
}

/**
 * Calculate actual spending for a floor from materials and labour
 * Enhanced to support phase-specific spending breakdown
 * @param {string} floorId - Floor ID
 * @param {boolean} includeByPhase - Whether to include phase-specific breakdown (default: true)
 * @returns {Promise<Object>} Actual spending breakdown with optional byPhase structure
 */
export async function calculateFloorActualSpending(floorId, includeByPhase = true) {
  const db = await getDatabase();
  
  if (!floorId || !ObjectId.isValid(floorId)) {
    throw new Error('Invalid floor ID');
  }
  
  const floorObjectId = new ObjectId(floorId);
  
  // Calculate materials spending (approved/received materials) - with phase breakdown
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
        _id: includeByPhase ? '$phaseId' : null,
        total: { $sum: '$totalCost' },
      },
    },
  ]).toArray();
  
  // Calculate total materials spending
  const materialsSpending = materialsAggregation.reduce((sum, item) => sum + (item.total || 0), 0);
  
  // Build phase-specific materials spending map
  const materialsByPhase = {};
  if (includeByPhase) {
    materialsAggregation.forEach(item => {
      const phaseId = item._id?.toString();
      if (phaseId) {
        materialsByPhase[phaseId] = (materialsByPhase[phaseId] || 0) + (item.total || 0);
      }
    });
  }
  
  // Calculate labour spending (approved labour entries) - with phase breakdown
  const labourAggregation = await db.collection('labour_entries').aggregate([
    {
      $match: {
        floorId: floorObjectId,
        deletedAt: null,
        status: { $in: ['approved', 'paid'] },
        isIndirectLabour: { $ne: true }, // Only direct labour (indirect labour doesn't have phaseId)
      },
    },
    {
      $group: {
        _id: includeByPhase ? '$phaseId' : null,
        total: { $sum: '$totalCost' },
      },
    },
  ]).toArray();
  
  // Calculate total labour spending
  const labourSpending = labourAggregation.reduce((sum, item) => sum + (item.total || 0), 0);
  
  // Build phase-specific labour spending map
  const labourByPhase = {};
  if (includeByPhase) {
    labourAggregation.forEach(item => {
      const phaseId = item._id?.toString();
      if (phaseId) {
        labourByPhase[phaseId] = (labourByPhase[phaseId] || 0) + (item.total || 0);
      }
    });
  }
  
  // Calculate equipment spending (if equipment is linked to floors)
  // Note: Equipment might not be directly linked to floors, so this might be 0
  const equipmentSpending = 0; // Placeholder for future implementation
  const equipmentByPhase = {};
  
  // Calculate subcontractor spending (if subcontractors are linked to floors)
  // Note: Subcontractors might not be directly linked to floors, so this might be 0
  const subcontractorSpending = 0; // Placeholder for future implementation
  const subcontractorsByPhase = {};
  
  const totalSpending = materialsSpending + labourSpending + equipmentSpending + subcontractorSpending;
  
  // Build byPhase structure if requested
  let byPhase = null;
  if (includeByPhase) {
    // Get all unique phase IDs from materials and labour
    const allPhaseIds = new Set([
      ...Object.keys(materialsByPhase),
      ...Object.keys(labourByPhase),
      ...Object.keys(equipmentByPhase),
      ...Object.keys(subcontractorsByPhase)
    ]);
    
    // Get phase codes for each phase ID
    const phaseMap = {};
    if (allPhaseIds.size > 0) {
      const phases = await db.collection('phases').find({
        _id: { $in: Array.from(allPhaseIds).map(id => new ObjectId(id)) },
        deletedAt: null
      }).toArray();
      
      phases.forEach(phase => {
        phaseMap[phase._id.toString()] = phase.phaseCode;
      });
    }
    
    // Build byPhase structure
    byPhase = {};
    allPhaseIds.forEach(phaseId => {
      const phaseCode = phaseMap[phaseId] || 'UNKNOWN';
      byPhase[phaseCode] = {
        total: (materialsByPhase[phaseId] || 0) + (labourByPhase[phaseId] || 0) + 
               (equipmentByPhase[phaseId] || 0) + (subcontractorsByPhase[phaseId] || 0),
        materials: materialsByPhase[phaseId] || 0,
        labour: labourByPhase[phaseId] || 0,
        equipment: equipmentByPhase[phaseId] || 0,
        subcontractors: subcontractorsByPhase[phaseId] || 0,
        phaseId: phaseId
      };
    });
    
    // Ensure all 4 phases are present (even if 0)
    ['PHASE-01', 'PHASE-02', 'PHASE-03', 'PHASE-04'].forEach(phaseCode => {
      if (!byPhase[phaseCode]) {
        byPhase[phaseCode] = {
          total: 0,
          materials: 0,
          labour: 0,
          equipment: 0,
          subcontractors: 0,
          phaseId: null
        };
      }
    });
  }
  
  return {
    total: totalSpending,
    materials: materialsSpending,
    labour: labourSpending,
    equipment: equipmentSpending,
    subcontractors: subcontractorSpending,
    ...(includeByPhase && byPhase ? { byPhase } : {})
  };
}

/**
 * Calculate committed costs for a floor (from pending material requests and purchase orders)
 * Enhanced to support phase-specific committed costs breakdown
 * @param {string} floorId - Floor ID
 * @param {boolean} includeByPhase - Whether to include phase-specific breakdown (default: true)
 * @returns {Promise<Object>} Committed costs breakdown with optional byPhase structure
 */
export async function calculateFloorCommittedCosts(floorId, includeByPhase = true) {
  const db = await getDatabase();
  
  if (!floorId || !ObjectId.isValid(floorId)) {
    throw new Error('Invalid floor ID');
  }
  
  const floorObjectId = new ObjectId(floorId);
  
  // Calculate committed from material requests (pending/approved but not received) - with phase breakdown
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
        _id: includeByPhase ? '$phaseId' : null,
        total: { $sum: '$estimatedCost' },
      },
    },
  ]).toArray();
  
  // Calculate total material requests committed
  const materialRequestsCommitted = materialRequestsAggregation.reduce((sum, item) => sum + (item.total || 0), 0);
  
  // Build phase-specific material requests committed map
  const materialRequestsByPhase = {};
  if (includeByPhase) {
    materialRequestsAggregation.forEach(item => {
      const phaseId = item._id?.toString();
      if (phaseId) {
        materialRequestsByPhase[phaseId] = (materialRequestsByPhase[phaseId] || 0) + (item.total || 0);
      }
    });
  }
  
  // Calculate committed from purchase orders (pending/approved but not received) - with phase breakdown
  // Note: Purchase orders might have phaseId, but let's check the schema
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
        _id: includeByPhase ? '$phaseId' : null,
        total: { $sum: '$totalAmount' },
      },
    },
  ]).toArray();
  
  // Calculate total purchase orders committed
  const purchaseOrdersCommitted = purchaseOrdersAggregation.reduce((sum, item) => sum + (item.total || 0), 0);
  
  // Build phase-specific purchase orders committed map
  const purchaseOrdersByPhase = {};
  if (includeByPhase) {
    purchaseOrdersAggregation.forEach(item => {
      const phaseId = item._id?.toString();
      if (phaseId) {
        purchaseOrdersByPhase[phaseId] = (purchaseOrdersByPhase[phaseId] || 0) + (item.total || 0);
      }
    });
  }
  
  const totalCommitted = materialRequestsCommitted + purchaseOrdersCommitted;
  
  // Build byPhase structure if requested
  let byPhase = null;
  if (includeByPhase) {
    // Get all unique phase IDs from material requests and purchase orders
    const allPhaseIds = new Set([
      ...Object.keys(materialRequestsByPhase),
      ...Object.keys(purchaseOrdersByPhase)
    ]);
    
    // Get phase codes for each phase ID
    const phaseMap = {};
    if (allPhaseIds.size > 0) {
      const phases = await db.collection('phases').find({
        _id: { $in: Array.from(allPhaseIds).map(id => new ObjectId(id)) },
        deletedAt: null
      }).toArray();
      
      phases.forEach(phase => {
        phaseMap[phase._id.toString()] = phase.phaseCode;
      });
    }
    
    // Build byPhase structure
    byPhase = {};
    allPhaseIds.forEach(phaseId => {
      const phaseCode = phaseMap[phaseId] || 'UNKNOWN';
      byPhase[phaseCode] = {
        total: (materialRequestsByPhase[phaseId] || 0) + (purchaseOrdersByPhase[phaseId] || 0),
        materialRequests: materialRequestsByPhase[phaseId] || 0,
        purchaseOrders: purchaseOrdersByPhase[phaseId] || 0,
        phaseId: phaseId
      };
    });
    
    // Ensure all 4 phases are present (even if 0)
    ['PHASE-01', 'PHASE-02', 'PHASE-03', 'PHASE-04'].forEach(phaseCode => {
      if (!byPhase[phaseCode]) {
        byPhase[phaseCode] = {
          total: 0,
          materialRequests: 0,
          purchaseOrders: 0,
          phaseId: null
        };
      }
    });
  }
  
  return {
    total: totalCommitted,
    materialRequests: materialRequestsCommitted,
    purchaseOrders: purchaseOrdersCommitted,
    ...(includeByPhase && byPhase ? { byPhase } : {})
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
  
  // Calculate actual spending (with phase-specific breakdown)
  const actualSpending = await calculateFloorActualSpending(floorId, true);
  
  // Calculate committed costs (with phase-specific breakdown)
  const committedCosts = await calculateFloorCommittedCosts(floorId, true);
  
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
 * Allocate phase budget to floors automatically (Enhanced for all phases)
 * Supports both even and weighted distribution strategies
 * Works for all phases: PHASE-01 (Basement), PHASE-02 (Superstructure), PHASE-03 (Finishing), PHASE-04 (Final)
 * @param {string} phaseId - Phase ID
 * @param {string} strategy - 'even' | 'weighted' (default: 'weighted')
 * @param {string} userId - User ID performing the operation (for audit log)
 * @param {Object} options - Optional configuration: { weights: {}, onlyZeroBudgets: true }
 * @returns {Promise<Object>} Summary of allocated floors
 */
export async function allocatePhaseBudgetToFloors(phaseId, strategy = 'weighted', userId = null, options = {}) {
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
  
  const projectId = phase.projectId;
  const phaseBudget = phase.budgetAllocation?.total || 0;
  const phaseCode = phase.phaseCode;
  
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
  
  // Get target floors for this phase
  const targetFloors = getTargetFloorsForPhase(phaseCode, floors);
  
  if (targetFloors.length === 0) {
    return {
      allocated: 0,
      skipped: 0,
      floors: [],
      message: `No applicable floors found for phase ${phaseCode}`
    };
  }
  
  // Filter floors that need allocation (zero budgets for this phase)
  const onlyZeroBudgets = options.onlyZeroBudgets !== false; // Default: true
  const floorsNeedingAllocation = targetFloors.filter(floor => {
    if (!onlyZeroBudgets) return true; // Allocate to all floors if flag is false
    
    const currentPhaseBudget = floor.budgetAllocation?.byPhase?.[phaseCode]?.total || 0;
    return currentPhaseBudget === 0;
  });
  
  if (floorsNeedingAllocation.length === 0) {
    return {
      allocated: 0,
      skipped: targetFloors.length,
      floors: [],
      message: 'All applicable floors already have budget allocations for this phase'
    };
  }
  
  // Get max floor number for floor type detection (for penthouse/rooftop detection)
  const maxFloorNumber = floors.length > 0 ? Math.max(...floors.map(f => f.floorNumber)) : null;
  
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
    // Determine floor type and assign weight
    const floorsWithWeights = floorsNeedingAllocation.map((floor) => {
      const floorType = detectFloorType(floor.floorNumber, null, maxFloorNumber);
      const weight = getPhaseFloorWeight(floorType, phaseCode);
      
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
    
    if (totalWeight === 0) {
      // Fallback to even distribution if all weights are 0
      const budgetPerFloor = Math.floor(phaseBudget / floorsNeedingAllocation.length);
      const remainder = phaseBudget - (budgetPerFloor * floorsNeedingAllocation.length);
      
      floorAllocations = floorsNeedingAllocation.map((floor, index) => ({
        floorId: floor._id.toString(),
        floorNumber: floor.floorNumber,
        floorName: floor.name,
        suggestedBudget: budgetPerFloor + (index === floorsNeedingAllocation.length - 1 ? remainder : 0),
      }));
    } else {
      // Calculate budget per weight unit
      const budgetPerWeightUnit = phaseBudget / totalWeight;
      
      // Assign budgets based on weights
      floorAllocations = floorsWithWeights.map((floor) => ({
        ...floor,
        suggestedBudget: Math.round(floor.weight * budgetPerWeightUnit),
      }));
    }
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
    
    // Calculate actual spending and committed costs for this phase
    let actualSpending = { total: 0, materials: 0, labour: 0, equipment: 0, subcontractors: 0 };
    let committedCosts = { total: 0 };
    
    try {
      // Calculate phase-specific spending for this phase
      const floorSpending = await calculateFloorActualSpending(floor._id.toString(), true);
      const floorCommitted = await calculateFloorCommittedCosts(floor._id.toString(), true);
      
      // Use phase-specific spending if available
      if (floorSpending.byPhase && floorCommitted.byPhase && phaseCode) {
        const phaseSpending = floorSpending.byPhase[phaseCode] || { total: 0, materials: 0, labour: 0, equipment: 0, subcontractors: 0 };
        const phaseCommitted = floorCommitted.byPhase[phaseCode] || { total: 0, materialRequests: 0, purchaseOrders: 0 };
        
        actualSpending = {
          total: phaseSpending.total,
          materials: phaseSpending.materials,
          labour: phaseSpending.labour,
          equipment: phaseSpending.equipment,
          subcontractors: phaseSpending.subcontractors
        };
        committedCosts = {
          total: phaseCommitted.total,
          materialRequests: phaseCommitted.materialRequests,
          purchaseOrders: phaseCommitted.purchaseOrders
        };
      } else {
        // Fallback to total spending if phase-specific not available
        actualSpending = floorSpending;
        committedCosts = floorCommitted;
      }
      
    } catch (spendingError) {
      console.error(`Error calculating spending for floor ${floor._id}:`, spendingError);
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
    
    // Build phase-specific budget allocation
    const phaseBudgetAllocation = {
      total: Math.round(finalBudget * 100) / 100,
      materials: Math.round(finalBudget * 0.65 * 100) / 100,
      labour: Math.round(finalBudget * 0.25 * 100) / 100,
      equipment: Math.round(finalBudget * 0.05 * 100) / 100,
      subcontractors: Math.round(finalBudget * 0.03 * 100) / 100,
      contingency: 0
    };
    
    // Get existing budget allocation or initialize
    const existingBudget = floor.budgetAllocation || { total: floor.totalBudget || 0, byPhase: {} };
    const byPhase = existingBudget.byPhase || {};
    
    // Update phase-specific allocation
    byPhase[phaseCode] = phaseBudgetAllocation;
    
    // Calculate new total from all phases
    const newTotal = Object.values(byPhase).reduce((sum, phase) => sum + (phase.total || 0), 0);
    
    // Calculate category totals
    const newMaterials = Object.values(byPhase).reduce((sum, phase) => sum + (phase.materials || 0), 0);
    const newLabour = Object.values(byPhase).reduce((sum, phase) => sum + (phase.labour || 0), 0);
    const newEquipment = Object.values(byPhase).reduce((sum, phase) => sum + (phase.equipment || 0), 0);
    const newSubcontractors = Object.values(byPhase).reduce((sum, phase) => sum + (phase.subcontractors || 0), 0);
    const newContingency = Object.values(byPhase).reduce((sum, phase) => sum + (phase.contingency || 0), 0);
    
    // Build complete budget allocation
    const newBudgetAllocation = {
      total: newTotal,
      byPhase: byPhase,
      materials: newMaterials,
      labour: newLabour,
      equipment: newEquipment,
      subcontractors: newSubcontractors,
      contingency: newContingency
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
      phaseCode: phaseCode,
      oldPhaseTotal: existingBudget.byPhase?.[phaseCode]?.total || 0,
      newPhaseTotal: phaseBudgetAllocation.total,
      oldTotal: existingBudget.total || 0,
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
          projectId: projectId.toString(),
          changes: {
            budgetAllocation: {
              oldValue: existingBudget.byPhase?.[phaseCode] || { total: 0 },
              newValue: phaseBudgetAllocation
            },
            phaseCode: phaseCode
          },
          description: `Budget allocated to floor ${floor.name || `Floor ${floor.floorNumber}`} for phase ${phaseCode}. Phase allocation: ${phaseBudgetAllocation.total.toLocaleString()} (Strategy: ${strategy}${allocationAdjusted ? ', adjusted to meet minimum requirement' : ''})`
        });
      } catch (auditError) {
        console.error(`Failed to create audit log for floor ${floor._id}:`, auditError);
      }
    }
  }
  
  // Build result message
  let message = `Successfully allocated budgets to ${allocatedFloors.length} floor(s) for phase ${phaseCode} using ${strategy} distribution`;
  if (warnings.length > 0) {
    message += `. ${warnings.length} warning(s) generated.`;
  }
  
  return {
    allocated: allocatedFloors.length,
    skipped: skippedFloors.length + (targetFloors.length - floorsNeedingAllocation.length),
    floors: allocatedFloors,
    skippedFloors: skippedFloors,
    warnings: warnings,
    strategy: strategy,
    phaseCode: phaseCode,
    message: message
  };
}

/**
 * Allocate Superstructure phase budget to floors automatically (Legacy function - now calls allocatePhaseBudgetToFloors)
 * Supports both even and weighted distribution strategies
 * @param {string} phaseId - Phase ID (should be Superstructure phase)
 * @param {string} strategy - 'even' | 'weighted' (default: 'weighted')
 * @param {string} userId - User ID performing the operation (for audit log)
 * @param {Object} weights - Optional weights for weighted strategy (deprecated, use options)
 * @returns {Promise<Object>} Summary of allocated floors
 */
export async function allocateSuperstructureBudgetToFloors(phaseId, strategy = 'weighted', userId = null, weights = {}) {
  // Legacy function - now calls the enhanced allocatePhaseBudgetToFloors
  // This maintains backward compatibility with existing code
  // Verify phase is Superstructure before calling
  const db = await getDatabase();
  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null,
  });
  
  if (!phase) {
    throw new Error('Phase not found');
  }
  
  if (phase.phaseCode !== 'PHASE-02') {
    throw new Error('Floor budget allocation is only available for Superstructure phase (PHASE-02)');
  }
  
  return await allocatePhaseBudgetToFloors(phaseId, strategy, userId, { weights });
}

/**
 * Rescale floor budgets proportionally when phase budget changes (Enhanced for all phases)
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
  
  const projectId = phase.projectId;
  const phaseCode = phase.phaseCode;
  
  // Get target floors for this phase
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
  
  const targetFloors = getTargetFloorsForPhase(phaseCode, floors);
  
  if (targetFloors.length === 0) {
    return {
      rescaled: 0,
      skipped: 0,
      floors: [],
      message: `No applicable floors found for phase ${phaseCode}`
    };
  }
  
  // Calculate scaling factor
  const scaleFactor = newBudget / oldBudget;
  
  const rescaledFloors = [];
  const skippedFloors = [];
  
  // Rescale each floor's phase-specific budget
  for (const floor of targetFloors) {
    const existingBudget = floor.budgetAllocation || { total: floor.totalBudget || 0, byPhase: {} };
    const byPhase = existingBudget.byPhase || {};
    const currentPhaseBudget = byPhase[phaseCode] || { total: 0 };
    const currentPhaseTotal = currentPhaseBudget.total || 0;
    
    // Skip floors with no budget allocation for this phase
    if (currentPhaseTotal === 0) {
      skippedFloors.push({
        floorId: floor._id.toString(),
        floorNumber: floor.floorNumber,
        floorName: floor.name,
        reason: `No budget allocated for phase ${phaseCode}`
      });
      continue;
    }
    
    // Calculate new phase-specific budget values
    const newPhaseTotal = Math.round(currentPhaseTotal * scaleFactor * 100) / 100;
    const newPhaseMaterials = currentPhaseBudget.materials ? Math.round(currentPhaseBudget.materials * scaleFactor * 100) / 100 : 0;
    const newPhaseLabour = currentPhaseBudget.labour ? Math.round(currentPhaseBudget.labour * scaleFactor * 100) / 100 : 0;
    const newPhaseEquipment = currentPhaseBudget.equipment ? Math.round(currentPhaseBudget.equipment * scaleFactor * 100) / 100 : 0;
    const newPhaseSubcontractors = currentPhaseBudget.subcontractors ? Math.round(currentPhaseBudget.subcontractors * scaleFactor * 100) / 100 : 0;
    
    // Update phase-specific allocation
    byPhase[phaseCode] = {
      total: newPhaseTotal,
      materials: newPhaseMaterials,
      labour: newPhaseLabour,
      equipment: newPhaseEquipment,
      subcontractors: newPhaseSubcontractors,
      contingency: 0
    };
    
    // Calculate new total from all phases
    const newTotal = Object.values(byPhase).reduce((sum, phase) => sum + (phase.total || 0), 0);
    
    // Calculate category totals
    const newMaterials = Object.values(byPhase).reduce((sum, phase) => sum + (phase.materials || 0), 0);
    const newLabour = Object.values(byPhase).reduce((sum, phase) => sum + (phase.labour || 0), 0);
    const newEquipment = Object.values(byPhase).reduce((sum, phase) => sum + (phase.equipment || 0), 0);
    const newSubcontractors = Object.values(byPhase).reduce((sum, phase) => sum + (phase.subcontractors || 0), 0);
    const newContingency = Object.values(byPhase).reduce((sum, phase) => sum + (phase.contingency || 0), 0);
    
    // Build complete budget allocation
    const newBudgetAllocation = {
      total: newTotal,
      byPhase: byPhase,
      materials: newMaterials,
      labour: newLabour,
      equipment: newEquipment,
      subcontractors: newSubcontractors,
      contingency: newContingency
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
      phaseCode: phaseCode,
      oldPhaseTotal: currentPhaseTotal,
      newPhaseTotal: newPhaseTotal,
      oldTotal: existingBudget.total || 0,
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
          projectId: projectId.toString(),
          changes: {
            budgetAllocation: {
              oldValue: currentPhaseBudget,
              newValue: byPhase[phaseCode]
            },
            phaseCode: phaseCode
          },
          description: `Floor budget rescaled for phase ${phaseCode}: ${floor.name || `Floor ${floor.floorNumber}`}. Phase: ${currentPhaseTotal.toLocaleString()} → ${newPhaseTotal.toLocaleString()} (Scale: ${scaleFactor.toFixed(4)})`
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
    phaseCode: phaseCode,
    message: `Successfully rescaled budgets for ${rescaledFloors.length} floor(s) for phase ${phaseCode}`
  };
}

/**
 * Capital Allocation to Floors
 */

/**
 * Allocate capital to floors for a project
 * @param {string} projectId - Project ID
 * @param {number} totalCapital - Total capital to allocate
 * @param {string} strategy - 'proportional' | 'even' | 'manual' (default: 'proportional')
 * @param {string} userId - User ID performing the operation (for audit log)
 * @param {Object} manualAllocations - Manual allocations for each floor (only used if strategy is 'manual')
 * @returns {Promise<Object>} Summary of allocated floors
 */
export async function allocateCapitalToFloors(projectId, totalCapital, strategy = 'proportional', userId = null, manualAllocations = {}) {
  const db = await getDatabase();
  const { createAuditLog } = await import('@/lib/audit-log');
  const { getProjectFinances } = await import('@/lib/financial-helpers');
  
  if (!projectId || !ObjectId.isValid(projectId)) {
    throw new Error('Invalid project ID');
  }
  
  if (!totalCapital || totalCapital <= 0) {
    throw new Error('Total capital must be greater than 0');
  }
  
  // Get project finances
  const projectFinances = await getProjectFinances(projectId);
  const availableCapital = projectFinances?.capitalBalance || 0;
  
  if (totalCapital > availableCapital) {
    throw new Error(`Insufficient capital. Available: ${availableCapital.toLocaleString()}, Requested: ${totalCapital.toLocaleString()}`);
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
  
  // Calculate floor allocations based on strategy
  let floorAllocations = [];
  
  if (strategy === 'even') {
    // Even distribution: divide capital equally among floors
    const capitalPerFloor = Math.floor(totalCapital / floors.length);
    const remainder = totalCapital - (capitalPerFloor * floors.length);
    
    floorAllocations = floors.map((floor, index) => ({
      floorId: floor._id.toString(),
      floorNumber: floor.floorNumber,
      floorName: floor.name,
      suggestedCapital: capitalPerFloor + (index === floors.length - 1 ? remainder : 0),
    }));
  } else if (strategy === 'manual') {
    // Manual allocation: use provided allocations
    floorAllocations = floors.map(floor => ({
      floorId: floor._id.toString(),
      floorNumber: floor.floorNumber,
      floorName: floor.name,
      suggestedCapital: manualAllocations[floor._id.toString()] || 0,
    }));
  } else {
    // Proportional distribution (default): allocate based on floor budgets
    const totalFloorBudgets = floors.reduce((sum, floor) => {
      const budget = floor.budgetAllocation?.total || floor.totalBudget || 0;
      return sum + budget;
    }, 0);
    
    if (totalFloorBudgets === 0) {
      // Fallback to even distribution if no budgets
      const capitalPerFloor = Math.floor(totalCapital / floors.length);
      const remainder = totalCapital - (capitalPerFloor * floors.length);
      
      floorAllocations = floors.map((floor, index) => ({
        floorId: floor._id.toString(),
        floorNumber: floor.floorNumber,
        floorName: floor.name,
        suggestedCapital: capitalPerFloor + (index === floors.length - 1 ? remainder : 0),
      }));
    } else {
      // Allocate proportionally to budgets
      floorAllocations = floors.map(floor => {
        const budget = floor.budgetAllocation?.total || floor.totalBudget || 0;
        const proportion = budget / totalFloorBudgets;
        return {
          floorId: floor._id.toString(),
          floorNumber: floor.floorNumber,
          floorName: floor.name,
          suggestedCapital: Math.round(totalCapital * proportion),
        };
      });
      
      // Adjust for rounding errors
      const allocatedTotal = floorAllocations.reduce((sum, f) => sum + f.suggestedCapital, 0);
      const difference = totalCapital - allocatedTotal;
      if (difference !== 0 && floorAllocations.length > 0) {
        // Add/subtract difference from the largest allocation
        const largestIndex = floorAllocations.reduce((maxIdx, f, idx) => 
          f.suggestedCapital > floorAllocations[maxIdx].suggestedCapital ? idx : maxIdx, 0
        );
        floorAllocations[largestIndex].suggestedCapital += difference;
      }
    }
  }
  
  const allocatedFloors = [];
  const skippedFloors = [];
  const warnings = [];
  
  // Allocate capital to floors
  for (const allocation of floorAllocations) {
    const floor = floors.find(f => f._id.toString() === allocation.floorId);
    if (!floor) {
      skippedFloors.push({
        floorId: allocation.floorId,
        floorName: allocation.floorName,
        reason: 'Floor not found'
      });
      continue;
    }
    
    const suggestedCapital = allocation.suggestedCapital || 0;
    
    if (suggestedCapital <= 0) {
      skippedFloors.push({
        floorId: allocation.floorId,
        floorName: allocation.floorName,
        reason: 'Suggested capital is zero or negative'
      });
      continue;
    }
    
    // Calculate actual spending and committed costs for this floor
    let actualSpending = { total: 0 };
    let committedCosts = { total: 0 };
    
    try {
      // Calculate phase-specific spending for this phase
      actualSpending = await calculateFloorActualSpending(floor._id.toString(), true);
      committedCosts = await calculateFloorCommittedCosts(floor._id.toString(), true);
    } catch (spendingError) {
      console.error(`Error calculating spending for floor ${floor._id}:`, spendingError);
      warnings.push({
        floorId: floor._id.toString(),
        floorName: floor.name || `Floor ${floor.floorNumber}`,
        message: 'Could not calculate actual spending. Proceeding with allocation.'
      });
    }
    
    // Get existing capital allocation or initialize
    const existingCapital = floor.capitalAllocation || { total: 0, byPhase: {}, used: 0, committed: 0, remaining: 0 };
    
    // Get floor's budget allocation by phase to distribute capital proportionally
    const floorBudget = floor.budgetAllocation || { total: floor.totalBudget || 0, byPhase: {} };
    const budgetByPhase = floorBudget.byPhase || {};
    const totalBudget = floorBudget.total || 0;
    
    // Distribute capital by phase proportionally based on budget allocation
    const capitalByPhase = existingCapital.byPhase || {};
    if (totalBudget > 0 && Object.keys(budgetByPhase).length > 0) {
      // Distribute new capital proportionally to phases based on their budget share
      Object.keys(budgetByPhase).forEach(phaseCode => {
        const phaseBudget = budgetByPhase[phaseCode]?.total || 0;
        const phaseBudgetShare = phaseBudget / totalBudget;
        const phaseCapitalAllocation = (suggestedCapital * phaseBudgetShare) + (capitalByPhase[phaseCode]?.total || 0);
        
        // Get phase-specific spending if available
        const phaseSpending = actualSpending.byPhase?.[phaseCode] || { total: 0 };
        const phaseCommitted = committedCosts.byPhase?.[phaseCode] || { total: 0 };
        
        capitalByPhase[phaseCode] = {
          total: Math.round(phaseCapitalAllocation * 100) / 100,
          used: phaseSpending.total || 0,
          committed: phaseCommitted.total || 0,
          remaining: Math.max(0, phaseCapitalAllocation - (phaseSpending.total || 0) - (phaseCommitted.total || 0))
        };
      });
    } else {
      // If no budget by phase, allocate all capital to PHASE-02 (legacy behavior)
      const legacyCapital = (capitalByPhase['PHASE-02']?.total || 0) + suggestedCapital;
      capitalByPhase['PHASE-02'] = {
        total: legacyCapital,
        used: actualSpending.total || 0,
        committed: committedCosts.total || 0,
        remaining: Math.max(0, legacyCapital - (actualSpending.total || 0) - (committedCosts.total || 0))
      };
    }
    
    // Build new capital allocation
    const newCapitalAllocation = {
      total: existingCapital.total + suggestedCapital,
      byPhase: capitalByPhase,
      used: actualSpending.total,
      committed: committedCosts.total,
      remaining: Math.max(0, (existingCapital.total + suggestedCapital) - actualSpending.total - committedCosts.total)
    };
    
    // Update floor with capital allocation
    await db.collection('floors').updateOne(
      { _id: floor._id },
      {
        $set: {
          capitalAllocation: newCapitalAllocation,
          updatedAt: new Date()
        }
      }
    );
    
    allocatedFloors.push({
      floorId: floor._id.toString(),
      floorNumber: floor.floorNumber,
      floorName: floor.name,
      oldCapital: existingCapital.total,
      newCapital: newCapitalAllocation.total,
      added: suggestedCapital,
      used: actualSpending.total,
      committed: committedCosts.total,
      remaining: newCapitalAllocation.remaining
    });
    
    // Create audit log
    if (userId) {
      try {
        await createAuditLog({
          userId: userId,
          action: 'update',
          entityType: 'floor',
          entityId: floor._id.toString(),
          projectId: projectId.toString(),
          changes: {
            capitalAllocation: {
              oldValue: existingCapital.total,
              newValue: newCapitalAllocation.total
            }
          },
          description: `Capital allocated to floor ${floor.name || `Floor ${floor.floorNumber}`}. Added: ${suggestedCapital.toLocaleString()}, Total: ${newCapitalAllocation.total.toLocaleString()} (Strategy: ${strategy})`
        });
      } catch (auditError) {
        console.error(`Failed to create audit log for floor ${floor._id}:`, auditError);
      }
    }
  }
  
  // Build result message
  let message = `Successfully allocated capital to ${allocatedFloors.length} floor(s) using ${strategy} distribution`;
  if (warnings.length > 0) {
    message += `. ${warnings.length} warning(s) generated.`;
  }
  
  return {
    allocated: allocatedFloors.length,
    skipped: skippedFloors.length,
    floors: allocatedFloors,
    skippedFloors: skippedFloors,
    warnings: warnings,
    strategy: strategy,
    totalAllocated: totalCapital,
    message: message
  };
}