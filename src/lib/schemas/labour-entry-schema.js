/**
 * Labour Entry Schema Definition
 * Centralized schema definition for individual labour entries
 * 
 * NOTE: This file contains MongoDB imports and should only be used in server-side code.
 * For client components, use @/lib/constants/labour-constants.js instead.
 */

import { ObjectId } from 'mongodb';
import {
  VALID_WORKER_TYPES,
  VALID_WORKER_ROLES,
  VALID_SKILL_TYPES,
  VALID_ENTRY_STATUSES,
  VALID_SERVICE_TYPES,
} from '@/lib/constants/labour-constants';

/**
 * Labour Entry Schema
 * @typedef {Object} LabourEntrySchema
 * @property {ObjectId} _id - Labour entry ID
 * @property {ObjectId} [batchId] - Batch ID (if part of bulk operation)
 * @property {string} [batchNumber] - Denormalized batch number
 * @property {ObjectId} projectId - Project ID (required, indexed)
 * @property {ObjectId} phaseId - Phase ID (required, indexed)
 * @property {ObjectId} [floorId] - Floor ID (optional, indexed)
 * @property {ObjectId} [categoryId] - Category ID (optional, indexed)
 * @property {ObjectId} [workItemId] - Work item ID (optional, indexed)
 * @property {ObjectId} [workerId] - Worker user ID (optional, can be null for external workers)
 * @property {string} workerName - Worker name (required, denormalized or manual entry)
 * @property {string} workerType - 'internal' | 'external' | 'professional' (required)
 * @property {string} workerRole - 'skilled' | 'unskilled' | 'supervisory' | 'professional' (required)
 * @property {string} skillType - Skill type (required): 'mason' | 'electrician' | 'plumber' | 'architect' | 'engineer' | etc.
 * @property {Date} entryDate - Entry date (required, indexed)
 * @property {Date} [clockInTime] - Clock in time
 * @property {Date} [clockOutTime] - Clock out time
 * @property {number} [breakDuration] - Break duration in minutes
 * @property {number} totalHours - Total hours worked (calculated)
 * @property {number} [overtimeHours] - Overtime hours
 * @property {number} regularHours - Regular hours (calculated)
 * @property {string} [taskDescription] - Task description
 * @property {number} [quantityCompleted] - Quantity completed (for piecework)
 * @property {string} [unitOfMeasure] - Unit of measure: 'blocks' | 'sqm' | 'units' | 'visits'
 * @property {number} [unitRate] - Rate per unit (for piecework)
 * @property {number} hourlyRate - Hourly rate (required)
 * @property {number} [dailyRate] - Daily rate (optional, for daily-rate workers)
 * @property {number} regularCost - Regular cost (calculated: regularHours * hourlyRate)
 * @property {number} overtimeCost - Overtime cost (calculated: overtimeHours * overtimeRate)
 * @property {number} totalCost - Total cost (calculated: regularCost + overtimeCost)
 * @property {string} [serviceType] - Service type for professionals: 'consultation' | 'inspection' | 'design' | 'approval'
 * @property {string} [visitPurpose] - Visit purpose for professionals
 * @property {string[]} [deliverables] - Deliverables array for professionals
 * @property {string} status - 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid' (required)
 * @property {ObjectId} createdBy - Creator user ID (required, always owner in single-user mode)
 * @property {number} [qualityRating] - Quality rating (1-5, optional)
 * @property {number} [productivityRating] - Productivity rating (1-5, optional)
 * @property {string} [notes] - Additional notes
 * @property {ObjectId} [equipmentId] - Equipment ID (optional, if operating equipment)
 * @property {ObjectId} [subcontractorId] - Subcontractor ID (optional, if part of subcontractor team)
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 */

