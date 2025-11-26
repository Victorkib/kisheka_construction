/**
 * Calculation Helper Functions
 * Utility functions for calculating quantities, costs, wastage, etc.
 */

/**
 * Calculates total cost from quantity and unit cost
 * @param {number} quantity - Quantity purchased
 * @param {number} unitCost - Cost per unit
 * @returns {number} Total cost
 */
export function calculateTotalCost(quantity, unitCost) {
  if (!quantity || !unitCost || quantity < 0 || unitCost < 0) {
    return 0;
  }
  return parseFloat((quantity * unitCost).toFixed(2));
}

/**
 * Calculates remaining quantity
 * @param {number} quantityPurchased - Total quantity purchased
 * @param {number} quantityDelivered - Quantity delivered
 * @param {number} quantityUsed - Quantity used
 * @returns {number} Remaining quantity
 * 
 * Logic:
 * - If not delivered yet: remaining = purchased (pending delivery)
 * - If delivered: remaining = delivered - used
 * - If used exceeds delivered: remaining = 0 (with wastage)
 */
export function calculateRemainingQuantity(quantityPurchased, quantityDelivered, quantityUsed) {
  const purchased = parseFloat(quantityPurchased) || 0;
  const delivered = parseFloat(quantityDelivered) || 0;
  const used = parseFloat(quantityUsed) || 0;
  
  // If not delivered yet, remaining = purchased (pending delivery)
  if (delivered === 0) {
    return purchased;
  }
  
  // If delivered, remaining = delivered - used
  return Math.max(0, delivered - used);
}

/**
 * Calculates quantity status with detailed information
 * @param {number} quantityPurchased - Total quantity purchased
 * @param {number} quantityDelivered - Quantity delivered
 * @param {number} quantityUsed - Quantity used
 * @returns {Object} Quantity status object with status, remaining, pendingDelivery, inStock, used
 */
export function calculateQuantityStatus(quantityPurchased, quantityDelivered, quantityUsed) {
  const purchased = parseFloat(quantityPurchased) || 0;
  const delivered = parseFloat(quantityDelivered) || 0;
  const used = parseFloat(quantityUsed) || 0;
  
  if (delivered === 0) {
    return {
      status: 'pending_delivery',
      remaining: purchased,
      pendingDelivery: purchased,
      inStock: 0,
      used: 0,
    };
  }
  
  const remaining = Math.max(0, delivered - used);
  const pendingDelivery = Math.max(0, purchased - delivered);
  
  return {
    status: remaining > 0 ? 'in_stock' : 'depleted',
    remaining,
    pendingDelivery,
    inStock: remaining,
    used,
  };
}

/**
 * Calculates wastage percentage
 * @param {number} quantityPurchased - Total quantity purchased
 * @param {number} quantityDelivered - Quantity delivered
 * @param {number} quantityUsed - Quantity used
 * @returns {number} Wastage percentage (0-100)
 */
export function calculateWastage(quantityPurchased, quantityDelivered, quantityUsed) {
  const purchased = parseFloat(quantityPurchased) || 0;
  const delivered = parseFloat(quantityDelivered) || 0;
  const used = parseFloat(quantityUsed) || 0;
  
  if (purchased === 0 || delivered === 0) {
    return 0;
  }
  
  // Wastage = (Purchased - Used) / Purchased * 100
  const wastage = ((purchased - used) / purchased) * 100;
  return Math.max(0, Math.min(100, parseFloat(wastage.toFixed(2))));
}

/**
 * Calculates wastage amount (absolute value)
 * @param {number} quantityPurchased - Total quantity purchased
 * @param {number} quantityUsed - Quantity used
 * @returns {number} Wastage amount
 */
export function calculateWastageAmount(quantityPurchased, quantityUsed) {
  const purchased = parseFloat(quantityPurchased) || 0;
  const used = parseFloat(quantityUsed) || 0;
  
  return Math.max(0, purchased - used);
}

/**
 * Formats currency amount
 * @param {number} amount - Amount to format
 * @param {string} [currency='KES'] - Currency code
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currency = 'KES') {
  const numAmount = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
}

/**
 * Formats number with thousand separators
 * @param {number} number - Number to format
 * @param {number} [decimals=2] - Number of decimal places
 * @returns {string} Formatted number string
 */
