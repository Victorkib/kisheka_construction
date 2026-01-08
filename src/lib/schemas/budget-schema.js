/**
 * Enhanced Budget Schema Definition
 * Enhanced (hierarchical) budget structure only
 * Legacy structure conversion functions are kept for migration purposes only
 */

/**
 * Enhanced Budget Schema
 * @typedef {Object} EnhancedBudgetSchema
 * 
 * Legacy Structure (backward compatible):
 * {
 *   total: Number,
 *   materials: Number,
 *   labour: Number,
 *   contingency: Number,
 *   spent: Number (computed)
 * }
 * 
 * Enhanced Structure:
 * {
 *   // Top-level totals
 *   total: Number,                    // Total project budget
 *   directConstructionCosts: Number,   // DCC subtotal
 *   preConstructionCosts: Number,     // Pre-construction subtotal
 *   indirectCosts: Number,            // Overhead subtotal
 *   contingencyReserve: Number,       // Contingency subtotal
 *   
 *   // Direct Construction Costs breakdown
 *   directCosts: {
 *     materials: {
 *       total: Number,
 *       structural: Number,
 *       finishing: Number,
 *       mep: Number,              // Mechanical, Electrical, Plumbing
 *       specialty: Number
 *     },
 *     labour: {
 *       total: Number,
 *       skilled: Number,
 *       unskilled: Number,
 *       supervisory: Number,
 *       specialized: Number      // Specialized contractors
 *     },
 *     equipment: {
 *       total: Number,
 *       rental: Number,
 *       purchase: Number,
 *       maintenance: Number
 *     },
 *     subcontractors: {
 *       total: Number,
 *       specializedTrades: Number,
 *       professionalServices: Number
 *     }
 *   },
 *   
 *   // Pre-Construction Costs breakdown
 *   preConstruction: {
 *     total: Number,
 *     landAcquisition: Number,
 *     legalRegulatory: Number,
 *     permitsApprovals: Number,
 *     sitePreparation: Number
 *   },
 *   
 *   // Indirect Costs breakdown
 *   indirect: {
 *     total: Number,
 *     siteOverhead: Number,
 *     transportation: Number,
 *     utilities: Number,
 *     safetyCompliance: Number
 *   },
 *   
 *   // Contingency breakdown
 *   contingency: {
 *     total: Number,
 *     designContingency: Number,      // 5-10% of design costs
 *     constructionContingency: Number, // 10-15% of construction costs
 *     ownersReserve: Number           // 5% owner-controlled
 *   },
 *   
 *   // Phase-level allocations (optional, can be auto-calculated)
 *   phaseAllocations: {
 *     preConstruction: Number,
 *     basement: Number,
 *     superstructure: Number,
 *     finishing: Number,
 *     finalSystems: Number
 *   },
 *   
 *   // Financial tracking states
 *   financialStates: {
 *     budgeted: Number,    // Total budgeted
 *     estimated: Number,   // Estimated costs (requests approved)
 *     committed: Number,   // Committed costs (POs accepted)
 *     actual: Number,      // Actual costs (invoiced/paid)
 *     forecast: Number     // Forecasted final cost
 *   },
 *   
 *   // Legacy fields (for backward compatibility)
 *   materials: Number,     // Maps to directCosts.materials.total
 *   labour: Number,        // Maps to directCosts.labour.total
 *   contingency: Number,  // Maps to contingency.total
 *   spent: Number          // Computed field
 * }
 */

/**
 * Check if budget uses enhanced structure
 * @param {Object} budget - Budget object to check
 * @returns {boolean} True if enhanced structure
 */
export function isEnhancedBudget(budget) {
  if (!budget || typeof budget !== 'object') {
    return false;
  }
  
  // Enhanced structure has directCosts field
  return budget.directCosts !== undefined;
}

/**
 * Check if budget uses legacy structure
 * @deprecated This function is kept for migration purposes only. All new projects use enhanced structure.
 * @param {Object} budget - Budget object to check
 * @returns {boolean} True if legacy structure
 */
