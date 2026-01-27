/**
 * Supervisor Submission Schema Definition
 * Handles supervisor data submissions from multiple channels
 */

import { ObjectId } from 'mongodb';

/**
 * Supervisor Submission Schema
 * @typedef {Object} SupervisorSubmissionSchema
 * @property {ObjectId} _id - Submission ID
 * @property {string} submissionNumber - Auto-generated: SUB-YYYYMMDD-001 (unique)
 * @property {string} submissionChannel - 'whatsapp' | 'email' | 'sms' | 'in_person' (required)
 * @property {Object} submissionData - Raw and parsed submission data
 * @property {ObjectId} projectId - Project ID (required)
 * @property {ObjectId} phaseId - Phase ID (required)
 * @property {ObjectId} [floorId] - Floor ID (optional)
 * @property {ObjectId} [workItemId] - Work item ID (optional)
 * @property {Date} entryDate - Entry date (required)
 * @property {Array<Object>} labourEntries - Array of parsed worker data
 * @property {string} status - 'draft' | 'pending_review' | 'approved' | 'rejected' | 'processed'
 * @property {string} submittedBy - Supervisor name/contact
 * @property {Date} submittedAt - Submission timestamp
 * @property {ObjectId} [reviewedBy] - Owner ID who reviewed
 * @property {Date} [reviewedAt] - Review timestamp
 * @property {string} [reviewNotes] - Review notes
 * @property {Array<Object>} [corrections] - Corrections made by owner
 * @property {ObjectId} [labourBatchId] - Labour batch ID if approved
 * @property {string} [labourBatchNumber] - Denormalized batch number
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

export const SUPERVISOR_SUBMISSION_SCHEMA = {
  submissionNumber: String, // Auto-generated: SUB-YYYYMMDD-001
  submissionChannel: String, // Required: 'whatsapp' | 'email' | 'sms' | 'in_person'
  submissionData: {
    rawText: String, // Original message/text
    parsedData: Object, // Parsed worker data
    attachments: [String], // File URLs if any
    senderInfo: {
      phone: String, // WhatsApp/SMS phone
      email: String, // Email address
      name: String, // Supervisor name
    },
  },
  projectId: 'ObjectId', // Required
  phaseId: 'ObjectId', // Required
  floorId: 'ObjectId', // Optional
  categoryId: 'ObjectId', // Optional
  workItemId: 'ObjectId', // Optional
  entryDate: Date, // Required
  labourEntries: [
    {
      workerName: String,
      skillType: String,
      hours: Number,
      hourlyRate: Number,
      taskDescription: String,
      workerType: String,
      workerRole: String,
      workItemId: 'ObjectId', // Optional: link entry to work item
      // Additional fields as needed
    },
  ],
  status: String, // Required
  submittedBy: String, // Required
  submittedAt: Date, // Required
  reviewedBy: 'ObjectId', // Optional
  reviewedAt: Date, // Optional
  reviewNotes: String, // Optional
  corrections: [
    {
      field: String,
      originalValue: String,
      correctedValue: String,
    },
  ],
  labourBatchId: 'ObjectId', // Optional
  labourBatchNumber: String, // Optional
  createdAt: Date,
  updatedAt: Date,
};

/**
 * Valid submission channels
 */
export const VALID_SUBMISSION_CHANNELS = ['whatsapp', 'email', 'sms', 'in_person'];

/**
 * Valid submission statuses
 */
export const VALID_SUBMISSION_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'processed',
];

/**
 * Validation rules for supervisor submissions
 */
export const SUPERVISOR_SUBMISSION_VALIDATION = {
  submissionChannel: {
    required: true,
    type: 'string',
    enum: VALID_SUBMISSION_CHANNELS,
  },
  projectId: {
    required: true,
    type: 'ObjectId',
  },
  phaseId: {
    required: true,
    type: 'ObjectId',
  },
  entryDate: {
    required: true,
    type: 'Date',
  },
  submittedBy: {
    required: true,
    type: 'string',
    minLength: 2,
  },
  status: {
    required: true,
    type: 'string',
    enum: VALID_SUBMISSION_STATUSES,
    default: 'draft',
  },
};

