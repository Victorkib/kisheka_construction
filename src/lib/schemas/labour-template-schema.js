/**
 * Labour Template Schema Definition
 * Templates for common labour entry patterns
 */

import { ObjectId } from 'mongodb';

/**
 * Labour Template Schema
 * @typedef {Object} LabourTemplateSchema
 * @property {string} name - Template name (required, min 2 chars, max 200)
 * @property {string} [description] - Optional description
 * @property {boolean} isPublic - Can others use it (default: false)
 * @property {string} [status] - Template status: 'official', 'community', 'private', 'deprecated'
 * @property {string} [templateCategory] - Category type: 'construction_phase', 'work_category', 'project_type', 'daily_crew'
 * @property {string} [templateType] - Specific type within category
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
 * @property {Array<Object>} labourEntries - Array of labour entry objects (template structure)
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

export const LABOUR_TEMPLATE_SCHEMA = {
  name: String, // Required, min 2 chars, max 200
  description: String, // Optional
  isPublic: Boolean, // Default: false
  status: String, // 'official', 'community', 'private', 'deprecated'
  templateCategory: String, // Optional
  templateType: String, // Optional
  tags: [String], // Optional: array of tags
  projectPhase: String, // Optional
  applicableFloors: [Number], // Optional: array of floor numbers, or can be 'all'
  createdBy: 'ObjectId', // Required
  createdByName: String, // Denormalized creator name
  validatedBy: 'ObjectId', // Optional
  validatedAt: Date, // Optional
  lastValidatedAt: Date, // Optional
  validationStatus: String, // Optional
  expiresAt: Date, // Optional
  labourEntries: [
    {
      workerName: String, // Required (can be placeholder like "Mason 1")
      workerType: String, // 'internal' | 'external' | 'professional'
      workerRole: String, // 'skilled' | 'unskilled' | 'supervisory' | 'professional'
      skillType: String, // Required
      totalHours: Number, // Required, > 0
      overtimeHours: Number, // Optional, default: 0
      hourlyRate: Number, // Required, >= 0 (can be placeholder, will use worker's rate)
      dailyRate: Number, // Optional
      taskDescription: String, // Optional
      breakDuration: Number, // Optional, default: 0
      quantityCompleted: Number, // Optional, for piecework
      unitOfMeasure: String, // Optional
      unitRate: Number, // Optional
      serviceType: String, // Optional, for professionals
      visitPurpose: String, // Optional, for professionals
      deliverables: [String], // Optional, for professionals
      isPlaceholder: Boolean, // If true, workerName is a placeholder (e.g., "Mason 1")
      placeholderType: String, // 'worker_name' | 'rate' | 'hours' - what needs to be filled
    },
  ],
  defaultProjectSettings: {
    defaultPhaseId: 'ObjectId', // Optional
    defaultFloorId: 'ObjectId', // Optional
    defaultCategoryId: 'ObjectId', // Optional
    defaultDate: Date, // Optional
    defaultWorkerRole: String, // Optional
    defaultEntryType: String, // Optional: 'time_based' | 'task_based' | 'professional_service'
  },
  estimatedTotalCost: Number, // Optional: auto-calculated
  costLastUpdated: Date, // Optional
  usageCount: Number, // Default: 0
  lastUsedAt: Date, // Optional
  lastUsedBy: 'ObjectId', // Optional
  parentTemplateId: 'ObjectId', // Optional
  variantType: String, // Optional
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date, // Soft delete
};

/**
 * Valid template statuses
 */
export const TEMPLATE_STATUS = {
  OFFICIAL: 'official',
  COMMUNITY: 'community',
  PRIVATE: 'private',
  DEPRECATED: 'deprecated',
};

/**
 * Valid template categories
 */
export const TEMPLATE_CATEGORY_TYPES = [
  'construction_phase',
  'work_category',
  'project_type',
  'daily_crew',
  'specialized_team',
];

/**
 * Validation rules for labour templates
 */
export const LABOUR_TEMPLATE_VALIDATION = {
  name: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 200,
  },
  createdBy: {
    required: true,
    type: 'ObjectId',
  },
  labourEntries: {
    required: true,
    type: 'array',
    minLength: 1,
  },
};

