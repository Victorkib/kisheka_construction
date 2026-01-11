/**
 * Purchase Order Schema Definition
 * Centralized schema definition for purchase orders
 */

/**
 * Purchase Order Schema
 * @typedef {Object} PurchaseOrderSchema
 * @property {string} purchaseOrderNumber - Auto-generated: PO-YYYYMMDD-001 (unique)
 * @property {ObjectId} materialRequestId - Links to material request (required)
 * @property {ObjectId} supplierId - Supplier user ID (required)
 * @property {string} supplierName - Denormalized supplier name
 * @property {string} [supplierEmail] - Denormalized supplier email
 * @property {ObjectId} projectId - Project ID (required)
 * @property {ObjectId} phaseId - Phase ID (required for phase tracking and financial management)
 * @property {ObjectId} [floorId] - Floor ID (optional)
 * @property {ObjectId} [categoryId] - Category ID (optional)
 * @property {string} [category] - Denormalized category name
 * @property {string} materialName - Material name
 * @property {string} [description] - Material description
 * @property {number} quantityOrdered - Quantity ordered (required, > 0)
 * @property {string} unit - Unit of measurement
 * @property {number} unitCost - Per unit cost (required, >= 0)
 * @property {number} totalCost - Total cost: quantityOrdered * unitCost (required)
 * @property {Date} deliveryDate - Expected delivery date (required)
 * @property {string} [terms] - Payment terms, delivery terms
 * @property {string} [notes] - Additional notes
 * @property {string} status - Status: 'order_sent', 'order_accepted', 'order_rejected', 'order_modified', 'retry_requested', 'retry_sent', 'alternatives_sent', 'ready_for_delivery', 'delivered', 'cancelled'
 * @property {Date} [sentAt] - When order was sent
 * @property {string} [supplierResponse] - 'accept', 'reject', 'modify'
 * @property {Date} [supplierResponseDate] - When supplier responded
 * @property {string} [supplierNotes] - Supplier's response notes
 * @property {string} [rejectionReason] - Main rejection reason category (from rejection-reasons.js)
 * @property {string} [rejectionSubcategory] - Specific rejection subcategory
 * @property {Object} [rejectionMetadata] - Additional rejection context and analytics
 * @property {boolean} [isRetryable] - Whether rejection is assessed as retryable
 * @property {string} [retryRecommendation] - Recommended action for retry
 * @property {Date} [retryRequestedAt] - When retry was requested
 * @property {ObjectId} [retryRequestedBy] - User who requested retry
 * @property {Object} [retryAdjustments] - Adjustments made for retry (price, quantity, etc.)
 * @property {number} [retryCount] - Number of retry attempts
 * @property {Date} [alternativesSentAt] - When alternatives were sent
 * @property {ObjectId} [alternativesSentBy] - User who sent alternatives
 * @property {Array} [alternativeOrderIds] - IDs of alternative orders created
 * @property {ObjectId} [originalOrderId] - Original rejected order ID (for alternative orders)
 * @property {string} [originalOrderNumber] - Original rejected order number
 * @property {string} [originalRejectionReason] - Original rejection reason (for alternative orders)
 * @property {boolean} [isAlternativeOrder] - Whether this is an alternative order
 * @property {Object} [supplierModifications] - If supplier proposes changes
 * @property {boolean} [modificationApproved] - If PM/OWNER approved supplier modifications
 * @property {Array} [materialResponses] - Material-level responses for bulk orders (array of { materialRequestId, action, status, notes, rejectionReason, rejectionSubcategory, modifications })
 * @property {boolean} [supportsPartialResponse] - Whether this order supports partial responses (bulk orders)
 * @property {string} [deliveryNoteFileUrl] - Uploaded by supplier
 * @property {number} [actualQuantityDelivered] - Actual quantity delivered (may differ from ordered)
 * @property {ObjectId} [linkedMaterialId] - Material entry created from this order
 * @property {ObjectId} createdBy - PM/OWNER who created the order
 * @property {string} createdByName - Denormalized creator name
 * @property {string} financialStatus - 'not_committed', 'committed', 'fulfilled'
 * @property {Date} [committedAt] - When order was accepted (committed)
 * @property {Date} [fulfilledAt] - When material entry created (fulfilled)
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 * @property {string} [idempotencyKey] - SHA256 hash of request parameters to prevent duplicates on retry
 */

