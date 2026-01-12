/**
 * Worker Profile Schema Definition
 * Extended worker information for labour tracking
 */

import { ObjectId } from 'mongodb';

/**
 * Worker Profile Schema
 * @typedef {Object} WorkerProfileSchema
 * @property {ObjectId} _id - Worker profile ID
 * @property {ObjectId} [userId] - User ID (optional, null for external workers)
 * @property {string} employeeId - Company employee ID (unique, indexed)
 * @property {string} workerName - Worker name (required)
 * @property {string} workerType - 'internal' | 'external' | 'professional' (required)
 * @property {string} [nationalId] - National ID number (optional, indexed)
 * @property {string} [phoneNumber] - Phone number
 * @property {string} [email] - Email address
 * @property {Object} [emergencyContact] - Emergency contact information
 * @property {string} [profession] - Profession for professionals: 'architect' | 'engineer' | 'surveyor' | 'consultant'
 * @property {string} [companyName] - Company name (for external professionals)
 * @property {string} [licenseNumber] - Professional license number
 * @property {string[]} skillTypes - Array of skill types
 * @property {Object[]} [certifications] - Certifications array
 * @property {number} defaultHourlyRate - Default hourly rate
 * @property {number} [defaultDailyRate] - Default daily rate (for daily-rate workers)
 * @property {number} overtimeMultiplier - Overtime rate multiplier (default: 1.5)
 * @property {Object[]} [skillAllowances] - Skill-specific allowances
 * @property {string} employmentType - 'full_time' | 'part_time' | 'contract' | 'casual' | 'consultant'
 * @property {Date} [hireDate] - Hire date
 * @property {Date} [terminationDate] - Termination date
 * @property {string} status - 'active' | 'inactive' | 'terminated' | 'on_leave'
 * @property {number} totalHoursWorked - Lifetime total hours worked
 * @property {number} averageRating - Average quality/productivity rating (1-5)
 * @property {number} attendanceRate - Attendance rate percentage
 * @property {ObjectId[]} currentProjects - Array of active project IDs
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

export const WORKER_PROFILE_SCHEMA = {
  userId: 'ObjectId', // Optional, unique
  employeeId: String, // Required, unique
  workerName: String, // Required
  workerType: String, // Required: 'internal' | 'external' | 'professional'
  nationalId: String, // Optional
  phoneNumber: String, // Optional
  email: String, // Optional
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String,
  },
  profession: String, // Optional, for professionals
  companyName: String, // Optional, for external professionals
  licenseNumber: String, // Optional
  skillTypes: [String], // Array of skill types
  certifications: [
    {
      name: String,
      issuingAuthority: String,
      issueDate: Date,
      expiryDate: Date,
      certificateNumber: String,
    },
  ],
  defaultHourlyRate: Number, // Required
  defaultDailyRate: Number, // Optional
  overtimeMultiplier: Number, // Default: 1.5
  skillAllowances: [
    {
      skillType: String,
      allowanceAmount: Number,
    },
  ],
  employmentType: String, // Required
  hireDate: Date, // Optional
  terminationDate: Date, // Optional
  status: String, // Required
  totalHoursWorked: Number, // Default: 0
  averageRating: Number, // Default: 0
  attendanceRate: Number, // Default: 0
  currentProjects: ['ObjectId'], // Array of project IDs
  createdAt: Date,
  updatedAt: Date,
};

/**
 * Valid worker types
 */
export const VALID_WORKER_TYPES = ['internal', 'external', 'professional'];

/**
 * Valid employment types
 */
export const VALID_EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'casual',
  'consultant',
];

/**
 * Valid worker statuses
 */
export const VALID_WORKER_STATUSES = [
  'active',
  'inactive',
  'terminated',
  'on_leave',
];

/**
 * Valid professions (for professionals)
 */
export const VALID_PROFESSIONS = [
  'architect',
  'engineer',
  'structural_engineer',
  'mep_engineer',
  'surveyor',
  'consultant',
  'quantity_surveyor',
  'legal_advisor',
  'financial_advisor',
];

/**
 * Validation rules for worker profiles
 */
export const WORKER_PROFILE_VALIDATION = {
  employeeId: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 50,
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
  defaultHourlyRate: {
    required: true,
    type: 'number',
    min: 0,
  },
  employmentType: {
    required: true,
    type: 'string',
    enum: VALID_EMPLOYMENT_TYPES,
  },
  status: {
    required: true,
    type: 'string',
    enum: VALID_WORKER_STATUSES,
    default: 'active',
  },
};

/**
 * Create worker profile object
 * @param {Object} input - Worker profile input data
 * @returns {Object} Worker profile object
 */
