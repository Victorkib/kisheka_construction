/**
 * Rejection Reason Constants
 * 
 * Centralized rejection reason categories and subcategories for supplier order rejections.
 * This provides structured data for analysis, reporting, and workflow automation.
 */

// ============================================================================
// MAIN REJECTION REASON CATEGORIES
// ============================================================================
export const REJECTION_REASONS = {
  // Price-related rejections
  PRICE_TOO_HIGH: {
    id: 'price_too_high',
    label: 'Price Too High',
    description: 'Supplier rejects due to pricing concerns',
    color: 'orange',
    priority: 'high',
    subcategories: {
      MARKET_RATES: 'market_rates_higher',
      MATERIAL_COSTS: 'material_costs_increased',
      LABOR_COSTS: 'labor_costs_high',
      OVERHEAD: 'overhead_costs',
      PROFIT_MARGIN: 'insufficient_profit_margin',
      CURRENCY_FLUCTUATION: 'currency_fluctuation'
    }
  },

  // Availability issues
  UNAVAILABLE: {
    id: 'unavailable',
    label: 'Material Unavailable',
    description: 'Supplier cannot fulfill due to material availability',
    color: 'red',
    priority: 'critical',
    subcategories: {
      OUT_OF_STOCK: 'out_of_stock',
      DISCONTINUED: 'material_discontinued',
      SEASONAL_UNAVAILABLE: 'seasonal_unavailable',
      SUPPLIER_SHORTAGE: 'supplier_shortage',
      MANUFACTURING_DELAY: 'manufacturing_delay',
      SHIPPING_CONSTRAINTS: 'shipping_constraints'
    }
  },

  // Timeline concerns
  TIMELINE: {
    id: 'timeline',
    label: 'Timeline Issues',
    description: 'Supplier cannot meet required delivery schedule',
    color: 'yellow',
    priority: 'medium',
    subcategories: {
      DELIVERY_DATE: 'delivery_date_too_soon',
      PRODUCTION_TIME: 'insufficient_production_time',
      LOGISTICS_DELAY: 'logistics_delay',
      WEATHER_CONCERNS: 'weather_related_delays',
      WORKLOAD: 'current_workload_too_high',
      STAFF_SHORTAGE: 'staff_shortage'
    }
  },

  // Quality/Specifications
  SPECIFICATIONS: {
    id: 'specifications',
    label: 'Specification Issues',
    description: 'Supplier cannot meet material specifications',
    color: 'purple',
    priority: 'high',
    subcategories: {
      QUALITY_STANDARDS: 'cannot_meet_quality_standards',
      TECHNICAL_SPECS: 'technical_specifications_unmet',
      MATERIAL_GRADE: 'material_grade_unavailable',
      CUSTOM_REQUIREMENTS: 'custom_requirements_impossible',
      CERTIFICATION: 'certification_requirements',
      TESTING: 'testing_requirements'
    }
  },

  // Quantity issues
  QUANTITY: {
    id: 'quantity',
    label: 'Quantity Issues',
    description: 'Supplier cannot fulfill required quantity',
    color: 'blue',
    priority: 'medium',
    subcategories: {
      MINIMUM_ORDER: 'below_minimum_order_quantity',
      MAXIMUM_CAPACITY: 'exceeds_production_capacity',
      BATCH_SIZE: 'batch_size_constraints',
      STORAGE_LIMITS: 'storage_limitations',
      PARTIAL_FULFILLMENT: 'can_only_partial_fulfill'
    }
  },

  // Business/Policy reasons
  BUSINESS_POLICY: {
    id: 'business_policy',
    label: 'Business Policy',
    description: 'Supplier rejects due to internal business policies',
    color: 'gray',
    priority: 'low',
    subcategories: {
      PAYMENT_TERMS: 'unacceptable_payment_terms',
      CONTRACT_TERMS: 'contract_terms_unacceptable',
      INSURANCE: 'insurance_requirements',
      LICENSING: 'licensing_restrictions',
      GEOGRAPHIC_LIMITS: 'geographic_service_limits',
      CLIENT_RESTRICTIONS: 'client_specific_restrictions'
    }
  },

  // External factors
  EXTERNAL_FACTORS: {
    id: 'external_factors',
    label: 'External Factors',
    description: 'Rejection due to factors outside supplier control',
    color: 'teal',
    priority: 'variable',
    subcategories: {
      REGULATORY: 'regulatory_changes',
      MARKET_CONDITIONS: 'market_volatility',
      FORCE_MAJEURE: 'force_majeure',
      TRANSPORTATION: 'transportation_issues',
      SUPPLIER_CHAIN: 'supply_chain_disruption',
      ECONOMIC: 'economic_conditions'
    }
  },

  // Other/Custom reasons
  OTHER: {
    id: 'other',
    label: 'Other Reasons',
    description: 'Custom or unspecified rejection reasons',
    color: 'gray',
    priority: 'low',
    subcategories: {
      CUSTOM: 'custom_reason',
      NOT_SPECIFIED: 'not_specified',
      PREFERENCE: 'supplier_preference',
      RELATIONSHIP: 'business_relationship_issues'
    }
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get rejection reason by ID
 * @param {string} reasonId - The rejection reason ID
 * @returns {Object|null} The rejection reason object or null
 */
export function getRejectionReason(reasonId) {
  for (const reason of Object.values(REJECTION_REASONS)) {
    if (reason.id === reasonId) {
      return reason;
    }
  }
  return null;
}

/**
 * Get subcategory label
 * @param {string} reasonId - Main reason ID
 * @param {string} subcategoryId - Subcategory ID
 * @returns {string} The subcategory label
 */
export function getSubcategoryLabel(reasonId, subcategoryId) {
  const reason = getRejectionReason(reasonId);
  if (!reason || !reason.subcategories[subcategoryId]) {
    return 'Unknown';
  }
  
  // Convert snake_case to Title Case
  return reason.subcategories[subcategoryId]
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get all rejection reasons as array for dropdowns
 * @returns {Array} Array of rejection reasons with value/label pairs
 */
export function getRejectionReasonOptions() {
  return Object.values(REJECTION_REASONS).map(reason => ({
    value: reason.id,
    label: reason.label,
    description: reason.description,
    color: reason.color,
    priority: reason.priority
  }));
}

/**
 * Get subcategories for a specific reason
 * @param {string} reasonId - The main reason ID
 * @returns {Array} Array of subcategory options
 */
export function getSubcategoryOptions(reasonId) {
  const reason = getRejectionReason(reasonId);
  if (!reason || !reason.subcategories) {
    return [];
  }

  return Object.entries(reason.subcategories).map(([key, value]) => ({
    value: value,
    label: getSubcategoryLabel(reasonId, key)
  }));
}

/**
 * Determine if rejection is retryable based on reason
 * @param {string} reasonId - The rejection reason ID
 * @param {string} subcategoryId - The subcategory ID
 * @returns {Object} Retry assessment with recommendation
 */
export function assessRetryability(reasonId, subcategoryId) {
  const reason = getRejectionReason(reasonId);
  if (!reason) {
    return { retryable: false, recommendation: 'Unknown reason - manual review required' };
  }

  // Define retryability rules based on reason categories
  const retryRules = {
    'price_too_high': {
      retryable: true,
      recommendation: 'Consider price negotiation or alternative specifications',
      confidence: 0.7
    },
    'unavailable': {
      retryable: false,
      recommendation: 'Find alternative supplier or material',
      confidence: 0.9
    },
    'timeline': {
      retryable: true,
      recommendation: 'Adjust delivery date or split order',
      confidence: 0.6
    },
    'specifications': {
      retryable: true,
      recommendation: 'Review specifications or find specialized supplier',
      confidence: 0.5
    },
    'quantity': {
      retryable: true,
      recommendation: 'Adjust quantity or split into multiple orders',
      confidence: 0.8
    },
    'business_policy': {
      retryable: false,
      recommendation: 'Respect supplier policies or find alternative',
      confidence: 0.8
    },
    'external_factors': {
      retryable: true,
      recommendation: 'Monitor conditions and retry when resolved',
      confidence: 0.4
    },
    'other': {
      retryable: true,
      recommendation: 'Contact supplier for clarification',
      confidence: 0.3
    }
  };

  const rule = retryRules[reasonId];
  if (!rule) {
    return { retryable: false, recommendation: 'Manual review required' };
  }

  return {
    ...rule,
    reasonCategory: reason.label,
    priority: reason.priority
  };
}

/**
 * Get priority level for analytics
 * @param {string} priority - Priority string
 * @returns {number} Numeric priority value (1-5)
 */
export function getPriorityValue(priority) {
  const priorityMap = {
    'critical': 5,
    'high': 4,
    'medium': 3,
    'low': 2,
    'variable': 1
  };
  return priorityMap[priority] || 1;
}

/**
 * Format rejection reason for display
 * @param {string} reasonId - Main reason ID
 * @param {string} subcategoryId - Subcategory ID
 * @returns {string} Formatted display string
 */
export function formatRejectionReason(reasonId, subcategoryId) {
  const reason = getRejectionReason(reasonId);
  if (!reason) {
    return 'Unknown Reason';
  }

  const subcategoryLabel = getSubcategoryLabel(reasonId, Object.keys(reason.subcategories).find(key => reason.subcategories[key] === subcategoryId));
  
  return subcategoryLabel ? `${reason.label}: ${subcategoryLabel}` : reason.label;
}