/**
 * Validate labour template data
 * @param {Object} data - Template data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateLabourTemplate(data) {
  const errors = [];

  // Required fields
  if (!data.name || data.name.trim().length < 2) {
    errors.push('Template name is required and must be at least 2 characters');
  }

  if (data.name && data.name.length > 200) {
    errors.push('Template name must be less than 200 characters');
  }

  if (!data.createdBy || !ObjectId.isValid(data.createdBy)) {
    errors.push('Valid createdBy is required');
  }

  // Validate labour entries
  if (!data.labourEntries || !Array.isArray(data.labourEntries) || data.labourEntries.length === 0) {
    errors.push('At least one labour entry is required in the template');
  } else {
    data.labourEntries.forEach((entry, index) => {
      if (!entry.workerName || entry.workerName.trim().length < 2) {
        errors.push(`Entry ${index + 1}: workerName is required and must be at least 2 characters`);
      }
      if (!entry.skillType) {
        errors.push(`Entry ${index + 1}: skillType is required`);
      }
      if (entry.totalHours === undefined || entry.totalHours === null || isNaN(entry.totalHours) || entry.totalHours <= 0) {
        errors.push(`Entry ${index + 1}: totalHours is required and must be > 0`);
      }
      if (entry.hourlyRate === undefined || entry.hourlyRate === null || isNaN(entry.hourlyRate) || entry.hourlyRate < 0) {
        errors.push(`Entry ${index + 1}: hourlyRate is required and must be >= 0`);
      }
    });
  }

  // Validate status
  if (data.status && !Object.values(TEMPLATE_STATUS).includes(data.status)) {
    errors.push(`status must be one of: ${Object.values(TEMPLATE_STATUS).join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate template total cost
 * @param {Object} template - Template object
 * @returns {number} Total estimated cost
 */
export function calculateTemplateTotalCost(template) {
  if (!template || !template.labourEntries || !Array.isArray(template.labourEntries)) {
    return 0;
  }

  return template.labourEntries.reduce((total, entry) => {
    const regularHours = Math.min(8, parseFloat(entry.totalHours) || 0);
    const overtimeHours = parseFloat(entry.overtimeHours) || Math.max(0, (parseFloat(entry.totalHours) || 0) - 8);
    const hourlyRate = parseFloat(entry.hourlyRate) || 0;
    const overtimeRate = hourlyRate * 1.5;

    const regularCost = regularHours * hourlyRate;
    const overtimeCost = overtimeHours * overtimeRate;

    // If daily rate provided and no hours, use daily rate
    if (entry.dailyRate && entry.dailyRate > 0 && (regularHours + overtimeHours) === 0) {
      return total + entry.dailyRate;
    }

    return total + regularCost + overtimeCost;
  }, 0);
}

/**
 * Create labour template object
 * @param {Object} input - Template input data
 * @param {ObjectId} createdBy - Creator user ID
 * @param {string} createdByName - Creator name
 * @returns {Object} Labour template object
 */
