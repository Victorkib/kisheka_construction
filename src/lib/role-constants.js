/**
 * Role Constants - Single Source of Truth
 * 
 * This file defines all valid roles in the system.
 * All role values are standardized to lowercase.
 * 
 * IMPORTANT: This file is client-safe (no server-side dependencies)
 * and can be imported in both client and server components.
 * 
 * Usage:
 *   import { ROLES, VALID_ROLES } from '@/lib/role-constants';
 */

/**
 * Role constant values (standardized to lowercase)
 */
export const ROLES = {
  OWNER: 'owner',
  INVESTOR: 'investor',
  PROJECT_MANAGER: 'pm', // Standardized: 'pm' (not 'PM' or 'project_manager')
  SUPERVISOR: 'supervisor',
  CLERK: 'site_clerk',
  ACCOUNTANT: 'accountant',
  SUPPLIER: 'supplier',
};

/**
 * Array of all valid role values (for validation)
 */
export const VALID_ROLES = [
  ROLES.OWNER,
  ROLES.INVESTOR,
  ROLES.PROJECT_MANAGER,
  'project_manager', // Backward compatibility (will be normalized)
  ROLES.SUPERVISOR,
  ROLES.CLERK,
  ROLES.ACCOUNTANT,
  ROLES.SUPPLIER,
];

/**
 * Role display names (for UI)
 */
export const ROLE_DISPLAY_NAMES = {
  [ROLES.OWNER]: 'Owner',
  [ROLES.INVESTOR]: 'Investor',
  [ROLES.PROJECT_MANAGER]: 'Project Manager',
  project_manager: 'Project Manager', // Backward compatibility
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.CLERK]: 'Clerk',
  [ROLES.ACCOUNTANT]: 'Accountant',
  [ROLES.SUPPLIER]: 'Supplier',
};

/**
 * Check if a role value is valid
 * @param {string} role - Role to check
 * @returns {boolean} True if role is valid
 */
export function isValidRole(role) {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  // Accept both 'pm' and 'project_manager' for backward compatibility
  return VALID_ROLES.some(validRole => validRole.toLowerCase() === normalized) ||
         normalized === 'pm' ||
         normalized === 'project_manager';
}

/**
 * Normalize a role to standard format
 * Converts 'project_manager' to 'pm', 'PM' to 'pm', etc.
 * @param {string} role - Role to normalize
 * @returns {string} Normalized role (lowercase)
 */
export function normalizeRole(role) {
  if (!role) return null;
  const normalized = role.toLowerCase().trim();
  // Normalize 'project_manager' to 'pm'
  if (normalized === 'project_manager') {
    return ROLES.PROJECT_MANAGER;
  }
  return normalized;
}

