/**
 * Budget Helper Functions
 * Utilities for budget validation and status checking
 * 
 * These helpers determine when budget validation should be skipped
 * (when budget is zero/not set) vs when it should be enforced.
 * 
 * NOTE: Spending tracking happens regardless of budget value.
 * These functions only affect validation logic.
 */

/**
 * Check if budget validation should be skipped (budget is zero/not set)
 * @param {Object|number} budget - Budget object or budget value
 * @param {string} budgetType - Type of budget check: 'phase', 'project', 'phase_material', 'phase_labour', 'indirect', 'preconstruction'
 * @returns {boolean} True if validation should be skipped (budget is zero)
 */
export function shouldSkipBudgetValidation(budget, budgetType = 'phase') {
  if (!budget) return true;
  
  // Handle numeric budget values
  if (typeof budget === 'number') {
    return budget === 0;
  }
  
  // Handle budget objects
  if (typeof budget !== 'object') {
    return true;
  }
  
  if (budgetType === 'phase') {
    // For phases, check if total budget allocation is zero
    return (budget.budgetAllocation?.total || 0) === 0;
  }
  
  if (budgetType === 'project') {
    // For projects, check if total budget is zero
    return (budget.total || 0) === 0;
  }
  
  if (budgetType === 'phase_material') {
    // For phase material validation, check material budget specifically
    return (budget.budgetAllocation?.materials || 0) === 0;
  }
  
  if (budgetType === 'phase_labour') {
    // For phase labour validation, check labour budget specifically
    return (budget.budgetAllocation?.labour || 0) === 0;
  }
  
  if (budgetType === 'indirect') {
    // For indirect costs, check indirect costs budget
    if (budget.indirect?.total !== undefined) {
      return budget.indirect.total === 0;
    }
    if (budget.indirectCosts !== undefined) {
      return budget.indirectCosts === 0;
    }
    return true; // If structure unclear, skip validation
  }
  
  if (budgetType === 'preconstruction') {
    // For pre-construction costs, check pre-construction budget
    if (budget.preConstruction?.total !== undefined) {
      return budget.preConstruction.total === 0;
    }
    if (budget.preConstructionCosts !== undefined) {
      return budget.preConstructionCosts === 0;
    }
    return true; // If structure unclear, skip validation
  }
  
  return false;
}

/**
 * Get budget status message for UI display
 * @param {Object|number} budget - Budget object or budget value
 * @param {string} budgetType - Type of budget check
 * @returns {Object|null} Status message object or null if budget is set
 */
export function getBudgetStatusMessage(budget, budgetType = 'phase') {
  if (!shouldSkipBudgetValidation(budget, budgetType)) {
    return null; // Budget is set, no special message needed
  }
  
  return {
    type: 'info',
    message: 'No budget set. Operation allowed - spending will be tracked. Set budget later to enable budget validation.',
    allowOperation: true,
    showSetBudgetPrompt: true
  };
}

/**
 * Check if a phase has budget allocated
 * @param {Object} phase - Phase object
 * @returns {boolean} True if phase has budget allocated
 */
export function hasPhaseBudget(phase) {
  if (!phase || !phase.budgetAllocation) {
    return false;
  }
  return (phase.budgetAllocation.total || 0) > 0;
}

/**
 * Check if a project has budget set
 * @param {Object} project - Project object
 * @returns {boolean} True if project has budget set
 */
export function hasProjectBudget(project) {
  if (!project || !project.budget) {
    return false;
  }
  return (project.budget.total || 0) > 0;
}

/**
 * Get budget value for a specific category
 * @param {Object} budget - Budget object
 * @param {string} category - Budget category: 'materials', 'labour', 'equipment', 'subcontractors', 'indirect', 'preconstruction', 'contingency'
 * @returns {number} Budget amount for the category
 */
export function getBudgetForCategory(budget, category) {
  if (!budget) return 0;
  
  switch (category) {
    case 'materials':
      return budget.directCosts?.materials?.total || budget.materials || 0;
    case 'labour':
      return budget.directCosts?.labour?.total || budget.labour || 0;
    case 'equipment':
      return budget.directCosts?.equipment?.total || budget.equipment || 0;
    case 'subcontractors':
      return budget.directCosts?.subcontractors?.total || budget.subcontractors || 0;
    case 'indirect':
      return budget.indirect?.total || budget.indirectCosts || 0;
    case 'preconstruction':
      return budget.preConstruction?.total || budget.preConstructionCosts || 0;
    case 'contingency':
      return budget.contingency?.total || budget.contingencyReserve || budget.contingency || 0;
    default:
      return 0;
  }
}
