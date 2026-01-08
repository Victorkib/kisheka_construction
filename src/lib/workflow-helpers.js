/**
 * Workflow Helpers
 * 
 * Helper functions for post-rejection and post-modification workflows
 * Provides intelligent suggestions and automation logic
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { assessRetryability } from './rejection-reasons';

/**
 * Get suggested actions after a purchase order rejection
 * @param {Object} order - Purchase order object
 * @returns {Object} Suggested actions with priorities
 */
export async function getPostRejectionActions(order) {
  const actions = {
    retry: null,
    findAlternatives: false,
    escalate: false,
    cancel: false,
    suggestions: []
  };

  if (!order || order.status !== 'order_rejected') {
    return actions;
  }

  // Check retryability
  if (order.isRetryable && (order.retryCount || 0) < 3) {
    actions.retry = {
      recommended: true,
      reason: order.retryRecommendation || 'Order is retryable',
      adjustments: suggestRetryAdjustments(order),
      priority: 'high'
    };
    actions.suggestions.push({
      type: 'retry',
      message: `Retry with same supplier: ${order.retryRecommendation}`,
      priority: 'high'
    });
  }

  // Always suggest finding alternatives
  actions.findAlternatives = true;
  actions.suggestions.push({
    type: 'alternatives',
    message: 'Find alternative suppliers for this material',
    priority: order.isRetryable ? 'medium' : 'high'
  });

  // Check if escalation is needed
  if (shouldAutoEscalate(order)) {
    actions.escalate = true;
    actions.suggestions.push({
      type: 'escalate',
      message: 'Multiple rejections detected. Consider escalating to management.',
      priority: 'high'
    });
  }

  // Suggest cancellation if not retryable and no alternatives
  if (!order.isRetryable && (order.retryCount || 0) >= 3) {
    actions.cancel = true;
    actions.suggestions.push({
      type: 'cancel',
      message: 'Maximum retries reached. Consider cancelling and creating new order.',
      priority: 'low'
    });
  }

  return actions;
}

/**
 * Suggest retry adjustments based on rejection reason
 * @param {Object} order - Purchase order object
 * @returns {Object} Suggested adjustments
 */
export function suggestRetryAdjustments(order) {
  const adjustments = {};
  const rejectionReason = order.rejectionReason;
  const rejectionSubcategory = order.rejectionSubcategory;

  if (!rejectionReason) {
    return adjustments;
  }

  switch (rejectionReason) {
    case 'price_too_high':
      // Suggest price negotiation (reduce by 5-10%)
      if (order.unitCost) {
        const suggestedReduction = order.unitCost * 0.05; // 5% reduction
        adjustments.unitCost = order.unitCost - suggestedReduction;
        adjustments.notes = 'Price reduced by 5% for negotiation';
      }
      break;

    case 'timeline':
      // Suggest extending delivery date
      if (order.deliveryDate) {
        const currentDate = new Date(order.deliveryDate);
        const extendedDate = new Date(currentDate);
        extendedDate.setDate(extendedDate.getDate() + 7); // Add 7 days
        adjustments.deliveryDate = extendedDate.toISOString().split('T')[0];
        adjustments.notes = 'Delivery date extended by 7 days';
      }
      break;

    case 'quantity':
      // Suggest adjusting quantity based on subcategory
      if (rejectionSubcategory === 'below_minimum_order_quantity') {
        // Increase quantity to meet minimum
        adjustments.quantityOrdered = order.quantityOrdered * 1.5;
        adjustments.notes = 'Quantity increased to meet minimum order requirement';
      } else if (rejectionSubcategory === 'exceeds_production_capacity') {
        // Decrease quantity
        adjustments.quantityOrdered = Math.floor(order.quantityOrdered * 0.7);
        adjustments.notes = 'Quantity reduced to match supplier capacity';
      }
      break;

    case 'specifications':
      // Suggest reviewing specifications
      adjustments.notes = 'Review material specifications with supplier before retry';
      break;

    default:
      // Generic suggestion
      adjustments.notes = 'Contact supplier to discuss specific requirements before retry';
  }

  return adjustments;
}

/**
 * Determine if order should be escalated
 * @param {Object} order - Purchase order object
 * @returns {boolean} Whether to escalate
 */
export function shouldAutoEscalate(order) {
  // Escalate if:
  // 1. Multiple retries (>= 2)
  // 2. High-value order (> 100,000)
  // 3. Critical rejection reason
  const retryCount = order.retryCount || 0;
  const isHighValue = order.totalCost && order.totalCost > 100000;
  const isCriticalReason = ['unavailable', 'business_policy'].includes(order.rejectionReason);

  return retryCount >= 2 || isHighValue || isCriticalReason;
}

/**
 * Get workflow suggestions for a modified order
 * @param {Object} order - Purchase order object
 * @returns {Object} Workflow suggestions
 */