export const PURCHASE_ORDER_SCHEMA = {
  purchaseOrderNumber: String, // Auto-generated: PO-YYYYMMDD-001
  materialRequestId: 'ObjectId', // Links to material request
  supplierId: 'ObjectId', // Supplier user ID
  supplierName: String, // Denormalized
  supplierEmail: String, // Denormalized
  projectId: 'ObjectId',
  phaseId: 'ObjectId', // Required for phase tracking and financial management
  floorId: 'ObjectId', // Optional
  categoryId: 'ObjectId', // Optional
  category: String, // Denormalized
  materialName: String,
  description: String,
  quantityOrdered: Number,
  unit: String,
  unitCost: Number, // From supplier quote or estimated
  totalCost: Number, // quantityOrdered * unitCost
  deliveryDate: Date, // Expected delivery date
  terms: String, // Payment terms, delivery terms
  notes: String, // Additional notes
  status: String, // 'order_sent', 'order_accepted', 'order_rejected', 'order_modified', 'ready_for_delivery', 'delivered', 'cancelled'
  sentAt: Date,
  supplierResponse: String, // 'accept', 'reject', 'modify'
  supplierResponseDate: Date,
  supplierNotes: String, // Supplier's response notes
  rejectionReason: String, // Main rejection reason category (from rejection-reasons.js)
  rejectionSubcategory: String, // Specific rejection subcategory
  rejectionMetadata: Object, // Additional rejection context and analytics
  isRetryable: Boolean, // Whether rejection is assessed as retryable
  retryRecommendation: String, // Recommended action for retry
  retryRequestedAt: Date, // When retry was requested
  retryRequestedBy: 'ObjectId', // User who requested retry
  retryAdjustments: Object, // Adjustments made for retry (price, quantity, etc.)
  retryCount: Number, // Number of retry attempts
  alternativesSentAt: Date, // When alternatives were sent
  alternativesSentBy: 'ObjectId', // User who sent alternatives
  alternativeOrderIds: ['ObjectId'], // IDs of alternative orders created
  originalOrderId: 'ObjectId', // Original rejected order ID (for alternative orders)
  originalOrderNumber: String, // Original rejected order number
  originalRejectionReason: String, // Original rejection reason (for alternative orders)
  isAlternativeOrder: Boolean, // Whether this is an alternative order
  supplierModifications: Object, // If supplier proposes changes
  modificationApproved: Boolean, // If PM/OWNER approved supplier modifications
  materialResponses: Array, // Material-level responses for bulk orders: [{ materialRequestId, action: 'accept'|'reject'|'modify', status: 'pending'|'accepted'|'rejected'|'modified', notes, rejectionReason, rejectionSubcategory, modifications: { unitCost, quantityOrdered, deliveryDate }, respondedAt }]
  supportsPartialResponse: Boolean, // Whether this order supports partial responses (true for bulk orders)
  deliveryNoteFileUrl: String, // Uploaded by supplier
  actualQuantityDelivered: Number, // Actual quantity delivered (may differ from ordered)
  linkedMaterialId: 'ObjectId', // Material entry created from this order
  createdBy: 'ObjectId', // PM/OWNER who created the order
  createdByName: String,
  financialStatus: String, // 'not_committed', 'committed', 'fulfilled'
  committedAt: Date, // When order was accepted (committed)
  fulfilledAt: Date, // When material entry created (fulfilled)
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date, // Soft delete
  idempotencyKey: String, // SHA256 hash to prevent duplicate POs on retry (e.g., after 404)
};

/**
 * Valid purchase order statuses
 */
export const VALID_PURCHASE_ORDER_STATUSES = [
  'order_sent',
  'order_accepted',
  'order_rejected',
  'order_modified',
  'order_partially_responded', // For bulk orders with mixed responses
  'retry_requested',
  'retry_sent',
  'alternatives_sent',
  'ready_for_delivery',
  'delivered',
  'cancelled',
];

/**
 * Retry workflow statuses (subset of main statuses)
 */
export const RETRY_STATUSES = [
  'retry_requested',
  'retry_sent',
];

/**
 * Valid supplier responses
 */
export const VALID_SUPPLIER_RESPONSES = ['accept', 'reject', 'modify'];

/**
 * Valid financial statuses
 */
export const VALID_FINANCIAL_STATUSES = ['not_committed', 'committed', 'fulfilled'];

/**
 * Validation rules for purchase orders
 */
