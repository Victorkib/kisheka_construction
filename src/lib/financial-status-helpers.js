/**
 * Financial Status Helper Functions
 * Utilities for determining financial status with optional budget/capital awareness
 * 
 * These helpers provide consistent status determination, percentage calculations,
 * and messaging across the entire financial system, properly handling cases
 * where budget or capital may be optional (zero/not set).
 */

/**
 * Get budget status with optional awareness
 * @param {number} budget - Budget amount (can be 0, null, or undefined for optional)
 * @param {number} actual - Actual spending amount
 * @param {number} [committed] - Optional: Committed costs
 * @param {number} [estimated] - Optional: Estimated costs
 * @returns {Object} Status object with status, label, message, and metrics
 */
export function getBudgetStatus(budget, actual, committed = 0, estimated = 0) {
  // Handle optional budget (zero, null, or undefined)
  if (budget === 0 || budget === null || budget === undefined || isNaN(budget)) {
    return {
      status: 'not_set',
      label: 'Budget Not Set',
      message: 'No budget allocated. Spending is being tracked. Set a budget to enable budget validation.',
      isOptional: true,
      utilization: null, // Don't calculate percentage when budget is 0
      variance: null,
      committedUtilization: null,
      estimatedUtilization: null,
      remaining: null,
      actual,
      committed,
      estimated,
      budget: 0,
    };
  }

  // Ensure budget is a valid positive number
  const budgetAmount = Math.max(0, Number(budget));
  const actualAmount = Math.max(0, Number(actual) || 0);
  const committedAmount = Math.max(0, Number(committed) || 0);
  const estimatedAmount = Math.max(0, Number(estimated) || 0);

  // Calculate utilization (actual vs budget)
  const utilization = (actualAmount / budgetAmount) * 100;
  const variance = budgetAmount - actualAmount;
  const remaining = budgetAmount - actualAmount - committedAmount;

  // Calculate committed and estimated utilization
  const committedUtilization = (committedAmount / budgetAmount) * 100;
  const estimatedUtilization = (estimatedAmount / budgetAmount) * 100;

  // Determine status based on utilization
  if (utilization > 100) {
    return {
      status: 'over_budget',
      label: 'Over Budget',
      message: `Exceeded budget by ${Math.abs(variance).toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 })}`,
      isOptional: false,
      utilization,
      variance,
      committedUtilization,
      estimatedUtilization,
      remaining: Math.min(0, remaining), // Negative if over budget
      actual: actualAmount,
      committed: committedAmount,
      estimated: estimatedAmount,
      budget: budgetAmount,
    };
  }

  if (utilization > 80 || committedUtilization > 100) {
    return {
      status: 'at_risk',
      label: 'At Risk',
      message: `Approaching budget limit (${utilization.toFixed(1)}% used${committedUtilization > 100 ? `, ${committedUtilization.toFixed(1)}% committed` : ''})`,
      isOptional: false,
      utilization,
      variance,
      committedUtilization,
      estimatedUtilization,
      remaining,
      actual: actualAmount,
      committed: committedAmount,
      estimated: estimatedAmount,
      budget: budgetAmount,
    };
  }

  return {
    status: 'on_budget',
    label: 'On Budget',
    message: `Within budget (${utilization.toFixed(1)}% used)`,
    isOptional: false,
    utilization,
    variance,
    committedUtilization,
    estimatedUtilization,
    remaining,
    actual: actualAmount,
    committed: committedAmount,
    estimated: estimatedAmount,
    budget: budgetAmount,
  };
}

/**
 * Get capital status with optional awareness
 * @param {number} totalInvested - Total capital invested (can be 0, null, or undefined for optional)
 * @param {number} totalUsed - Total capital used
 * @param {number} availableCapital - Available capital (including committed costs)
 * @param {number} [committedCost] - Optional: Committed costs
 * @returns {Object} Status object with status, label, message, and metrics
 */
