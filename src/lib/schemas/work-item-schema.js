/**
 * Work Item Schema Definition
 * Defines work items/tasks structure for breaking down phases
 */

import { ObjectId } from 'mongodb';
// Import constants for use in validation functions (server-side only)
import { 
  WORK_ITEM_STATUSES, 
  WORK_ITEM_PRIORITIES, 
  WORK_ITEM_CATEGORIES,
  getPriorityLabel,
  getPriorityColor,
  getStatusColor
} from '@/lib/constants/work-item-constants';

/**
 * Work Item Schema
 * @typedef {Object} WorkItemSchema
 * @property {ObjectId} _id - Work item ID
 * @property {string} scope - 'project' | 'phase' | 'floor' | 'multi_phase' (default: 'phase')
 * @property {ObjectId} [projectId] - Project ID (required for project scope)
 * @property {ObjectId} [phaseId] - Phase ID (required for phase scope)
 * @property {Array<ObjectId>} [phaseIds] - Phase IDs (required for multi_phase scope)
 * @property {ObjectId} [floorId] - Floor ID (required for floor scope)
 * @property {string} name - Work item name (required)
 * @property {string} [description] - Work item description
 * @property {string} category - Work category (required)
 * @property {string} status - 'not_started' | 'in_progress' | 'completed' | 'blocked'
 * @property {Array<ObjectId>} [assignedTo] - Assigned workers or subcontractors (multiple)
 * @property {string} [executionModel] - Execution model: 'direct_labour' | 'contract_based' (optional, mainly for finishing works)
 * @property {Array<Object>} [assignmentHistory] - History of assignment changes
 * @property {number} estimatedHours - Estimated hours (>= 0)
 * @property {number} actualHours - Actual hours (>= 0)
 * @property {number} estimatedCost - Estimated cost (>= 0)
 * @property {number} actualCost - Actual cost (>= 0)
 * @property {Date} [startDate] - Start date
 * @property {Date} [plannedEndDate] - Planned end date
 * @property {Date} [actualEndDate] - Actual end date
 * @property {Array<ObjectId>} dependencies - Other work items this depends on
 * @property {ObjectId} [subcontractorId] - Linked subcontractor (optional, for contract-based finishing works)
 * @property {ObjectId} [categoryId] - Category ID (optional)
 * @property {number} priority - Priority level (1-5, 1 = highest)
 * @property {string} [notes] - Additional notes
 * @property {ObjectId} createdBy - Creator user ID
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 */

// Re-export constants from client-safe constants file for backward compatibility
// This allows server-side code to import from schema while keeping client-side code safe
export { WORK_ITEM_STATUSES, WORK_ITEM_PRIORITIES, WORK_ITEM_CATEGORIES };

/**
 * Work Item Schema Object
 */
export const WORK_ITEM_SCHEMA = {
  scope: String, // Optional: 'project' | 'phase' | 'floor' | 'multi_phase' (default: 'phase')
  projectId: 'ObjectId', // Required for project scope
  phaseId: 'ObjectId', // Required for phase scope
  phaseIds: ['ObjectId'], // Required for multi_phase scope
  floorId: 'ObjectId', // Required for floor scope
  name: String, // Required, min 2 chars
  description: String,
  category: String, // Required
  status: String, // Required: 'not_started' | 'in_progress' | 'completed' | 'blocked'
  executionModel: String, // Optional: 'direct_labour' | 'contract_based'
  assignedTo: ['ObjectId'], // Optional - Array of worker IDs
  assignmentHistory: [Object], // Optional - History of assignment changes
  estimatedHours: Number, // Default: 0
  actualHours: Number, // Default: 0
  estimatedCost: Number, // Default: 0
  actualCost: Number, // Default: 0
  startDate: Date,
  plannedEndDate: Date,
  actualEndDate: Date,
  dependencies: ['ObjectId'], // Array of work item IDs
  subcontractorId: 'ObjectId', // Optional
  categoryId: 'ObjectId', // Optional
  priority: Number, // 1-5, default: 3
  notes: String,
  createdBy: 'ObjectId', // Required
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date
};

