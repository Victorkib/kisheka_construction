/**
 * Professional Services Constants
 * Client-safe constants for professional services (no MongoDB imports)
 * These can be safely imported in client components
 */

/**
 * Valid professional types
 */
export const PROFESSIONAL_TYPES = ['architect', 'engineer'];

/**
 * Valid contract types
 */
export const CONTRACT_TYPES = {
  ARCHITECT: ['full_service', 'consultation', 'oversight_only', 'design_only'],
  ENGINEER: ['inspection_only', 'full_oversight', 'quality_control', 'consultation'],
  ALL: ['full_service', 'consultation', 'oversight_only', 'design_only', 'inspection_only', 'full_oversight', 'quality_control'],
};

/**
 * Valid payment schedules
 */
export const PAYMENT_SCHEDULES = [
  'milestone',
  'monthly',
  'lump_sum',
  'per_visit',
  'retainer',
  'percentage',
];

/**
 * Valid visit frequencies (for engineers)
 */
export const VISIT_FREQUENCIES = [
  'weekly',
  'bi_weekly',
  'monthly',
  'milestone_based',
  'as_needed',
];

/**
 * Valid specializations (for engineers)
 */
export const ENGINEER_SPECIALIZATIONS = [
  'structural',
  'construction',
  'quality_control',
  'mep', // Mechanical, Electrical, Plumbing
];

/**
 * Valid professional service statuses
 */
export const PROFESSIONAL_SERVICE_STATUSES = [
  'active',
  'completed',
  'terminated',
  'on_hold',
];

/**
 * Valid payment statuses (for milestone payments)
 */
export const PAYMENT_STATUSES = ['pending', 'invoiced', 'paid'];





