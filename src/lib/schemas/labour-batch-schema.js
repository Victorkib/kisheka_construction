/**
 * Labour Batch Schema Definition
 * Centralized schema for labour entry batches (bulk operations)
 */

import { ObjectId } from 'mongodb';

/**
 * Labour Batch Schema
 * @typedef {Object} LabourBatchSchema
 * @property {ObjectId} _id - Batch ID
 * @property {string} batchNumber - Auto-generated: LABOUR-YYYYMMDD-001 (unique)
 * @property {string} [batchName] - Optional user-defined name
 * @property {ObjectId} projectId - Project ID (required, indexed)
 * @property {ObjectId} [defaultPhaseId] - Default phase ID (optional, null for indirect labour batches)
 * @property {ObjectId} [defaultFloorId] - Default floor ID (optional)
 * @property {ObjectId} [defaultCategoryId] - Default category ID (optional)
 * @property {Date} [defaultDate] - Default entry date for all entries
 * @property {string} entryType - 'time_based' | 'task_based' | 'professional_service' | 'mixed' (required)
 * @property {string} [defaultWorkerRole] - Default worker role (optional)
 * @property {boolean} isIndirectLabour - NEW: Whether all entries in this batch are indirect labour (default: false)
 * @property {string} [indirectCostCategory] - NEW: Category for indirect costs (siteOverhead, utilities, transportation, safetyCompliance) - only if isIndirectLabour is true
 * @property {ObjectId[]} labourEntryIds - Array of labour entry IDs
 * @property {number} totalEntries - Count of entries
 * @property {number} totalHours - Sum of all hours
 * @property {number} totalCost - Sum of all costs
 * @property {string} status - 'draft' | 'submitted' | 'approved' | 'partially_paid' | 'fully_paid' | 'rejected' | 'cancelled'
 * @property {boolean} autoApproved - true for owner (auto-approval)
 * @property {ObjectId} [approvedBy] - Owner ID who approved
 * @property {Date} [approvedAt] - Approval timestamp
 * @property {string} [approvalNotes] - Approval notes
 * @property {ObjectId} createdBy - Creator user ID (required)
 * @property {string} createdByName - Denormalized creator name
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 */

export const LABOUR_BATCH_SCHEMA = {
  batchNumber: String, // Auto-generated: LABOUR-YYYYMMDD-001
  batchName: String, // Optional
  projectId: 'ObjectId', // Required
  defaultPhaseId: 'ObjectId', // Optional (null for indirect labour batches)
  defaultFloorId: 'ObjectId', // Optional
  defaultCategoryId: 'ObjectId', // Optional
  defaultDate: Date, // Optional
  entryType: String, // Required: 'time_based' | 'task_based' | 'professional_service' | 'mixed'
  defaultWorkerRole: String, // Optional
  isIndirectLabour: Boolean, // NEW: Whether this batch is all indirect labour (default: false)
  indirectCostCategory: String, // NEW: Category for indirect costs (only if isIndirectLabour is true)
  labourEntryIds: ['ObjectId'], // Array of entry IDs
  totalEntries: Number, // Count
  totalHours: Number, // Sum
  totalCost: Number, // Sum
  status: String, // Required
  autoApproved: Boolean, // true for owner
  approvedBy: 'ObjectId', // Optional
  approvedAt: Date, // Optional
  approvalNotes: String, // Optional
  createdBy: 'ObjectId', // Required
  createdByName: String, // Denormalized
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date, // Soft delete
};

/**
 * Valid batch statuses
 */
export const VALID_BATCH_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'partially_paid',
  'fully_paid',
  'rejected',
  'cancelled',
];

/**
 * Valid entry types
 */
export const VALID_ENTRY_TYPES = [
  'time_based',
  'task_based',
  'professional_service',
  'mixed',
];

/**
 * Validation rules for labour batches
 */
export const LABOUR_BATCH_VALIDATION = {
  batchNumber: {
    required: false, // Auto-generated
    type: 'string',
    pattern: /^LABOUR-\d{8}-\d{3}$/,
  },
  projectId: {
    required: true,
    type: 'ObjectId',
  },
  createdBy: {
    required: true,
    type: 'ObjectId',
  },
  entryType: {
    required: true,
    type: 'string',
    enum: VALID_ENTRY_TYPES,
  },
  status: {
    required: true,
    type: 'string',
    enum: VALID_BATCH_STATUSES,
    default: 'draft',
  },
};