/**
 * Create work item object
 * @param {Object} input - Work item input data
 * @param {ObjectId} projectId - Project ID
 * @param {ObjectId} phaseId - Phase ID
 * @param {ObjectId} createdBy - Creator user ID
 * @returns {Object} Work item object
 */
export function createWorkItem(input, projectId, phaseId, createdBy) {
  const {
    scope,
    name,
    description,
    category,
    status,
    assignedTo,
    estimatedHours,
    actualHours,
    estimatedCost,
    actualCost,
    startDate,
    plannedEndDate,
    actualEndDate,
    dependencies,
    floorId,
    phaseIds,
    categoryId,
    priority,
    notes,
    executionModel,
    subcontractorId
  } = input;

  // Handle assignedTo as array (support both single and multiple)
  let assignedToArray = [];
  if (assignedTo) {
    if (Array.isArray(assignedTo)) {
      // Array of worker IDs
      assignedToArray = assignedTo
        .filter(id => id && ObjectId.isValid(id))
        .map(id => new ObjectId(id));
    } else if (ObjectId.isValid(assignedTo)) {
      // Single worker ID (backward compatibility)
      assignedToArray = [new ObjectId(assignedTo)];
    }
  }

  // Create initial assignment history entry if workers are assigned
  const assignmentHistory = assignedToArray.length > 0 ? [{
    previousWorkers: [],
    assignedWorkers: assignedToArray.map(id => id.toString()),
    assignedBy: typeof createdBy === 'string' ? new ObjectId(createdBy) : createdBy,
    assignedAt: new Date(),
    action: 'assigned'
  }] : [];

  // Determine scope-based field values
  const workItemScope = scope || 'phase';

  // For backward compatibility, default to phase scope
  const finalProjectId = typeof projectId === 'string' ? new ObjectId(projectId) : projectId;
  // phaseId is needed for both phase and floor scopes
  const finalPhaseId = ((workItemScope === 'phase' || workItemScope === 'floor') && phaseId)
    ? (typeof phaseId === 'string' ? new ObjectId(phaseId) : phaseId)
    : null;
  const finalPhaseIds = (workItemScope === 'multi_phase' && Array.isArray(phaseIds))
    ? phaseIds.filter(id => id && ObjectId.isValid(id)).map(id => typeof id === 'string' ? new ObjectId(id) : id)
    : [];
  const finalFloorId = (workItemScope === 'floor' && floorId && ObjectId.isValid(floorId))
    ? new ObjectId(floorId)
    : null;

  return {
    scope: workItemScope,
    projectId: finalProjectId,
    phaseId: finalPhaseId,
    phaseIds: finalPhaseIds,
    floorId: finalFloorId,
    name: name?.trim() || '',
    description: description?.trim() || '',
    category: category || 'other',
    status: status || 'not_started',
    executionModel: executionModel || null,
    assignedTo: assignedToArray,
    assignmentHistory: assignmentHistory,
    estimatedHours: parseFloat(estimatedHours) || 0,
    actualHours: parseFloat(actualHours) || 0,
    estimatedCost: parseFloat(estimatedCost) || 0,
    actualCost: parseFloat(actualCost) || 0,
    startDate: startDate ? new Date(startDate) : null,
    plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
    actualEndDate: actualEndDate ? new Date(actualEndDate) : null,
    dependencies: Array.isArray(dependencies)
      ? dependencies.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id))
      : [],
    categoryId: categoryId && ObjectId.isValid(categoryId) ? new ObjectId(categoryId) : null,
    subcontractorId: subcontractorId && ObjectId.isValid(subcontractorId) ? new ObjectId(subcontractorId) : null,
    priority: priority && WORK_ITEM_PRIORITIES.includes(parseInt(priority)) ? parseInt(priority) : 3,
    notes: notes?.trim() || '',
    createdBy: typeof createdBy === 'string' ? new ObjectId(createdBy) : createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  };
}