export function formatNumber(number, decimals = 2) {
  const num = parseFloat(number) || 0;
  return new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Validates that a number is positive
 * @param {number} value - Value to validate
 * @returns {boolean} True if positive
 */
export function isPositiveNumber(value) {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
}

/**
 * Validates that a number is non-negative
 * @param {number} value - Value to validate
 * @returns {boolean} True if non-negative
 */
export function isNonNegativeNumber(value) {
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0;
}

/**
 * Calculates variance (difference between purchased and delivered)
 * Variance indicates materials purchased but not delivered (potential theft or supplier issue)
 * @param {number} quantityPurchased - Total quantity purchased
 * @param {number} quantityDelivered - Quantity actually delivered
 * @returns {number} Variance amount (purchased - delivered)
 */
export function calculateVariance(quantityPurchased, quantityDelivered) {
  const purchased = parseFloat(quantityPurchased) || 0;
  const delivered = parseFloat(quantityDelivered) || 0;
  
  return Math.max(0, purchased - delivered);
}

/**
 * Calculates variance percentage
 * @param {number} quantityPurchased - Total quantity purchased
 * @param {number} quantityDelivered - Quantity actually delivered
 * @returns {number} Variance percentage (0-100)
 */
export function calculateVariancePercentage(quantityPurchased, quantityDelivered) {
  const purchased = parseFloat(quantityPurchased) || 0;
  const delivered = parseFloat(quantityDelivered) || 0;
  
  if (purchased === 0) {
    return 0;
  }
  
  const variance = ((purchased - delivered) / purchased) * 100;
  return Math.max(0, Math.min(100, parseFloat(variance.toFixed(2))));
}

/**
 * Calculates loss (difference between delivered and used)
 * Loss indicates materials delivered but not used (wastage, theft, or damage)
 * @param {number} quantityDelivered - Quantity delivered
 * @param {number} quantityUsed - Quantity actually used
 * @returns {number} Loss amount (delivered - used)
 */
export function calculateLoss(quantityDelivered, quantityUsed) {
  const delivered = parseFloat(quantityDelivered) || 0;
  const used = parseFloat(quantityUsed) || 0;
  
  return Math.max(0, delivered - used);
}

/**
 * Calculates loss percentage
 * @param {number} quantityDelivered - Quantity delivered
 * @param {number} quantityUsed - Quantity actually used
 * @returns {number} Loss percentage (0-100)
 */
export function calculateLossPercentage(quantityDelivered, quantityUsed) {
  const delivered = parseFloat(quantityDelivered) || 0;
  const used = parseFloat(quantityUsed) || 0;
  
  if (delivered === 0) {
    return 0;
  }
  
  const loss = ((delivered - used) / delivered) * 100;
  return Math.max(0, Math.min(100, parseFloat(loss.toFixed(2))));
}

/**
 * Calculates total discrepancy (variance + loss)
 * This represents total materials that are unaccounted for
 * @param {number} quantityPurchased - Total quantity purchased
 * @param {number} quantityDelivered - Quantity delivered
 * @param {number} quantityUsed - Quantity used
 * @returns {number} Total discrepancy amount
 */
export function calculateTotalDiscrepancy(quantityPurchased, quantityDelivered, quantityUsed) {
  const variance = calculateVariance(quantityPurchased, quantityDelivered);
  const loss = calculateLoss(quantityDelivered, quantityUsed);
  
  return variance + loss;
}

/**
 * Calculates total discrepancy percentage
 * @param {number} quantityPurchased - Total quantity purchased
 * @param {number} quantityDelivered - Quantity delivered
 * @param {number} quantityUsed - Quantity used
 * @returns {number} Total discrepancy percentage (0-100)
 */
export function calculateTotalDiscrepancyPercentage(quantityPurchased, quantityDelivered, quantityUsed) {
  const purchased = parseFloat(quantityPurchased) || 0;
  
  if (purchased === 0) {
    return 0;
  }
  
  const totalDiscrepancy = calculateTotalDiscrepancy(quantityPurchased, quantityDelivered, quantityUsed);
  const percentage = (totalDiscrepancy / purchased) * 100;
  
  return Math.max(0, Math.min(100, parseFloat(percentage.toFixed(2))));
}

/**
 * Calculates variance cost (financial impact of variance)
 * @param {number} quantityPurchased - Total quantity purchased
 * @param {number} quantityDelivered - Quantity delivered
 * @param {number} unitCost - Cost per unit
 * @returns {number} Variance cost in currency
 */
export function calculateVarianceCost(quantityPurchased, quantityDelivered, unitCost) {
  const variance = calculateVariance(quantityPurchased, quantityDelivered);
  const cost = parseFloat(unitCost) || 0;
  
  return parseFloat((variance * cost).toFixed(2));
}

/**
 * Calculates loss cost (financial impact of loss)
 * @param {number} quantityDelivered - Quantity delivered
 * @param {number} quantityUsed - Quantity used
 * @param {number} unitCost - Cost per unit
 * @returns {number} Loss cost in currency
 */
export function calculateLossCost(quantityDelivered, quantityUsed, unitCost) {
  const loss = calculateLoss(quantityDelivered, quantityUsed);
  const cost = parseFloat(unitCost) || 0;
  
  return parseFloat((loss * cost).toFixed(2));
}

/**
 * Calculates total discrepancy cost (financial impact of all discrepancies)
 * @param {number} quantityPurchased - Total quantity purchased
 * @param {number} quantityDelivered - Quantity delivered
 * @param {number} quantityUsed - Quantity used
 * @param {number} unitCost - Cost per unit
 * @returns {number} Total discrepancy cost in currency
 */
export function calculateTotalDiscrepancyCost(quantityPurchased, quantityDelivered, quantityUsed, unitCost) {
  const varianceCost = calculateVarianceCost(quantityPurchased, quantityDelivered, unitCost);
  const lossCost = calculateLossCost(quantityDelivered, quantityUsed, unitCost);
  
  return parseFloat((varianceCost + lossCost).toFixed(2));
}

/**
 * Determines if variance exceeds threshold (potential theft or supplier issue)
 * @param {number} quantityPurchased - Total quantity purchased
 * @param {number} quantityDelivered - Quantity delivered
 * @param {number} thresholdPercentage - Threshold percentage (default: 5%)
 * @param {number} thresholdAmount - Threshold absolute amount (default: 0, disabled)
 * @returns {boolean} True if variance exceeds threshold
 */
export function isVarianceExcessive(quantityPurchased, quantityDelivered, thresholdPercentage = 5, thresholdAmount = 0) {
  const variance = calculateVariance(quantityPurchased, quantityDelivered);
  const variancePercentage = calculateVariancePercentage(quantityPurchased, quantityDelivered);
  
  // Check percentage threshold
  if (variancePercentage > thresholdPercentage) {
    return true;
  }
  
  // Check absolute amount threshold
  if (thresholdAmount > 0 && variance > thresholdAmount) {
    return true;
  }
  
  return false;
}

/**
 * Determines if loss exceeds threshold (potential wastage or theft)
 * @param {number} quantityDelivered - Quantity delivered
 * @param {number} quantityUsed - Quantity used
 * @param {number} thresholdPercentage - Threshold percentage (default: 10%)
 * @param {number} thresholdAmount - Threshold absolute amount (default: 0, disabled)
 * @returns {boolean} True if loss exceeds threshold
 */
export function isLossExcessive(quantityDelivered, quantityUsed, thresholdPercentage = 10, thresholdAmount = 0) {
  const loss = calculateLoss(quantityDelivered, quantityUsed);
  const lossPercentage = calculateLossPercentage(quantityDelivered, quantityUsed);
  
  // Check percentage threshold
  if (lossPercentage > thresholdPercentage) {
    return true;
  }
  
  // Check absolute amount threshold
  if (thresholdAmount > 0 && loss > thresholdAmount) {
    return true;
  }
  
  return false;
}

/**
 * Determines if wastage exceeds threshold
 * @param {number} quantityPurchased - Total quantity purchased
 * @param {number} quantityDelivered - Quantity delivered
 * @param {number} quantityUsed - Quantity used
 * @param {number} thresholdPercentage - Threshold percentage (default: 15%)
 * @returns {boolean} True if wastage exceeds threshold
 */
export function isWastageExcessive(quantityPurchased, quantityDelivered, quantityUsed, thresholdPercentage = 15) {
  const wastage = calculateWastage(quantityPurchased, quantityDelivered, quantityUsed);
  
  return wastage > thresholdPercentage;
}

