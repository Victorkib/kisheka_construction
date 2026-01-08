/**
 * Material Request Schema Definition
 * Centralized schema definition for material requests
 */

/**
 * Material Request Schema
 * @typedef {Object} MaterialRequestSchema
 * @property {string} requestNumber - Auto-generated: REQ-YYYYMMDD-001 (unique)
 * @property {ObjectId} requestedBy - User ID (CLERK/PM/OWNER/SUPERVISOR)
 * @property {string} requestedByName - Denormalized requester name
 * @property {ObjectId} projectId - Project ID (required)
 * @property {ObjectId} [floorId] - Floor ID (optional)
 * @property {ObjectId} [categoryId] - Category ID (optional)
 * @property {ObjectId} phaseId - Phase ID (required for phase tracking and financial management)
 * @property {string} [category] - Denormalized category name
 * @property {string} materialName - Material name (required, min 2 characters)
 * @property {string} [description] - Material description
 * @property {number} quantityNeeded - Quantity needed (required, > 0)
 * @property {string} unit - Unit of measurement (required)
 * @property {string} urgency - Urgency level: 'low', 'medium', 'high', 'critical' (required)
 * @property {number} [estimatedCost] - Estimated total cost (optional, >= 0)
 * @property {number} [estimatedUnitCost] - Estimated cost per unit (optional, >= 0)
 * @property {string} [reason] - Why this material is needed
 * @property {string} status - Status: 'requested', 'pending_approval', 'approved', 'rejected', 'converted_to_order', 'converted_to_material', 'cancelled' (required, defaults to 'requested')
 * @property {Date} [submittedAt] - When request was submitted
 * @property {ObjectId} [approvedBy] - PM/OWNER who approved
 * @property {string} [approvedByName] - Denormalized approver name
 * @property {Date} [approvalDate] - When request was approved
 * @property {string} [rejectionReason] - Reason for rejection
 * @property {ObjectId} [linkedPurchaseOrderId] - Purchase order ID when converted
 * @property {string} [notes] - Additional notes
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 */

export const MATERIAL_REQUEST_SCHEMA = {
  requestNumber: String, // Auto-generated: REQ-YYYYMMDD-001
  requestedBy: 'ObjectId', // User ID
  requestedByName: String,
  projectId: 'ObjectId',
  floorId: 'ObjectId', // Optional
  categoryId: 'ObjectId', // Optional
  phaseId: 'ObjectId', // Required for phase tracking and financial management
  category: String, // Denormalized
  materialName: String, // Required
  description: String,
  quantityNeeded: Number, // Required
  unit: String, // Required
  urgency: String, // 'low', 'medium', 'high', 'critical'
  estimatedCost: Number, // Optional
  estimatedUnitCost: Number, // Optional
  reason: String, // Why this material is needed
  status: String, // 'requested', 'pending_approval', 'approved', 'rejected', 'converted_to_order', 'converted_to_material', 'cancelled'
  submittedAt: Date,
  approvedBy: 'ObjectId', // PM/OWNER
  approvedByName: String,
  approvalDate: Date,
  rejectionReason: String,
  linkedPurchaseOrderId: 'ObjectId', // When converted to order
  notes: String,
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date, // Soft delete
};

/**
 * Valid urgency levels
 */
export const VALID_URGENCY_LEVELS = ['low', 'medium', 'high', 'critical'];

/**
 * Valid request statuses
 */
export const VALID_REQUEST_STATUSES = [
  'requested',
  'pending_approval',
  'approved',
  'rejected',
  'converted_to_order',
  'converted_to_material', // When material entry is created from PO
  'cancelled',
];

/**
 * Validation rules for material requests
 */
export const MATERIAL_REQUEST_VALIDATION = {
  requestNumber: {
    required: false, // Auto-generated
    type: 'string',
    pattern: /^REQ-\d{8}-\d{3}$/,
  },
  requestedBy: {
    required: true,
    type: 'ObjectId',
  },
  projectId: {
    required: true,
    type: 'ObjectId',
  },
  materialName: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 200,
  },
  quantityNeeded: {
    required: true,
    type: 'number',
    min: 0.01,
  },
  unit: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 50,
  },
  urgency: {
    required: true,
    type: 'string',
    enum: VALID_URGENCY_LEVELS,
  },
  estimatedCost: {
    required: false,
    type: 'number',
    min: 0,
  },
  estimatedUnitCost: {
    required: false,
    type: 'number',
    min: 0,
  },
  status: {
    required: true,
    type: 'string',
    enum: VALID_REQUEST_STATUSES,
    default: 'requested',
  },
};

/**
 * Validate material request data
 * @param {Object} data - Material request data to validate
 * @returns {Object} { isValid: boolean, errors: string[], warnings: string[] }
 */
export function validateMaterialRequest(data) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!data.requestedBy) {
    errors.push('requestedBy is required');
  }
  if (!data.projectId) {
    errors.push('projectId is required');
  }
  if (!data.materialName || data.materialName.trim().length < 2) {
    errors.push('materialName is required and must be at least 2 characters');
  }
  if (!data.quantityNeeded || data.quantityNeeded <= 0) {
    errors.push('quantityNeeded is required and must be greater than 0');
  }
  if (!data.unit || data.unit.trim().length === 0) {
    errors.push('unit is required');
  }
  if (!data.urgency || !VALID_URGENCY_LEVELS.includes(data.urgency)) {
    errors.push(`urgency is required and must be one of: ${VALID_URGENCY_LEVELS.join(', ')}`);
  }

  // Phase Management: phaseId is now required
  if (!data.phaseId || data.phaseId === null || data.phaseId === '') {
    errors.push('phaseId is required for phase tracking and financial management. Please select a phase for this material request.');
  } else {
    // Validate phaseId format
    const isValidObjectId = (id) => {
      if (typeof id === 'string') {
        return /^[0-9a-fA-F]{24}$/.test(id);
      }
      return id && typeof id === 'object' && id.toString && /^[0-9a-fA-F]{24}$/.test(id.toString());
    };

    if (!isValidObjectId(data.phaseId)) {
      errors.push('Invalid phaseId format. phaseId must be a valid ObjectId');
    }
    // Note: Project validation should be done at the API level where we can query the database
  }

  // Optional field validation
  if (data.estimatedCost !== undefined && data.estimatedCost < 0) {
    errors.push('estimatedCost must be >= 0');
  }
  if (data.estimatedUnitCost !== undefined && data.estimatedUnitCost < 0) {
    errors.push('estimatedUnitCost must be >= 0');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