/**
 * Validate work item data
 * @param {Object} data - Work item data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateWorkItem(data) {
  const errors = [];
  const scope = data.scope || 'phase';

  // Scope-based validation
  if (scope === 'project') {
    if (!data.projectId || !ObjectId.isValid(data.projectId)) {
      errors.push('Valid projectId is required for project-level work items');
    }
  } else if (scope === 'phase') {
    if (!data.phaseId || !ObjectId.isValid(data.phaseId)) {
      errors.push('Valid phaseId is required for phase-level work items');
    }
    if (!data.projectId || !ObjectId.isValid(data.projectId)) {
      errors.push('Valid projectId is required');
    }
  } else if (scope === 'floor') {
    if (!data.floorId || !ObjectId.isValid(data.floorId)) {
      errors.push('Valid floorId is required for floor-level work items');
    }
    if (!data.phaseId || !ObjectId.isValid(data.phaseId)) {
      errors.push('Valid phaseId is required for floor-level work items');
    }
    if (!data.projectId || !ObjectId.isValid(data.projectId)) {
      errors.push('Valid projectId is required');
    }
  } else if (scope === 'multi_phase') {
    if (!data.phaseIds || !Array.isArray(data.phaseIds) || data.phaseIds.length === 0) {
      errors.push('phaseIds array is required for multi-phase work items');
    } else {
      for (const pid of data.phaseIds) {
        if (!pid || !ObjectId.isValid(pid)) {
          errors.push(`Invalid phaseId in phaseIds array: ${pid}`);
        }
      }
    }
    if (!data.projectId || !ObjectId.isValid(data.projectId)) {
      errors.push('Valid projectId is required');
    }
  }

  if (!data.name || data.name.trim().length < 2) {
    errors.push('Work item name is required and must be at least 2 characters');
  }

  if (!data.category || data.category.trim().length === 0) {
    errors.push('Category is required');
  }

  if (!data.status || !WORK_ITEM_STATUSES.includes(data.status)) {
    errors.push(`Status is required and must be one of: ${WORK_ITEM_STATUSES.join(', ')}`);
  }

  if (data.estimatedHours !== undefined && (isNaN(data.estimatedHours) || data.estimatedHours < 0)) {
    errors.push('Estimated hours must be >= 0');
  }

  if (data.actualHours !== undefined && (isNaN(data.actualHours) || data.actualHours < 0)) {
    errors.push('Actual hours must be >= 0');
  }

  if (data.estimatedCost !== undefined && (isNaN(data.estimatedCost) || data.estimatedCost < 0)) {
    errors.push('Estimated cost must be >= 0');
  }

  if (data.actualCost !== undefined && (isNaN(data.actualCost) || data.actualCost < 0)) {
    errors.push('Actual cost must be >= 0');
  }

  if (data.priority !== undefined && !WORK_ITEM_PRIORITIES.includes(parseInt(data.priority))) {
    errors.push('Priority must be between 1 and 5');
  }

  // Validate dependencies
  if (data.dependencies && Array.isArray(data.dependencies)) {
    for (const depId of data.dependencies) {
      if (!ObjectId.isValid(depId)) {
        errors.push(`Invalid dependency work item ID: ${depId}`);
      }
    }
  }

  // Validate dates
  if (data.startDate && data.plannedEndDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.plannedEndDate);
    if (end <= start) {
      errors.push('Planned end date must be after start date');
    }
  }

  // Validate executionModel and subcontractorId consistency
  if (data.executionModel === 'contract_based' && data.subcontractorId) {
    // Contract-based work items should have a valid subcontractorId
    if (!ObjectId.isValid(data.subcontractorId)) {
      errors.push('For contract-based work items, subcontractorId must be a valid ObjectId');
    }
  }

  // Warn (but don't block) if contract_based without subcontractorId
  // This is handled at API level for better UX

  // If direct_labour, subcontractorId should ideally be null (but not strictly enforced)
  // This allows flexibility for work items that might transition between models

  return { isValid: errors.length === 0, errors };
}

// Re-export client-safe functions from constants file for backward compatibility
// These functions don't use MongoDB, so they're safe to re-export
// Note: Functions are imported above, so they're available in module scope for default export
export { getPriorityLabel, getPriorityColor, getStatusColor };

export default {
  WORK_ITEM_SCHEMA,
  WORK_ITEM_STATUSES,
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_CATEGORIES,
  createWorkItem,
  validateWorkItem,
  getPriorityLabel,
  getPriorityColor,
  getStatusColor
};