export const LABOUR_ENTRY_SCHEMA = {
  batchId: 'ObjectId', // Optional
  batchNumber: String, // Optional, denormalized
  projectId: 'ObjectId', // Required
  phaseId: 'ObjectId', // Required
  floorId: 'ObjectId', // Optional
  categoryId: 'ObjectId', // Optional
  workItemId: 'ObjectId', // Optional
  workerId: 'ObjectId', // Optional (can be null for external workers)
  workerName: String, // Required
  workerType: String, // Required: 'internal' | 'external' | 'professional'
  workerRole: String, // Required: 'skilled' | 'unskilled' | 'supervisory' | 'professional'
  skillType: String, // Required
  entryDate: Date, // Required
  clockInTime: Date, // Optional
  clockOutTime: Date, // Optional
  breakDuration: Number, // Optional, minutes
  totalHours: Number, // Calculated
  overtimeHours: Number, // Optional
  regularHours: Number, // Calculated
  taskDescription: String, // Optional
  quantityCompleted: Number, // Optional, for piecework
  unitOfMeasure: String, // Optional
  unitRate: Number, // Optional, for piecework
  hourlyRate: Number, // Required
  dailyRate: Number, // Optional
  regularCost: Number, // Calculated
  overtimeCost: Number, // Calculated
  totalCost: Number, // Calculated
  serviceType: String, // Optional, for professionals
  visitPurpose: String, // Optional, for professionals
  deliverables: [String], // Optional, for professionals
  status: String, // Required
  createdBy: 'ObjectId', // Required
  qualityRating: Number, // Optional, 1-5
  productivityRating: Number, // Optional, 1-5
  notes: String, // Optional
  equipmentId: 'ObjectId', // Optional
  subcontractorId: 'ObjectId', // Optional
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date, // Soft delete
};

// Constants are now imported from @/lib/constants/labour-constants.js
// Re-export for backward compatibility with server-side code
export {
  VALID_WORKER_TYPES,
  VALID_WORKER_ROLES,
  VALID_SKILL_TYPES,
  VALID_ENTRY_STATUSES,
  VALID_SERVICE_TYPES,
};

/**
 * Validation rules for labour entries
 */
export const LABOUR_ENTRY_VALIDATION = {
  projectId: {
    required: true,
    type: 'ObjectId',
  },
  phaseId: {
    required: true,
    type: 'ObjectId',
  },
  workerName: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 200,
  },
  workerType: {
    required: true,
    type: 'string',
    enum: VALID_WORKER_TYPES,
  },
  workerRole: {
    required: true,
    type: 'string',
    enum: VALID_WORKER_ROLES,
  },
  skillType: {
    required: true,
    type: 'string',
    enum: VALID_SKILL_TYPES,
  },
  entryDate: {
    required: true,
    type: 'Date',
  },
  hourlyRate: {
    required: true,
    type: 'number',
    min: 0,
  },
  totalHours: {
    required: true,
    type: 'number',
    min: 0,
    max: 24,
  },
  status: {
    required: true,
    type: 'string',
    enum: VALID_ENTRY_STATUSES,
    default: 'draft',
  },
  createdBy: {
    required: true,
    type: 'ObjectId',
  },
};

/**
 * Create labour entry object
 * @param {Object} input - Labour entry input data
 * @param {ObjectId} createdBy - Creator user ID
 * @returns {Object} Labour entry object
 */
