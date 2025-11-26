/**
 * Client-Safe Discrepancy Calculations
 * Pure JavaScript functions for calculating discrepancy metrics on the client side
 * 
 * This module provides client-safe versions of discrepancy calculations
 * that can be used in React components without server-side dependencies.
 */

import {
  calculateVariance,
  calculateVariancePercentage,
  calculateLoss,
  calculateLossPercentage,
  calculateWastage,
  isVarianceExcessive,
  isLossExcessive,
  isWastageExcessive,
  calculateVarianceCost,
  calculateLossCost,
  calculateTotalDiscrepancyCost,
} from './calculations';

/**
 * Default thresholds for discrepancy detection
 */
export const DEFAULT_THRESHOLDS = {
  variancePercentage: 5, // Alert if variance > 5%
  varianceAmount: 100, // Alert if variance > 100 units
  lossPercentage: 10, // Alert if loss > 10%
  lossAmount: 50, // Alert if loss > 50 units
  wastagePercentage: 15, // Alert if wastage > 15%
};

/**
 * Determines severity level of discrepancies
 * @param {boolean} hasVariance - Whether variance exceeds threshold
 * @param {boolean} hasLoss - Whether loss exceeds threshold
 * @param {boolean} hasWastage - Whether wastage exceeds threshold
 * @param {number} totalCost - Total discrepancy cost
 * @returns {string} Severity level (CRITICAL, HIGH, MEDIUM, LOW, NONE)
 */
function getSeverityLevel(hasVariance, hasLoss, hasWastage, totalCost) {
  if (!hasVariance && !hasLoss && !hasWastage) {
    return 'NONE';
  }

  // Critical: Multiple issues AND high cost (> 100,000 KES)
  if ((hasVariance && hasLoss) || (hasVariance && hasWastage) || (hasLoss && hasWastage)) {
    if (totalCost > 100000) return 'CRITICAL';
    return 'HIGH';
  }

  // High: Single issue with high cost (> 50,000 KES)
  if (totalCost > 50000) return 'HIGH';

  // Medium: Single issue with moderate cost (10,000 - 50,000 KES)
  if (totalCost > 10000) return 'MEDIUM';

  // Low: Single issue with low cost (< 10,000 KES)
  return 'LOW';
}

/**
 * Checks a single material for discrepancies (Client-Safe)
 * @param {Object} material - Material document
 * @param {Object} [thresholds] - Custom thresholds (optional)
 * @returns {Object} Discrepancy analysis result
 */
export function checkMaterialDiscrepanciesClient(material, thresholds = {}) {
  const thresh = { ...DEFAULT_THRESHOLDS, ...thresholds };
  
  const quantityPurchased = parseFloat(material.quantityPurchased || material.quantity || 0);
  const quantityDelivered = parseFloat(material.quantityDelivered || 0);
  const quantityUsed = parseFloat(material.quantityUsed || 0);
  const unitCost = parseFloat(material.unitCost || 0);
  
  // Calculate metrics
  const variance = calculateVariance(quantityPurchased, quantityDelivered);
  const variancePercentage = calculateVariancePercentage(quantityPurchased, quantityDelivered);
  const varianceCost = calculateVarianceCost(quantityPurchased, quantityDelivered, unitCost);
  
  const loss = calculateLoss(quantityDelivered, quantityUsed);
  const lossPercentage = calculateLossPercentage(quantityDelivered, quantityUsed);
  const lossCost = calculateLossCost(quantityDelivered, quantityUsed, unitCost);
  
  const wastage = calculateWastage(quantityPurchased, quantityDelivered, quantityUsed);
  const totalDiscrepancyCost = calculateTotalDiscrepancyCost(
    quantityPurchased,
    quantityDelivered,
    quantityUsed,
    unitCost
  );
  
  // Check if discrepancies exceed thresholds
  const hasVarianceIssue = isVarianceExcessive(
    quantityPurchased,
    quantityDelivered,
    thresh.variancePercentage,
    thresh.varianceAmount
  );
  
  const hasLossIssue = isLossExcessive(
    quantityDelivered,
    quantityUsed,
    thresh.lossPercentage,
    thresh.lossAmount
  );
  
  const hasWastageIssue = isWastageExcessive(
    quantityPurchased,
    quantityDelivered,
    quantityUsed,
    thresh.wastagePercentage
  );
  
  return {
    materialId: material._id?.toString() || material.id,
    materialName: material.name || material.materialName,
    projectId: material.projectId?.toString(),
    supplierName: material.supplierName || material.supplier,
    metrics: {
      variance,
      variancePercentage,
      varianceCost,
      loss,
      lossPercentage,
      lossCost,
      wastage,
      totalDiscrepancyCost,
    },
    alerts: {
      variance: hasVarianceIssue,
      loss: hasLossIssue,
      wastage: hasWastageIssue,
      hasAnyAlert: hasVarianceIssue || hasLossIssue || hasWastageIssue,
    },
    severity: getSeverityLevel(hasVarianceIssue, hasLossIssue, hasWastageIssue, totalDiscrepancyCost),
  };
}

