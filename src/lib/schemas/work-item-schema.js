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
 * @property {ObjectId} phaseId - Phase ID (required, indexed)
 * @property {ObjectId} projectId - Project ID (required, indexed)
 * @property {string} name - Work item name (required)
 * @property {string} [description] - Work item description
 * @property {string} category - Work category (required)
 * @property {string} status - 'not_started' | 'in_progress' | 'completed' | 'blocked'
 * @property {Array<ObjectId>} [assignedTo] - Assigned workers or subcontractors (multiple)
 * @property {Array<Object>} [assignmentHistory] - History of assignment changes
 * @property {number} estimatedHours - Estimated hours (>= 0)
 * @property {number} actualHours - Actual hours (>= 0)
 * @property {number} estimatedCost - Estimated cost (>= 0)
 * @property {number} actualCost - Actual cost (>= 0)
 * @property {Date} [startDate] - Start date
 * @property {Date} [plannedEndDate] - Planned end date
 * @property {Date} [actualEndDate] - Actual end date
 * @property {Array<ObjectId>} dependencies - Other work items this depends on
 * @property {ObjectId} [floorId] - Floor ID (optional)
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
  phaseId: 'ObjectId', // Required
  projectId: 'ObjectId', // Required
  name: String, // Required, min 2 chars
  description: String,
  category: String, // Required
  status: String, // Required: 'not_started' | 'in_progress' | 'completed' | 'blocked'
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
  floorId: 'ObjectId', // Optional
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
    categoryId,
    priority,
    notes
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

  return {
    projectId: typeof projectId === 'string' ? new ObjectId(projectId) : projectId,
    phaseId: typeof phaseId === 'string' ? new ObjectId(phaseId) : phaseId,
    name: name?.trim() || '',
    description: description?.trim() || '',
    category: category || 'other',
    status: status || 'not_started',
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
    floorId: floorId && ObjectId.isValid(floorId) ? new ObjectId(floorId) : null,
    categoryId: categoryId && ObjectId.isValid(categoryId) ? new ObjectId(categoryId) : null,
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
  
  if (!data.phaseId || !ObjectId.isValid(data.phaseId)) {
    errors.push('Valid phaseId is required');
  }
  
  if (!data.projectId || !ObjectId.isValid(data.projectId)) {
    errors.push('Valid projectId is required');
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

