/**
 * Professional Fees Schema Definition
 * Centralized schema definition for professional fees (Architect & Engineer fees)
 * Pattern: Similar to expenses schema with UPPERCASE status values
 */

import { ObjectId } from 'mongodb';
// Import constants directly at module level to ensure they're available
import {
  FEE_TYPES as FEE_TYPES_CONST,
  FEE_STATUSES as FEE_STATUSES_CONST,
  PAYMENT_METHODS as PAYMENT_METHODS_CONST,
  CURRENCIES as CURRENCIES_CONST,
  APPROVAL_CHAIN_STATUSES as APPROVAL_CHAIN_STATUSES_CONST,
} from '@/lib/constants/professional-fees-constants';

/**
 * Professional Fees Schema
 * @typedef {Object} ProfessionalFeesSchema
 * @property {ObjectId} professionalServiceId - Link to professional_services (required)
 * @property {ObjectId} [activityId] - Optional: link to specific activity
 * @property {ObjectId} projectId - Link to project (required)
 * @property {ObjectId} [phaseId] - Optional: phase this fee relates to
 * @property {string} feeCode - Auto-generated: "FEE-{type}-{sequence}"
 * @property {string} feeType - Required: fee type
 * @property {string} [description] - Optional description
 * @property {number} amount - Required, > 0
 * @property {string} currency - Default: 'KES'
 * @property {string} [paymentMethod] - Payment method
 * @property {Date} [paymentDate] - Payment date
 * @property {string} [referenceNumber] - Payment reference
 * @property {string} [receiptUrl] - Cloudinary URL to receipt
 * @property {string} [invoiceNumber] - Invoice number
 * @property {Date} [invoiceDate] - Invoice date
 * @property {string} [invoiceUrl] - Cloudinary URL to invoice
 * @property {Date} [dueDate] - Due date
 * @property {string} status - Required: 'PENDING', 'APPROVED', 'REJECTED', 'PAID', 'ARCHIVED' (UPPERCASE like expenses)
 * @property {ObjectId} [approvedBy] - Approver user ID
 * @property {Date} [approvedAt] - Approval date
 * @property {string} [approvalNotes] - Approval notes
 * @property {Array} [approvalChain] - Approval chain
 * @property {ObjectId} [expenseId] - Link to expenses collection (if expense created)
 * @property {ObjectId} createdBy - Creator user ID
 * @property {string} createdByName - Denormalized creator name
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 */

export const PROFESSIONAL_FEES_SCHEMA = {
  professionalServiceId: 'ObjectId', // Required
  activityId: 'ObjectId', // Optional
  projectId: 'ObjectId', // Required
  phaseId: 'ObjectId', // Optional
  feeCode: String, // Auto-generated
  feeType: String, // Required
  description: String, // Optional
  amount: Number, // Required, > 0
  currency: String, // Default: 'KES'
  paymentMethod: String, // Optional
  paymentDate: Date, // Optional
  referenceNumber: String, // Optional
  receiptUrl: String, // Optional, Cloudinary URL
  invoiceNumber: String, // Optional
  invoiceDate: Date, // Optional
  invoiceUrl: String, // Optional, Cloudinary URL
  dueDate: Date, // Optional
  status: String, // Required: 'PENDING', 'APPROVED', 'REJECTED', 'PAID', 'ARCHIVED'
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
  expenseId: 'ObjectId', // Optional, link to expenses
  createdBy: 'ObjectId', // Required
  createdByName: String, // Denormalized
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date, // Soft delete
};

// Re-export constants from client-safe constants file for server-side compatibility
export {
  FEE_TYPES,
  FEE_STATUSES,
  PAYMENT_METHODS,
  CURRENCIES,
  APPROVAL_CHAIN_STATUSES,
} from '@/lib/constants/professional-fees-constants';

/**
 * Validation rules for professional fees
 */