export const PURCHASE_ORDER_VALIDATION = {
  purchaseOrderNumber: {
    required: false, // Auto-generated
    type: 'string',
    pattern: /^PO-\d{8}-\d{3}$/,
  },
  materialRequestId: {
    required: true,
    type: 'ObjectId',
  },
  supplierId: {
    required: true,
    type: 'ObjectId',
  },
  projectId: {
    required: true,
    type: 'ObjectId',
  },
  quantityOrdered: {
    required: true,
    type: 'number',
    min: 0.01,
  },
  unitCost: {
    required: true,
    type: 'number',
    min: 0.01, // CRITICAL FIX: Require unitCost > 0 to prevent data loss
  },
  totalCost: {
    required: true,
    type: 'number',
    min: 0,
  },
  deliveryDate: {
    required: true,
    type: 'Date',
  },
  status: {
    required: true,
    type: 'string',
    enum: VALID_PURCHASE_ORDER_STATUSES,
    default: 'order_sent',
  },
  financialStatus: {
    required: true,
    type: 'string',
    enum: VALID_FINANCIAL_STATUSES,
    default: 'not_committed',
  },
  rejectionReason: {
    required: false,
    type: 'string',
    validate: (value) => {
      // Import would cause circular dependency, so basic validation
      const validReasons = [
        'price_too_high', 'unavailable', 'timeline', 'specifications',
        'quantity', 'business_policy', 'external_factors', 'other'
      ];
      return !value || validReasons.includes(value);
    },
  },
  rejectionSubcategory: {
    required: false,
    type: 'string',
  },
  isRetryable: {
    required: false,
    type: 'boolean',
    default: null,
  },
  retryRecommendation: {
    required: false,
    type: 'string',
    maxLength: 500,
  },
};

/**
 * Validate purchase order data
 * @param {Object} data - Purchase order data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validatePurchaseOrder(data) {
  const errors = [];

  // Required fields
  if (!data.materialRequestId) {
    errors.push('materialRequestId is required');
  }
  if (!data.supplierId) {
    errors.push('supplierId is required');
  }
  if (!data.projectId) {
    errors.push('projectId is required');
  }
  if (!data.quantityOrdered || data.quantityOrdered <= 0) {
    errors.push('quantityOrdered is required and must be greater than 0');
  }
  // CRITICAL FIX: Require unitCost > 0 to prevent data loss in material creation
  if (data.unitCost === undefined || data.unitCost === null || isNaN(parseFloat(data.unitCost)) || parseFloat(data.unitCost) <= 0) {
    errors.push('unitCost is required and must be greater than 0');
  }
  if (data.totalCost === undefined || data.totalCost < 0) {
    errors.push('totalCost is required and must be >= 0');
  }
  if (!data.deliveryDate) {
    errors.push('deliveryDate is required');
  }

  // Validate totalCost calculation
  if (data.quantityOrdered && data.unitCost !== undefined && data.totalCost !== undefined) {
    const expectedTotal = data.quantityOrdered * data.unitCost;
    if (Math.abs(data.totalCost - expectedTotal) > 0.01) {
      errors.push(`totalCost (${data.totalCost}) must equal quantityOrdered (${data.quantityOrdered}) * unitCost (${data.unitCost}) = ${expectedTotal}`);
    }
  }

  // Validate delivery date is in the future
  if (data.deliveryDate) {
    const deliveryDate = new Date(data.deliveryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deliveryDate < today) {
      errors.push('deliveryDate must be a future date');
    }
  }

  // Validate status
  if (data.status && !VALID_PURCHASE_ORDER_STATUSES.includes(data.status)) {
    errors.push(`status must be one of: ${VALID_PURCHASE_ORDER_STATUSES.join(', ')}`);
  }

  // Validate financial status
  if (data.financialStatus && !VALID_FINANCIAL_STATUSES.includes(data.financialStatus)) {
    errors.push(`financialStatus must be one of: ${VALID_FINANCIAL_STATUSES.join(', ')}`);
  }

  // Validate phaseId (required)
  if (!data.phaseId) {
    errors.push('phaseId is required for phase tracking and financial management');
  } else if (typeof data.phaseId === 'string' && !data.phaseId.match(/^[0-9a-fA-F]{24}$/)) {
    errors.push('Invalid phaseId format');
  } else if (data.phaseId && typeof data.phaseId !== 'object' && typeof data.phaseId !== 'string') {
    errors.push('Invalid phaseId format');
  }

  // Validate rejection reason
  if (data.rejectionReason) {
    const validReasons = [
      'price_too_high', 'unavailable', 'timeline', 'specifications',
      'quantity', 'business_policy', 'external_factors', 'other'
    ];
    if (!validReasons.includes(data.rejectionReason)) {
      errors.push(`rejectionReason must be one of: ${validReasons.join(', ')}`);
    }
  }

  // Validate rejection subcategory (only present if rejectionReason exists)
  if (data.rejectionSubcategory && !data.rejectionReason) {
    errors.push('rejectionSubcategory requires rejectionReason to be present');
  }

  // Validate retry recommendation (only present if isRetryable is true)
  if (data.isRetryable === false && !data.retryRecommendation) {
    errors.push('retryRecommendation is required when isRetryable is false');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

