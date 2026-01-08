/**
 * Phase Template Schema Definition
 * Defines phase templates for quick project setup
 */

/**
 * Phase Template Schema
 * @typedef {Object} PhaseTemplateSchema
 * @property {ObjectId} _id - Template ID
 * @property {string} templateName - Template name (required)
 * @property {string} templateType - 'residential' | 'commercial' | 'infrastructure' | 'custom'
 * @property {string} [description] - Template description
 * @property {Array} phases - Array of phase definitions
 * @property {Object} defaultBudgetAllocation - Default budget percentages
 * @property {number} usageCount - How many times used
 * @property {Date} lastUsedAt - Last time used
 * @property {ObjectId} createdBy - Creator user ID
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} deletedAt - Soft delete timestamp
 */

export const TEMPLATE_TYPES = ['residential', 'commercial', 'infrastructure', 'custom'];

/**
 * Create phase template object
 * @param {Object} input - Template input data
 * @param {ObjectId} userId - Creator user ID
 * @returns {Object} Phase template object
 */
export function createPhaseTemplate(input, userId) {
  const {
    templateName,
    templateType,
    description,
    phases = [],
    defaultBudgetAllocation = {
      materials: 40,
      labour: 30,
      equipment: 10,
      subcontractors: 15,
      contingency: 5
    }
  } = input;

  if (!templateName || templateName.trim().length < 2) {
    throw new Error('Template name is required and must be at least 2 characters');
  }

  if (!templateType || !TEMPLATE_TYPES.includes(templateType)) {
    throw new Error(`Template type must be one of: ${TEMPLATE_TYPES.join(', ')}`);
  }

  if (!Array.isArray(phases) || phases.length === 0) {
    throw new Error('Template must have at least one phase definition');
  }

  // Validate budget allocation percentages sum to 100
  const totalPercentage = Object.values(defaultBudgetAllocation).reduce((sum, val) => sum + (val || 0), 0);
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error('Budget allocation percentages must sum to 100');
  }

  return {
    templateName: templateName.trim(),
    templateType,
    description: description?.trim() || '',
    phases: phases.map((phase, index) => ({
      phaseName: phase.phaseName || `Phase ${index + 1}`,
      phaseCode: phase.phaseCode || `PHASE-${String(index + 1).padStart(2, '0')}`,
      phaseType: phase.phaseType || 'construction',
      sequence: phase.sequence !== undefined ? phase.sequence : index,
      description: phase.description || '',
      defaultBudgetPercentage: phase.defaultBudgetPercentage || 0,
      defaultWorkItems: Array.isArray(phase.defaultWorkItems) ? phase.defaultWorkItems : [],
      defaultMilestones: Array.isArray(phase.defaultMilestones) ? phase.defaultMilestones : []
    })),
    defaultBudgetAllocation: {
      materials: defaultBudgetAllocation.materials || 0,
      labour: defaultBudgetAllocation.labour || 0,
      equipment: defaultBudgetAllocation.equipment || 0,
      subcontractors: defaultBudgetAllocation.subcontractors || 0,
      contingency: defaultBudgetAllocation.contingency || 0
    },
    usageCount: 0,
    lastUsedAt: null,
    createdBy: typeof userId === 'string' ? userId : userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  };
}

/**
 * Validate phase template data
 * @param {Object} template - Template object to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validatePhaseTemplate(template) {
  const errors = [];

  if (!template) {
    return { isValid: false, errors: ['Template is required'] };
  }

  if (!template.templateName || template.templateName.trim().length < 2) {
    errors.push('Template name is required and must be at least 2 characters');
  }

  if (!template.templateType || !TEMPLATE_TYPES.includes(template.templateType)) {
    errors.push(`Template type must be one of: ${TEMPLATE_TYPES.join(', ')}`);
  }

  if (!Array.isArray(template.phases) || template.phases.length === 0) {
    errors.push('Template must have at least one phase definition');
  }

  // Validate phases
  template.phases?.forEach((phase, index) => {
    if (!phase.phaseName || phase.phaseName.trim().length < 2) {
      errors.push(`Phase ${index + 1}: Phase name is required`);
    }
    if (phase.defaultBudgetPercentage !== undefined && (phase.defaultBudgetPercentage < 0 || phase.defaultBudgetPercentage > 100)) {
      errors.push(`Phase ${index + 1}: Budget percentage must be between 0 and 100`);
    }
  });

  // Validate budget allocation
  if (template.defaultBudgetAllocation) {
    const total = Object.values(template.defaultBudgetAllocation).reduce((sum, val) => sum + (val || 0), 0);
    if (Math.abs(total - 100) > 0.01) {
      errors.push('Budget allocation percentages must sum to 100');
    }
  }

  return { isValid: errors.length === 0, errors };
}

export default {
  TEMPLATE_TYPES,
  createPhaseTemplate,
  validatePhaseTemplate
};


