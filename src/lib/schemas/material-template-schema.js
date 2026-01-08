/**
 * Material Template Schema Definition
 * Schema for saving and reusing material combinations
 */

/**
 * Template Status Values
 */
export const TEMPLATE_STATUS = {
  OFFICIAL: 'official', // OWNER-validated, recommended
  COMMUNITY: 'community', // User-created, public
  PRIVATE: 'private', // User's personal templates
  DEPRECATED: 'deprecated', // Marked as outdated but kept for reference
};

/**
 * Template Category Types
 */
export const TEMPLATE_CATEGORY_TYPES = {
  CONSTRUCTION_PHASE: 'construction_phase',
  WORK_CATEGORY: 'work_category',
  PROJECT_TYPE: 'project_type',
};

/**
 * Project Phases (from OrgDoc.md)
 * NOTE: 'pre_construction' removed - pre-construction costs tracked via initial_expenses collection
 */
export const PROJECT_PHASES = [
  // 'pre_construction', // REMOVED - pre-construction tracked via initial_expenses
  'basement_substructure',
  'superstructure',
  'doors_windows',
  'electrical',
  'plumbing',
  'joinery',
  'paintwork',
  'tiling_terrazzo',
  'lift_installation',
];

/**
 * Material Template Schema
 * @typedef {Object} MaterialTemplateSchema
 * @property {string} name - Template name (required, min 2 chars, max 200)
 * @property {string} [description] - Optional description
 * @property {boolean} isPublic - Can others use it (default: false)
 * @property {string} [status] - Template status: 'official', 'community', 'private', 'deprecated'
 * @property {string} [templateCategory] - Category type: 'construction_phase', 'work_category', 'project_type'
 * @property {string} [templateType] - Specific type within category (e.g., 'foundation', 'electrical')
 * @property {Array<string>} [tags] - Tags for filtering and search
 * @property {string} [projectPhase] - Project phase this template applies to
 * @property {Array<number>|string} [applicableFloors] - Floors this template applies to, or 'all'
 * @property {ObjectId} createdBy - User who created the template
 * @property {string} createdByName - Name of creator
 * @property {ObjectId} [validatedBy] - OWNER who validated (for official templates)
 * @property {Date} [validatedAt] - When template was validated
 * @property {Date} [lastValidatedAt] - Last validation date
 * @property {string} [validationStatus] - 'valid', 'needs_review', 'outdated'
 * @property {Date} [expiresAt] - Expiration date for cost-sensitive templates
 * @property {Array<Object>} materials - Array of material objects
 * @property {Object} [defaultProjectSettings] - Default settings for projects
 * @property {number} [estimatedTotalCost] - Auto-calculated total cost
 * @property {Date} [costLastUpdated] - When costs were last updated
 * @property {number} usageCount - How many times used (default: 0)
 * @property {Date} [lastUsedAt] - Last time used
 * @property {ObjectId} [lastUsedBy] - Last user who used it
 * @property {ObjectId} [parentTemplateId] - If this is a variant of another template
 * @property {string} [variantType] - Variant type: 'small', 'medium', 'large', 'custom'
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 */

