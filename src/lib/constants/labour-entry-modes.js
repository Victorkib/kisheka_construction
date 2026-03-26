/**
 * Labour Entry Modes
 * Defines different contexts for labour entry creation
 */

/**
 * Entry mode types
 */
export const LABOUR_ENTRY_MODES = {
  GENERAL: 'general',                    // Direct labour entry with work item
  WORK_ITEM: 'work_item',                // From work item page
  EQUIPMENT_OPERATOR: 'equipment_operator', // From equipment page (operating equipment)
  INDIRECT: 'indirect',                  // Indirect labour (site overhead)
  SUBCONTRACTOR: 'subcontractor',        // Subcontractor labour
  PROFESSIONAL: 'professional',          // Professional services
};

/**
 * Entry mode configurations
 * Defines what fields are required/optional/hidden for each mode
 */
export const ENTRY_MODE_CONFIG = {
  [LABOUR_ENTRY_MODES.GENERAL]: {
    label: 'Direct Labour',
    icon: '👷',
    description: 'Log labour for a specific work item',
    required: ['workerId', 'entryDate', 'totalHours', 'hourlyRate', 'workItemId', 'phaseId', 'projectId'],
    optional: ['equipmentId', 'taskDescription', 'notes'],
    hidden: ['indirectCostCategory', 'subcontractorId', 'serviceType'],
    budgetImpact: 'phase_labour',
  },
  
  [LABOUR_ENTRY_MODES.WORK_ITEM]: {
    label: 'Work Item Labour',
    icon: '📋',
    description: 'Log labour for pre-selected work item',
    required: ['workerId', 'entryDate', 'totalHours', 'hourlyRate'],
    optional: ['equipmentId', 'taskDescription', 'notes'],
    hidden: ['workItemId', 'phaseId', 'projectId', 'indirectCostCategory', 'subcontractorId'],
    budgetImpact: 'phase_labour',
    autoFill: ['workItemId', 'phaseId', 'projectId'],
  },
  
  [LABOUR_ENTRY_MODES.EQUIPMENT_OPERATOR]: {
    label: 'Equipment Operator',
    icon: '🚜',
    description: 'Log equipment operator hours',
    required: ['workerId', 'entryDate', 'totalHours', 'equipmentId'],
    optional: ['taskDescription', 'notes'],
    hidden: ['workItemId', 'indirectCostCategory', 'subcontractorId', 'serviceType'],
    budgetImpact: 'equipment_labour',
    autoFill: ['equipmentId', 'workerId', 'hourlyRate', 'dailyRate', 'taskDescription'],
    workItemRequired: false, // KEY: Work item NOT required for equipment operator
  },
  
  [LABOUR_ENTRY_MODES.INDIRECT]: {
    label: 'Indirect Labour',
    icon: '🏗️',
    description: 'Site overhead labour (security, cleaning, management)',
    required: ['workerId', 'entryDate', 'totalHours', 'hourlyRate', 'indirectCostCategory'],
    optional: ['taskDescription', 'notes'],
    hidden: ['workItemId', 'equipmentId', 'subcontractorId', 'serviceType'],
    budgetImpact: 'indirect_labour',
    workItemRequired: false,
  },
  
  [LABOUR_ENTRY_MODES.SUBCONTRACTOR]: {
    label: 'Subcontractor Labour',
    icon: '🤝',
    description: 'Log subcontractor worker hours',
    required: ['subcontractorId', 'workerId', 'entryDate', 'totalHours', 'hourlyRate'],
    optional: ['workItemId', 'equipmentId', 'taskDescription', 'notes'],
    hidden: ['indirectCostCategory', 'serviceType'],
    budgetImpact: 'subcontractor_labour',
  },
  
  [LABOUR_ENTRY_MODES.PROFESSIONAL]: {
    label: 'Professional Services',
    icon: '👨‍💼',
    description: 'Professional services (architect, engineer, consultant)',
    required: ['workerId', 'entryDate', 'totalHours', 'hourlyRate', 'serviceType'],
    optional: ['workItemId', 'visitPurpose', 'deliverables', 'notes'],
    hidden: ['equipmentId', 'indirectCostCategory', 'subcontractorId'],
    budgetImpact: 'professional_fees',
  },
};

/**
 * Get entry mode from URL parameters
 * @param {URLSearchParams} searchParams - URL search parameters
 * @returns {string} Entry mode
 */
export function detectEntryMode(searchParams) {
  const equipmentId = searchParams.get('equipmentId');
  const workItemId = searchParams.get('workItemId');
  const subcontractorId = searchParams.get('subcontractorId');
  const isIndirect = searchParams.get('isIndirectLabour') === 'true';
  const serviceType = searchParams.get('serviceType');
  
  // Priority order: most specific to most general
  if (equipmentId) return LABOUR_ENTRY_MODES.EQUIPMENT_OPERATOR;
  if (subcontractorId) return LABOUR_ENTRY_MODES.SUBCONTRACTOR;
  if (isIndirect) return LABOUR_ENTRY_MODES.INDIRECT;
  if (serviceType) return LABOUR_ENTRY_MODES.PROFESSIONAL;
  if (workItemId) return LABOUR_ENTRY_MODES.WORK_ITEM;
  
  return LABOUR_ENTRY_MODES.GENERAL;
}

/**
 * Get configuration for entry mode
 * @param {string} mode - Entry mode
 * @returns {Object} Configuration object
 */
export function getEntryModeConfig(mode) {
  return ENTRY_MODE_CONFIG[mode] || ENTRY_MODE_CONFIG.general;
}

/**
 * Map URL parameters to form fields
 */
export const URL_PARAM_MAPPING = {
  // Worker
  workerId: 'workerId',
  worker_id: 'workerId',
  workerName: 'workerName',
  worker_name: 'workerName',
  
  // Equipment
  equipmentId: 'equipmentId',
  equipment_id: 'equipmentId',
  
  // Work Item
  workItemId: 'workItemId',
  workItemId: 'workItemId',
  
  // Project/Phase/Floor
  projectId: 'projectId',
  project_id: 'projectId',
  phaseId: 'phaseId',
  phase_id: 'phaseId',
  floorId: 'floorId',
  floor_id: 'floorId',
  
  // Rates
  hourlyRate: 'hourlyRate',
  hourly_rate: 'hourlyRate',
  dailyRate: 'dailyRate',
  daily_rate: 'dailyRate',
  
  // Time
  totalHours: 'totalHours',
  total_hours: 'totalHours',
  entryDate: 'entryDate',
  entry_date: 'entryDate',
  
  // Description
  taskDescription: 'taskDescription',
  task_description: 'taskDescription',
  task: 'taskDescription',
  
  // Subcontractor
  subcontractorId: 'subcontractorId',
  subcontractor_id: 'subcontractorId',
  
  // Professional
  serviceType: 'serviceType',
  service_type: 'serviceType',
  visitPurpose: 'visitPurpose',
  visit_purpose: 'visitPurpose',
  
  // Indirect
  indirectCostCategory: 'indirectCostCategory',
  indirect_cost_category: 'indirectCostCategory',
  isIndirectLabour: 'isIndirectLabour',
  is_indirect_labour: 'isIndirectLabour',
};

export default {
  LABOUR_ENTRY_MODES,
  ENTRY_MODE_CONFIG,
  detectEntryMode,
  getEntryModeConfig,
  URL_PARAM_MAPPING,
};
