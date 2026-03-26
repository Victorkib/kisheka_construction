/**
 * Equipment Operator Assignment Schema
 * Defines operator assignments to equipment for specific periods
 */

import { ObjectId } from 'mongodb';

/**
 * Operator Assignment Schema
 * @typedef {Object} OperatorAssignmentSchema
 * @property {ObjectId} _id - Assignment ID
 * @property {ObjectId} projectId - Project ID (required, indexed)
 * @property {ObjectId} equipmentId - Equipment ID (required, indexed)
 * @property {ObjectId} workerId - Worker/Operator ID (required)
 * @property {string} workerName - Worker name (denormalized for quick access)
 * @property {Date} startDate - Assignment start date (required)
 * @property {Date} endDate - Assignment end date (required)
 * @property {number} dailyRate - Daily rate for operator (required)
 * @property {number} expectedHours - Expected hours per day (default: 8)
 * @property {string} status - 'active' | 'completed' | 'cancelled' | 'scheduled'
 * @property {string} [notes] - Additional notes
 * @property {ObjectId} createdBy - Creator user ID
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 */

export const OPERATOR_ASSIGNMENT_SCHEMA = {
  projectId: 'ObjectId', // Required
  equipmentId: 'ObjectId', // Required
  workerId: 'ObjectId', // Required
  workerName: String, // Required (denormalized)
  startDate: Date, // Required
  endDate: Date, // Required
  dailyRate: Number, // Required
  expectedHours: Number, // Default: 8
  status: String, // Required: 'active' | 'completed' | 'cancelled' | 'scheduled'
  notes: String, // Optional
  createdBy: 'ObjectId', // Required
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date // Soft delete
};

/**
 * Create operator assignment object
 * @param {Object} input - Assignment input data
 * @param {ObjectId} createdBy - Creator user ID
 * @returns {Object} Operator assignment object
 */
export function createOperatorAssignment(input, createdBy) {
  const {
    projectId,
    equipmentId,
    workerId,
    workerName,
    startDate,
    endDate,
    dailyRate,
    expectedHours,
    status,
    notes
  } = input;

  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) {
    throw new Error('End date must be after start date');
  }

  return {
    projectId: typeof projectId === 'string' ? new ObjectId(projectId) : projectId,
    equipmentId: typeof equipmentId === 'string' ? new ObjectId(equipmentId) : equipmentId,
    workerId: typeof workerId === 'string' ? new ObjectId(workerId) : workerId,
    workerName: workerName?.trim() || '',
    startDate: start,
    endDate: end,
    dailyRate: parseFloat(dailyRate) || 0,
    expectedHours: parseFloat(expectedHours) || 8,
    status: status || 'scheduled',
    notes: notes?.trim() || '',
    createdBy: typeof createdBy === 'string' ? new ObjectId(createdBy) : createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  };
}

/**
 * Validate operator assignment data
 * @param {Object} data - Assignment data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateOperatorAssignment(data) {
  const errors = [];

  if (!data.projectId || !ObjectId.isValid(data.projectId)) {
    errors.push('Valid projectId is required');
  }

  if (!data.equipmentId || !ObjectId.isValid(data.equipmentId)) {
    errors.push('Valid equipmentId is required');
  }

  if (!data.workerId || !ObjectId.isValid(data.workerId)) {
    errors.push('Valid workerId is required');
  }

  if (!data.workerName || data.workerName.trim().length < 2) {
    errors.push('Worker name is required and must be at least 2 characters');
  }

  if (!data.startDate) {
    errors.push('Start date is required');
  }

  if (!data.endDate) {
    errors.push('End date is required');
  }

  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (end <= start) {
      errors.push('End date must be after start date');
    }
  }

  if (data.dailyRate === undefined || data.dailyRate === null || isNaN(data.dailyRate) || data.dailyRate < 0) {
    errors.push('Daily rate is required and must be >= 0');
  }

  if (data.expectedHours !== undefined && (isNaN(data.expectedHours) || data.expectedHours <= 0 || data.expectedHours > 24)) {
    errors.push('Expected hours must be between 0 and 24');
  }

  if (data.status && !['active', 'completed', 'cancelled', 'scheduled'].includes(data.status)) {
    errors.push('Status must be one of: active, completed, cancelled, scheduled');
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Check for operator assignment conflicts
 * @param {ObjectId} equipmentId - Equipment ID
 * @param {ObjectId} workerId - Worker ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {ObjectId} [excludeId] - Assignment ID to exclude (for updates)
 * @returns {Object} { hasConflict: boolean, conflicts: Array }
 */
export function checkAssignmentConflicts(existingAssignments, equipmentId, workerId, startDate, endDate, excludeId = null) {
  const conflicts = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (const assignment of existingAssignments) {
    // Skip excluded assignment (for updates)
    if (excludeId && assignment._id.toString() === excludeId.toString()) {
      continue;
    }

    // Skip deleted assignments
    if (assignment.deletedAt) {
      continue;
    }

    // Skip cancelled assignments
    if (assignment.status === 'cancelled') {
      continue;
    }

    const assignStart = new Date(assignment.startDate);
    const assignEnd = new Date(assignment.endDate);

    // Check for date overlap
    const hasDateOverlap = start < assignEnd && end > assignStart;

    if (hasDateOverlap) {
      // Check if same equipment
      if (assignment.equipmentId.toString() === equipmentId.toString()) {
        conflicts.push({
          type: 'equipment_conflict',
          assignment,
          message: `Equipment already assigned to ${assignment.workerName} from ${assignStart.toLocaleDateString()} to ${assignEnd.toLocaleDateString()}`
        });
      }

      // Check if same worker (worker can't operate multiple equipment at same time)
      if (assignment.workerId.toString() === workerId.toString()) {
        conflicts.push({
          type: 'worker_conflict',
          assignment,
          message: `${assignment.workerName} is already assigned to other equipment from ${assignStart.toLocaleDateString()} to ${assignEnd.toLocaleDateString()}`
        });
      }
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts
  };
}

export default {
  OPERATOR_ASSIGNMENT_SCHEMA,
  createOperatorAssignment,
  validateOperatorAssignment,
  checkAssignmentConflicts
};
