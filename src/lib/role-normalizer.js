/**
 * Role Normalization Utility
 * Ensures consistent role naming across the system
 * Standardizes 'project_manager' to 'pm'
 * 
 * NOTE: This file re-exports and extends functions from role-constants
 */

import { ROLES, normalizeRole } from './role-constants';

// Re-export normalizeRole for backward compatibility
export { normalizeRole };

/**
 * Checks if a role is a project manager (handles both 'pm' and 'project_manager')
 * @param {string} role - Role to check
 * @returns {boolean} True if role is project manager
 */
export function isProjectManager(role) {
  if (!role) return false;
  const normalized = normalizeRole(role);
  return normalized === ROLES.PROJECT_MANAGER;
}

/**
 * Normalizes an array of roles
 * @param {string[]} roles - Array of roles to normalize
 * @returns {string[]} Array of normalized roles
 */
export function normalizeRoles(roles) {
  if (!Array.isArray(roles)) return [];
  return roles.map(normalizeRole).filter(Boolean);
}