/**
 * Validate supervisor submission data
 * @param {Object} data - Submission data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateSupervisorSubmission(data) {
  const errors = [];

  // Required fields
  if (!data.submissionChannel || !VALID_SUBMISSION_CHANNELS.includes(data.submissionChannel)) {
    errors.push(`submissionChannel is required and must be one of: ${VALID_SUBMISSION_CHANNELS.join(', ')}`);
  }

  if (!data.projectId || !ObjectId.isValid(data.projectId)) {
    errors.push('Valid projectId is required');
  }

  if (!data.phaseId || !ObjectId.isValid(data.phaseId)) {
    errors.push('Valid phaseId is required');
  }

  if (data.workItemId && !ObjectId.isValid(data.workItemId)) {
    errors.push('workItemId must be a valid ObjectId');
  }

  if (!data.entryDate) {
    errors.push('entryDate is required');
  }

  if (!data.submittedBy || data.submittedBy.trim().length < 2) {
    errors.push('submittedBy is required and must be at least 2 characters');
  }

  // Validate labour entries
  if (data.labourEntries && Array.isArray(data.labourEntries)) {
    if (data.labourEntries.length === 0) {
      errors.push('At least one labour entry is required');
    }

    data.labourEntries.forEach((entry, index) => {
      if (!entry.workerName || entry.workerName.trim().length < 2) {
        errors.push(`Entry ${index + 1}: workerName is required and must be at least 2 characters`);
      }
      if (!entry.skillType) {
        errors.push(`Entry ${index + 1}: skillType is required`);
      }
      if (entry.hours === undefined || entry.hours === null || isNaN(entry.hours) || entry.hours <= 0) {
        errors.push(`Entry ${index + 1}: hours is required and must be > 0`);
      }
      if (entry.hourlyRate === undefined || entry.hourlyRate === null || isNaN(entry.hourlyRate) || entry.hourlyRate < 0) {
        errors.push(`Entry ${index + 1}: hourlyRate is required and must be >= 0`);
      }
      if (entry.workItemId && !ObjectId.isValid(entry.workItemId)) {
        errors.push(`Entry ${index + 1}: workItemId must be a valid ObjectId`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate submission number
 * @param {Date} [date] - Date to use (defaults to today)
 * @returns {Promise<string>} Submission number
 */
export async function generateSubmissionNumber(date = new Date()) {
  const { getDatabase } = await import('@/lib/mongodb/connection');
  const db = await getDatabase();

  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `SUB-${dateStr}`;

  // Find the highest sequence number for today
  const todayStart = new Date(date);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(date);
  todayEnd.setHours(23, 59, 59, 999);

  const lastSubmission = await db.collection('supervisor_submissions').findOne(
    {
      submissionNumber: { $regex: `^${prefix}-` },
      createdAt: { $gte: todayStart, $lte: todayEnd },
    },
    { sort: { submissionNumber: -1 } }
  );

  let sequence = 1;
  if (lastSubmission && lastSubmission.submissionNumber) {
    const lastSequence = parseInt(lastSubmission.submissionNumber.split('-').pop(), 10);
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Create supervisor submission object
 * @param {Object} input - Submission input data
 * @returns {Object} Supervisor submission object
 */
export function createSupervisorSubmission(input) {
  const {
    submissionChannel,
    submissionData,
    projectId,
    phaseId,
    floorId,
    categoryId,
    entryDate,
    labourEntries = [],
    submittedBy,
    status = 'draft',
  } = input;

  return {
    submissionNumber: null, // Will be generated by API
    submissionChannel: submissionChannel || 'in_person',
    submissionData: {
      rawText: submissionData?.rawText || '',
      parsedData: submissionData?.parsedData || {},
      attachments: submissionData?.attachments || [],
      senderInfo: {
        phone: submissionData?.senderInfo?.phone || null,
        email: submissionData?.senderInfo?.email || null,
        name: submissionData?.senderInfo?.name || submittedBy || '',
      },
    },
    projectId: ObjectId.isValid(projectId) ? new ObjectId(projectId) : projectId,
    phaseId: ObjectId.isValid(phaseId) ? new ObjectId(phaseId) : phaseId,
    floorId: floorId && ObjectId.isValid(floorId) ? new ObjectId(floorId) : null,
    categoryId: categoryId && ObjectId.isValid(categoryId) ? new ObjectId(categoryId) : null,
  workItemId: workItemId && ObjectId.isValid(workItemId) ? new ObjectId(workItemId) : null,
    entryDate: entryDate ? new Date(entryDate) : new Date(),
    labourEntries: Array.isArray(labourEntries)
      ? labourEntries.map((entry) => ({
          workerName: entry.workerName?.trim() || '',
          skillType: entry.skillType || 'general_worker',
          hours: parseFloat(entry.hours) || 0,
          hourlyRate: parseFloat(entry.hourlyRate) || 0,
          taskDescription: entry.taskDescription?.trim() || '',
          workerType: entry.workerType || 'internal',
          workerRole: entry.workerRole || 'skilled',
        }))
      : [],
    status: status || 'draft',
    submittedBy: submittedBy?.trim() || '',
    submittedAt: new Date(),
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    corrections: [],
    labourBatchId: null,
    labourBatchNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export default {
  SUPERVISOR_SUBMISSION_SCHEMA,
  VALID_SUBMISSION_CHANNELS,
  VALID_SUBMISSION_STATUSES,
  SUPERVISOR_SUBMISSION_VALIDATION,
  validateSupervisorSubmission,
  generateSubmissionNumber,
  createSupervisorSubmission,
};

