/**
 * Subcontractor Schema Definition
 * Defines subcontractor tracking and management structure
 */

import { ObjectId } from 'mongodb';
// Import constants for use in validation functions (server-side only)
import { SUBCONTRACTOR_TYPES, SUBCONTRACTOR_STATUSES, CONTRACT_TYPES, calculateTotalPaid, calculateTotalUnpaid } from '@/lib/constants/subcontractor-constants';

/**
 * Subcontractor Schema
 * @typedef {Object} SubcontractorSchema
 * @property {ObjectId} _id - Subcontractor ID
 * @property {ObjectId} projectId - Project ID (required, indexed)
 * @property {ObjectId} phaseId - Phase ID (required, indexed)
 * @property {string} subcontractorName - Subcontractor name/company (required)
 * @property {string} subcontractorType - Subcontractor type (required)
 * @property {string} contactPerson - Contact person name
 * @property {string} phone - Phone number
 * @property {string} email - Email address
 * @property {number} contractValue - Total contract value (required, > 0)
 * @property {string} contractType - 'fixed_price' | 'time_material' | 'cost_plus' (required)
 * @property {Date} startDate - Contract start date (required)
 * @property {Date} [endDate] - Contract end date
 * @property {Array} paymentSchedule - Payment milestones
 * @property {string} status - 'pending' | 'active' | 'completed' | 'terminated'
 * @property {Object} performance - Performance ratings
 * @property {string} [notes] - Additional notes
 * @property {ObjectId} createdBy - Creator user ID
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 */

// Re-export constants from client-safe constants file for backward compatibility
// This allows server-side code to import from schema while keeping client-side code safe
export { SUBCONTRACTOR_TYPES, SUBCONTRACTOR_STATUSES, CONTRACT_TYPES, calculateTotalPaid, calculateTotalUnpaid };

/**
 * Subcontractor Schema Object
 */
export const SUBCONTRACTOR_SCHEMA = {
  projectId: 'ObjectId', // Required
  phaseId: 'ObjectId', // Required
  subcontractorName: String, // Required
  subcontractorType: String, // Required
  contactPerson: String, // Optional
  phone: String, // Optional
  email: String, // Optional
  contractValue: Number, // Required, > 0
  contractType: String, // Required: 'fixed_price' | 'time_material' | 'cost_plus'
  startDate: Date, // Required
  endDate: Date, // Optional
  paymentSchedule: [
    {
      milestone: String, // Milestone name
      amount: Number, // Payment amount
      dueDate: Date, // Due date
      paid: Boolean, // Payment status
      paidDate: Date, // When paid
      paymentReference: String // Payment reference
    }
  ],
  status: String, // Required: 'pending' | 'active' | 'completed' | 'terminated'
  performance: {
    quality: Number, // 1-5 rating
    timeliness: Number, // 1-5 rating
    communication: Number // 1-5 rating
  },
  notes: String, // Optional
  createdBy: 'ObjectId', // Required
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date
};

/**
 * Create subcontractor object
 * @param {Object} input - Subcontractor input data
 * @param {ObjectId} projectId - Project ID
 * @param {ObjectId} phaseId - Phase ID
 * @param {ObjectId} createdBy - Creator user ID
 * @returns {Object} Subcontractor object
 */
export function createSubcontractor(input, projectId, phaseId, createdBy) {
  const {
    subcontractorName,
    subcontractorType,
    contactPerson,
    phone,
    email,
    contractValue,
    contractType,
    startDate,
    endDate,
    paymentSchedule,
    status,
    performance,
    notes
  } = input;

  return {
    projectId: typeof projectId === 'string' ? new ObjectId(projectId) : projectId,
    phaseId: typeof phaseId === 'string' ? new ObjectId(phaseId) : phaseId,
    subcontractorName: subcontractorName?.trim() || '',
    subcontractorType: subcontractorType || 'other',
    contactPerson: contactPerson?.trim() || '',
    phone: phone?.trim() || '',
    email: email?.trim() || '',
    contractValue: parseFloat(contractValue) || 0,
    contractType: contractType || 'fixed_price',
    startDate: startDate ? new Date(startDate) : new Date(),
    endDate: endDate ? new Date(endDate) : null,
    paymentSchedule: Array.isArray(paymentSchedule) ? paymentSchedule.map(payment => ({
      milestone: payment.milestone?.trim() || '',
      amount: parseFloat(payment.amount) || 0,
      dueDate: payment.dueDate ? new Date(payment.dueDate) : null,
      paid: payment.paid === true,
      paidDate: payment.paidDate ? new Date(payment.paidDate) : null,
      paymentReference: payment.paymentReference?.trim() || ''
    })) : [],
    status: status || 'pending',
    performance: {
      quality: performance?.quality || 0,
      timeliness: performance?.timeliness || 0,
      communication: performance?.communication || 0
    },
    notes: notes?.trim() || '',
    createdBy: typeof createdBy === 'string' ? new ObjectId(createdBy) : createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  };
}