export function getCapitalStatus(totalInvested, totalUsed, availableCapital, committedCost = 0) {
  // Handle optional capital (zero, null, or undefined)
  if (totalInvested === 0 || totalInvested === null || totalInvested === undefined || isNaN(totalInvested)) {
    return {
      status: 'not_set',
      label: 'Capital Not Set',
      message: 'No capital invested. Spending is being tracked. Add capital to enable capital validation.',
      isOptional: true,
      utilization: null, // Don't calculate percentage when capital is 0
      available: availableCapital || 0,
      totalInvested: 0,
      totalUsed: Math.max(0, Number(totalUsed) || 0),
      committedCost: Math.max(0, Number(committedCost) || 0),
      remaining: null,
    };
  }

  // Ensure values are valid numbers
  const invested = Math.max(0, Number(totalInvested));
  const used = Math.max(0, Number(totalUsed) || 0);
  const available = Number(availableCapital) || 0;
  const committed = Math.max(0, Number(committedCost) || 0);

  // Calculate utilization
  const utilization = (used / invested) * 100;

  // Determine status based on available capital and utilization
  if (available < 0) {
    return {
      status: 'overspent',
      label: 'Overspent',
      message: `Overspent by ${Math.abs(available).toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 })}`,
      isOptional: false,
      utilization,
      available,
      totalInvested: invested,
      totalUsed: used,
      committedCost: committed,
      remaining: available,
    };
  }

  if (utilization > 80 || available < invested * 0.1) {
    return {
      status: 'low',
      label: 'Low Capital',
      message: `High utilization (${utilization.toFixed(1)}% used, ${((available / invested) * 100).toFixed(1)}% remaining)`,
      isOptional: false,
      utilization,
      available,
      totalInvested: invested,
      totalUsed: used,
      committedCost: committed,
      remaining: available,
    };
  }

  return {
    status: 'sufficient',
    label: 'Sufficient',
    message: `Capital available (${utilization.toFixed(1)}% used, ${((available / invested) * 100).toFixed(1)}% remaining)`,
    isOptional: false,
    utilization,
    available,
    totalInvested: invested,
    totalUsed: used,
    committedCost: committed,
    remaining: available,
  };
}

/**
 * Calculate safe percentage (handles zero denominator)
 * @param {number} numerator - Numerator value
 * @param {number} denominator - Denominator value
 * @returns {number|null} Percentage (0-100) or null if denominator is 0/invalid
 */
export function safePercentage(numerator, denominator) {
  const num = Number(numerator) || 0;
  const den = Number(denominator) || 0;

  if (den === 0 || isNaN(den) || isNaN(num)) {
    return null;
  }

  return Math.max(0, Math.min(100, (num / den) * 100));
}

/**
 * Format percentage with optional awareness
 * @param {number|null|undefined} percentage - Percentage value or null/undefined
 * @param {string} [fallback='N/A'] - Fallback text when percentage is null
 * @param {number} [decimals=1] - Number of decimal places
 * @returns {string} Formatted percentage or fallback
 */
export function formatPercentage(percentage, fallback = 'N/A', decimals = 1) {
  if (percentage === null || percentage === undefined || isNaN(percentage)) {
    return fallback;
  }

  return `${Number(percentage).toFixed(decimals)}%`;
}

/**
 * Get variance with optional awareness
 * @param {number} budget - Budget amount (can be 0 for optional)
 * @param {number} actual - Actual spending amount
 * @param {number} [committed] - Optional: Committed costs
 * @param {number} [estimated] - Optional: Estimated costs
 * @returns {Object} Variance object with amount, percentage, and message
 */
