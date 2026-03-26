/**
 * Equipment Helper Functions
 * Utilities for equipment management and calculations
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { calculateEquipmentCost, calculateUtilizationPercentage } from '@/lib/schemas/equipment-schema';
import { validatePhaseMaterialBudget } from '@/lib/phase-helpers';
import { validateFloorBudget } from '@/lib/floor-financial-helpers';
import { validateCapitalAvailability, getProjectFinances } from '@/lib/financial-helpers';

/**
 * Validate equipment budget and capital based on scope
 * @param {Object} equipment - Equipment data
 * @returns {Promise<Object>} Validation result
 */
export async function validateEquipmentBudgetAndCapital(equipment) {
  const { 
    projectId, 
    equipmentScope, 
    phaseId, 
    floorId, 
    totalCost,
    costAttribution 
  } = equipment;
  
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
    budgetNotSet: false,
    capitalNotSet: false,
    validationDetails: {
      budget: null,
      capital: null
    }
  };
  
  // Handle zero cost equipment (no validation needed)
  if (!totalCost || totalCost <= 0) {
    return {
      ...result,
      message: 'Equipment with zero cost - no validation required'
    };
  }
  
  // ========== BUDGET VALIDATION ==========
  if (equipmentScope === 'site_wide') {
    // Site-wide equipment: charge to Indirect Costs
    const projectFinances = await getProjectFinances(projectId);
    const indirectBudget = projectFinances?.budget?.indirectCosts || 0;
    
    // Get actual indirect spending
    const indirectSpending = await getIndirectCostSpending(projectId);
    
    if (indirectBudget === 0) {
      result.budgetNotSet = true;
      result.warnings.push({
        type: 'budget_not_set',
        category: 'indirect_costs',
        message: 'No indirect costs budget set. Equipment cost will be tracked. Set budget later to enable budget validation.',
        severity: 'info'
      });
    } else {
      const available = indirectBudget - indirectSpending;
      if (totalCost > available) {
        result.isValid = false;
        result.errors.push({
          type: 'budget_exceeded',
          category: 'indirect_costs',
          message: `Indirect costs budget exceeded. Available: ${formatCurrency(available)}, Required: ${formatCurrency(totalCost)}, Shortfall: ${formatCurrency(totalCost - available)}`,
          available,
          required: totalCost,
          shortfall: totalCost - available
        });
      } else {
        result.validationDetails.budget = {
          category: 'indirect_costs',
          budget: indirectBudget,
          spent: indirectSpending,
          available,
          remaining: available - totalCost
        };
      }
    }
    
  } else if (equipmentScope === 'multi_phase' && equipment.phaseIds && equipment.phaseIds.length > 0) {
    // Multi-phase equipment: split cost across phases
    const costSplit = equipment.costSplit || { type: 'equal' };
    const phaseCount = equipment.phaseIds.length;
    
    for (const pid of equipment.phaseIds) {
      // Calculate split cost for this phase
      let phaseCost = totalCost;
      if (costSplit.type === 'equal') {
        phaseCost = totalCost / phaseCount;
      } else if (costSplit.type === 'percentage' && costSplit.percentages) {
        const percentage = costSplit.percentages[pid.toString()] || (100 / phaseCount);
        phaseCost = totalCost * (percentage / 100);
      }
      
      // Validate against phase budget
      const phaseValidation = await validatePhaseMaterialBudget(pid, phaseCost, null);
      
      if (phaseValidation.budgetNotSet) {
        result.budgetNotSet = true;
        result.warnings.push({
          type: 'budget_not_set',
          phaseId: pid.toString(),
          message: phaseValidation.message,
          severity: 'info'
        });
      } else if (!phaseValidation.isValid) {
        result.isValid = false;
        result.errors.push({
          type: 'budget_exceeded',
          phaseId: pid.toString(),
          message: `Phase ${pid.toString().slice(-4)}: ${phaseValidation.message}`,
          ...phaseValidation
        });
      } else {
        if (!result.validationDetails.budget) {
          result.validationDetails.budget = { type: 'multi_phase', phases: [] };
        }
        result.validationDetails.budget.phases.push({
          phaseId: pid.toString(),
          allocated: phaseCost,
          ...phaseValidation
        });
      }
    }
    
  } else if (equipmentScope === 'floor_specific' && floorId) {
    // Floor-specific equipment: charge to floor budget
    const floorValidation = await validateFloorBudget(floorId, totalCost, 'equipment');
    
    if (floorValidation.budgetNotSet) {
      result.budgetNotSet = true;
      result.warnings.push({
        type: 'budget_not_set',
        floorId: floorId.toString(),
        message: floorValidation.message,
        severity: 'info'
      });
    } else if (!floorValidation.isValid) {
      result.isValid = false;
      result.errors.push({
        type: 'budget_exceeded',
        floorId: floorId.toString(),
        message: floorValidation.message,
        ...floorValidation
      });
    } else {
      result.validationDetails.budget = {
        type: 'floor_specific',
        floorId: floorId.toString(),
        ...floorValidation
      };
    }
    
  } else if (equipmentScope === 'phase_specific' && phaseId) {
    // Phase-specific equipment: charge to phase budget
    const phaseValidation = await validatePhaseMaterialBudget(phaseId, totalCost, null);
    
    if (phaseValidation.budgetNotSet) {
      result.budgetNotSet = true;
      result.warnings.push({
        type: 'budget_not_set',
        phaseId: phaseId.toString(),
        message: phaseValidation.message,
        severity: 'info'
      });
    } else if (!phaseValidation.isValid) {
      result.isValid = false;
      result.errors.push({
        type: 'budget_exceeded',
        phaseId: phaseId.toString(),
        message: phaseValidation.message,
        ...phaseValidation
      });
    } else {
      result.validationDetails.budget = {
        type: 'phase_specific',
        phaseId: phaseId.toString(),
        ...phaseValidation
      };
    }
  }
  
  // ========== CAPITAL VALIDATION ==========
  const capitalValidation = await validateCapitalAvailability(projectId, totalCost);
  
  if (capitalValidation.capitalNotSet) {
    result.capitalNotSet = true;
    result.warnings.push({
      type: 'capital_not_set',
      message: capitalValidation.message,
      severity: 'info'
    });
  } else if (!capitalValidation.isValid) {
    result.isValid = false;
    result.errors.push({
      type: 'capital_insufficient',
      message: capitalValidation.message,
      ...capitalValidation
    });
  } else {
    result.validationDetails.capital = capitalValidation;
  }
  
  // ========== SUMMARY ==========
  if (result.isValid && result.errors.length === 0) {
    if (result.budgetNotSet && result.capitalNotSet) {
      result.message = 'Equipment approved: No budget or capital set. Spending will be tracked.';
      result.severity = 'info';
    } else if (result.budgetNotSet) {
      result.message = 'Equipment approved: No budget set. Capital validated successfully.';
      result.severity = 'success';
    } else if (result.capitalNotSet) {
      result.message = 'Equipment approved: No capital set. Budget validated successfully. Add capital to enable capital tracking.';
      result.severity = 'warning';
    } else {
      result.message = 'Equipment approved: Budget and capital validated successfully.';
      result.severity = 'success';
    }
  }
  
  return result;
}

