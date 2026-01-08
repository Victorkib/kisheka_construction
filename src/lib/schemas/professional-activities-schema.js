/**
 * Professional Activities Schema Definition
 * Centralized schema definition for professional activities (Architect & Engineer activities)
 * Pattern: Similar to material-request-schema.js with approval workflow
 */

import { ObjectId } from 'mongodb';
// Import constants directly at module level to ensure they're available
import {
  ACTIVITY_TYPES as ACTIVITY_TYPES_CONST,
  VISIT_PURPOSES as VISIT_PURPOSES_CONST,
  INSPECTION_TYPES as INSPECTION_TYPES_CONST,
  COMPLIANCE_STATUSES as COMPLIANCE_STATUSES_CONST,
  ISSUE_SEVERITIES as ISSUE_SEVERITIES_CONST,
  ISSUE_STATUSES as ISSUE_STATUSES_CONST,
  TEST_TYPES as TEST_TYPES_CONST,
  TEST_RESULTS as TEST_RESULTS_CONST,
  DOCUMENT_TYPES as DOCUMENT_TYPES_CONST,
} from '@/lib/constants/professional-activities-constants';

/**
 * Professional Activities Schema
 * @typedef {Object} ProfessionalActivitiesSchema
 * @property {ObjectId} professionalServiceId - Link to professional_services (required)
 * @property {ObjectId} libraryId - Denormalized from professional_services
 * @property {ObjectId} projectId - Link to project (required)
 * @property {ObjectId} [phaseId] - Optional: phase this activity relates to
 * @property {ObjectId} [floorId] - Optional: floor-specific activity
 * @property {ObjectId} [templateId] - Optional: template used to create this
 * @property {string} activityCode - Auto-generated: "ACT-{type}-{sequence}"
 * @property {string} activityType - Required: activity type
 * @property {Date} activityDate - Required: date of activity
 * @property {string} [visitPurpose] - For site visits
 * @property {number} [visitDuration] - Hours
 * @property {Array<string>} [attendees] - Names of people present
 * @property {string} [revisionNumber] - For design revisions
 * @property {string} [revisionReason] - For design revisions
 * @property {Array<string>} [affectedAreas] - For design revisions
 * @property {ObjectId} [previousRevisionId] - Link to previous revision
 * @property {string} [inspectionType] - For inspections
 * @property {Array<string>} [areasInspected] - For inspections
 * @property {number} [inspectionDuration] - Hours
 * @property {string} [complianceStatus] - Compliance status
 * @property {boolean} [codeCompliance] - Code compliance
 * @property {boolean} [designCompliance] - Design compliance
 * @property {boolean} [qualityStandards] - Quality standards
 * @property {Array} [issuesFound] - Issues found (for engineers)
 * @property {Array} [materialTests] - Material tests (for engineers)
 * @property {Array} [documents] - Documents uploaded
 * @property {number} [feesCharged] - Fees for this activity
 * @property {number} [expensesIncurred] - Expenses incurred
 * @property {string} [paymentStatus] - Payment status
 * @property {ObjectId} [feeId] - Link to professional_fees
 * @property {string} [notes] - Notes
 * @property {string} [observations] - Site observations
 * @property {string} [recommendations] - Recommendations
 * @property {boolean} [followUpRequired] - Follow-up required
 * @property {Date} [followUpDate] - Follow-up date
 * @property {string} status - Status: 'draft', 'pending_approval', 'approved', 'rejected'
 * @property {boolean} requiresApproval - Requires approval (default: true)
 * @property {ObjectId} [approvedBy] - PM or Owner who approved
 * @property {Date} [approvedAt] - Approval date
 * @property {string} [approvalNotes] - Approval notes
 * @property {Array} [approvalChain] - Approval chain
 * @property {ObjectId} createdBy - Creator user ID
 * @property {string} createdByName - Denormalized creator name
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 */

