/**
 * Activity Template Schema Definition
 * Schema for saving and reusing professional activity configurations
 * Pattern: Similar to material-template-schema.js
 */

import { ObjectId } from 'mongodb';
import { PROJECT_PHASES } from './material-template-schema';

// Import constants directly at module level to ensure they're available
import {
  TEMPLATE_STATUS,
  TEMPLATE_CATEGORY_TYPES,
  TEMPLATE_PROFESSIONAL_TYPES,
  getActivityTypesForProfessionalType,
} from '@/lib/constants/activity-template-constants';

import {
  ACTIVITY_TYPES as ACTIVITY_TYPES_CONST,
  VISIT_PURPOSES as VISIT_PURPOSES_CONST,
  INSPECTION_TYPES as INSPECTION_TYPES_CONST,
  COMPLIANCE_STATUSES as COMPLIANCE_STATUSES_CONST,
} from '@/lib/constants/professional-activities-constants';

// Re-export constants from client-safe constants file for server-side compatibility
export {
  TEMPLATE_STATUS,
  TEMPLATE_CATEGORY_TYPES,
  TEMPLATE_PROFESSIONAL_TYPES,
  getActivityTypesForProfessionalType,
};

// Re-export activity constants for validation
export {
  ACTIVITY_TYPES,
  VISIT_PURPOSES,
  INSPECTION_TYPES,
  COMPLIANCE_STATUSES,
} from '@/lib/constants/professional-activities-constants';

/**
 * Activity Template Schema
 * @typedef {Object} ActivityTemplateSchema
 * @property {string} name - Template name (required, min 2 chars, max 200)
 * @property {string} [description] - Optional description
 * @property {string} type - Required: 'architect_activity' or 'engineer_activity'
 * @property {string} activityType - Required: activity type
 * @property {boolean} isPublic - Can others use it (default: false)
 * @property {string} [status] - Template status: 'official', 'community', 'private', 'deprecated'
 * @property {string} [templateCategory] - Category type: 'construction_phase', 'work_category', 'project_type'
 * @property {string} [templateType] - Specific type within category
 * @property {Array<string>} [tags] - Tags for filtering and search
 * @property {string} [projectPhase] - Project phase this template applies to
 * @property {Array<number>|string} [applicableFloors] - Floors this template applies to, or 'all'
 * @property {Object} [defaultData] - Pre-filled activity data
 * @property {number} [defaultFeeAmount] - Optional, default fee for this activity type
 * @property {number} [defaultExpenseAmount] - Optional, default expense amount
 * @property {number} usageCount - How many times used (default: 0)
 * @property {Date} [lastUsedAt] - Last time used
 * @property {ObjectId} [lastUsedBy] - Last user who used it
 * @property {ObjectId} [lastUsedInProject] - Last project where used
 * @property {ObjectId} [validatedBy] - OWNER who validated (for official templates)
 * @property {Date} [validatedAt] - When template was validated
 * @property {string} [validationStatus] - 'valid', 'needs_review', 'outdated'
 * @property {Date} [expiresAt] - Expiration date for cost-sensitive templates
 * @property {ObjectId} createdBy - User who created the template
 * @property {string} createdByName - Denormalized creator name
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 */

export const ACTIVITY_TEMPLATE_SCHEMA = {
  name: String, // Required, min 2 chars, max 200
  description: String, // Optional
  type: String, // Required: 'architect_activity' or 'engineer_activity'
  activityType: String, // Required: activity type
  isPublic: Boolean, // Default: false
  status: String, // 'official', 'community', 'private', 'deprecated'
  templateCategory: String, // Optional: 'construction_phase', 'work_category', 'project_type'
  templateType: String, // Optional: specific type within category
  tags: [String], // Optional: array of tags
  projectPhase: String, // Optional: from PROJECT_PHASES
  applicableFloors: [Number], // Optional: array of floor numbers, or can be 'all'
  defaultData: {
    visitPurpose: String, // Optional, for site visits
    visitDuration: Number, // Optional, hours
    inspectionType: String, // Optional, for inspections
    areasInspected: [String], // Optional, default areas
    complianceStatus: String, // Optional, default compliance status
    notes: String, // Optional, default notes
    observations: String, // Optional, default observations
    recommendations: String, // Optional, default recommendations
    attendees: [String], // Optional, default attendees
    affectedAreas: [String], // Optional, for design revisions
    revisionReason: String, // Optional, for design revisions
  },
  defaultFeeAmount: Number, // Optional, >= 0
  defaultExpenseAmount: Number, // Optional, >= 0
  usageCount: Number, // Default: 0
  lastUsedAt: Date, // Optional
  lastUsedBy: 'ObjectId', // Optional
  lastUsedInProject: 'ObjectId', // Optional
  validatedBy: 'ObjectId', // Optional: OWNER who validated
  validatedAt: Date, // Optional: when validated
  validationStatus: String, // Optional: 'valid', 'needs_review', 'outdated'
  expiresAt: Date, // Optional: expiration date
  createdBy: 'ObjectId', // Required
  createdByName: String, // Denormalized creator name
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date, // Soft delete
};