export function isLegacyBudget(budget) {
  if (!budget || typeof budget !== 'object') {
    return false; // Empty budgets are treated as enhanced (will be initialized as enhanced)
  }
  
  // Legacy structure only has total, materials, labour, contingency (no directCosts)
  return budget.directCosts === undefined && (budget.materials !== undefined || budget.labour !== undefined);
}

/**
 * Get total budget amount (works with both structures)
 * @param {Object} budget - Budget object
 * @returns {number} Total budget amount
 */
export function getBudgetTotal(budget) {
  if (!budget) return 0;
  
  if (isEnhancedBudget(budget)) {
    return budget.total || 0;
  }
  
  // Legacy structure
  return budget.total || 0;
}

/**
 * Get materials budget (works with both structures)
 * @param {Object} budget - Budget object
 * @returns {number} Materials budget
 */
export function getMaterialsBudget(budget) {
  if (!budget) return 0;
  
  if (isEnhancedBudget(budget)) {
    return budget.directCosts?.materials?.total || budget.materials || 0;
  }
  
  // Legacy structure
  return budget.materials || 0;
}

/**
 * Get labour budget (works with both structures)
 * @param {Object} budget - Budget object
 * @returns {number} Labour budget
 */
export function getLabourBudget(budget) {
  if (!budget) return 0;
  
  if (isEnhancedBudget(budget)) {
    return budget.directCosts?.labour?.total || budget.labour || 0;
  }
  
  // Legacy structure
  return budget.labour || 0;
}

/**
 * Get contingency budget (works with both structures)
 * @param {Object} budget - Budget object
 * @returns {number} Contingency budget
 */
export function getContingencyBudget(budget) {
  if (!budget) return 0;
  
  if (isEnhancedBudget(budget)) {
    return budget.contingency?.total || budget.contingencyReserve || budget.contingency || 0;
  }
  
  // Legacy structure
  return budget.contingency || 0;
}

/**
 * Convert legacy budget to enhanced structure
 * @deprecated This function is kept for migration purposes only. All new projects use enhanced structure.
 * @param {Object} legacyBudget - Legacy budget object
 * @returns {Object} Enhanced budget object
 */