export function getVariance(budget, actual, committed = 0, estimated = 0) {
  // Handle optional budget
  if (budget === 0 || budget === null || budget === undefined || isNaN(budget)) {
    return {
      amount: null,
      percentage: null,
      committedAmount: null,
      committedPercentage: null, // Explicitly set to null (not undefined)
      estimatedAmount: null,
      estimatedPercentage: null, // Explicitly set to null (not undefined)
      isOptional: true,
      message: 'Budget not set - variance cannot be calculated',
      actual,
      committed,
      estimated,
      budget: 0,
    };
  }

  const budgetAmount = Math.max(0, Number(budget));
  const actualAmount = Math.max(0, Number(actual) || 0);
  const committedAmount = Math.max(0, Number(committed) || 0);
  const estimatedAmount = Math.max(0, Number(estimated) || 0);

  const amount = budgetAmount - actualAmount;
  const percentage = safePercentage(amount, budgetAmount);

  const committedVariance = budgetAmount - committedAmount;
  const committedPercentage = safePercentage(committedVariance, budgetAmount);

  const estimatedVariance = budgetAmount - estimatedAmount;
  const estimatedPercentage = safePercentage(estimatedVariance, budgetAmount);

  return {
    amount,
    percentage,
    committedAmount: committedVariance,
    committedPercentage,
    estimatedAmount: estimatedVariance,
    estimatedPercentage,
    isOptional: false,
    message: amount >= 0 ? 'Under budget' : 'Over budget',
    actual: actualAmount,
    committed: committedAmount,
    estimated: estimatedAmount,
    budget: budgetAmount,
  };
}

/**
 * Get phase budget status (for phase-level budgets)
 * @param {Object} phase - Phase object with budgetAllocation
 * @param {Object} actualSpending - Actual spending object
 * @param {Object} [financialStates] - Optional: Financial states (committed, estimated)
 * @returns {Object} Status object for phase budget
 */
export function getPhaseBudgetStatus(phase, actualSpending, financialStates = {}) {
  const phaseBudget = phase?.budgetAllocation?.total || 0;
  const phaseActual = actualSpending?.total || 0;
  const phaseCommitted = financialStates?.committed || 0;
  const phaseEstimated = financialStates?.estimated || 0;

  return getBudgetStatus(phaseBudget, phaseActual, phaseCommitted, phaseEstimated);
}

/**
 * Get category budget status (for material/labour categories within a phase)
 * @param {number} categoryBudget - Budget for this category
 * @param {number} categoryActual - Actual spending for this category
 * @returns {Object} Status object for category budget
 */
export function getCategoryBudgetStatus(categoryBudget, categoryActual) {
  return getBudgetStatus(categoryBudget, categoryActual);
}

/**
 * Format currency with fallback for zero/null values
 * @param {number|null|undefined} amount - Amount to format
 * @param {string} [locale='en-KE'] - Locale for formatting
 * @param {string} [currency='KES'] - Currency code
 * @param {string} [zeroLabel='0'] - Label to show when amount is 0
 * @returns {string} Formatted currency string
 */
export function formatCurrencySafe(amount, locale = 'en-KE', currency = 'KES', zeroLabel = '0') {
  const numAmount = Number(amount) || 0;

  if (numAmount === 0) {
    return zeroLabel;
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numAmount);
}

/**
 * Get optional state summary
 * @param {Object} project - Project object with budget
 * @param {Object} finances - Project finances object
 * @returns {Object} Optional state information with guidance
 */
export function getOptionalState(project, finances) {
  const budget = project?.budget || {};
  const budgetTotal = budget?.total || 0;
  const totalInvested = finances?.totalInvested || 0;

  const budgetNotSet = budgetTotal === 0 || budgetTotal === null || budgetTotal === undefined;
  const capitalNotSet = totalInvested === 0 || totalInvested === null || totalInvested === undefined;

  const guidance = [];

  if (budgetNotSet) {
    guidance.push({
      type: 'budget',
      message: 'Budget not set. Set a budget to enable budget validation and better financial control.',
      actionUrl: `/projects/${project?._id || project?.id}/finances`,
      actionLabel: 'Set Budget',
      priority: 'medium',
    });
  }

  if (capitalNotSet) {
    guidance.push({
      type: 'capital',
      message: 'No capital invested. Add capital to enable capital validation and track available funds.',
      actionUrl: '/financing',
      actionLabel: 'Add Capital',
      priority: 'high',
    });
  }

  if (!budgetNotSet && !capitalNotSet) {
    guidance.push({
      type: 'info',
      message: 'Budget and capital are set. Full financial validation is active.',
      priority: 'low',
    });
  }

  return {
    budgetNotSet,
    capitalNotSet,
    spendingTracked: true, // Always true - spending is always tracked
    guidance,
    hasOptionalState: budgetNotSet || capitalNotSet,
  };
}