/**
 * Get indirect cost spending for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Total indirect spending
 */
export async function getIndirectCostSpending(projectId) {
  const db = await getDatabase();
  
  if (!projectId || !ObjectId.isValid(projectId)) {
    return 0;
  }
  
  // Get site-wide equipment costs
  const equipmentResult = await db.collection('equipment').aggregate([
    {
      $match: {
        projectId: new ObjectId(projectId),
        equipmentScope: 'site_wide',
        deletedAt: null,
        status: { $in: ['assigned', 'in_use', 'returned'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalCost' }
      }
    }
  ]).toArray();
  
  // Get indirect expenses
  const expensesResult = await db.collection('expenses').aggregate([
    {
      $match: {
        projectId: new ObjectId(projectId),
        isIndirectCost: true,
        deletedAt: null,
        status: { $in: ['approved', 'paid'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]).toArray();
  
  const equipmentTotal = equipmentResult[0]?.total || 0;
  const expensesTotal = expensesResult[0]?.total || 0;
  
  return equipmentTotal + expensesTotal;
}

/**
 * Calculate equipment cost for a phase
 * Handles phase_specific, floor_specific, and multi_phase equipment
 * Site-wide equipment is NOT included (charged to indirect costs)
 * @param {string} phaseId - Phase ID
 * @returns {Promise<number>} Total equipment cost
 */
export async function calculatePhaseEquipmentCost(phaseId) {
  const db = await getDatabase();

  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return 0;
  }

  const phaseObjectId = new ObjectId(phaseId);
  
  // Get all equipment for this phase (phase_specific + multi_phase)
  const phaseSpecificEquipment = await db.collection('equipment').aggregate([
    {
      $match: {
        phaseId: phaseObjectId,
        equipmentScope: 'phase_specific',
        deletedAt: null,
        status: { $in: ['assigned', 'in_use', 'returned'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalCost' }
      }
    }
  ]).toArray();

  // Get floor-specific equipment for floors in this phase
  const floorsInPhase = await db.collection('floors').find({
    phaseId: phaseObjectId,
    deletedAt: null
  }).toArray();
  
  const floorIds = floorsInPhase.map(f => f._id);
  
  let floorEquipmentTotal = 0;
  if (floorIds.length > 0) {
    const floorEquipmentResult = await db.collection('equipment').aggregate([
      {
        $match: {
          floorId: { $in: floorIds },
          equipmentScope: 'floor_specific',
          deletedAt: null,
          status: { $in: ['assigned', 'in_use', 'returned'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalCost' }
        }
      }
    ]).toArray();
    floorEquipmentTotal = floorEquipmentResult[0]?.total || 0;
  }

  // Get multi-phase equipment and split costs
  const multiPhaseEquipment = await db.collection('equipment').find({
    equipmentScope: 'multi_phase',
    phaseIds: phaseObjectId,
    deletedAt: null,
    status: { $in: ['assigned', 'in_use', 'returned'] }
  }).toArray();
  
  let multiPhaseTotal = 0;
  for (const eq of multiPhaseEquipment) {
    if (eq.costSplit && eq.costSplit.type === 'percentage' && eq.costSplit.percentages) {
      // Use percentage split
      const percentage = eq.costSplit.percentages[phaseId] || 0;
      multiPhaseTotal += eq.totalCost * (percentage / 100);
    } else {
      // Equal split
      const phaseCount = eq.phaseIds?.length || 1;
      multiPhaseTotal += eq.totalCost / phaseCount;
    }
  }

  const phaseSpecificTotal = phaseSpecificEquipment[0]?.total || 0;
  
  return phaseSpecificTotal + floorEquipmentTotal + multiPhaseTotal;
}

/**
 * Calculate committed equipment cost for a phase
 * Equipment that is assigned but not yet returned
 * Handles phase_specific, floor_specific, and multi_phase equipment
 * Site-wide equipment is NOT included (charged to indirect costs)
 * @param {string} phaseId - Phase ID
 * @returns {Promise<number>} Total committed equipment cost
 */
export async function calculatePhaseEquipmentCommittedCost(phaseId) {
  const db = await getDatabase();

  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return 0;
  }

  const phaseObjectId = new ObjectId(phaseId);
  
  // Get phase-specific equipment
  const phaseSpecificResult = await db.collection('equipment').aggregate([
    {
      $match: {
        phaseId: phaseObjectId,
        equipmentScope: 'phase_specific',
        deletedAt: null,
        status: { $in: ['assigned', 'in_use'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalCost' }
      }
    }
  ]).toArray();

  // Get floor-specific equipment
  const floorsInPhase = await db.collection('floors').find({
    phaseId: phaseObjectId,
    deletedAt: null
  }).toArray();
  
  const floorIds = floorsInPhase.map(f => f._id);
  let floorEquipmentTotal = 0;
  
  if (floorIds.length > 0) {
    const floorResult = await db.collection('equipment').aggregate([
      {
        $match: {
          floorId: { $in: floorIds },
          equipmentScope: 'floor_specific',
          deletedAt: null,
          status: { $in: ['assigned', 'in_use'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalCost' }
        }
      }
    ]).toArray();
    floorEquipmentTotal = floorResult[0]?.total || 0;
  }

  // Get multi-phase equipment and split costs
  const multiPhaseEquipment = await db.collection('equipment').find({
    equipmentScope: 'multi_phase',
    phaseIds: phaseObjectId,
    deletedAt: null,
    status: { $in: ['assigned', 'in_use'] }
  }).toArray();
  
  let multiPhaseTotal = 0;
  for (const eq of multiPhaseEquipment) {
    if (eq.costSplit && eq.costSplit.type === 'percentage' && eq.costSplit.percentages) {
      const percentage = eq.costSplit.percentages[phaseId] || 0;
      multiPhaseTotal += eq.totalCost * (percentage / 100);
    } else {
      const phaseCount = eq.phaseIds?.length || 1;
      multiPhaseTotal += eq.totalCost / phaseCount;
    }
  }

  const phaseSpecificTotal = phaseSpecificResult[0]?.total || 0;
  
  return phaseSpecificTotal + floorEquipmentTotal + multiPhaseTotal;
}

/**
 * Update equipment utilization
 * @param {string} equipmentId - Equipment ID
 * @param {number} actualHours - Actual hours used
 * @returns {Promise<Object>} Updated equipment
 */
export async function updateEquipmentUtilization(equipmentId, actualHours) {
  const db = await getDatabase();
  
  if (!equipmentId || !ObjectId.isValid(equipmentId)) {
    throw new Error('Invalid equipment ID');
  }
  
  const equipment = await db.collection('equipment').findOne({
    _id: new ObjectId(equipmentId),
    deletedAt: null
  });
  
  if (!equipment) {
    throw new Error('Equipment not found');
  }
  
  const estimatedHours = equipment.utilization?.estimatedHours || 0;
  const utilizationPercentage = calculateUtilizationPercentage(actualHours, estimatedHours);
  
  const updated = await db.collection('equipment').findOneAndUpdate(
    { _id: new ObjectId(equipmentId) },
    {
      $set: {
        'utilization.actualHours': parseFloat(actualHours) || 0,
        'utilization.utilizationPercentage': utilizationPercentage,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );
  
  return updated.value;
}

/**
 * Recalculate equipment total cost based on dates
 * @param {string} equipmentId - Equipment ID
 * @returns {Promise<Object>} Updated equipment
 */
export async function recalculateEquipmentCost(equipmentId) {
  const db = await getDatabase();
  
  if (!equipmentId || !ObjectId.isValid(equipmentId)) {
    throw new Error('Invalid equipment ID');
  }
  
  const equipment = await db.collection('equipment').findOne({
    _id: new ObjectId(equipmentId),
    deletedAt: null
  });
  
  if (!equipment) {
    throw new Error('Equipment not found');
  }
  
  const totalCost = calculateEquipmentCost(
    equipment.startDate,
    equipment.endDate || new Date(),
    equipment.dailyRate
  );
  
  const updated = await db.collection('equipment').findOneAndUpdate(
    { _id: new ObjectId(equipmentId) },
    {
      $set: {
        totalCost: totalCost,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );
  
  return updated.value;
}

/**
 * Get equipment statistics for a phase
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Object>} Equipment statistics
 */
export async function getPhaseEquipmentStatistics(phaseId) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return {
      total: 0,
      totalCost: 0,
      byStatus: {},
      byType: {},
      averageUtilization: 0
    };
  }
  
  const equipment = await db.collection('equipment').find({
    phaseId: new ObjectId(phaseId),
    deletedAt: null
  }).toArray();
  
  const stats = {
    total: equipment.length,
    totalCost: equipment.reduce((sum, eq) => sum + (eq.totalCost || 0), 0),
    byStatus: {},
    byType: {},
    totalEstimatedHours: 0,
    totalActualHours: 0,
    averageUtilization: 0
  };
  
  equipment.forEach(eq => {
    // By status
    const status = eq.status || 'unknown';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    
    // By type
    const type = eq.equipmentType || 'other';
    stats.byType[type] = (stats.byType[type] || 0) + 1;
    
    // Utilization
    stats.totalEstimatedHours += eq.utilization?.estimatedHours || 0;
    stats.totalActualHours += eq.utilization?.actualHours || 0;
  });
  
  // Calculate average utilization
  if (stats.totalEstimatedHours > 0) {
    stats.averageUtilization = (stats.totalActualHours / stats.totalEstimatedHours) * 100;
  }

  return stats;
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

// Export all functions
export { formatCurrency };


