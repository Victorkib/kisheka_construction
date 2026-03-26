/**
 * Capital Authorization System
 * Defines authorization levels, thresholds, and approval workflows for capital operations
 */

/**
 * Capital Authorization Levels
 * Based on amount thresholds
 */
export const CAPITAL_AUTH_LEVELS = {
  // Small amounts: Auto-approve for PM, Accountant, Owner
  SMALL: {
    name: 'Small',
    min: 0,
    max: 50000, // KES 50K (reduced from 100K)
    autoApproveRoles: ['owner', 'pm', 'project_manager', 'accountant'],
    requiresConfirmation: false,
    requiresApproval: false
  },
  // Medium amounts: Auto-approve for Owner/PM, Confirm for Accountant
  MEDIUM: {
    name: 'Medium',
    min: 50000,
    max: 1000000, // KES 1M
    autoApproveRoles: ['owner', 'pm', 'project_manager'],
    requiresConfirmation: true, // Show confirmation modal
    requiresApproval: false
  },
  // Large amounts: Auto-approve for Owner only, Approval for PM/Accountant
  LARGE: {
    name: 'Large',
    min: 1000000,
    max: 10000000, // KES 10M
    autoApproveRoles: ['owner'],
    requiresConfirmation: true,
    requiresApproval: true // Requires approval workflow for non-owner
  },
  // Very Large amounts: Owner only, requires approval even for owner
  VERY_LARGE: {
    name: 'Very Large',
    min: 10000000,
    max: Infinity,
    autoApproveRoles: [],
    requiresConfirmation: true,
    requiresApproval: true
  }
};

/**
 * Get authorization level for an amount
 * @param {number} amount - Capital amount
 * @returns {Object} Authorization level configuration
 */
export function getCapitalAuthLevel(amount) {
  const levels = Object.values(CAPITAL_AUTH_LEVELS);
  
  for (const level of levels) {
    if (amount >= level.min && amount < level.max) {
      return level;
    }
  }
  
  // Default to MEDIUM if no match
  return CAPITAL_AUTH_LEVELS.MEDIUM;
}

/**
 * Check if user can auto-approve capital operation
 * @param {string} userRole - User role
 * @param {number} amount - Capital amount
 * @returns {Object} { canAutoApprove, requiresConfirmation, requiresApproval, authLevel }
 */
export function checkCapitalAuthorization(userRole, amount) {
  const authLevel = getCapitalAuthLevel(amount);
  const canAutoApprove = authLevel.autoApproveRoles.includes(userRole?.toLowerCase());
  
  return {
    authLevel,
    canAutoApprove,
    requiresConfirmation: authLevel.requiresConfirmation,
    requiresApproval: authLevel.requiresApproval && !canAutoApprove,
    message: getAuthorizationMessage(authLevel, canAutoApprove, userRole)
  };
}

/**
 * Get authorization message for UI display
 * @param {Object} authLevel - Authorization level
 * @param {boolean} canAutoApprove - Can user auto-approve
 * @param {string} userRole - User role
 * @returns {string} Message to display
 */
export function getAuthorizationMessage(authLevel, canAutoApprove, userRole) {
  if (canAutoApprove) {
    if (authLevel.requiresConfirmation) {
      return `This ${authLevel.name.toLowerCase()} capital allocation requires your confirmation before proceeding.`;
    }
    return `This ${authLevel.name.toLowerCase()} capital allocation will be processed immediately.`;
  }
  
  if (authLevel.requiresApproval) {
    return `This ${authLevel.name.toLowerCase()} capital allocation requires approval from an Owner or Project Manager.`;
  }
  
  return '';
}

/**
 * Capital Operation Types
 */
export const CAPITAL_OPERATION_TYPES = {
  ALLOCATION: 'capital_allocation',
  REBALANCING: 'capital_rebalancing',
  EQUIPMENT: 'equipment_creation',
  BULK_ALLOCATION: 'bulk_capital_allocation'
};

/**
 * Format currency for display
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

/**
 * Get authorization badge color
 * @param {Object} authLevel - Authorization level
 * @returns {string} CSS color class
 */
export function getAuthBadgeColor(authLevel) {
  switch (authLevel.name) {
    case 'Small':
      return 'bg-green-100 text-green-800 border-green-400/60';
    case 'Medium':
      return 'bg-blue-100 text-blue-800 border-blue-400/60';
    case 'Large':
      return 'bg-orange-100 text-orange-800 border-orange-400/60';
    case 'Very Large':
      return 'bg-red-100 text-red-800 border-red-400/60';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-400/60';
  }
}