export function convertLegacyToEnhanced(legacyBudget) {
  if (!legacyBudget || isEnhancedBudget(legacyBudget)) {
    return legacyBudget;
  }
  
  const materials = legacyBudget.materials || 0;
  const labour = legacyBudget.labour || 0;
  const contingency = legacyBudget.contingency || 0;
  const total = legacyBudget.total || 0;
  
  // CRITICAL FIX: Ensure components sum to user's intended total
  // Strategy: Calculate Pre-Construction and Indirect first, then adjust DCC to fit remaining budget
  
  // Estimate pre-construction as 5% of total if not specified
  const preConstructionCosts = total * 0.05;
  
  // Estimate indirect costs as 3% of total if not specified
  const indirectCosts = total * 0.03;
  
  // Calculate remaining budget for Direct Construction Costs
  // Total = DCC + Pre-Construction + Indirect + Contingency
  // Therefore: DCC = Total - Pre-Construction - Indirect - Contingency
  const remainingForDCC = total - preConstructionCosts - indirectCosts - contingency;
  const adjustedDCC = Math.max(0, remainingForDCC);
  
  // Calculate estimated equipment and subcontractors as percentages of materials+labour
  // But scale them proportionally to fit within adjustedDCC
  const materialsPlusLabour = materials + labour;
  const estimatedEquipmentRatio = materialsPlusLabour > 0 ? (materials + labour) * 0.1 : 0;
  const estimatedSubcontractorsRatio = materialsPlusLabour > 0 ? (materials + labour) * 0.05 : 0;
  const estimatedDCCFromInputs = materialsPlusLabour + estimatedEquipmentRatio + estimatedSubcontractorsRatio;
  
  // Scale materials, labour, equipment, and subcontractors proportionally to fit adjustedDCC
  let scaledMaterials = materials;
  let scaledLabour = labour;
  let scaledEquipment = estimatedEquipmentRatio;
  let scaledSubcontractors = estimatedSubcontractorsRatio;
  
  if (estimatedDCCFromInputs > 0 && adjustedDCC !== estimatedDCCFromInputs) {
    const scaleFactor = adjustedDCC / estimatedDCCFromInputs;
    scaledMaterials = materials * scaleFactor;
    scaledLabour = labour * scaleFactor;
    scaledEquipment = estimatedEquipmentRatio * scaleFactor;
    scaledSubcontractors = estimatedSubcontractorsRatio * scaleFactor;
  }
  
  // Ensure DCC matches adjusted value (account for rounding)
  const directConstructionCosts = scaledMaterials + scaledLabour + scaledEquipment + scaledSubcontractors;
  
  return {
    // Top-level totals - CRITICAL: total remains as user intended
    total,
    directConstructionCosts: Math.max(0, directConstructionCosts),
    preConstructionCosts,
    indirectCosts,
    contingencyReserve: contingency,
    
    // Direct Construction Costs breakdown - using scaled values
    directCosts: {
      materials: {
        total: scaledMaterials,
        structural: scaledMaterials * 0.65,      // Estimate 65% structural
        finishing: scaledMaterials * 0.25,       // Estimate 25% finishing
        mep: scaledMaterials * 0.08,             // Estimate 8% MEP
        specialty: scaledMaterials * 0.02        // Estimate 2% specialty
      },
      labour: {
        total: scaledLabour,
        skilled: scaledLabour * 0.6,             // Estimate 60% skilled
        unskilled: scaledLabour * 0.3,          // Estimate 30% unskilled
        supervisory: scaledLabour * 0.08,        // Estimate 8% supervisory
        specialized: scaledLabour * 0.02        // Estimate 2% specialized
      },
      equipment: {
        total: scaledEquipment,
        rental: scaledEquipment * 0.7,
        purchase: scaledEquipment * 0.2,
        maintenance: scaledEquipment * 0.1
      },
      subcontractors: {
        total: scaledSubcontractors,
        specializedTrades: scaledSubcontractors * 0.8,
        professionalServices: scaledSubcontractors * 0.2
      }
    },
    
    // Pre-Construction Costs breakdown
    preConstruction: {
      total: preConstructionCosts,
      landAcquisition: preConstructionCosts * 0.5,
      legalRegulatory: preConstructionCosts * 0.2,
      permitsApprovals: preConstructionCosts * 0.2,
      sitePreparation: preConstructionCosts * 0.1
    },
    
    // Indirect Costs breakdown
    indirect: {
      total: indirectCosts,
      siteOverhead: indirectCosts * 0.4,
      transportation: indirectCosts * 0.3,
      utilities: indirectCosts * 0.2,
      safetyCompliance: indirectCosts * 0.1
    },
    
    // Contingency breakdown
    contingency: {
      total: contingency,
      designContingency: contingency * 0.2,
      constructionContingency: contingency * 0.7,
      ownersReserve: contingency * 0.1
    },
    
    // Phase allocations (estimated based on typical construction)
    phaseAllocations: {
      preConstruction: preConstructionCosts,
      basement: directConstructionCosts * 0.15,
      superstructure: directConstructionCosts * 0.65,
      finishing: directConstructionCosts * 0.15,
      finalSystems: directConstructionCosts * 0.05
    },
    
    // Financial states (initialize)
    financialStates: {
      budgeted: total,
      estimated: 0,
      committed: 0,
      actual: legacyBudget.spent || 0,
      forecast: total
    },
    
    // Legacy fields (for backward compatibility) - use scaled values
    materials: scaledMaterials,
    labour: scaledLabour,
    contingency,
    spent: legacyBudget.spent || 0
  };
}

/**
 * Create enhanced budget from input data
 * @param {Object} input - Budget input data
 * @returns {Object} Enhanced budget object
 */
