/**
 * Professional Services (Project Assignments) Schema Definition
 * Schema for professional service assignments to projects
 * Pattern: Similar to suppliers, but for professional services
 */

import { ObjectId } from 'mongodb';
// Import constants directly to avoid module resolution issues
import {
  CONTRACT_TYPES as CONTRACT_TYPES_CONST,
  PAYMENT_SCHEDULES as PAYMENT_SCHEDULES_CONST,
  VISIT_FREQUENCIES as VISIT_FREQUENCIES_CONST,
  PROFESSIONAL_SERVICE_STATUSES as PROFESSIONAL_SERVICE_STATUSES_CONST,
  PAYMENT_STATUSES as PAYMENT_STATUSES_CONST,
  PROFESSIONAL_TYPES as PROFESSIONAL_TYPES_CONST_IMPORT,
} from '@/lib/constants/professional-services-constants';

// Re-export PROFESSIONAL_TYPES for backward compatibility (no circular dependency)
export const PROFESSIONAL_TYPES = PROFESSIONAL_TYPES_CONST_IMPORT;

/**
 * Professional Services (Project Assignments) Schema
 * @typedef {Object} ProfessionalServicesSchema
 * @property {ObjectId} libraryId - Link to professional_services_library (required)
 * @property {ObjectId} projectId - Link to project (required)
 * @property {ObjectId} [phaseId] - Optional: primary phase assignment
 * @property {string} professionalCode - Auto-generated code (e.g., "ARCH-PROJ001-001")
 * @property {string} type - Denormalized from library: 'architect' or 'engineer'
 * @property {Date} assignedDate - When assigned to project (required)
 * @property {string} contractType - Contract type (required)
 * @property {number} contractValue - Total contract amount (required, > 0)
 * @property {string} paymentSchedule - Payment schedule (required)
 * @property {string} [visitFrequency] - For engineers: visit frequency
 * @property {Date} contractStartDate - Contract start date (required)
 * @property {Date} [contractEndDate] - Optional contract end date
 * @property {string} [contractDocumentUrl] - Cloudinary URL to contract document
 * @property {string} [paymentTerms] - Payment terms (e.g., "Net 30")
 * @property {Array} [milestonePayments] - Milestone-based payments array
 * @property {number} totalFees - Total fees paid/committed (default: 0)
 * @property {number} feesPaid - Amount paid so far (default: 0)
 * @property {number} feesPending - Amount pending (default: 0)
 * @property {number} expensesIncurred - Site visit expenses (default: 0)
 * @property {number} totalActivities - Total activities logged (default: 0)
 * @property {number} totalSiteVisits - For architects (default: 0)
 * @property {number} totalInspections - For engineers (default: 0)
 * @property {number} documentsUploaded - Documents uploaded (default: 0)
 * @property {number} revisionsMade - For architects (default: 0)
 * @property {number} issuesIdentified - For engineers (default: 0)
 * @property {number} issuesResolved - For engineers (default: 0)
 * @property {Date} [lastActivityDate] - Last activity date
 * @property {string} status - Status: 'active', 'completed', 'terminated', 'on_hold'
 * @property {boolean} isActive - Computed from status (default: true)
 * @property {string} [notes] - Assignment notes
 * @property {ObjectId} createdBy - Creator user ID
 * @property {string} createdByName - Denormalized creator name
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 */

export const PROFESSIONAL_SERVICES_SCHEMA = {
  libraryId: 'ObjectId', // Required, link to professional_services_library
  projectId: 'ObjectId', // Required, link to project
  phaseId: 'ObjectId', // Optional: primary phase assignment
  professionalCode: String, // Auto-generated
  type: String, // Denormalized: 'architect' or 'engineer'
  assignedDate: Date, // Required
  contractType: String, // Required
  contractValue: Number, // Required, > 0
  paymentSchedule: String, // Required
  visitFrequency: String, // Optional, for engineers
  contractStartDate: Date, // Required
  contractEndDate: Date, // Optional
  contractDocumentUrl: String, // Optional, Cloudinary URL
  paymentTerms: String, // Optional
  milestonePayments: [
    {
      milestoneName: String,
      milestoneDate: Date,
      paymentAmount: Number,
      paymentStatus: String, // 'pending', 'invoiced', 'paid'
      paidDate: Date,
    },
  ],
  totalFees: Number, // Default: 0
  feesPaid: Number, // Default: 0
  feesPending: Number, // Default: 0
  expensesIncurred: Number, // Default: 0
  totalActivities: Number, // Default: 0
  totalSiteVisits: Number, // Default: 0, for architects
  totalInspections: Number, // Default: 0, for engineers
  documentsUploaded: Number, // Default: 0
  revisionsMade: Number, // Default: 0, for architects
  issuesIdentified: Number, // Default: 0, for engineers
  issuesResolved: Number, // Default: 0, for engineers
  lastActivityDate: Date, // Optional
  status: String, // Required: 'active', 'completed', 'terminated', 'on_hold'
  isActive: Boolean, // Default: true, computed from status
  notes: String, // Optional
  createdBy: 'ObjectId', // Required
  createdByName: String, // Denormalized creator name
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date, // Soft delete
};

// Re-export constants from client-safe constants file for server-side compatibility
export {
  PROFESSIONAL_SERVICE_STATUSES,
  PAYMENT_STATUSES,
} from '@/lib/constants/professional-services-constants';

