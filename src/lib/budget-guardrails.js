/**
 * Budget Validation Guardrails
 * Reusable validation functions for budget allocation across all levels
 */

/**
 * Validate project budget against spending
 * @param {Object} budget - Project budget object
 * @param {Object} preBudgetSummary - Pre-budget spending summary
 * @returns {Object} Validation result with warnings
 */
export function validateProjectBudget(budget, preBudgetSummary) {
  const warnings = [];
  const errors = [];
  
  const dcc = budget.directConstructionCosts || 0;
  const preConstruction = budget.preConstructionCosts || 0;
  const indirect = budget.indirectCosts || 0;
  
  // DCC validation
  if (dcc > 0 && preBudgetSummary?.totalSpending?.dcc > 0) {
    if (dcc < preBudgetSummary.totalSpending.dcc) {
      errors.push({
        category: 'DCC',
        type: 'below_spending',
        message: `DCC budget (${formatCurrency(dcc)}) cannot be less than actual spending (${formatCurrency(preBudgetSummary.totalSpending.dcc)})`,
        recommended: preBudgetSummary.totalSpending.dcc,
        severity: 'error'
      });
    } else if (dcc < preBudgetSummary.totalSpending.dcc * 1.1) {
      warnings.push({
        category: 'DCC',
        type: 'close_to_spending',
        message: `DCC budget is close to spending. Recommended: ${formatCurrency(preBudgetSummary.recommendations?.dcc || 0)}`,
        recommended: preBudgetSummary.recommendations?.dcc || 0,
        severity: 'warning'
      });
    }
  }
  
  // Pre-construction validation
  if (preConstruction > 0 && preBudgetSummary?.totalSpending?.preConstruction > 0) {
    if (preConstruction < preBudgetSummary.totalSpending.preConstruction) {
      errors.push({
        category: 'Pre-Construction',
        type: 'below_spending',
        message: `Pre-construction budget (${formatCurrency(preConstruction)}) cannot be less than actual spending (${formatCurrency(preBudgetSummary.totalSpending.preConstruction)})`,
        recommended: preBudgetSummary.totalSpending.preConstruction,
        severity: 'error'
      });
    }
  }
  
  // Indirect costs validation
  if (indirect > 0 && preBudgetSummary?.totalSpending?.indirect > 0) {
    if (indirect < preBudgetSummary.totalSpending.indirect) {
      errors.push({
        category: 'Indirect',
        type: 'below_spending',
        message: `Indirect costs budget (${formatCurrency(indirect)}) cannot be less than actual spending (${formatCurrency(preBudgetSummary.totalSpending.indirect)})`,
        recommended: preBudgetSummary.totalSpending.indirect,
        severity: 'error'
      });
    }
  }
  
  // Total budget validation
  const totalBudget = budget.total || dcc + preConstruction + indirect + (budget.contingencyReserve || 0);
  const totalSpending = (preBudgetSummary?.totalSpending?.dcc || 0) + 
                        (preBudgetSummary?.totalSpending?.preConstruction || 0) + 
                        (preBudgetSummary?.totalSpending?.indirect || 0);
  
  if (totalBudget > 0 && totalSpending > 0 && totalBudget < totalSpending) {
    errors.push({
      category: 'Total Budget',
      type: 'below_spending',
      message: `Total budget (${formatCurrency(totalBudget)}) cannot be less than total spending (${formatCurrency(totalSpending)})`,
      recommended: totalSpending,
      severity: 'error'
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    hasIssues: errors.length > 0 || warnings.length > 0
  };
}

/**
 * Validate phase budget allocation
 * @param {Object} phaseBudget - Phase budget object
 * @param {Object} phase - Phase data
 * @param {number} projectDCC - Project DCC total
 * @param {number} totalPhaseBudgets - Sum of all phase budgets
 * @returns {Object} Validation result
 */
export function validatePhaseBudget(phaseBudget, phase, projectDCC, totalPhaseBudgets) {
  const errors = [];
  const warnings = [];
  
  const total = phaseBudget.total || 0;
  const actualSpending = phase?.actualSpending?.total || 0;
  
  // Cannot be negative
  if (total < 0) {
    errors.push({
      category: 'Phase Budget',
      type: 'negative',
      message: 'Phase budget cannot be negative',
      severity: 'error'
    });
  }
  
  // Cannot be less than actual spending
  if (total > 0 && actualSpending > 0 && total < actualSpending) {
    errors.push({
      category: 'Phase Budget',
      type: 'below_spending',
      message: `Phase budget (${formatCurrency(total)}) cannot be less than actual spending (${formatCurrency(actualSpending)})`,
      recommended: actualSpending,
      severity: 'error'
    });
  }
  
  // Check if total phase budgets exceed project DCC
  if (projectDCC > 0 && totalPhaseBudgets > projectDCC) {
    const excess = totalPhaseBudgets - projectDCC;
    warnings.push({
      category: 'Phase Allocation',
      type: 'exceeds_dcc',
      message: `Total phase budgets (${formatCurrency(totalPhaseBudgets)}) exceed project DCC (${formatCurrency(projectDCC)}) by ${formatCurrency(excess)}`,
      recommended: projectDCC,
      severity: 'warning'
    });
  }
  
  // Category breakdown validation
  const categories = ['materials', 'labour', 'equipment', 'subcontractors'];
  const categoryTotal = categories.reduce((sum, cat) => sum + (phaseBudget[cat] || 0), 0);
  
  if (total > 0 && categoryTotal > 0) {
    const variance = Math.abs(categoryTotal - total);
    const variancePercent = (variance / total) * 100;
    
    if (variancePercent > 5) {
      warnings.push({
        category: 'Category Breakdown',
        type: 'mismatch',
        message: `Category breakdown (${formatCurrency(categoryTotal)}) doesn't match total (${formatCurrency(total)}). Variance: ${variancePercent.toFixed(1)}%`,
        severity: 'warning'
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    hasIssues: errors.length > 0 || warnings.length > 0
  };
}

/**
 * Validate floor budget allocation
 * @param {Object} floorBudget - Floor budget object
 * @param {Object} floor - Floor data
 * @param {number} phaseBudget - Parent phase budget
 * @returns {Object} Validation result
 */
export function validateFloorBudget(floorBudget, floor, phaseBudget) {
  const errors = [];
  const warnings = [];
  
  const total = floorBudget.total || 0;
  const actualSpending = floor?.actualCost || 0;
  const capitalAllocation = floor?.capitalAllocation?.total || 0;
  
  // Cannot be negative
  if (total < 0) {
    errors.push({
      category: 'Floor Budget',
      type: 'negative',
      message: 'Floor budget cannot be negative',
      severity: 'error'
    });
  }
  
  // Cannot be less than actual spending
  if (total > 0 && actualSpending > 0 && total < actualSpending) {
    errors.push({
      category: 'Floor Budget',
      type: 'below_spending',
      message: `Floor budget (${formatCurrency(total)}) cannot be less than actual spending (${formatCurrency(actualSpending)})`,
      recommended: actualSpending,
      severity: 'error'
    });
  }
  
  // Capital coverage warning
  if (total > 0 && capitalAllocation > 0) {
    const coverageRatio = capitalAllocation / total;
    
    if (coverageRatio < 0.5) {
      warnings.push({
        category: 'Capital Coverage',
        type: 'low_coverage',
        message: `Capital covers only ${Math.round(coverageRatio * 100)}% of budget. Recommended: ${Math.round(total * 0.8)}`,
        recommended: Math.round(total * 0.8),
        severity: 'warning'
      });
    } else if (coverageRatio < 0.8) {
      warnings.push({
        category: 'Capital Coverage',
        type: 'below_target',
        message: `Capital coverage (${Math.round(coverageRatio * 100)}%) is below target (80%)`,
        recommended: Math.round(total * 0.8),
        severity: 'info'
      });
    }
  }
  
  // Zero capital alert
  if (total > 0 && capitalAllocation === 0) {
    warnings.push({
      category: 'Capital Coverage',
      type: 'no_capital',
      message: 'No capital allocated to this floor. Budget cannot be spent without capital.',
      recommended: Math.round(total * 0.8),
      severity: 'warning'
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    hasIssues: errors.length > 0 || warnings.length > 0
  };
}

/**
 * Validate capital allocation
 * @param {number} capitalAmount - Capital to allocate
 * @param {number} budgetTotal - Related budget total
 * @param {number} availableCapital - Available project capital
 * @returns {Object} Validation result
 */
export function validateCapitalAllocation(capitalAmount, budgetTotal, availableCapital) {
  const errors = [];
  const warnings = [];
  
  // Cannot be negative
  if (capitalAmount < 0) {
    errors.push({
      category: 'Capital Allocation',
      type: 'negative',
      message: 'Capital allocation cannot be negative',
      severity: 'error'
    });
  }
  
  // Cannot exceed available capital
  if (availableCapital > 0 && capitalAmount > availableCapital) {
    errors.push({
      category: 'Capital Allocation',
      type: 'exceeds_available',
      message: `Capital allocation (${formatCurrency(capitalAmount)}) exceeds available capital (${formatCurrency(availableCapital)})`,
      recommended: availableCapital,
      severity: 'error'
    });
  }
  
  // Coverage ratio warnings
  if (budgetTotal > 0 && capitalAmount > 0) {
    const coverageRatio = capitalAmount / budgetTotal;
    
    if (coverageRatio > 1.2) {
      warnings.push({
        category: 'Capital Coverage',
        type: 'excess_capital',
        message: `Capital (${formatCurrency(capitalAmount)}) exceeds budget (${formatCurrency(budgetTotal)}) by ${Math.round((coverageRatio - 1) * 100)}%. Consider reallocating excess.`,
        severity: 'info'
      });
    } else if (coverageRatio < 0.5) {
      warnings.push({
        category: 'Capital Coverage',
        type: 'low_coverage',
        message: `Capital covers only ${Math.round(coverageRatio * 100)}% of budget. Recommended: ${formatCurrency(budgetTotal * 0.8)}`,
        recommended: Math.round(budgetTotal * 0.8),
        severity: 'warning'
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    hasIssues: errors.length > 0 || warnings.length > 0
  };
}

/**
 * Calculate recommended budget from spending
 * @param {Object} spending - Spending breakdown
 * @param {string} category - Category to calculate for
 * @returns {number} Recommended budget
 */
export function calculateRecommendedBudget(spending, category) {
  const categorySpending = spending?.[category] || 0;
  
  if (categorySpending === 0) return 0;
  
  // Add 15-25% buffer depending on category
  const buffers = {
    dcc: 1.20, // 20% buffer for DCC
    preConstruction: 1.15, // 15% buffer for pre-construction
    indirect: 1.15, // 15% buffer for indirect
    contingency: 1.10 // 10% buffer for contingency
  };
  
  return Math.round(categorySpending * (buffers[category] || 1.15));
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