export const PROFESSIONAL_ACTIVITIES_SCHEMA = {
  professionalServiceId: 'ObjectId', // Required
  libraryId: 'ObjectId', // Denormalized
  projectId: 'ObjectId', // Required
  phaseId: 'ObjectId', // Optional
  floorId: 'ObjectId', // Optional
  templateId: 'ObjectId', // Optional
  activityCode: String, // Auto-generated
  activityType: String, // Required
  activityDate: Date, // Required
  visitPurpose: String, // Optional
  visitDuration: Number, // Optional, hours
  attendees: [String], // Optional
  revisionNumber: String, // Optional
  revisionReason: String, // Optional
  affectedAreas: [String], // Optional
  previousRevisionId: 'ObjectId', // Optional
  inspectionType: String, // Optional
  areasInspected: [String], // Optional
  inspectionDuration: Number, // Optional, hours
  complianceStatus: String, // Optional
  codeCompliance: Boolean, // Optional
  designCompliance: Boolean, // Optional
  qualityStandards: Boolean, // Optional
  issuesFound: [
    {
      issueId: 'ObjectId', // Optional
      description: String, // Required
      severity: String, // Required: 'critical', 'major', 'minor'
      location: String, // Optional
      status: String, // Default: 'identified'
      resolutionDate: Date, // Optional
      resolutionNotes: String, // Optional
      materialId: 'ObjectId', // Optional
    },
  ],
  materialTests: [
    {
      materialId: 'ObjectId', // Optional
      materialName: String, // Required
      testType: String, // Required: 'strength', 'quality', 'specification', 'compliance'
      testResult: String, // Required: 'pass', 'fail', 'conditional'
      testReportUrl: String, // Optional
      testDate: Date, // Optional
    },
  ],
  documents: [
    {
      documentType: String, // Required
      documentName: String, // Required
      documentUrl: String, // Required: Cloudinary URL
      documentVersion: String, // Optional
      uploadedAt: Date, // Required
      uploadedBy: 'ObjectId', // Optional
      description: String, // Optional
    },
  ],
  feesCharged: Number, // Optional, >= 0
  expensesIncurred: Number, // Optional, >= 0
  paymentStatus: String, // Optional: 'pending', 'invoiced', 'paid'
  feeId: 'ObjectId', // Optional
  notes: String, // Optional
  observations: String, // Optional
  recommendations: String, // Optional
  followUpRequired: Boolean, // Default: false
  followUpDate: Date, // Optional
  status: String, // Required: 'draft', 'pending_approval', 'approved', 'rejected'
  requiresApproval: Boolean, // Default: true
  approvedBy: 'ObjectId', // Optional
  approvedAt: Date, // Optional
  approvalNotes: String, // Optional
  approvalChain: [
    {
      approverId: 'ObjectId', // Required
      approverName: String, // Required
      status: String, // Required: 'pending', 'approved', 'rejected'
      notes: String, // Optional
      approvedAt: Date, // Optional
    },
  ],
  createdBy: 'ObjectId', // Required
  createdByName: String, // Denormalized
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date, // Soft delete
};

// Re-export constants from client-safe constants file for server-side compatibility
export {
  ACTIVITY_TYPES,
  VISIT_PURPOSES,
  INSPECTION_TYPES,
  COMPLIANCE_STATUSES,
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  TEST_TYPES,
  TEST_RESULTS,
  DOCUMENT_TYPES,
} from '@/lib/constants/professional-activities-constants';

/**
 * Valid activity statuses (following material_requests pattern)
 */
export const ACTIVITY_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
];

/**
 * Valid payment statuses
 */
export const PAYMENT_STATUSES = ['pending', 'invoiced', 'paid'];

/**
 * Validation rules for professional activities
 */
export const PROFESSIONAL_ACTIVITIES_VALIDATION = {
  professionalServiceId: {
    required: true,
    type: 'ObjectId',
  },
  projectId: {
    required: true,
    type: 'ObjectId',
  },
  activityType: {
    required: true,
    type: 'string',
    enum: ACTIVITY_TYPES_CONST.ALL, // Use imported constant directly
  },
  activityDate: {
    required: true,
    type: 'date',
  },
  status: {
    required: true,
    type: 'string',
    enum: ACTIVITY_STATUSES,
    default: 'draft',
  },
  visitDuration: {
    required: false,
    type: 'number',
    min: 0,
  },
  inspectionDuration: {
    required: false,
    type: 'number',
    min: 0,
  },
  feesCharged: {
    required: false,
    type: 'number',
    min: 0,
  },
  expensesIncurred: {
    required: false,
    type: 'number',
    min: 0,
  },
};