export function createWorkerProfile(input) {
  const {
    userId,
    employeeId,
    workerName,
    workerType,
    nationalId,
    phoneNumber,
    email,
    emergencyContact,
    profession,
    companyName,
    licenseNumber,
    skillTypes = [],
    certifications = [],
    defaultHourlyRate,
    defaultDailyRate,
    overtimeMultiplier = 1.5,
    skillAllowances = [],
    employmentType,
    hireDate,
    terminationDate,
    status = 'active',
  } = input;

  return {
    userId: userId && ObjectId.isValid(userId) ? new ObjectId(userId) : null,
    employeeId: employeeId?.trim() || '',
    workerName: workerName?.trim() || '',
    workerType: workerType || 'internal',
    nationalId: nationalId?.trim() || null,
    phoneNumber: phoneNumber?.trim() || null,
    email: email?.trim() || null,
    emergencyContact: emergencyContact
      ? {
          name: emergencyContact.name?.trim() || '',
          phone: emergencyContact.phone?.trim() || '',
          relationship: emergencyContact.relationship?.trim() || '',
        }
      : null,
    profession: profession || null,
    companyName: companyName?.trim() || null,
    licenseNumber: licenseNumber?.trim() || null,
    skillTypes: Array.isArray(skillTypes) ? skillTypes : [],
    certifications: Array.isArray(certifications)
      ? certifications.map((cert) => ({
          name: cert.name?.trim() || '',
          issuingAuthority: cert.issuingAuthority?.trim() || '',
          issueDate: cert.issueDate ? new Date(cert.issueDate) : null,
          expiryDate: cert.expiryDate ? new Date(cert.expiryDate) : null,
          certificateNumber: cert.certificateNumber?.trim() || '',
        }))
      : [],
    defaultHourlyRate: parseFloat(defaultHourlyRate) || 0,
    defaultDailyRate: defaultDailyRate ? parseFloat(defaultDailyRate) : null,
    overtimeMultiplier: parseFloat(overtimeMultiplier) || 1.5,
    skillAllowances: Array.isArray(skillAllowances)
      ? skillAllowances.map((allowance) => ({
          skillType: allowance.skillType?.trim() || '',
          allowanceAmount: parseFloat(allowance.allowanceAmount) || 0,
        }))
      : [],
    employmentType: employmentType || 'casual',
    hireDate: hireDate ? new Date(hireDate) : null,
    terminationDate: terminationDate ? new Date(terminationDate) : null,
    status: status || 'active',
    totalHoursWorked: 0,
    averageRating: 0,
    attendanceRate: 0,
    currentProjects: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Validate worker profile data
 * @param {Object} data - Worker profile data to validate
 * @returns {Object} { isValid: boolean, errors: string[], warnings: string[] }
 */
export function validateWorkerProfile(data) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!data.employeeId || data.employeeId.trim().length === 0) {
    errors.push('employeeId is required');
  }

  if (!data.workerName || data.workerName.trim().length < 2) {
    errors.push('workerName is required and must be at least 2 characters');
  }

  if (!data.workerType || !VALID_WORKER_TYPES.includes(data.workerType)) {
    errors.push(`workerType is required and must be one of: ${VALID_WORKER_TYPES.join(', ')}`);
  }

  if (data.defaultHourlyRate === undefined || data.defaultHourlyRate === null || isNaN(data.defaultHourlyRate) || data.defaultHourlyRate < 0) {
    errors.push('defaultHourlyRate is required and must be >= 0');
  }

  if (!data.employmentType || !VALID_EMPLOYMENT_TYPES.includes(data.employmentType)) {
    errors.push(`employmentType is required and must be one of: ${VALID_EMPLOYMENT_TYPES.join(', ')}`);
  }

  if (data.status && !VALID_WORKER_STATUSES.includes(data.status)) {
    errors.push(`status must be one of: ${VALID_WORKER_STATUSES.join(', ')}`);
  }

  // Professional-specific validation
  if (data.workerType === 'professional') {
    if (!data.profession || !VALID_PROFESSIONS.includes(data.profession)) {
      warnings.push('profession is recommended for professional workers');
    }
  }

  // Validate dates
  if (data.hireDate && data.terminationDate) {
    const hire = new Date(data.hireDate);
    const termination = new Date(data.terminationDate);
    if (termination <= hire) {
      errors.push('terminationDate must be after hireDate');
    }
  }

  // Validate certifications
  if (data.certifications && Array.isArray(data.certifications)) {
    data.certifications.forEach((cert, index) => {
      if (cert.issueDate && cert.expiryDate) {
        const issue = new Date(cert.issueDate);
        const expiry = new Date(cert.expiryDate);
        if (expiry <= issue) {
          errors.push(`Certification ${index + 1}: expiryDate must be after issueDate`);
        }
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export default {
  WORKER_PROFILE_SCHEMA,
  VALID_WORKER_TYPES,
  VALID_EMPLOYMENT_TYPES,
  VALID_WORKER_STATUSES,
  VALID_PROFESSIONS,
  WORKER_PROFILE_VALIDATION,
  createWorkerProfile,
  validateWorkerProfile,
};

