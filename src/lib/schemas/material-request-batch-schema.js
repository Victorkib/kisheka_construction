/**
 * Material Request Batch Schema Definition
 * Centralized schema for material request batches
 */

/**
 * Material Request Batch Schema
 * @typedef {Object} MaterialRequestBatchSchema
 * @property {string} batchNumber - Auto-generated: BATCH-YYYYMMDD-001 (unique)
 * @property {string} batchName - Optional user-defined name
 * @property {ObjectId} projectId - Project ID (required)
 * @property {ObjectId} [defaultFloorId] - Default floor ID (optional)
 * @property {ObjectId} [defaultCategoryId] - Default category ID (optional)
 * @property {string} defaultUrgency - Default urgency: 'low', 'medium', 'high', 'critical'
 * @property {string} [defaultReason] - Default reason for all materials
 * @property {ObjectId} createdBy - User ID who created
 * @property {string} createdByName - Denormalized creator name
 * @property {string} status - Status: 'draft', 'submitted', 'pending_approval', 'approved', 'partially_ordered', 'fully_ordered', 'cancelled'
 * @property {ObjectId[]} materialRequestIds - Array of material request IDs
 * @property {ObjectId} [approvedBy] - User who approved
 * @property {Date} [approvedAt] - Approval timestamp
 * @property {string} [approvalNotes] - Approval notes
 * @property {string} [supplierAssignmentMode] - 'single' or 'multiple'
 * @property {ObjectId[]} [assignedSuppliers] - Array of supplier IDs
 * @property {ObjectId[]} [purchaseOrderIds] - Array of purchase order IDs
 * @property {number} totalMaterials - Total number of materials in batch
 * @property {number} totalEstimatedCost - Total estimated cost
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 */

export const MATERIAL_REQUEST_BATCH_SCHEMA = {
  batchNumber: String, // Auto-generated: BATCH-YYYYMMDD-001
  batchName: String, // Optional
  projectId: 'ObjectId', // Required
  defaultFloorId: 'ObjectId', // Optional
  defaultCategoryId: 'ObjectId', // Optional
  defaultUrgency: String, // 'low', 'medium', 'high', 'critical'
  defaultReason: String, // Optional
  createdBy: 'ObjectId', // Required
  createdByName: String, // Denormalized
  status: String, // 'draft', 'submitted', 'pending_approval', 'approved', 'partially_ordered', 'fully_ordered', 'cancelled'
  materialRequestIds: ['ObjectId'], // Array of request IDs
  approvedBy: 'ObjectId', // Optional
  approvedAt: Date, // Optional
  approvalNotes: String, // Optional
  supplierAssignmentMode: String, // 'single', 'multiple'
  assignedSuppliers: ['ObjectId'], // Array of supplier IDs
  purchaseOrderIds: ['ObjectId'], // Array of PO IDs
  totalMaterials: Number, // Total count
  totalEstimatedCost: Number, // Total cost
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date, // Soft delete
};

/**
 * Valid batch statuses
 */
export const VALID_BATCH_STATUSES = [
  'draft',
  'submitted',
  'pending_approval',
  'approved',
  'partially_ordered',
  'fully_ordered',
  'cancelled',
];

/**
 * Valid supplier assignment modes
 */
export const VALID_SUPPLIER_MODES = ['single', 'multiple'];

/**
 * Validation rules for material request batches
 */
export const MATERIAL_REQUEST_BATCH_VALIDATION = {
  batchNumber: {
    required: false, // Auto-generated
    type: 'string',
    pattern: /^BATCH-\d{8}-\d{3}$/,
  },
  projectId: {
    required: true,
    type: 'ObjectId',
  },
  createdBy: {
    required: true,
    type: 'ObjectId',
  },
  status: {
    required: true,
    type: 'string',
    enum: VALID_BATCH_STATUSES,
    default: 'draft',
  },
  defaultUrgency: {
    required: false,
    type: 'string',
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
};

/**
 * Validate material request batch data
 * @param {Object} data - Batch data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateMaterialRequestBatch(data) {
  const errors = [];

  // Required fields
  if (!data.projectId) {
    errors.push('projectId is required');
  }

  if (!data.createdBy) {
    errors.push('createdBy is required');
  }

  // Validate status
  if (data.status && !VALID_BATCH_STATUSES.includes(data.status)) {
    errors.push(`status must be one of: ${VALID_BATCH_STATUSES.join(', ')}`);
  }

  // Validate default urgency
  if (data.defaultUrgency && !['low', 'medium', 'high', 'critical'].includes(data.defaultUrgency)) {
    errors.push('defaultUrgency must be one of: low, medium, high, critical');
  }

  // Validate supplier assignment mode
  if (data.supplierAssignmentMode && !VALID_SUPPLIER_MODES.includes(data.supplierAssignmentMode)) {
    errors.push(`supplierAssignmentMode must be one of: ${VALID_SUPPLIER_MODES.join(', ')}`);
  }

  // Validate materials array
  if (data.materials && Array.isArray(data.materials)) {
    if (data.materials.length === 0) {
      errors.push('At least one material is required');
    }

    data.materials.forEach((material, index) => {
      if (!material.name || material.name.trim().length < 2) {
        errors.push(`Material ${index + 1}: name is required and must be at least 2 characters`);
      }
      if (!material.quantityNeeded || material.quantityNeeded <= 0) {
        errors.push(`Material ${index + 1}: quantityNeeded is required and must be greater than 0`);
      }
      if (!material.unit || material.unit.trim().length === 0) {
        errors.push(`Material ${index + 1}: unit is required`);
      }
      if (material.estimatedUnitCost !== undefined && material.estimatedUnitCost < 0) {
        errors.push(`Material ${index + 1}: estimatedUnitCost must be >= 0`);
      }
      // Phase Enforcement: Validate phaseId format if provided (actual validation happens in API)
      if (material.phaseId !== undefined && material.phaseId !== null && material.phaseId !== '') {
        const isValidObjectId = (id) => {
          if (typeof id === 'string') {
            return /^[0-9a-fA-F]{24}$/.test(id);
          }
          return id && typeof id === 'object' && id.toString && /^[0-9a-fA-F]{24}$/.test(id.toString());
        };
        if (!isValidObjectId(material.phaseId)) {
          errors.push(`Material ${index + 1}: Invalid phaseId format. phaseId must be a valid ObjectId`);
        }
      }
    });
    
    // Phase Enforcement: Require either defaultPhaseId or all materials have phaseId
    const hasDefaultPhase = data.defaultPhaseId && (
      (typeof data.defaultPhaseId === 'string' && /^[0-9a-fA-F]{24}$/.test(data.defaultPhaseId)) ||
      (typeof data.defaultPhaseId === 'object')
    );
    const materialsWithPhase = data.materials ? data.materials.filter(m => 
      m.phaseId && (
        (typeof m.phaseId === 'string' && /^[0-9a-fA-F]{24}$/.test(m.phaseId)) ||
        (typeof m.phaseId === 'object')
      )
    ) : [];
    const allMaterialsHavePhase = data.materials && data.materials.length === materialsWithPhase.length;
    
    if (!hasDefaultPhase && !allMaterialsHavePhase) {
      errors.push(
        'Phase selection is required. Either provide defaultPhaseId for all materials, or specify phaseId for each material. ' +
        `Currently: ${materialsWithPhase.length} of ${data.materials?.length || 0} materials have phaseId, and no defaultPhaseId provided.`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