export const PROFESSIONAL_FEES_VALIDATION = {
  professionalServiceId: {
    required: true,
    type: 'ObjectId',
  },
  projectId: {
    required: true,
    type: 'ObjectId',
  },
  feeType: {
    required: true,
    type: 'string',
    enum: FEE_TYPES_CONST.ALL, // Use imported constant directly
  },
  amount: {
    required: true,
    type: 'number',
    min: 0.01,
  },
  currency: {
    required: false,
    type: 'string',
    enum: CURRENCIES_CONST, // Use imported constant directly
    default: 'KES',
  },
  status: {
    required: true,
    type: 'string',
    enum: FEE_STATUSES_CONST, // Use imported constant directly
    default: 'PENDING',
  },
};

/**
 * Validate professional fee data
 * @param {Object} data - Professional fee data to validate
 * @param {Object} professionalService - Professional service assignment data (for type validation)
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateProfessionalFee(data, professionalService = null) {
  // Use constants imported at module level
  const FEE_TYPES = FEE_TYPES_CONST;
  const FEE_STATUSES = FEE_STATUSES_CONST;
  const PAYMENT_METHODS = PAYMENT_METHODS_CONST;
  const CURRENCIES = CURRENCIES_CONST;
  const APPROVAL_CHAIN_STATUSES = APPROVAL_CHAIN_STATUSES_CONST;
  
  const errors = [];

  // Required fields
  if (!data.professionalServiceId || !ObjectId.isValid(data.professionalServiceId)) {
    errors.push('Valid professionalServiceId is required');
  }

  if (!data.projectId || !ObjectId.isValid(data.projectId)) {
    errors.push('Valid projectId is required');
  }

  if (!data.feeType || !FEE_TYPES.ALL.includes(data.feeType)) {
    errors.push(`Fee type is required and must be one of: ${FEE_TYPES.ALL.join(', ')}`);
  }

  if (!data.amount || data.amount <= 0) {
    errors.push('Amount is required and must be greater than 0');
  }

  // Validate fee type matches professional type (if professional service provided)
  if (professionalService) {
    const professionalType = professionalService.type; // 'architect' or 'engineer'
    const validTypes = professionalType === 'architect' 
      ? FEE_TYPES.ARCHITECT 
      : FEE_TYPES.ENGINEER;
    
    if (!validTypes.includes(data.feeType)) {
      errors.push(`Fee type '${data.feeType}' is not valid for ${professionalType}. Valid types: ${validTypes.join(', ')}`);
    }
  }

  // Validate currency
  if (data.currency && !CURRENCIES.includes(data.currency)) {
    errors.push(`Currency must be one of: ${CURRENCIES.join(', ')}`);
  }

  // Validate payment method
  if (data.paymentMethod && !PAYMENT_METHODS.includes(data.paymentMethod)) {
    errors.push(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`);
  }

  // Validate status
  if (!data.status || !FEE_STATUSES.includes(data.status)) {
    errors.push(`Status must be one of: ${FEE_STATUSES.join(', ')}`);
  }

  // Validate dates
  if (data.invoiceDate && data.dueDate) {
    const invoiceDate = new Date(data.invoiceDate);
    const dueDate = new Date(data.dueDate);
    if (dueDate < invoiceDate) {
      errors.push('Due date must be after or equal to invoice date');
    }
  }

  // Validate approval chain
  if (data.approvalChain && Array.isArray(data.approvalChain)) {
    data.approvalChain.forEach((entry, index) => {
      if (!entry.approverId || !ObjectId.isValid(entry.approverId)) {
        errors.push(`Approval chain entry ${index + 1}: valid approverId is required`);
      }
      if (!entry.approverName || entry.approverName.trim().length < 1) {
        errors.push(`Approval chain entry ${index + 1}: approverName is required`);
      }
      if (!entry.status || !APPROVAL_CHAIN_STATUSES.includes(entry.status)) {
        errors.push(`Approval chain entry ${index + 1}: status must be one of: ${APPROVAL_CHAIN_STATUSES.join(', ')}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate fee code
 * @param {string} type - Professional type: 'architect' or 'engineer'
 * @param {number} sequence - Sequence number
 * @returns {string} Fee code (e.g., "FEE-ARCH-001" or "FEE-ENG-001")
 */
export function generateFeeCode(type, sequence) {
  const prefix = type === 'architect' ? 'ARCH' : 'ENG';
  const sequenceStr = String(sequence).padStart(6, '0');
  return `FEE-${prefix}-${sequenceStr}`;
}