/**
 * Validate activity template data
 * @param {Object} data - Template data to validate
 * @returns {{isValid: boolean, errors: Array<string>}}
 */
export function validateActivityTemplate(data) {
  // Use constants imported at module level
  const ACTIVITY_TYPES = ACTIVITY_TYPES_CONST;
  const VISIT_PURPOSES = VISIT_PURPOSES_CONST;
  const INSPECTION_TYPES = INSPECTION_TYPES_CONST;
  const COMPLIANCE_STATUSES = COMPLIANCE_STATUSES_CONST;
  
  const errors = [];

  if (!data.name || data.name.trim().length < 2) {
    errors.push('Template name is required and must be at least 2 characters');
  }

  if (data.name && data.name.length > 200) {
    errors.push('Template name must be less than 200 characters');
  }

  if (!data.type || !Object.values(TEMPLATE_PROFESSIONAL_TYPES).includes(data.type)) {
    errors.push(`Type is required and must be one of: ${Object.values(TEMPLATE_PROFESSIONAL_TYPES).join(', ')}`);
  }

  if (!data.activityType) {
    errors.push('Activity type is required');
  } else {
    // Validate activity type matches professional type
    const validTypes = data.type === TEMPLATE_PROFESSIONAL_TYPES.ARCHITECT
      ? ACTIVITY_TYPES.ARCHITECT
      : ACTIVITY_TYPES.ENGINEER;
    
    if (!validTypes.includes(data.activityType)) {
      errors.push(`Activity type '${data.activityType}' is not valid for ${data.type}. Valid types: ${validTypes.join(', ')}`);
    }
  }

  // Validate status if provided
  if (data.status && !Object.values(TEMPLATE_STATUS).includes(data.status)) {
    errors.push(`Invalid status. Must be one of: ${Object.values(TEMPLATE_STATUS).join(', ')}`);
  }

  // Validate template category if provided
  if (data.templateCategory && !Object.values(TEMPLATE_CATEGORY_TYPES).includes(data.templateCategory)) {
    errors.push(`Invalid template category. Must be one of: ${Object.values(TEMPLATE_CATEGORY_TYPES).join(', ')}`);
  }

  // Validate project phase if provided
  if (data.projectPhase && !PROJECT_PHASES.includes(data.projectPhase)) {
    errors.push(`Invalid project phase. Must be one of: ${PROJECT_PHASES.join(', ')}`);
  }

  // Validate visit purpose if provided and activity type is site_visit
  if (data.activityType === 'site_visit' && data.defaultData?.visitPurpose) {
    if (!VISIT_PURPOSES.includes(data.defaultData.visitPurpose)) {
      errors.push(`Invalid visit purpose. Must be one of: ${VISIT_PURPOSES.join(', ')}`);
    }
  }

  // Validate inspection type if provided and activity type is inspection
  if (data.activityType === 'inspection' && data.defaultData?.inspectionType) {
    if (!INSPECTION_TYPES.includes(data.defaultData.inspectionType)) {
      errors.push(`Invalid inspection type. Must be one of: ${INSPECTION_TYPES.join(', ')}`);
    }
  }

  // Validate compliance status if provided
  if (data.defaultData?.complianceStatus && !COMPLIANCE_STATUSES.includes(data.defaultData.complianceStatus)) {
    errors.push(`Invalid compliance status. Must be one of: ${COMPLIANCE_STATUSES.join(', ')}`);
  }

  // Validate default fee amount if provided
  if (data.defaultFeeAmount !== undefined && data.defaultFeeAmount !== null) {
    if (typeof data.defaultFeeAmount !== 'number' || data.defaultFeeAmount < 0) {
      errors.push('Default fee amount must be a number >= 0');
    }
  }

  // Validate default expense amount if provided
  if (data.defaultExpenseAmount !== undefined && data.defaultExpenseAmount !== null) {
    if (typeof data.defaultExpenseAmount !== 'number' || data.defaultExpenseAmount < 0) {
      errors.push('Default expense amount must be a number >= 0');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// getActivityTypesForProfessionalType is now exported from constants file

