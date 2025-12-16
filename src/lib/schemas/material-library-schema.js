/**
 * Material Library Schema Definition
 * Centralized schema for material library entries
 */

/**
 * Material Library Schema
 * @typedef {Object} MaterialLibrarySchema
 * @property {string} name - Material name (required, min 2 chars, max 200)
 * @property {string} [description] - Optional description
 * @property {ObjectId} [categoryId] - Link to category
 * @property {string} category - Denormalized category name
 * @property {string} defaultUnit - Default unit of measurement (required)
 * @property {number} [defaultUnitCost] - Estimated unit cost (optional, >= 0)
 * @property {string} [materialCode] - Optional material code
 * @property {string} [brand] - Optional brand name
 * @property {string} [specifications] - Optional specifications (e.g., "Grade 42.5", "12mm diameter")
 * @property {number} usageCount - How many times used in requests (default: 0, auto-incremented)
 * @property {Date} [lastUsedAt] - Last time used
 * @property {ObjectId} [lastUsedBy] - Last user who used it
 * @property {boolean} isActive - Active status (default: true)
 * @property {boolean} isCommon - Marked as commonly used (default: false)
 * @property {ObjectId} createdBy - OWNER who created
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 */

export const MATERIAL_LIBRARY_SCHEMA = {
  name: String, // Required, min 2 chars, max 200
  description: String, // Optional
  categoryId: 'ObjectId', // Optional, link to category
  category: String, // Denormalized category name
  defaultUnit: String, // Required, must be valid unit
  defaultUnitCost: Number, // Optional, >= 0
  materialCode: String, // Optional
  brand: String, // Optional
  specifications: String, // Optional, e.g., "Grade 42.5", "12mm diameter"
  usageCount: Number, // Default: 0, auto-incremented
  lastUsedAt: Date, // Updated when used
  lastUsedBy: 'ObjectId', // Last user who used it
  isActive: Boolean, // Default: true
  isCommon: Boolean, // Default: false, marked as commonly used
  createdBy: 'ObjectId', // OWNER who created
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date, // Soft delete
};

/**
 * Valid units of measurement
 */
export const VALID_UNITS = [
  'piece',
  'bag',
  'kg',
  'ton',
  'liter',
  'gallon',
  'meter',
  'square meter',
  'cubic meter',
  'roll',
  'sheet',
  'box',
  'carton',
  'pack',
  'set',
  'pair',
  'dozen',
  'lorry',
  'truck',
  'others',
];

/**
 * Validation rules for material library
 */
export const MATERIAL_LIBRARY_VALIDATION = {
  name: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 200,
  },
  description: {
    required: false,
    type: 'string',
    maxLength: 1000,
  },
  categoryId: {
    required: false,
    type: 'ObjectId',
  },
  defaultUnit: {
    required: true,
    type: 'string',
    enum: VALID_UNITS,
  },
  defaultUnitCost: {
    required: false,
    type: 'number',
    min: 0,
  },
  materialCode: {
    required: false,
    type: 'string',
    maxLength: 50,
  },
  brand: {
    required: false,
    type: 'string',
    maxLength: 100,
  },
  specifications: {
    required: false,
    type: 'string',
    maxLength: 500,
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
 * Validate material library data
 * @param {Object} data - Material library data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateMaterialLibrary(data) {
  const errors = [];

  // Required fields
  if (!data.name || data.name.trim().length < 2) {
    errors.push('Material name is required and must be at least 2 characters');
  }

  if (data.name && data.name.length > 200) {
    errors.push('Material name must be less than 200 characters');
  }

  if (!data.defaultUnit || !VALID_UNITS.includes(data.defaultUnit)) {
    errors.push(`Unit is required and must be one of: ${VALID_UNITS.join(', ')}`);
  }

  // Optional field validation
  if (data.defaultUnitCost !== undefined && data.defaultUnitCost < 0) {
    errors.push('Default unit cost must be >= 0');
  }

  if (data.description && data.description.length > 1000) {
    errors.push('Description must be less than 1000 characters');
  }

  if (data.materialCode && data.materialCode.length > 50) {
    errors.push('Material code must be less than 50 characters');
  }

  if (data.brand && data.brand.length > 100) {
    errors.push('Brand must be less than 100 characters');
  }

  if (data.specifications && data.specifications.length > 500) {
    errors.push('Specifications must be less than 500 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

