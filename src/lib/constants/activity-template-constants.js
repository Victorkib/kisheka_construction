/**
 * Activity Template Constants
 * Client-safe constants for activity templates (no MongoDB imports)
 * These can be safely imported in client components
 */

import { ACTIVITY_TYPES } from './professional-activities-constants';

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
 * Professional Types for Templates
 */
export const TEMPLATE_PROFESSIONAL_TYPES = {
  ARCHITECT: 'architect_activity',
  ENGINEER: 'engineer_activity',
};

/**
 * Get activity types for a professional type
 * @param {string} professionalType - 'architect_activity' or 'engineer_activity'
 * @returns {string[]} Array of activity types
 */
export function getActivityTypesForProfessionalType(professionalType) {
  if (professionalType === TEMPLATE_PROFESSIONAL_TYPES.ARCHITECT) {
    return ACTIVITY_TYPES.ARCHITECT;
  } else if (professionalType === TEMPLATE_PROFESSIONAL_TYPES.ENGINEER) {
    return ACTIVITY_TYPES.ENGINEER;
  }
  return ACTIVITY_TYPES.ALL;
}