export async function getModificationWorkflowSuggestions(order) {
  const suggestions = {
    shouldApprove: false,
    shouldReject: false,
    shouldNegotiate: false,
    impact: null,
    recommendations: []
  };

  if (!order || order.status !== 'order_modified' || !order.supplierModifications) {
    return suggestions;
  }

  const modifications = order.supplierModifications;
  const originalCost = order.totalCost || (order.unitCost * order.quantityOrdered);
  
  // Calculate new cost
  const newQuantity = modifications.quantityOrdered || order.quantityOrdered;
  const newUnitCost = modifications.unitCost !== undefined ? modifications.unitCost : order.unitCost;
  const newCost = newQuantity * newUnitCost;
  
  const costDifference = newCost - originalCost;
  const costChangePercent = originalCost > 0 ? (costDifference / originalCost) * 100 : 0;

  // Assess impact
  suggestions.impact = {
    costChange: costDifference,
    costChangePercent: costChangePercent,
    quantityChange: newQuantity - order.quantityOrdered,
    unitCostChange: newUnitCost - order.unitCost
  };

  // Auto-approve if:
  // - Cost reduction or minimal increase (< 5%)
  // - Reasonable quantity adjustments
  // - Delivery date extension (not reduction)
  if (costChangePercent <= 5 && costChangePercent >= -10) {
    if (modifications.deliveryDate) {
      const newDate = new Date(modifications.deliveryDate);
      const originalDate = new Date(order.deliveryDate);
      if (newDate >= originalDate) {
        suggestions.shouldApprove = true;
        suggestions.recommendations.push({
          type: 'approve',
          message: 'Modifications are reasonable. Cost change is acceptable and delivery date is extended.',
          priority: 'high'
        });
      }
    } else if (costChangePercent <= 0) {
      suggestions.shouldApprove = true;
      suggestions.recommendations.push({
        type: 'approve',
        message: 'Modifications result in cost reduction. Recommend approval.',
        priority: 'high'
      });
    }
  }

  // Auto-reject if:
  // - Significant cost increase (> 20%)
  // - Delivery date moved earlier (may not be feasible)
  // - Quantity reduced significantly (> 30%)
  if (costChangePercent > 20) {
    suggestions.shouldReject = true;
    suggestions.recommendations.push({
      type: 'reject',
      message: `Significant cost increase (${costChangePercent.toFixed(1)}%). Consider rejecting or negotiating.`,
      priority: 'high'
    });
  }

  if (modifications.quantityOrdered && 
      ((modifications.quantityOrdered - order.quantityOrdered) / order.quantityOrdered) < -0.3) {
    suggestions.shouldReject = true;
    suggestions.recommendations.push({
      type: 'reject',
      message: 'Significant quantity reduction. May not meet project requirements.',
      priority: 'medium'
    });
  }

  if (modifications.deliveryDate) {
    const newDate = new Date(modifications.deliveryDate);
    const originalDate = new Date(order.deliveryDate);
    if (newDate < originalDate) {
      suggestions.shouldReject = true;
      suggestions.recommendations.push({
        type: 'reject',
        message: 'Delivery date moved earlier. Verify feasibility before approving.',
        priority: 'medium'
      });
    }
  }

  // Suggest negotiation if:
  // - Moderate cost increase (5-20%)
  // - Mixed changes
  if (costChangePercent > 5 && costChangePercent <= 20 && !suggestions.shouldReject) {
    suggestions.shouldNegotiate = true;
    suggestions.recommendations.push({
      type: 'negotiate',
      message: 'Moderate cost increase. Consider negotiating with supplier before approving.',
      priority: 'medium'
    });
  }

  return suggestions;
}

/**
 * Check if order needs immediate attention
 * @param {Object} order - Purchase order object
 * @returns {Object} Attention flags and urgency
 */
export function needsImmediateAttention(order) {
  const flags = {
    urgent: false,
    reasons: [],
    priority: 'normal'
  };

  if (!order) {
    return flags;
  }

  // Urgent if rejected and retryable
  if (order.status === 'order_rejected' && order.isRetryable) {
    flags.urgent = true;
    flags.reasons.push('Rejected order is retryable - action needed');
    flags.priority = 'high';
  }

  // Urgent if modified and awaiting approval
  if (order.status === 'order_modified' && order.modificationApproved === undefined) {
    flags.urgent = true;
    flags.reasons.push('Modification request awaiting approval');
    flags.priority = 'high';
  }

  // Urgent if multiple retries
  if ((order.retryCount || 0) >= 2) {
    flags.urgent = true;
    flags.reasons.push('Multiple retry attempts - escalation may be needed');
    flags.priority = 'high';
  }

  // High value orders need attention
  if (order.totalCost && order.totalCost > 500000) {
    flags.urgent = true;
    flags.reasons.push('High-value order requires attention');
    flags.priority = order.priority || 'high';
  }

  return flags;
}

/**
 * Get next steps for an order based on current status
 * @param {Object} order - Purchase order object
 * @returns {Array} Array of next step actions
 */
export async function getNextSteps(order) {
  const steps = [];

  if (!order) {
    return steps;
  }

  switch (order.status) {
    case 'order_rejected':
      if (order.isRetryable && (order.retryCount || 0) < 3) {
        steps.push({
          action: 'retry',
          label: 'Retry with Same Supplier',
          description: order.retryRecommendation || 'Retry with adjustments',
          priority: 'high'
        });
      }
      steps.push({
        action: 'find_alternatives',
        label: 'Find Alternative Suppliers',
        description: 'Search for other suppliers who can fulfill this order',
        priority: order.isRetryable ? 'medium' : 'high'
      });
      steps.push({
        action: 'create_new_order',
        label: 'Create New Order',
        description: 'Create a new purchase order with different parameters',
        priority: 'low'
      });
      break;

    case 'order_modified':
      steps.push({
        action: 'review_modifications',
        label: 'Review Modifications',
        description: 'Review supplier-proposed changes and approve or reject',
        priority: 'high'
      });
      if (order.modificationApproved === true) {
        steps.push({
          action: 'resend_order',
          label: 'Resend Order',
          description: 'Resend order to supplier with approved modifications',
          priority: 'medium'
        });
      }
      break;

    case 'order_sent':
      steps.push({
        action: 'wait_for_response',
        label: 'Awaiting Supplier Response',
        description: 'Waiting for supplier to accept, reject, or propose modifications',
        priority: 'normal'
      });
      break;

    default:
      steps.push({
        action: 'monitor',
        label: 'Monitor Order',
        description: 'Continue monitoring order status',
        priority: 'low'
      });
  }

  return steps;
}
