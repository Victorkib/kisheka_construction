/**
 * Labour Constants
 * Client-safe constants for labour system (no MongoDB dependencies)
 * These can be safely imported in client components
 */

/**
 * Valid worker types
 */
export const VALID_WORKER_TYPES = ['internal', 'external', 'professional'];

/**
 * Valid worker roles
 */
export const VALID_WORKER_ROLES = ['skilled', 'unskilled', 'supervisory', 'professional'];

/**
 * Valid employment types
 */
export const VALID_EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'casual',
  'consultant',
];

/**
 * Valid worker statuses
 */
export const VALID_WORKER_STATUSES = [
  'active',
  'inactive',
  'terminated',
  'on_leave',
];

/**
 * Valid skill types
 */
export const VALID_SKILL_TYPES = [
  // Construction skills
  'mason',
  'steel_fixer',
  'carpenter',
  'electrician',
  'plumber',
  'painter',
  'tile_layer',
  'equipment_operator',
  'general_worker',
  'helper',
  'cleaner',
  'supervisor',
  'foreman',
  'team_leader',
  // Professional skills
  'architect',
  'engineer',
  'structural_engineer',
  'mep_engineer',
  'surveyor',
  'consultant',
  'quantity_surveyor',
  'legal_advisor',
  'financial_advisor',
  // Specialized
  'lift_technician',
  'hvac_specialist',
  'fire_safety_specialist',
  'security_installer',
];

/**
 * Valid entry statuses
 */
export const VALID_ENTRY_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'paid',
];

/**
 * Valid service types (for professionals)
 */
export const VALID_SERVICE_TYPES = [
  'consultation',
  'inspection',
  'design',
  'approval',
  'testing',
  'review',
];

/**
 * Get skill type label
 */
export function getSkillTypeLabel(skillType) {
  return skillType
    ? skillType
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : '';
}

/**
 * Get worker type label
 */
export function getWorkerTypeLabel(workerType) {
  const labels = {
    internal: 'Internal',
    external: 'External',
    professional: 'Professional',
  };
  return labels[workerType] || workerType;
}

/**
 * Get worker role label
 */
export function getWorkerRoleLabel(workerRole) {
  const labels = {
    skilled: 'Skilled',
    unskilled: 'Unskilled',
    supervisory: 'Supervisory',
    professional: 'Professional',
  };
  return labels[workerRole] || workerRole;
}

export default {
  VALID_WORKER_TYPES,
  VALID_WORKER_ROLES,
  VALID_EMPLOYMENT_TYPES,
  VALID_WORKER_STATUSES,
  VALID_SKILL_TYPES,
  VALID_ENTRY_STATUSES,
  VALID_SERVICE_TYPES,
  getSkillTypeLabel,
  getWorkerTypeLabel,
  getWorkerRoleLabel,
};

