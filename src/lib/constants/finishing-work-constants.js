/**
 * Finishing Work Constants
 * Central configuration for finishing work categories and defaults.
 *
 * NOTE: This file is client-safe (no MongoDB imports) so it can be used
 * both in server routes and UI components.
 */

/**
 * Valid execution models for finishing work items
 */
export const FINISHING_EXECUTION_MODELS = ['direct_labour', 'contract_based'];

/**
 * Core finishing work category definitions.
 *
 * These are intentionally generic and aligned with existing work item
 * categories and subcontractor types.
 */
export const FINISHING_WORK_CATEGORIES = [
  {
    code: 'plastering',
    name: 'Plastering',
    description: 'Internal wall and ceiling plastering works.',
    defaultExecutionModel: 'direct_labour',
    typicalContractType: null,
    typicalSubcontractorType: null,
    dependencies: [],
    estimatedDurationDays: 10,
    typicalCostPerSqm: null,
    icon: '🧱',
    color: 'gray',
  },
  {
    code: 'electrical',
    name: 'Electrical Installations',
    description: 'Electrical first fix, second fix, and small power/lighting.',
    defaultExecutionModel: 'contract_based',
    typicalContractType: 'time_material',
    typicalSubcontractorType: 'electrical',
    dependencies: [],
    estimatedDurationDays: 14,
    typicalCostPerSqm: null,
    icon: '⚡',
    color: 'yellow',
  },
  {
    code: 'plumbing',
    name: 'Plumbing Installations',
    description: 'Cold and hot water, drainage, sanitary fittings.',
    defaultExecutionModel: 'contract_based',
    typicalContractType: 'fixed_price',
    typicalSubcontractorType: 'plumbing',
    dependencies: [],
    estimatedDurationDays: 14,
    typicalCostPerSqm: null,
    icon: '🚰',
    color: 'blue',
  },
  {
    code: 'tiling',
    name: 'Tiling & Floor Finishes',
    description: 'Wall and floor tiling, skirting, and related finishes.',
    defaultExecutionModel: 'contract_based',
    typicalContractType: 'fixed_price',
    typicalSubcontractorType: 'tiling',
    dependencies: ['plastering'],
    estimatedDurationDays: 10,
    typicalCostPerSqm: null,
    icon: '🧩',
    color: 'teal',
  },
  {
    code: 'painting',
    name: 'Painting & Wall Finishes',
    description: 'Primer, undercoat, final paint, and special finishes.',
    defaultExecutionModel: 'contract_based',
    typicalContractType: 'fixed_price',
    typicalSubcontractorType: 'painting',
    dependencies: ['plastering'],
    estimatedDurationDays: 10,
    typicalCostPerSqm: null,
    icon: '🎨',
    color: 'purple',
  },
  {
    code: 'joinery',
    name: 'Joinery & Carpentry',
    description: 'Doors, wardrobes, skirting, and general joinery.',
    defaultExecutionModel: 'direct_labour',
    typicalContractType: null,
    typicalSubcontractorType: 'carpentry',
    dependencies: [],
    estimatedDurationDays: 12,
    typicalCostPerSqm: null,
    icon: '🪚',
    color: 'orange',
  },
  {
    code: 'windows_doors',
    name: 'Windows & Doors Installation',
    description: 'Supply and installation of windows and door units.',
    defaultExecutionModel: 'contract_based',
    typicalContractType: 'fixed_price',
    typicalSubcontractorType: 'other',
    dependencies: [],
    estimatedDurationDays: 8,
    typicalCostPerSqm: null,
    icon: '🚪',
    color: 'indigo',
  },
  {
    code: 'ceilings',
    name: 'Ceiling Works',
    description: 'Suspended ceilings, gypsum works, and bulkheads.',
    defaultExecutionModel: 'contract_based',
    typicalContractType: 'fixed_price',
    typicalSubcontractorType: 'other',
    dependencies: ['electrical'],
    estimatedDurationDays: 10,
    typicalCostPerSqm: null,
    icon: '🧱',
    color: 'cyan',
  },
];

/**
 * Quick lookup map by code for convenience
 */
export const FINISHING_WORK_CATEGORY_MAP = FINISHING_WORK_CATEGORIES.reduce(
  (acc, category) => {
    acc[category.code] = category;
    return acc;
  },
  {}
);