export function createLabourTemplate(input, createdBy, createdByName) {
  const {
    name,
    description,
    isPublic = false,
    status,
    templateCategory,
    templateType,
    tags = [],
    projectPhase,
    applicableFloors,
    labourEntries = [],
    defaultProjectSettings = {},
    expiresAt,
  } = input;

  // Determine default status
  const defaultStatus = isPublic ? TEMPLATE_STATUS.COMMUNITY : TEMPLATE_STATUS.PRIVATE;
  const finalStatus = status || defaultStatus;

  // Calculate total cost
  const estimatedTotalCost = calculateTemplateTotalCost({ labourEntries });

  return {
    name: name.trim(),
    description: description?.trim() || '',
    isPublic: isPublic || false,
    status: finalStatus,
    templateCategory: templateCategory || null,
    templateType: templateType || null,
    tags: Array.isArray(tags) ? tags.filter((t) => t && t.trim()).map((t) => t.trim()) : [],
    projectPhase: projectPhase || null,
    applicableFloors:
      applicableFloors === 'all'
        ? 'all'
        : Array.isArray(applicableFloors)
        ? applicableFloors.map((f) => parseInt(f, 10)).filter((f) => !isNaN(f))
        : null,
    createdBy: ObjectId.isValid(createdBy) ? new ObjectId(createdBy) : createdBy,
    createdByName: createdByName || '',
    validatedBy: null,
    validatedAt: null,
    lastValidatedAt: null,
    validationStatus: null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    labourEntries: labourEntries.map((entry) => ({
      workerName: entry.workerName?.trim() || '',
      workerType: entry.workerType || 'internal',
      workerRole: entry.workerRole || 'skilled',
      skillType: entry.skillType || 'general_worker',
      totalHours: parseFloat(entry.totalHours) || 8,
      overtimeHours: parseFloat(entry.overtimeHours) || 0,
      hourlyRate: parseFloat(entry.hourlyRate) || 0,
      dailyRate: entry.dailyRate ? parseFloat(entry.dailyRate) : null,
      taskDescription: entry.taskDescription?.trim() || '',
      breakDuration: parseFloat(entry.breakDuration) || 0,
      quantityCompleted: entry.quantityCompleted ? parseFloat(entry.quantityCompleted) : null,
      unitOfMeasure: entry.unitOfMeasure?.trim() || null,
      unitRate: entry.unitRate ? parseFloat(entry.unitRate) : null,
      serviceType: entry.serviceType || null,
      visitPurpose: entry.visitPurpose?.trim() || null,
      deliverables: Array.isArray(entry.deliverables) ? entry.deliverables : [],
      isPlaceholder: entry.isPlaceholder || false,
      placeholderType: entry.placeholderType || null,
    })),
    defaultProjectSettings: {
      defaultPhaseId: defaultProjectSettings.defaultPhaseId && ObjectId.isValid(defaultProjectSettings.defaultPhaseId)
        ? new ObjectId(defaultProjectSettings.defaultPhaseId)
        : null,
      defaultFloorId: defaultProjectSettings.defaultFloorId && ObjectId.isValid(defaultProjectSettings.defaultFloorId)
        ? new ObjectId(defaultProjectSettings.defaultFloorId)
        : null,
      defaultCategoryId:
        defaultProjectSettings.defaultCategoryId && ObjectId.isValid(defaultProjectSettings.defaultCategoryId)
          ? new ObjectId(defaultProjectSettings.defaultCategoryId)
          : null,
      defaultDate: defaultProjectSettings.defaultDate ? new Date(defaultProjectSettings.defaultDate) : null,
      defaultWorkerRole: defaultProjectSettings.defaultWorkerRole || 'skilled',
      defaultEntryType: defaultProjectSettings.defaultEntryType || 'time_based',
    },
    estimatedTotalCost,
    costLastUpdated: estimatedTotalCost > 0 ? new Date() : null,
    usageCount: 0,
    lastUsedAt: null,
    lastUsedBy: null,
    parentTemplateId: null,
    variantType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

/**
 * Apply template to create labour entries
 * @param {Object} template - Template object
 * @param {Object} overrides - Override values (projectId, phaseId, date, etc.)
 * @param {Object} workerMap - Map of placeholder names to actual worker data
 * @returns {Array} Array of labour entry objects ready for batch creation
 */
export function applyLabourTemplate(template, overrides = {}, workerMap = {}) {
  if (!template || !template.labourEntries || !Array.isArray(template.labourEntries)) {
    return [];
  }

  const defaultSettings = template.defaultProjectSettings || {};

  return template.labourEntries.map((entry) => {
    // Resolve worker name from placeholder if needed
    let workerName = entry.workerName;
    if (entry.isPlaceholder && workerMap[entry.workerName]) {
      workerName = workerMap[entry.workerName].workerName || entry.workerName;
    }

    // Resolve rate from worker if placeholder
    let hourlyRate = entry.hourlyRate;
    if (entry.placeholderType === 'rate' && workerMap[entry.workerName]) {
      hourlyRate = workerMap[entry.workerName].defaultHourlyRate || entry.hourlyRate;
    }

    return {
      workerName,
      workerType: entry.workerType || 'internal',
      workerRole: entry.workerRole || defaultSettings.defaultWorkerRole || 'skilled',
      skillType: entry.skillType,
      totalHours: entry.totalHours,
      overtimeHours: entry.overtimeHours || 0,
      hourlyRate,
      dailyRate: entry.dailyRate,
      taskDescription: entry.taskDescription || '',
      breakDuration: entry.breakDuration || 0,
      quantityCompleted: entry.quantityCompleted,
      unitOfMeasure: entry.unitOfMeasure,
      unitRate: entry.unitRate,
      serviceType: entry.serviceType,
      visitPurpose: entry.visitPurpose,
      deliverables: entry.deliverables || [],
      // Apply overrides
      projectId: overrides.projectId || null,
      phaseId: overrides.phaseId || defaultSettings.defaultPhaseId || null,
      floorId: overrides.floorId || defaultSettings.defaultFloorId || null,
      categoryId: overrides.categoryId || defaultSettings.defaultCategoryId || null,
      entryDate: overrides.entryDate || defaultSettings.defaultDate || new Date(),
    };
  });
}

export default {
  LABOUR_TEMPLATE_SCHEMA,
  TEMPLATE_STATUS,
  TEMPLATE_CATEGORY_TYPES,
  LABOUR_TEMPLATE_VALIDATION,
  validateLabourTemplate,
  calculateTemplateTotalCost,
  createLabourTemplate,
  applyLabourTemplate,
};