/**
 * Validate labour batch data
 * @param {Object} data - Batch data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateLabourBatch(data) {
  const errors = [];

  // Required fields
  if (!data.projectId || !ObjectId.isValid(data.projectId)) {
    errors.push('Valid projectId is required');
  }

  if (!data.createdBy || !ObjectId.isValid(data.createdBy)) {
    errors.push('Valid createdBy is required');
  }

  if (!data.entryType || !VALID_ENTRY_TYPES.includes(data.entryType)) {
    errors.push(`entryType is required and must be one of: ${VALID_ENTRY_TYPES.join(', ')}`);
  }

  if (data.status && !VALID_BATCH_STATUSES.includes(data.status)) {
    errors.push(`status must be one of: ${VALID_BATCH_STATUSES.join(', ')}`);
  }

  // Validate labour entries array
  if (data.labourEntries && Array.isArray(data.labourEntries)) {
    if (data.labourEntries.length === 0) {
      errors.push('At least one labour entry is required');
    }

    // Validate each entry (basic validation)
    data.labourEntries.forEach((entry, index) => {
      if (!entry.workerName || entry.workerName.trim().length < 2) {
        errors.push(`Entry ${index + 1}: workerName is required and must be at least 2 characters`);
      }
      if (!entry.skillType) {
        errors.push(`Entry ${index + 1}: skillType is required`);
      }
      if (entry.hourlyRate === undefined || entry.hourlyRate === null || isNaN(entry.hourlyRate) || entry.hourlyRate < 0) {
        errors.push(`Entry ${index + 1}: hourlyRate is required and must be >= 0`);
      }
      if (entry.totalHours === undefined || entry.totalHours === null || isNaN(entry.totalHours) || entry.totalHours < 0) {
        errors.push(`Entry ${index + 1}: totalHours is required and must be >= 0`);
      }
    });
  }

  // If batch is marked as indirect, require indirectCostCategory
  if (data.isIndirectLabour) {
    const VALID_INDIRECT_CATEGORIES = ['utilities', 'siteOverhead', 'transportation', 'safetyCompliance'];
    if (!data.indirectCostCategory || !VALID_INDIRECT_CATEGORIES.includes(data.indirectCostCategory)) {
      errors.push(`indirectCostCategory is required for indirect labour batches and must be one of: ${VALID_INDIRECT_CATEGORIES.join(', ')}`);
    }
    // Ensure defaultPhaseId is not provided for indirect batches
    if (data.defaultPhaseId && ObjectId.isValid(data.defaultPhaseId)) {
      errors.push('defaultPhaseId must be empty (null) for indirect labour batches');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create labour batch object
 * @param {Object} input - Batch input data
 * @param {ObjectId} createdBy - Creator user ID
 * @param {string} createdByName - Creator name
 * @returns {Object} Labour batch object
 */
export function createLabourBatch(input, createdBy, createdByName) {
  const {
    batchName,
    projectId,
    defaultPhaseId,
    defaultFloorId,
    defaultCategoryId,
    defaultDate,
    entryType,
    defaultWorkerRole,
    labourEntries = [],
    status = 'draft',
  } = input;

  // Calculate totals from entries
  const totalEntries = labourEntries.length;
  const totalHours = labourEntries.reduce((sum, entry) => sum + (parseFloat(entry.totalHours) || 0), 0);
  const totalCost = labourEntries.reduce((sum, entry) => {
    const regularCost = (entry.regularHours || 0) * (entry.hourlyRate || 0);
    const overtimeCost = (entry.overtimeHours || 0) * (entry.hourlyRate || 0) * 1.5;
    return sum + regularCost + overtimeCost;
  }, 0);

  return {
    batchNumber: null, // Will be generated by API
    batchName: batchName?.trim() || null,
    projectId: ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId,
    defaultPhaseId: defaultPhaseId && ObjectId.isValid(defaultPhaseId) ? new ObjectId(defaultPhaseId) : null,
    isIndirectLabour: input.isIndirectLabour === true,
    indirectCostCategory: input.indirectCostCategory || null,
    defaultFloorId: defaultFloorId && ObjectId.isValid(defaultFloorId) ? new ObjectId(defaultFloorId) : null,
    defaultCategoryId: defaultCategoryId && ObjectId.isValid(defaultCategoryId) ? new ObjectId(defaultCategoryId) : null,
    defaultDate: defaultDate ? new Date(defaultDate) : new Date(),
    entryType: entryType || 'time_based',
    defaultWorkerRole: defaultWorkerRole || null,
    labourEntryIds: [], // Will be populated when entries are created
    totalEntries,
    totalHours: parseFloat(totalHours.toFixed(2)),
    totalCost: parseFloat(totalCost.toFixed(2)),
    status,
    autoApproved: false, // Will be set to true for owner
    approvedBy: null,
    approvedAt: null,
    approvalNotes: null,
    createdBy: ObjectId.isValid(createdBy) ? new ObjectId(createdBy) : createdBy,
    createdByName: createdByName || '',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

/**
 * Generate batch number
 * @param {Date} [date] - Date to use (defaults to today)
 * @returns {Promise<string>} Batch number
 */
export async function generateBatchNumber(date = new Date()) {
  const { getDatabase } = await import('@/lib/mongodb/connection');
  const db = await getDatabase();

  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `LABOUR-${dateStr}`;

  // Find the highest sequence number for today
  const todayStart = new Date(date);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(date);
  todayEnd.setHours(23, 59, 59, 999);

  const lastBatch = await db.collection('labour_batches').findOne(
    {
      batchNumber: { $regex: `^${prefix}-` },
      createdAt: { $gte: todayStart, $lte: todayEnd },
    },
    { sort: { batchNumber: -1 } }
  );

  let sequence = 1;
  if (lastBatch && lastBatch.batchNumber) {
    const lastSequence = parseInt(lastBatch.batchNumber.split('-').pop(), 10);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

export default {
  LABOUR_BATCH_SCHEMA,
  VALID_BATCH_STATUSES,
  VALID_ENTRY_TYPES,
  LABOUR_BATCH_VALIDATION,
  createLabourBatch,
  validateLabourBatch,
  generateBatchNumber,
};