export function createEnhancedBudget(input) {
  const {
    total,
    directConstructionCosts,
    preConstructionCosts,
    indirectCosts,
    contingencyReserve,
    directCosts,
    preConstruction,
    indirect,
    contingency,
    phaseAllocations
  } = input;
  
  // Calculate totals if not provided
  const calculatedTotal = total || 
    (directConstructionCosts || 0) + 
    (preConstructionCosts || 0) + 
    (indirectCosts || 0) + 
    (contingencyReserve || 0);
  
  const calculatedDCC = directConstructionCosts || 
    ((directCosts?.materials?.total || 0) +
     (directCosts?.labour?.total || 0) +
     (directCosts?.equipment?.total || 0) +
     (directCosts?.subcontractors?.total || 0));
  
  return {
    total: calculatedTotal,
    directConstructionCosts: calculatedDCC,
    preConstructionCosts: preConstructionCosts || 0,
    indirectCosts: indirectCosts || 0,
    contingencyReserve: contingencyReserve || contingency?.total || 0,
    
    directCosts: directCosts || {
      materials: { total: 0, structural: 0, finishing: 0, mep: 0, specialty: 0 },
      labour: { total: 0, skilled: 0, unskilled: 0, supervisory: 0, specialized: 0 },
      equipment: { total: 0, rental: 0, purchase: 0, maintenance: 0 },
      subcontractors: { total: 0, specializedTrades: 0, professionalServices: 0 }
    },
    
    preConstruction: preConstruction || {
      total: preConstructionCosts || 0,
      landAcquisition: 0,
      legalRegulatory: 0,
      permitsApprovals: 0,
      sitePreparation: 0
    },
    
    indirect: indirect || {
      total: indirectCosts || 0,
      siteOverhead: 0,
      transportation: 0,
      utilities: 0,
      safetyCompliance: 0
    },
    
    contingency: contingency || {
      total: contingencyReserve || 0,
      designContingency: 0,
      constructionContingency: 0,
      ownersReserve: 0
    },
    
    phaseAllocations: phaseAllocations || {},
    
    financialStates: {
      budgeted: calculatedTotal,
      estimated: 0,
      committed: 0,
      actual: 0,
      forecast: calculatedTotal
    },
    
    // Legacy compatibility fields
    materials: directCosts?.materials?.total || 0,
    labour: directCosts?.labour?.total || 0,
    contingency: contingencyReserve || contingency?.total || 0,
    spent: 0
  };
}

/**
 * Validate budget structure
 * @param {Object} budget - Budget object to validate
 * @returns {Object} { isValid: boolean, errors: string[], warnings: string[] }
 */