/**
 * Validate subcontractor data
 * @param {Object} data - Subcontractor data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateSubcontractor(data) {
  const errors = [];
  
  if (!data.projectId || !ObjectId.isValid(data.projectId)) {
    errors.push('Valid projectId is required');
  }
  
  if (!data.phaseId || !ObjectId.isValid(data.phaseId)) {
    errors.push('Valid phaseId is required');
  }
  
  if (!data.subcontractorName || data.subcontractorName.trim().length < 2) {
    errors.push('Subcontractor name is required and must be at least 2 characters');
  }
  
  if (!data.subcontractorType || !SUBCONTRACTOR_TYPES.includes(data.subcontractorType)) {
    errors.push(`Subcontractor type is required and must be one of: ${SUBCONTRACTOR_TYPES.join(', ')}`);
  }
  
  if (!data.contractValue || data.contractValue <= 0) {
    errors.push('Contract value is required and must be greater than 0');
  }
  
  if (!data.contractType || !CONTRACT_TYPES.includes(data.contractType)) {
    errors.push(`Contract type is required and must be one of: ${CONTRACT_TYPES.join(', ')}`);
  }
  
  if (!data.startDate) {
    errors.push('Start date is required');
  }
  
  if (data.status && !SUBCONTRACTOR_STATUSES.includes(data.status)) {
    errors.push(`Status must be one of: ${SUBCONTRACTOR_STATUSES.join(', ')}`);
  }
  
  // Validate end date is after start date
  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (end <= start) {
      errors.push('End date must be after start date');
    }
  }
  
  // Validate payment schedule
  if (data.paymentSchedule && Array.isArray(data.paymentSchedule)) {
    data.paymentSchedule.forEach((payment, index) => {
      if (!payment.milestone || payment.milestone.trim().length === 0) {
        errors.push(`Payment ${index + 1}: milestone name is required`);
      }
      if (payment.amount === undefined || payment.amount === null || payment.amount <= 0) {
        errors.push(`Payment ${index + 1}: amount must be greater than 0`);
      }
      if (!payment.dueDate) {
        errors.push(`Payment ${index + 1}: due date is required`);
      }
    });
    
    // Validate total payment schedule doesn't exceed contract value
    const totalScheduled = data.paymentSchedule.reduce((sum, p) => sum + (p.amount || 0), 0);
    if (totalScheduled > data.contractValue * 1.1) { // Allow 10% tolerance
      errors.push(`Total payment schedule (${totalScheduled}) exceeds contract value (${data.contractValue}) by more than 10%`);
    }
  }
  
  // Validate performance ratings (1-5)
  if (data.performance) {
    ['quality', 'timeliness', 'communication'].forEach(field => {
      if (data.performance[field] !== undefined && data.performance[field] !== null) {
        const rating = parseFloat(data.performance[field]);
        if (isNaN(rating) || rating < 1 || rating > 5) {
          errors.push(`Performance ${field} must be between 1 and 5`);
        }
      }
    });
  }
  
  return { isValid: errors.length === 0, errors };
}

// calculateTotalPaid and calculateTotalUnpaid are now exported from constants file
// They don't use MongoDB, so they're safe to re-export

/**
 * Calculate average performance rating
 * @param {Object} performance - Performance object
 * @returns {number} Average rating (0-5)
 */
export function calculateAveragePerformance(performance) {
  if (!performance) return 0;
  const ratings = [performance.quality, performance.timeliness, performance.communication]
    .filter(r => r && r > 0);
  if (ratings.length === 0) return 0;
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
}

export default {
  SUBCONTRACTOR_SCHEMA,
  SUBCONTRACTOR_TYPES,
  CONTRACT_TYPES,
  SUBCONTRACTOR_STATUSES,
  createSubcontractor,
  validateSubcontractor,
  calculateTotalPaid,
  calculateTotalUnpaid,
  calculateAveragePerformance
};

