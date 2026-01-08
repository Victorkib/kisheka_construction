/**
 * Budget Reallocation Schema Definition
 * Defines budget reallocation requests and their workflow
 */

/**
 * Budget Reallocation Schema
 * @typedef {Object} BudgetReallocationSchema
 * @property {ObjectId} _id - Reallocation request ID
 * @property {ObjectId} projectId - Project ID (required, indexed)
 * @property {ObjectId} fromPhaseId - Source phase ID (null for project budget)
 * @property {ObjectId} toPhaseId - Target phase ID (null for project budget)
 * @property {string} reallocationType - Type: 'phase_to_phase', 'project_to_phase', 'phase_to_project'
 * @property {number} amount - Amount to reallocate (required, > 0)
 * @property {string} reason - Reason for reallocation (required)
 * @property {string} status - Status: 'pending', 'approved', 'rejected', 'cancelled'
 * @property {ObjectId} requestedBy - User who requested (required)
 * @property {ObjectId} approvedBy - User who approved (nullable)
 * @property {ObjectId} rejectedBy - User who rejected (nullable)
 * @property {string} approvalNotes - Notes from approver
 * @property {string} rejectionReason - Reason for rejection
 * @property {Date} requestedAt - Request timestamp
 * @property {Date} approvedAt - Approval timestamp (nullable)
 * @property {Date} rejectedAt - Rejection timestamp (nullable)
 * @property {Date} executedAt - Execution timestamp (nullable)
 * @property {Object} budgetBreakdown - Budget breakdown (materials, labour, etc.)
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} deletedAt - Soft delete timestamp
 */

/**
 * Valid reallocation types
 */
export const REALLOCATION_TYPES = {
  PHASE_TO_PHASE: 'phase_to_phase',
  PROJECT_TO_PHASE: 'project_to_phase',
  PHASE_TO_PROJECT: 'phase_to_project'
};

/**
 * Valid reallocation statuses
 */
export const REALLOCATION_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  EXECUTED: 'executed'
};

/**
 * Validate budget reallocation request
 * @param {Object} reallocation - Reallocation request data
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateBudgetReallocation(reallocation) {
  const errors = [];

  if (!reallocation.projectId) {
    errors.push('Project ID is required');
  }

  if (!reallocation.amount || reallocation.amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (!reallocation.reason || reallocation.reason.trim().length === 0) {
    errors.push('Reason is required');
  }

  if (!reallocation.reallocationType || !Object.values(REALLOCATION_TYPES).includes(reallocation.reallocationType)) {
    errors.push('Invalid reallocation type');
  }

  // Validate based on type
  if (reallocation.reallocationType === REALLOCATION_TYPES.PHASE_TO_PHASE) {
    if (!reallocation.fromPhaseId) {
      errors.push('Source phase ID is required for phase-to-phase reallocation');
    }
    if (!reallocation.toPhaseId) {
      errors.push('Target phase ID is required for phase-to-phase reallocation');
    }
    if (reallocation.fromPhaseId === reallocation.toPhaseId) {
      errors.push('Source and target phases cannot be the same');
    }
  } else if (reallocation.reallocationType === REALLOCATION_TYPES.PROJECT_TO_PHASE) {
    if (reallocation.fromPhaseId) {
      errors.push('Source phase ID should not be provided for project-to-phase reallocation');
    }
    if (!reallocation.toPhaseId) {
      errors.push('Target phase ID is required for project-to-phase reallocation');
    }
  } else if (reallocation.reallocationType === REALLOCATION_TYPES.PHASE_TO_PROJECT) {
    if (!reallocation.fromPhaseId) {
      errors.push('Source phase ID is required for phase-to-project reallocation');
    }
    if (reallocation.toPhaseId) {
      errors.push('Target phase ID should not be provided for phase-to-project reallocation');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate available budget for reallocation
 * @param {number} currentAllocation - Current budget allocation
 * @param {number} actualSpending - Actual spending
 * @param {number} committedCost - Committed cost
 * @returns {number} Available budget
 */
export function calculateAvailableBudget(currentAllocation, actualSpending = 0, committedCost = 0) {
  return Math.max(0, currentAllocation - actualSpending - committedCost);
}

/**
 * Create budget reallocation request
 * @param {Object} data - Reallocation request data
 * @returns {Object} Reallocation request object
 */
export function createBudgetReallocation(data) {
  const validation = validateBudgetReallocation(data);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  return {
    projectId: data.projectId,
    fromPhaseId: data.fromPhaseId || null,
    toPhaseId: data.toPhaseId || null,
    reallocationType: data.reallocationType,
    amount: parseFloat(data.amount),
    reason: data.reason.trim(),
    status: REALLOCATION_STATUSES.PENDING,
    requestedBy: data.requestedBy,
    approvedBy: null,
    rejectedBy: null,
    approvalNotes: null,
    rejectionReason: null,
    requestedAt: new Date(),
    approvedAt: null,
    rejectedAt: null,
    executedAt: null,
    budgetBreakdown: data.budgetBreakdown || {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  };
}

