/**
 * Professional Services Library Schema Definition
 * Centralized schema for professional services library entries (Architects & Engineers)
 * Pattern: Similar to material-library-schema.js
 */

// Import constants directly at module level to ensure they're available
import {
  PROFESSIONAL_TYPES as PROFESSIONAL_TYPES_CONST,
  ENGINEER_SPECIALIZATIONS as ENGINEER_SPECIALIZATIONS_CONST,
  CONTRACT_TYPES as CONTRACT_TYPES_CONST,
  PAYMENT_SCHEDULES as PAYMENT_SCHEDULES_CONST,
  VISIT_FREQUENCIES as VISIT_FREQUENCIES_CONST,
} from '@/lib/constants/professional-services-constants';

/**
 * Professional Services Library Schema
 * @typedef {Object} ProfessionalServicesLibrarySchema
 * @property {string} name - Professional name or company name (required, min 2 chars, max 200)
 * @property {string} type - Professional type: 'architect' or 'engineer' (required)
 * @property {string} [description] - Optional description
 * @property {string} [companyName] - Optional: if part of firm
 * @property {string} [firstName] - Optional if companyName provided
 * @property {string} [lastName] - Optional if companyName provided
 * @property {string} [email] - Optional, validated format
 * @property {string} [phone] - Optional, validated format
 * @property {string} [address] - Optional
 * @property {string} [registrationNumber] - Professional registration number
 * @property {string} [licenseNumber] - Architecture/Engineering license number
 * @property {string} [specialization] - For engineers: 'structural', 'construction', 'quality_control', 'mep'
 * @property {string} [defaultContractType] - Default contract type for quick assignment
 * @property {string} [defaultPaymentSchedule] - Default payment schedule
 * @property {string} [defaultVisitFrequency] - Default visit frequency (for engineers)
 * @property {number} [defaultHourlyRate] - Default hourly rate
 * @property {number} [defaultPerVisitRate] - Default per-visit rate
 * @property {number} [defaultMonthlyRetainer] - Default monthly retainer
 * @property {number} usageCount - How many times assigned to projects (default: 0)
 * @property {Date} [lastUsedAt] - Last time assigned
 * @property {ObjectId} [lastUsedBy] - Last user who assigned
 * @property {ObjectId} [lastUsedInProject] - Last project assigned to
 * @property {boolean} isActive - Active status (default: true)
 * @property {boolean} isCommon - Marked as commonly used (default: false)
 * @property {Array<string>} [tags] - Tags for filtering
 * @property {ObjectId} createdBy - OWNER who created
 * @property {string} createdByName - Denormalized creator name
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 */

export const PROFESSIONAL_SERVICES_LIBRARY_SCHEMA = {
  name: String, // Required, min 2 chars, max 200
  type: String, // Required: 'architect' or 'engineer'
  description: String, // Optional, max 1000 chars
  companyName: String, // Optional, max 200 chars
  firstName: String, // Optional if companyName provided
  lastName: String, // Optional if companyName provided
  email: String, // Optional, validated format
  phone: String, // Optional, validated format
  address: String, // Optional
  registrationNumber: String, // Optional
  licenseNumber: String, // Optional
  specialization: String, // Optional, for engineers
  defaultContractType: String, // Optional
  defaultPaymentSchedule: String, // Optional
  defaultVisitFrequency: String, // Optional, for engineers
  defaultHourlyRate: Number, // Optional, >= 0
  defaultPerVisitRate: Number, // Optional, >= 0
  defaultMonthlyRetainer: Number, // Optional, >= 0
  usageCount: Number, // Default: 0, auto-incremented
  lastUsedAt: Date, // Updated when assigned
  lastUsedBy: 'ObjectId', // Last user who assigned
  lastUsedInProject: 'ObjectId', // Last project assigned to
  isActive: Boolean, // Default: true
  isCommon: Boolean, // Default: false
  tags: [String], // Optional: array of tags
  createdBy: 'ObjectId', // Required, OWNER who created
  createdByName: String, // Denormalized creator name
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date, // Soft delete
};

// Re-export constants from client-safe constants file for server-side compatibility
export {
  PROFESSIONAL_TYPES,
  CONTRACT_TYPES,
  PAYMENT_SCHEDULES,
  VISIT_FREQUENCIES,
  ENGINEER_SPECIALIZATIONS,
} from '@/lib/constants/professional-services-constants';

/**
 * Validation rules for professional services library
 */