export function createLabourEntry(input, createdBy) {
  const {
    batchId,
    batchNumber,
    projectId,
    phaseId,
    floorId,
    categoryId,
    workItemId,
    workerId,
    workerName,
    workerType,
    workerRole,
    skillType,
    entryDate,
    clockInTime,
    clockOutTime,
    breakDuration = 0,
    taskDescription,
    quantityCompleted,
    unitOfMeasure,
    unitRate,
    hourlyRate,
    dailyRate,
    overtimeHours = 0,
    serviceType,
    visitPurpose,
    deliverables = [],
    qualityRating,
    productivityRating,
    notes,
    equipmentId,
    subcontractorId,
  } = input;

  // Calculate hours
  let totalHours = 0;
  let regularHours = 0;

  if (clockInTime && clockOutTime) {
    const start = new Date(clockInTime);
    const end = new Date(clockOutTime);
    const diffMs = end - start;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    totalHours = Math.max(0, (diffMinutes - breakDuration) / 60);
  } else if (input.totalHours) {
    totalHours = parseFloat(input.totalHours) || 0;
  }

  // Calculate regular vs overtime hours
  regularHours = Math.min(8, totalHours); // Standard 8-hour day
  const calculatedOvertimeHours = Math.max(0, totalHours - 8);

  // Use provided overtime hours if available, otherwise calculate
  const finalOvertimeHours = overtimeHours > 0 ? overtimeHours : calculatedOvertimeHours;
  const finalRegularHours = totalHours - finalOvertimeHours;

  // Calculate costs
  const regularCost = finalRegularHours * (parseFloat(hourlyRate) || 0);
  const overtimeRate = (parseFloat(hourlyRate) || 0) * 1.5; // Standard 1.5x overtime
  const overtimeCost = finalOvertimeHours * overtimeRate;
  const totalCost = regularCost + overtimeCost;

  // If daily rate is provided and no hours specified, use daily rate
  let finalTotalCost = totalCost;
  if (dailyRate && dailyRate > 0 && totalHours === 0) {
    finalTotalCost = parseFloat(dailyRate);
  }

  return {
    batchId: batchId && ObjectId.isValid(batchId) ? new ObjectId(batchId) : null,
    batchNumber: batchNumber || null,
    projectId: ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId,
    phaseId: ObjectId.isValid(phaseId) ? new ObjectId(phaseId) : phaseId,
    floorId: floorId && ObjectId.isValid(floorId) ? new ObjectId(floorId) : null,
    categoryId: categoryId && ObjectId.isValid(categoryId) ? new ObjectId(categoryId) : null,
    workItemId: workItemId && ObjectId.isValid(workItemId) ? new ObjectId(workItemId) : null,
    workerId: workerId && ObjectId.isValid(workerId) ? new ObjectId(workerId) : null,
    workerName: workerName?.trim() || '',
    workerType: workerType || 'internal',
    workerRole: workerRole || 'skilled',
    skillType: skillType || 'general_worker',
    entryDate: entryDate ? new Date(entryDate) : new Date(),
    clockInTime: clockInTime ? new Date(clockInTime) : null,
    clockOutTime: clockOutTime ? new Date(clockOutTime) : null,
    breakDuration: parseFloat(breakDuration) || 0,
    totalHours: parseFloat(totalHours.toFixed(2)),
    overtimeHours: parseFloat(finalOvertimeHours.toFixed(2)),
    regularHours: parseFloat(finalRegularHours.toFixed(2)),
    taskDescription: taskDescription?.trim() || '',
    quantityCompleted: quantityCompleted ? parseFloat(quantityCompleted) : null,
    unitOfMeasure: unitOfMeasure?.trim() || null,
    unitRate: unitRate ? parseFloat(unitRate) : null,
    hourlyRate: parseFloat(hourlyRate) || 0,
    dailyRate: dailyRate ? parseFloat(dailyRate) : null,
    regularCost: parseFloat(regularCost.toFixed(2)),
    overtimeCost: parseFloat(overtimeCost.toFixed(2)),
    totalCost: parseFloat(finalTotalCost.toFixed(2)),
    serviceType: serviceType || null,
    visitPurpose: visitPurpose?.trim() || null,
    deliverables: Array.isArray(deliverables) ? deliverables : [],
    status: 'draft',
    createdBy: ObjectId.isValid(createdBy) ? new ObjectId(createdBy) : createdBy,
    qualityRating: qualityRating && qualityRating >= 1 && qualityRating <= 5 ? qualityRating : null,
    productivityRating: productivityRating && productivityRating >= 1 && productivityRating <= 5 ? productivityRating : null,
    notes: notes?.trim() || '',
    equipmentId: equipmentId && ObjectId.isValid(equipmentId) ? new ObjectId(equipmentId) : null,
    subcontractorId: subcontractorId && ObjectId.isValid(subcontractorId) ? new ObjectId(subcontractorId) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

/**
 * Validate labour entry data
 * @param {Object} data - Labour entry data to validate
 * @returns {Object} { isValid: boolean, errors: string[], warnings: string[] }
 */
export function validateLabourEntry(data) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!data.projectId || !ObjectId.isValid(data.projectId)) {
    errors.push('Valid projectId is required');
  }

  if (!data.phaseId || !ObjectId.isValid(data.phaseId)) {
    errors.push('Valid phaseId is required');
  }

  if (!data.workerName || data.workerName.trim().length < 2) {
    errors.push('workerName is required and must be at least 2 characters');
  }

  if (!data.workerType || !VALID_WORKER_TYPES.includes(data.workerType)) {
    errors.push(`workerType is required and must be one of: ${VALID_WORKER_TYPES.join(', ')}`);
  }

  if (!data.workerRole || !VALID_WORKER_ROLES.includes(data.workerRole)) {
    errors.push(`workerRole is required and must be one of: ${VALID_WORKER_ROLES.join(', ')}`);
  }

  if (!data.skillType || !VALID_SKILL_TYPES.includes(data.skillType)) {
    errors.push(`skillType is required and must be one of: ${VALID_SKILL_TYPES.join(', ')}`);
  }

  if (!data.entryDate) {
    errors.push('entryDate is required');
  }

  if (data.hourlyRate === undefined || data.hourlyRate === null || isNaN(data.hourlyRate) || data.hourlyRate < 0) {
    errors.push('hourlyRate is required and must be >= 0');
  }

  if (data.totalHours === undefined || data.totalHours === null || isNaN(data.totalHours) || data.totalHours < 0) {
    errors.push('totalHours is required and must be >= 0');
  }

  if (data.totalHours > 24) {
    errors.push('totalHours cannot exceed 24 hours per day');
  }

  if (!data.createdBy || !ObjectId.isValid(data.createdBy)) {
    errors.push('Valid createdBy is required');
  }

  // Optional field validation
  if (data.breakDuration !== undefined && (isNaN(data.breakDuration) || data.breakDuration < 0)) {
    errors.push('breakDuration must be >= 0');
  }

  if (data.overtimeHours !== undefined && (isNaN(data.overtimeHours) || data.overtimeHours < 0)) {
    errors.push('overtimeHours must be >= 0');
  }

  if (data.qualityRating !== undefined && (data.qualityRating < 1 || data.qualityRating > 5)) {
    errors.push('qualityRating must be between 1 and 5');
  }

  if (data.productivityRating !== undefined && (data.productivityRating < 1 || data.productivityRating > 5)) {
    errors.push('productivityRating must be between 1 and 5');
  }

  // Validate dates
  if (data.clockInTime && data.clockOutTime) {
    const start = new Date(data.clockInTime);
    const end = new Date(data.clockOutTime);
    if (end <= start) {
      errors.push('clockOutTime must be after clockInTime');
    }
  }

  // Warnings
  if (data.totalHours > 12) {
    warnings.push('Total hours exceeds 12 hours. Please verify this is correct.');
  }

  if (data.hourlyRate > 10000) {
    warnings.push('Hourly rate seems unusually high. Please verify.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Calculate labour entry cost
 * @param {Object} entry - Labour entry object
 * @returns {number} Total cost
 */
export function calculateLabourEntryCost(entry) {
  if (!entry) return 0;

  const regularHours = entry.regularHours || 0;
  const overtimeHours = entry.overtimeHours || 0;
  const hourlyRate = entry.hourlyRate || 0;
  const overtimeRate = hourlyRate * 1.5;

  const regularCost = regularHours * hourlyRate;
  const overtimeCost = overtimeHours * overtimeRate;

  // If daily rate is provided and no hours, use daily rate
  if (entry.dailyRate && entry.dailyRate > 0 && (regularHours + overtimeHours) === 0) {
    return entry.dailyRate;
  }

  return regularCost + overtimeCost;
}

export default {
  LABOUR_ENTRY_SCHEMA,
  VALID_WORKER_TYPES,
  VALID_WORKER_ROLES,
  VALID_SKILL_TYPES,
  VALID_ENTRY_STATUSES,
  VALID_SERVICE_TYPES,
  LABOUR_ENTRY_VALIDATION,
  createLabourEntry,
  validateLabourEntry,
  calculateLabourEntryCost,
};

