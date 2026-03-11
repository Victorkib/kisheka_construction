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
// LABOUR STATUS VALUES
// ============================================================================
// Labour entries use lowercase status values, but legacy data may include uppercase.
export const LABOUR_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  PAID: 'paid',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

// Statuses that count toward financial calculations (approved labour)
export const LABOUR_APPROVED_STATUSES = ['approved', 'paid', 'APPROVED', 'PAID'];

// Statuses that are pending approval
export const LABOUR_PENDING_STATUSES = [
  LABOUR_STATUS.PENDING_APPROVAL,
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

// ============================================================================
// MATERIAL REQUEST STATUS VALUES
// ============================================================================
export const MATERIAL_REQUEST_STATUS = {
  REQUESTED: 'requested',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CONVERTED_TO_ORDER: 'converted_to_order',
  CONVERTED_TO_MATERIAL: 'converted_to_material',
  CANCELLED: 'cancelled',
};

// Statuses that are pending approval
export const MATERIAL_REQUEST_PENDING_STATUSES = [
  MATERIAL_REQUEST_STATUS.REQUESTED,
  MATERIAL_REQUEST_STATUS.PENDING_APPROVAL,
];

// ============================================================================
// PROFESSIONAL FEES STATUS VALUES
// ============================================================================
// Professional fees use UPPERCASE status values (like expenses)
export const PROFESSIONAL_FEE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID',
  ARCHIVED: 'ARCHIVED',
};

// Statuses that are pending approval
// Note: Uses 'PENDING' (uppercase) for backward compatibility
export const PROFESSIONAL_FEE_PENDING_STATUSES = [
  PROFESSIONAL_FEE_STATUS.PENDING,
  // Also support lowercase for future migration
  'pending_approval',
];

// ============================================================================
// PROFESSIONAL ACTIVITIES STATUS VALUES
// ============================================================================
export const PROFESSIONAL_ACTIVITY_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

// Statuses that are pending approval
export const PROFESSIONAL_ACTIVITY_PENDING_STATUSES = [
  PROFESSIONAL_ACTIVITY_STATUS.PENDING_APPROVAL,
];

// ============================================================================
// BUDGET REALLOCATION STATUS VALUES
// ============================================================================
export const BUDGET_REALLOCATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  EXECUTED: 'executed',
};

// Statuses that are pending approval
export const BUDGET_REALLOCATION_PENDING_STATUSES = [
  BUDGET_REALLOCATION_STATUS.PENDING,
];

// ============================================================================
// UNIFIED APPROVAL STATUS MAPPINGS
// ============================================================================
/**
 * Mapping of collection names to their pending approval status values
 * This allows unified querying across all approval types
 * 
 * NOTE: Some collections use different status formats (uppercase vs lowercase)
 * This mapping handles both for backward compatibility during migration
 */
export const APPROVAL_STATUS_MAP = {
  // Materials: lowercase, snake_case
  materials: {
    pending: ['pending_approval', 'submitted'],
    approved: MATERIAL_APPROVED_STATUSES,
  },
  
  // Expenses: UPPERCASE (legacy), but also support lowercase for migration
  expenses: {
    pending: ['PENDING', 'pending_approval', 'submitted'],
    approved: EXPENSE_APPROVED_STATUSES,
  },
  
  // Initial Expenses: lowercase
  initial_expenses: {
    pending: ['pending_approval', 'pending'],
    approved: INITIAL_EXPENSE_APPROVED_STATUSES,
  },
  
  // Material Requests: lowercase
  material_requests: {
    pending: ['pending_approval', 'requested'],
    approved: ['approved'],
  },
  
  // Labour Entries: lowercase
  labour_entries: {
    pending: ['pending_approval'],
    approved: LABOUR_APPROVED_STATUSES,
  },
  
  // Professional Fees: UPPERCASE (legacy)
  professional_fees: {
    pending: ['PENDING', 'pending_approval'],
    approved: ['APPROVED', 'PAID'],
  },
  
  // Professional Activities: lowercase
  professional_activities: {
    pending: ['pending_approval'],
    approved: ['approved'],
  },
  
  // Budget Reallocations: lowercase, no underscore
  budget_reallocations: {
    pending: ['pending'],
    approved: ['approved'],
  },
  
  // Purchase Order Modifications: special case
  purchase_orders: {
    pending: ['order_modified'],
    approved: ['order_sent', 'order_approved'],
  },
  // Alias for consistency with frontend naming
  purchase_order_modifications: {
    pending: ['order_modified'],
    approved: ['order_sent', 'order_approved'],
  },
  
  // Contingency Draws: lowercase, no underscore
  contingency_draws: {
    pending: ['pending'],
    approved: ['approved'],
  },
};

/**
 * Get pending approval statuses for a specific collection
 * @param {string} collectionName - Name of the collection
 * @returns {string[]} Array of pending status values
 */
export function getPendingApprovalStatuses(collectionName) {
  const mapping = APPROVAL_STATUS_MAP[collectionName];
  return mapping?.pending || [];
}

/**
 * Check if a status is a pending approval status for a collection
 * @param {string} collectionName - Name of the collection
 * @param {string} status - Status to check
 * @returns {boolean}
 */
export function isPendingApproval(collectionName, status) {
  const pendingStatuses = getPendingApprovalStatuses(collectionName);
  return pendingStatuses.includes(status);
}

/**
 * Get all pending approval statuses across all collections
 * Useful for unified queries
 * @returns {string[]} Array of all unique pending status values
 */
export function getAllPendingApprovalStatuses() {
  const allStatuses = new Set();
  Object.values(APPROVAL_STATUS_MAP).forEach((mapping) => {
    mapping.pending.forEach((status) => allStatuses.add(status));
  });
  return Array.from(allStatuses);
}