/**
 * Validation rules for professional services (assignments)
 */
export const PROFESSIONAL_SERVICES_VALIDATION = {
  libraryId: {
    required: true,
    type: 'ObjectId',
  },
  projectId: {
    required: true,
    type: 'ObjectId',
  },
  phaseId: {
    required: false,
    type: 'ObjectId',
  },
  contractType: {
    required: true,
    type: 'string',
    enum: CONTRACT_TYPES_CONST.ALL, // Use imported constant directly
  },
  contractValue: {
    required: true,
    type: 'number',
    min: 0.01, // Must be greater than 0
  },
  paymentSchedule: {
    required: true,
    type: 'string',
    enum: PAYMENT_SCHEDULES_CONST, // Use imported constant directly
  },
  visitFrequency: {
    required: false,
    type: 'string',
    enum: VISIT_FREQUENCIES_CONST, // Use imported constant directly
  },
  contractStartDate: {
    required: true,
    type: 'date',
  },
  contractEndDate: {
    required: false,
    type: 'date',
  },
  status: {
    required: true,
    type: 'string',
    enum: PROFESSIONAL_SERVICE_STATUSES_CONST, // Use imported constant directly
  },
};

/**
 * Validate professional services (assignment) data
 * @param {Object} data - Professional services assignment data to validate
 * @param {Object} libraryData - Professional library data (for type validation)
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateProfessionalServices(data, libraryData = null) {
  // Use constants imported at module level
  const CONTRACT_TYPES = CONTRACT_TYPES_CONST;
  const PAYMENT_SCHEDULES = PAYMENT_SCHEDULES_CONST;
  const VISIT_FREQUENCIES = VISIT_FREQUENCIES_CONST;
  
  const errors = [];

  // Required fields
  if (!data.libraryId || !ObjectId.isValid(data.libraryId)) {
    errors.push('Valid libraryId is required');
  }

  if (!data.projectId || !ObjectId.isValid(data.projectId)) {
    errors.push('Valid projectId is required');
  }

  if (data.phaseId && !ObjectId.isValid(data.phaseId)) {
    errors.push('Valid phaseId is required if provided');
  }

  if (!data.contractType || !CONTRACT_TYPES.ALL.includes(data.contractType)) {
    errors.push(`Contract type is required and must be one of: ${CONTRACT_TYPES.ALL.join(', ')}`);
  }

  if (!data.contractValue || data.contractValue <= 0) {
    errors.push('Contract value is required and must be greater than 0');
  }

  if (!data.paymentSchedule || !PAYMENT_SCHEDULES.includes(data.paymentSchedule)) {
    errors.push(`Payment schedule is required and must be one of: ${PAYMENT_SCHEDULES.join(', ')}`);
  }

  if (!data.contractStartDate) {
    errors.push('Contract start date is required');
  }

  // Validate contract end date is after start date
  if (data.contractStartDate && data.contractEndDate) {
    const startDate = new Date(data.contractStartDate);
    const endDate = new Date(data.contractEndDate);
    if (endDate <= startDate) {
      errors.push('Contract end date must be after contract start date');
    }
  }

  // Validate visit frequency (only for engineers)
  if (libraryData && libraryData.type === 'engineer') {
    if (data.visitFrequency && !VISIT_FREQUENCIES.includes(data.visitFrequency)) {
      errors.push(`Visit frequency must be one of: ${VISIT_FREQUENCIES.join(', ')}`);
    }
  }

  // Use status constants
  const PROFESSIONAL_SERVICE_STATUSES = PROFESSIONAL_SERVICE_STATUSES_CONST;
  const PAYMENT_STATUSES = PAYMENT_STATUSES_CONST;
  
  // Validate status
  if (!data.status || !PROFESSIONAL_SERVICE_STATUSES.includes(data.status)) {
    errors.push(`Status is required and must be one of: ${PROFESSIONAL_SERVICE_STATUSES.join(', ')}`);
  }

  // Validate milestone payments
  if (data.milestonePayments && Array.isArray(data.milestonePayments)) {
    data.milestonePayments.forEach((milestone, index) => {
      if (!milestone.milestoneName || milestone.milestoneName.trim().length < 1) {
        errors.push(`Milestone ${index + 1}: milestone name is required`);
      }
      if (!milestone.milestoneDate) {
        errors.push(`Milestone ${index + 1}: milestone date is required`);
      }
      if (!milestone.paymentAmount || milestone.paymentAmount <= 0) {
        errors.push(`Milestone ${index + 1}: payment amount must be greater than 0`);
      }
      if (milestone.paymentStatus && !PAYMENT_STATUSES.includes(milestone.paymentStatus)) {
        errors.push(`Milestone ${index + 1}: payment status must be one of: ${PAYMENT_STATUSES.join(', ')}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate professional code
 * @param {string} projectCode - Project code
 * @param {string} type - 'architect' or 'engineer'
 * @param {number} sequence - Sequence number
 * @returns {string} Professional code (e.g., "ARCH-PROJ001-001")
 */
export function generateProfessionalCode(projectCode, type, sequence) {
  const prefix = type === 'architect' ? 'ARCH' : 'ENG';
  const projectCodeShort = projectCode.substring(0, 8).toUpperCase();
  const sequenceStr = String(sequence).padStart(3, '0');
  return `${prefix}-${projectCodeShort}-${sequenceStr}`;
}