export function validateBudget(budget) {
  const errors = [];
  const warnings = [];
  
  if (!budget || typeof budget !== 'object') {
    return { isValid: false, errors: ['Budget is required'], warnings: [] };
  }
  
  // Check total
  const total = getBudgetTotal(budget);
  if (total < 0) {
    errors.push('Total budget cannot be negative');
  }
  
  // If enhanced structure, validate sub-structures
  if (isEnhancedBudget(budget)) {
    const dcc = budget.directConstructionCosts || 0;
    const preCon = budget.preConstructionCosts || 0;
    const indirect = budget.indirectCosts || 0;
    const contingency = budget.contingencyReserve || 0;
    
    const calculatedTotal = dcc + preCon + indirect + contingency;
    const variance = Math.abs(total - calculatedTotal);
    
    // Allow 1% variance for rounding (or 1000 KES minimum)
    const allowedVariance = Math.max(total * 0.01, 1000);
    
    if (variance > allowedVariance && total > 0) {
      errors.push(
        `Budget components don't sum to total. Expected ${total.toLocaleString()} KES, got ${calculatedTotal.toLocaleString()} KES. Variance: ${variance.toLocaleString()} KES`
      );
    } else if (variance > 0 && variance <= allowedVariance) {
      warnings.push(
        `Minor rounding variance detected: ${variance.toLocaleString()} KES. This is acceptable.`
      );
    }
    
    // Validate Pre-Construction breakdown (if advanced options used)
    if (budget.preConstruction) {
      const preConBreakdown = 
        (budget.preConstruction.landAcquisition || 0) +
        (budget.preConstruction.legalRegulatory || 0) +
        (budget.preConstruction.permitsApprovals || 0) +
        (budget.preConstruction.sitePreparation || 0);
      const preConVariance = Math.abs(preCon - preConBreakdown);
      if (preConVariance > Math.max(preCon * 0.01, 1000) && preCon > 0) {
        warnings.push(
          `Pre-Construction breakdown (${preConBreakdown.toLocaleString()} KES) doesn't match total (${preCon.toLocaleString()} KES). Variance: ${preConVariance.toLocaleString()} KES`
        );
      }
    }
    
    // Validate Indirect Costs breakdown (if advanced options used)
    if (budget.indirect) {
      const indirectBreakdown = 
        (budget.indirect.siteOverhead || 0) +
        (budget.indirect.transportation || 0) +
        (budget.indirect.utilities || 0) +
        (budget.indirect.safetyCompliance || 0);
      const indirectVariance = Math.abs(indirect - indirectBreakdown);
      if (indirectVariance > Math.max(indirect * 0.01, 1000) && indirect > 0) {
        warnings.push(
          `Indirect Costs breakdown (${indirectBreakdown.toLocaleString()} KES) doesn't match total (${indirect.toLocaleString()} KES). Variance: ${indirectVariance.toLocaleString()} KES`
        );
      }
    }
    
    // Validate Contingency breakdown (if advanced options used)
    if (budget.contingency) {
      const contingencyBreakdown = 
        (budget.contingency.designContingency || 0) +
        (budget.contingency.constructionContingency || 0) +
        (budget.contingency.ownersReserve || 0);
      const contingencyVariance = Math.abs(contingency - contingencyBreakdown);
      if (contingencyVariance > Math.max(contingency * 0.01, 1000) && contingency > 0) {
        warnings.push(
          `Contingency breakdown (${contingencyBreakdown.toLocaleString()} KES) doesn't match total (${contingency.toLocaleString()} KES). Variance: ${contingencyVariance.toLocaleString()} KES`
        );
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Update project budget total (works with both legacy and enhanced structures)
 * @param {Object} budget - Current budget object
 * @param {number} amount - Amount to add (positive) or subtract (negative)
 * @returns {Object} Updated budget object
 */
export function updateBudgetTotal(budget, amount) {
  if (!budget || typeof budget !== 'object') {
    // If no budget, create a minimal one
    return {
      total: Math.max(0, amount),
      materials: 0,
      labour: 0,
      contingency: 0
    };
  }

  const currentTotal = getBudgetTotal(budget);
  const newTotal = Math.max(0, currentTotal + amount);

  if (isEnhancedBudget(budget)) {
    // Enhanced structure: update total and maintain structure
    return {
      ...budget,
      total: newTotal,
      // Update directConstructionCosts proportionally if it exists
      directConstructionCosts: budget.directConstructionCosts 
        ? Math.max(0, budget.directConstructionCosts + (amount * (budget.directConstructionCosts / currentTotal || 1)))
        : budget.directConstructionCosts || 0,
      // Update legacy fields for backward compatibility
      materials: getMaterialsBudget(budget),
      labour: getLabourBudget(budget),
      contingency: getContingencyBudget(budget)
    };
  } else {
    // Legacy structure: update total
    return {
      ...budget,
      total: newTotal
    };
  }
}

export const BUDGET_SCHEMA = {
  // Export constants for use in validation
  LEGACY_FIELDS: ['total', 'materials', 'labour', 'contingency', 'spent'],
  ENHANCED_FIELDS: [
    'directConstructionCosts',
    'preConstructionCosts',
    'indirectCosts',
    'contingencyReserve',
    'directCosts',
    'preConstruction',
    'indirect',
    'contingency',
    'phaseAllocations',
    'financialStates'
  ]
};

