/**
 * Status Constants
 * 
 * Centralized status values for all entities to prevent bugs and ensure consistency.
 * 
 * IMPORTANT: Expenses use UPPERCASE status values, while Materials and Initial Expenses use lowercase.
 */

// ============================================================================
// EXPENSE STATUS VALUES
// ============================================================================
// Expenses use UPPERCASE status values
export const EXPENSE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID',
  ARCHIVED: 'ARCHIVED',
};

// Statuses that count toward financial calculations (approved expenses)
export const EXPENSE_APPROVED_STATUSES = [
  EXPENSE_STATUS.APPROVED,
  EXPENSE_STATUS.PAID,
];

// Statuses that are pending approval
export const EXPENSE_PENDING_STATUSES = [
  EXPENSE_STATUS.PENDING,
];

// ============================================================================
// MATERIAL STATUS VALUES
// ============================================================================
// Materials use lowercase status values
export const MATERIAL_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  RECEIVED: 'received',
  IN_USE: 'in_use',
  ARCHIVED: 'archived',
  REJECTED: 'rejected',
};

// Statuses that count toward financial calculations (approved materials)
export const MATERIAL_APPROVED_STATUSES = [
  MATERIAL_STATUS.APPROVED,
  MATERIAL_STATUS.RECEIVED,
];

// Statuses that are pending approval
export const MATERIAL_PENDING_STATUSES = [
  MATERIAL_STATUS.SUBMITTED,
  MATERIAL_STATUS.PENDING_APPROVAL,
];

// ============================================================================
// INITIAL EXPENSE STATUS VALUES
// ============================================================================
// Initial expenses use lowercase status values
export const INITIAL_EXPENSE_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DELETED: 'deleted', // Soft delete status
};

// Statuses that count toward financial calculations (approved initial expenses)
export const INITIAL_EXPENSE_APPROVED_STATUSES = [
  INITIAL_EXPENSE_STATUS.APPROVED,
];

// Statuses that are pending approval
export const INITIAL_EXPENSE_PENDING_STATUSES = [
  INITIAL_EXPENSE_STATUS.PENDING,
  INITIAL_EXPENSE_STATUS.PENDING_APPROVAL,
];

// ============================================================================
// INVESTOR STATUS VALUES
// ============================================================================
export const INVESTOR_STATUS = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  INACTIVE: 'INACTIVE',
};

// ============================================================================
// PROJECT STATUS VALUES
// ============================================================================
export const PROJECT_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if an expense status counts toward financial calculations
 * @param {string} status - Expense status
 * @returns {boolean}
 */
export function isExpenseApproved(status) {
  return EXPENSE_APPROVED_STATUSES.includes(status);
}

/**
 * Check if a material status counts toward financial calculations
 * @param {string} status - Material status
 * @returns {boolean}
 */
export function isMaterialApproved(status) {
  return MATERIAL_APPROVED_STATUSES.includes(status);
}

/**
 * Check if an initial expense status counts toward financial calculations
 * @param {string} status - Initial expense status
 * @returns {boolean}
 */
export function isInitialExpenseApproved(status) {
  return INITIAL_EXPENSE_APPROVED_STATUSES.includes(status);
}