/**
 * Validate professional activity data
 * @param {Object} data - Professional activity data to validate
 * @param {Object} professionalService - Professional service assignment data (for type validation)
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateProfessionalActivity(data, professionalService = null) {
  // Use constants imported at module level
  const ACTIVITY_TYPES = ACTIVITY_TYPES_CONST;
  const VISIT_PURPOSES = VISIT_PURPOSES_CONST;
  const INSPECTION_TYPES = INSPECTION_TYPES_CONST;
  const COMPLIANCE_STATUSES = COMPLIANCE_STATUSES_CONST;
  const ISSUE_SEVERITIES = ISSUE_SEVERITIES_CONST;
  const ISSUE_STATUSES = ISSUE_STATUSES_CONST;
  const TEST_TYPES = TEST_TYPES_CONST;
  const TEST_RESULTS = TEST_RESULTS_CONST;
  const DOCUMENT_TYPES = DOCUMENT_TYPES_CONST;
  
  const errors = [];

  // Required fields
  if (!data.professionalServiceId || !ObjectId.isValid(data.professionalServiceId)) {
    errors.push('Valid professionalServiceId is required');
  }

  if (!data.projectId || !ObjectId.isValid(data.projectId)) {
    errors.push('Valid projectId is required');
  }

  if (!data.activityType || !ACTIVITY_TYPES.ALL.includes(data.activityType)) {
    errors.push(`Activity type is required and must be one of: ${ACTIVITY_TYPES.ALL.join(', ')}`);
  }

  if (!data.activityDate) {
    errors.push('Activity date is required');
  }

  // Validate activity type matches professional type
  if (professionalService) {
    const professionalType = professionalService.type; // 'architect' or 'engineer'
    const validTypes = professionalType === 'architect' 
      ? ACTIVITY_TYPES.ARCHITECT 
      : ACTIVITY_TYPES.ENGINEER;
    
    if (!validTypes.includes(data.activityType)) {
      errors.push(`Activity type '${data.activityType}' is not valid for ${professionalType}. Valid types: ${validTypes.join(', ')}`);
    }
  }

  // Validate visit purpose (for site visits)
  if (data.activityType === 'site_visit' && data.visitPurpose && !VISIT_PURPOSES.includes(data.visitPurpose)) {
    errors.push(`Visit purpose must be one of: ${VISIT_PURPOSES.join(', ')}`);
  }

  // Validate inspection type (for inspections)
  if (data.activityType === 'inspection' && data.inspectionType && !INSPECTION_TYPES.includes(data.inspectionType)) {
    errors.push(`Inspection type must be one of: ${INSPECTION_TYPES.join(', ')}`);
  }

  // Validate compliance status
  if (data.complianceStatus && !COMPLIANCE_STATUSES.includes(data.complianceStatus)) {
    errors.push(`Compliance status must be one of: ${COMPLIANCE_STATUSES.join(', ')}`);
  }

  // Validate issues
  if (data.issuesFound && Array.isArray(data.issuesFound)) {
    data.issuesFound.forEach((issue, index) => {
      if (!issue.description || issue.description.trim().length < 1) {
        errors.push(`Issue ${index + 1}: description is required`);
      }
      if (!issue.severity || !ISSUE_SEVERITIES.includes(issue.severity)) {
        errors.push(`Issue ${index + 1}: severity must be one of: ${ISSUE_SEVERITIES.join(', ')}`);
      }
      if (issue.status && !ISSUE_STATUSES.includes(issue.status)) {
        errors.push(`Issue ${index + 1}: status must be one of: ${ISSUE_STATUSES.join(', ')}`);
      }
    });
  }

  // Validate material tests
  if (data.materialTests && Array.isArray(data.materialTests)) {
    data.materialTests.forEach((test, index) => {
      if (!test.materialName || test.materialName.trim().length < 1) {
        errors.push(`Material test ${index + 1}: material name is required`);
      }
      if (!test.testType || !TEST_TYPES.includes(test.testType)) {
        errors.push(`Material test ${index + 1}: test type must be one of: ${TEST_TYPES.join(', ')}`);
      }
      if (!test.testResult || !TEST_RESULTS.includes(test.testResult)) {
        errors.push(`Material test ${index + 1}: test result must be one of: ${TEST_RESULTS.join(', ')}`);
      }
    });
  }

  // Validate documents
  if (data.documents && Array.isArray(data.documents)) {
    data.documents.forEach((doc, index) => {
      if (!doc.documentType || !DOCUMENT_TYPES.includes(doc.documentType)) {
        errors.push(`Document ${index + 1}: document type must be one of: ${DOCUMENT_TYPES.join(', ')}`);
      }
      if (!doc.documentName || doc.documentName.trim().length < 1) {
        errors.push(`Document ${index + 1}: document name is required`);
      }
      if (!doc.documentUrl || doc.documentUrl.trim().length < 1) {
        errors.push(`Document ${index + 1}: document URL is required`);
      }
    });
  }

  // Validate financial fields
  if (data.feesCharged !== undefined && data.feesCharged < 0) {
    errors.push('Fees charged must be >= 0');
  }

  if (data.expensesIncurred !== undefined && data.expensesIncurred < 0) {
    errors.push('Expenses incurred must be >= 0');
  }

  // Validate status
  if (!data.status || !ACTIVITY_STATUSES.includes(data.status)) {
    errors.push(`Status must be one of: ${ACTIVITY_STATUSES.join(', ')}`);
  }

  // Validate payment status
  if (data.paymentStatus && !PAYMENT_STATUSES.includes(data.paymentStatus)) {
    errors.push(`Payment status must be one of: ${PAYMENT_STATUSES.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate activity code
 * @param {string} type - Professional type: 'architect' or 'engineer'
 * @param {number} sequence - Sequence number
 * @returns {string} Activity code (e.g., "ACT-ARCH-001" or "ACT-ENG-001")
 */
export function generateActivityCode(type, sequence) {
  const prefix = type === 'architect' ? 'ARCH' : 'ENG';
  const sequenceStr = String(sequence).padStart(6, '0');
  return `ACT-${prefix}-${sequenceStr}`;
}