export const MATERIAL_TEMPLATE_SCHEMA = {
  name: String, // Required, min 2 chars, max 200
  description: String, // Optional
  isPublic: Boolean, // Default: false
  status: String, // 'official', 'community', 'private', 'deprecated' (default: 'community' for public, 'private' for private)
  templateCategory: String, // Optional: 'construction_phase', 'work_category', 'project_type'
  templateType: String, // Optional: specific type within category
  tags: [String], // Optional: array of tags
  projectPhase: String, // Optional: from PROJECT_PHASES
  applicableFloors: [Number], // Optional: array of floor numbers, or can be 'all'
  createdBy: 'ObjectId', // Required
  createdByName: String, // Denormalized creator name
  validatedBy: 'ObjectId', // Optional: OWNER who validated
  validatedAt: Date, // Optional: when validated
  lastValidatedAt: Date, // Optional: last validation date
  validationStatus: String, // Optional: 'valid', 'needs_review', 'outdated'
  expiresAt: Date, // Optional: expiration date
  materials: [
    {
      name: String, // Required
      quantityNeeded: Number, // Required, > 0
      quantityPerUnit: Number, // Optional: for scaling (e.g., per floor)
      unit: String, // Required
      categoryId: 'ObjectId', // Optional
      category: String, // Optional, denormalized
      estimatedUnitCost: Number, // Optional, >= 0
      estimatedCost: Number, // Optional, auto-calculated
      description: String, // Optional
      specifications: String, // Optional
      libraryMaterialId: 'ObjectId', // Optional, if from library
      isScalable: Boolean, // Optional: can quantity be scaled?
      scalingFactor: String, // Optional: 'per_floor', 'per_sqm', 'fixed'
    },
  ],
  defaultProjectSettings: {
    defaultUrgency: String, // Optional, 'low', 'medium', 'high', 'critical'
    defaultReason: String, // Optional
    defaultCategoryId: 'ObjectId', // Optional
    defaultFloorId: 'ObjectId', // Optional
  },
  estimatedTotalCost: Number, // Optional: auto-calculated
  costLastUpdated: Date, // Optional: when costs were last updated
  usageCount: Number, // Default: 0
  lastUsedAt: Date, // Updated when used
  lastUsedBy: 'ObjectId', // Last user who used it
  parentTemplateId: 'ObjectId', // Optional: if this is a variant
  variantType: String, // Optional: 'small', 'medium', 'large', 'custom'
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date, // Soft delete
};

/**
 * Validate material template data
 * @param {Object} data - Template data to validate
 * @returns {{isValid: boolean, errors: Array<string>}}
 */
export function validateMaterialTemplate(data) {
  const errors = [];

  if (!data.name || data.name.trim().length < 2) {
    errors.push('Template name is required and must be at least 2 characters');
  }

  if (data.name && data.name.length > 200) {
    errors.push('Template name must be less than 200 characters');
  }

  if (!Array.isArray(data.materials) || data.materials.length === 0) {
    errors.push('Template must contain at least one material');
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

  // Validate each material
  data.materials?.forEach((material, index) => {
    if (!material.name || material.name.trim().length < 2) {
      errors.push(`Material ${index + 1}: Name is required and must be at least 2 characters`);
    }
    if (!material.quantityNeeded || parseFloat(material.quantityNeeded) <= 0) {
      errors.push(`Material ${index + 1}: Quantity must be greater than 0`);
    }
    if (!material.unit || material.unit.trim().length === 0) {
      errors.push(`Material ${index + 1}: Unit is required`);
    }
    if (material.estimatedUnitCost !== undefined && parseFloat(material.estimatedUnitCost) < 0) {
      errors.push(`Material ${index + 1}: Estimated unit cost must be >= 0`);
    }
    if (material.quantityPerUnit !== undefined && parseFloat(material.quantityPerUnit) <= 0) {
      errors.push(`Material ${index + 1}: Quantity per unit must be greater than 0`);
    }
    if (material.scalingFactor && !['per_floor', 'per_sqm', 'fixed'].includes(material.scalingFactor)) {
      errors.push(`Material ${index + 1}: Scaling factor must be 'per_floor', 'per_sqm', or 'fixed'`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate estimated total cost from materials
 * @param {Array} materials - Array of material objects
 * @returns {number} Total estimated cost
 */
export function calculateTemplateTotalCost(materials) {
  if (!Array.isArray(materials)) return 0;
  
  return materials.reduce((total, material) => {
    const cost = material.estimatedCost || 
                 (material.estimatedUnitCost && material.quantityNeeded 
                  ? material.estimatedUnitCost * material.quantityNeeded 
                  : 0);
    return total + (cost || 0);
  }, 0);
}