export const PROFESSIONAL_SERVICES_LIBRARY_VALIDATION = {
  name: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 200,
  },
  type: {
    required: true,
    type: 'string',
    enum: PROFESSIONAL_TYPES_CONST, // Use imported constant directly
  },
  description: {
    required: false,
    type: 'string',
    maxLength: 1000,
  },
  companyName: {
    required: false,
    type: 'string',
    maxLength: 200,
  },
  email: {
    required: false,
    type: 'string',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // Basic email validation
  },
  phone: {
    required: false,
    type: 'string',
    maxLength: 20,
  },
  specialization: {
    required: false,
    type: 'string',
    enum: ENGINEER_SPECIALIZATIONS_CONST, // Use imported constant directly
  },
  defaultContractType: {
    required: false,
    type: 'string',
    enum: CONTRACT_TYPES_CONST.ALL, // Use imported constant directly
  },
  defaultPaymentSchedule: {
    required: false,
    type: 'string',
    enum: PAYMENT_SCHEDULES_CONST, // Use imported constant directly
  },
  defaultVisitFrequency: {
    required: false,
    type: 'string',
    enum: VISIT_FREQUENCIES_CONST, // Use imported constant directly
  },
  defaultHourlyRate: {
    required: false,
    type: 'number',
    min: 0,
  },
  defaultPerVisitRate: {
    required: false,
    type: 'number',
    min: 0,
  },
  defaultMonthlyRetainer: {
    required: false,
    type: 'number',
    min: 0,
  },
  isActive: {
    required: false,
    type: 'boolean',
    default: true,
  },
  isCommon: {
    required: false,
    type: 'boolean',
    default: false,
  },
};

/**
 * Validate professional services library data
 * @param {Object} data - Professional services library data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateProfessionalServicesLibrary(data) {
  // Use constants imported at module level
  const PROFESSIONAL_TYPES = PROFESSIONAL_TYPES_CONST;
  const ENGINEER_SPECIALIZATIONS = ENGINEER_SPECIALIZATIONS_CONST;
  const CONTRACT_TYPES = CONTRACT_TYPES_CONST;
  const PAYMENT_SCHEDULES = PAYMENT_SCHEDULES_CONST;
  const VISIT_FREQUENCIES = VISIT_FREQUENCIES_CONST;
  
  const errors = [];

  // Required fields
  if (!data.name || data.name.trim().length < 2) {
    errors.push('Professional name is required and must be at least 2 characters');
  }

  if (data.name && data.name.length > 200) {
    errors.push('Professional name must be less than 200 characters');
  }

  if (!data.type || !PROFESSIONAL_TYPES.includes(data.type)) {
    errors.push(`Professional type is required and must be one of: ${PROFESSIONAL_TYPES.join(', ')}`);
  }

  // If individual (no companyName), firstName and lastName should be provided
  if (!data.companyName) {
    if (!data.firstName || data.firstName.trim().length < 1) {
      errors.push('First name is required when company name is not provided');
    }
    if (!data.lastName || data.lastName.trim().length < 1) {
      errors.push('Last name is required when company name is not provided');
    }
  }

  // Email validation
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Email must be a valid email address');
  }

  // Optional field validation
  if (data.description && data.description.length > 1000) {
    errors.push('Description must be less than 1000 characters');
  }

  if (data.companyName && data.companyName.length > 200) {
    errors.push('Company name must be less than 200 characters');
  }

  if (data.phone && data.phone.length > 20) {
    errors.push('Phone number must be less than 20 characters');
  }

  // Specialization validation (only for engineers)
  if (data.type === 'engineer' && data.specialization && !ENGINEER_SPECIALIZATIONS.includes(data.specialization)) {
    errors.push(`Specialization must be one of: ${ENGINEER_SPECIALIZATIONS.join(', ')}`);
  }

  // Contract type validation
  if (data.defaultContractType && !CONTRACT_TYPES.ALL.includes(data.defaultContractType)) {
    errors.push(`Contract type must be one of: ${CONTRACT_TYPES.ALL.join(', ')}`);
  }

  // Payment schedule validation
  if (data.defaultPaymentSchedule && !PAYMENT_SCHEDULES.includes(data.defaultPaymentSchedule)) {
    errors.push(`Payment schedule must be one of: ${PAYMENT_SCHEDULES.join(', ')}`);
  }

  // Visit frequency validation (only for engineers)
  if (data.type === 'engineer' && data.defaultVisitFrequency && !VISIT_FREQUENCIES.includes(data.defaultVisitFrequency)) {
    errors.push(`Visit frequency must be one of: ${VISIT_FREQUENCIES.join(', ')}`);
  }

  // Rate validation
  if (data.defaultHourlyRate !== undefined && data.defaultHourlyRate < 0) {
    errors.push('Default hourly rate must be >= 0');
  }

  if (data.defaultPerVisitRate !== undefined && data.defaultPerVisitRate < 0) {
    errors.push('Default per-visit rate must be >= 0');
  }

  if (data.defaultMonthlyRetainer !== undefined && data.defaultMonthlyRetainer < 0) {
    errors.push('Default monthly retainer must be >= 0');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

