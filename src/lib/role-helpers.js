/**
 * Role-Based Access Control Helpers
 * Functions to check user roles and permissions
 */

import { getUserProfile } from './auth-helpers';
import { PERMISSIONS, roleHasPermission } from './permissions';
import { ROLES, normalizeRole, normalizeUserRole, isRole } from './role-constants';

// Re-export ROLES and client-safe functions for backward compatibility
export { ROLES, normalizeUserRole, isRole };

/**
 * Checks if user has one of the required roles
 * @param {string} supabaseId - Supabase user ID
 * @param {string|string[]} requiredRoles - Required role(s)
 * @returns {Promise<boolean>} True if user has required role
 */
export async function hasRole(supabaseId, requiredRoles) {
  try {
    const userProfile = await getUserProfile(supabaseId);
    if (!userProfile) return false;

    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    const userRole = userProfile.role?.toLowerCase();
    
    return roles.some(role => role.toLowerCase() === userRole);
  } catch (error) {
    console.error('Error checking role:', error);
    return false;
  }
}

/**
 * Checks if user has permission to perform an action
 * @param {string} supabaseId - Supabase user ID
 * @param {string} action - Action to check (e.g., 'create_material', 'approve_item')
 * @returns {Promise<boolean>} True if user has permission
 */
export async function hasPermission(supabaseId, action) {
  try {
    const userProfile = await getUserProfile(supabaseId);
    if (!userProfile) return false;

    const role = userProfile.role;

    // Use centralized permissions
    return roleHasPermission(role, action);
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Gets user role from Supabase ID
 * @param {string} supabaseId - Supabase user ID
 * @returns {Promise<string|null>} User role or null
 */
export async function getUserRole(supabaseId) {
  try {
    const userProfile = await getUserProfile(supabaseId);
    return userProfile?.role || null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

