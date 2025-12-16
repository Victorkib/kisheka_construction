/**
 * Centralized Permissions Configuration
 * Single source of truth for all role-based permissions
 * 
 * This file defines all permissions in the system and which roles can perform them.
 * Update this file to modify permissions across the entire application.
 * 
 * NOTE: This file is used in both client and server components.
 * Do not import server-side modules here.
 */

// Import roles from centralized constants
import { ROLES } from './role-constants';

/**
 * Permission definitions
 * Each permission maps to an array of roles that can perform that action
 */
export const PERMISSIONS = {
  // ============================================
  // Material/Item Permissions
  // ============================================
  create_material: [ROLES.CLERK, ROLES.PROJECT_MANAGER, ROLES.OWNER, ROLES.SUPERVISOR],
  edit_material: [ROLES.CLERK, ROLES.PROJECT_MANAGER, ROLES.OWNER],
  delete_material: [ROLES.OWNER],
  approve_material: [ROLES.PROJECT_MANAGER, ROLES.OWNER],
  reject_material: [ROLES.PROJECT_MANAGER, ROLES.OWNER],
  view_materials: [ROLES.SUPERVISOR, ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.CLERK, ROLES.ACCOUNTANT],

  // ============================================
  // Material Request Permissions
  // ============================================
  create_material_request: [ROLES.CLERK, ROLES.PROJECT_MANAGER, ROLES.OWNER, ROLES.SUPERVISOR],
  view_material_requests: [ROLES.CLERK, ROLES.PROJECT_MANAGER, ROLES.OWNER, ROLES.SUPERVISOR, ROLES.ACCOUNTANT],
  approve_material_request: [ROLES.PROJECT_MANAGER, ROLES.OWNER],
  reject_material_request: [ROLES.PROJECT_MANAGER, ROLES.OWNER],
  edit_material_request: [ROLES.CLERK, ROLES.PROJECT_MANAGER, ROLES.OWNER, ROLES.SUPERVISOR],
  delete_material_request: [ROLES.PROJECT_MANAGER, ROLES.OWNER],

  // ============================================
  // Material Library Permissions (Bulk Procurement)
  // ============================================
  manage_material_library: [ROLES.OWNER],
  view_material_library: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.CLERK, ROLES.SUPERVISOR, ROLES.ACCOUNTANT],

  // ============================================
  // Bulk Request Permissions (Bulk Procurement)
  // ============================================
  create_bulk_material_request: [ROLES.CLERK, ROLES.SUPERVISOR, ROLES.PROJECT_MANAGER, ROLES.OWNER],
  view_bulk_material_requests: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.CLERK, ROLES.ACCOUNTANT, ROLES.SUPERVISOR],
  bulk_approve_material_requests: [ROLES.PROJECT_MANAGER, ROLES.OWNER, ROLES.ACCOUNTANT],
  create_bulk_purchase_orders: [ROLES.PROJECT_MANAGER, ROLES.OWNER],

  // ============================================
  // Template Permissions (Bulk Procurement)
  // ============================================
  create_material_template: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  manage_material_templates: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  use_material_template: [ROLES.CLERK, ROLES.SUPERVISOR, ROLES.PROJECT_MANAGER, ROLES.OWNER],
  validate_material_template: [ROLES.OWNER],
  mark_template_official: [ROLES.OWNER],
  create_template_variant: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  view_template_analytics: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],

  // ============================================
  // Analytics Permissions (Bulk Procurement)
  // ============================================
  view_bulk_analytics: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],
  view_supplier_performance: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],

  // ============================================
  // Purchase Order Permissions
  // ============================================
  create_purchase_order: [ROLES.PROJECT_MANAGER, ROLES.OWNER],
  view_purchase_orders: [ROLES.PROJECT_MANAGER, ROLES.OWNER, ROLES.ACCOUNTANT, ROLES.SUPPLIER],
  edit_purchase_order: [ROLES.PROJECT_MANAGER, ROLES.OWNER],
  delete_purchase_order: [ROLES.OWNER],
  accept_purchase_order: [ROLES.SUPPLIER],
  reject_purchase_order: [ROLES.SUPPLIER],
  modify_purchase_order: [ROLES.SUPPLIER],
  fulfill_purchase_order: [ROLES.SUPPLIER],
  create_material_from_order: [ROLES.PROJECT_MANAGER, ROLES.OWNER],

  // ============================================
  // Expense Permissions
  // ============================================
  create_expense: [ROLES.CLERK, ROLES.PROJECT_MANAGER, ROLES.OWNER, ROLES.ACCOUNTANT],
  edit_expense: [ROLES.CLERK, ROLES.PROJECT_MANAGER, ROLES.OWNER, ROLES.ACCOUNTANT],
  delete_expense: [ROLES.OWNER],
  approve_expense: [ROLES.PROJECT_MANAGER, ROLES.OWNER, ROLES.ACCOUNTANT],
  reject_expense: [ROLES.PROJECT_MANAGER, ROLES.OWNER, ROLES.ACCOUNTANT],
  view_expenses: [ROLES.SUPERVISOR, ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.CLERK, ROLES.ACCOUNTANT],

  // ============================================
  // Initial Expense Permissions
  // ============================================
  create_initial_expense: [ROLES.CLERK, ROLES.PROJECT_MANAGER, ROLES.OWNER],
  edit_initial_expense: [ROLES.CLERK, ROLES.PROJECT_MANAGER, ROLES.OWNER],
  delete_initial_expense: [ROLES.OWNER],
  approve_initial_expense: [ROLES.PROJECT_MANAGER, ROLES.OWNER, ROLES.ACCOUNTANT],
  reject_initial_expense: [ROLES.PROJECT_MANAGER, ROLES.OWNER, ROLES.ACCOUNTANT],

  // ============================================
  // Project Permissions
  // ============================================
  create_project: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  edit_project: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  delete_project: [ROLES.OWNER],
  view_projects: [ROLES.SUPERVISOR, ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.CLERK, ROLES.ACCOUNTANT],
  manage_project_finances: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],

  // ============================================
  // Category Permissions
  // ============================================
  create_category: [ROLES.OWNER],
  edit_category: [ROLES.OWNER],
  delete_category: [ROLES.OWNER],

  // ============================================
  // Floor Permissions
  // ============================================
  create_floor: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  edit_floor: [ROLES.PROJECT_MANAGER, ROLES.OWNER],
  delete_floor: [ROLES.OWNER],

  // ============================================
  // View & Reporting Permissions
  // ============================================
  view_reports: [ROLES.OWNER, ROLES.INVESTOR, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT, ROLES.SUPERVISOR],
  view_all_data: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT, ROLES.SUPERVISOR],
  view_dashboard: [ROLES.OWNER, ROLES.INVESTOR, ROLES.PROJECT_MANAGER, ROLES.CLERK, ROLES.ACCOUNTANT, ROLES.SUPERVISOR, ROLES.SUPPLIER],

  // ============================================
  // Investor & Financing Permissions
  // ============================================
  view_financing: [ROLES.OWNER, ROLES.INVESTOR, ROLES.ACCOUNTANT],
  manage_investors: [ROLES.OWNER],
  view_investor_statements: [ROLES.OWNER, ROLES.INVESTOR],
  add_investor_contribution: [ROLES.OWNER],
  update_project_finances: [ROLES.OWNER],

  // ============================================
  // Supplier Permissions (Legacy - for old supplier role)
  // ============================================
  upload_delivery_note: [ROLES.SUPPLIER],
  view_supplier_materials: [ROLES.SUPPLIER],

  // ============================================
  // Supplier Management Permissions (New - for contact-based suppliers)
  // ============================================
  manage_suppliers: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  create_supplier: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  edit_supplier: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  delete_supplier: [ROLES.OWNER],
  view_suppliers: [ROLES.OWNER, ROLES.PROJECT_MANAGER],

  // ============================================
  // Approval Permissions
  // ============================================
  view_approvals: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],
  bulk_approve: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],

  // ============================================
  // User Management Permissions
  // ============================================
  manage_users: [ROLES.OWNER],
  assign_role: [ROLES.OWNER],
  revoke_access: [ROLES.OWNER],
  view_users: [ROLES.OWNER],
  invite_users: [ROLES.OWNER],
};

/**
 * Get all permissions for a specific role
 * @param {string} role - Role to get permissions for
 * @returns {string[]} Array of permission names
 */
export function getPermissionsForRole(role) {
  if (!role) return [];
  
  const normalizedRole = role.toLowerCase();
  const permissions = [];
  
  for (const [permission, allowedRoles] of Object.entries(PERMISSIONS)) {
    if (allowedRoles.some(r => r.toLowerCase() === normalizedRole)) {
      permissions.push(permission);
    }
  }
  
  return permissions;
}

/**
 * Check if a role has a specific permission
 * @param {string} role - Role to check
 * @param {string} permission - Permission to check
 * @returns {boolean} True if role has permission
 */
export function roleHasPermission(role, permission) {
  if (!role || !permission) return false;
  
  const normalizedRole = role.toLowerCase();
  const allowedRoles = PERMISSIONS[permission] || [];
  
  return allowedRoles.some(r => r.toLowerCase() === normalizedRole);
}

/**
 * Get all roles that have a specific permission
 * @param {string} permission - Permission to check
 * @returns {string[]} Array of role names
 */
export function getRolesWithPermission(permission) {
  return PERMISSIONS[permission] || [];
}

/**
 * Permission categories for organization
 */
export const PERMISSION_CATEGORIES = {
  MATERIALS: [
    'create_material',
    'edit_material',
    'delete_material',
    'approve_material',
    'reject_material',
    'view_materials',
  ],
  MATERIAL_REQUESTS: [
    'create_material_request',
    'view_material_requests',
    'approve_material_request',
    'reject_material_request',
    'edit_material_request',
    'delete_material_request',
  ],
  MATERIAL_LIBRARY: [
    'manage_material_library',
    'view_material_library',
  ],
  BULK_REQUESTS: [
    'create_bulk_material_request',
    'view_bulk_material_requests',
    'bulk_approve_material_requests',
    'create_bulk_purchase_orders',
  ],
  TEMPLATES: [
    'create_material_template',
    'manage_material_templates',
    'use_material_template',
    'validate_material_template',
    'mark_template_official',
    'create_template_variant',
    'view_template_analytics',
  ],
  ANALYTICS: [
    'view_bulk_analytics',
    'view_supplier_performance',
  ],
  PURCHASE_ORDERS: [
    'create_purchase_order',
    'view_purchase_orders',
    'edit_purchase_order',
    'delete_purchase_order',
    'accept_purchase_order',
    'reject_purchase_order',
    'modify_purchase_order',
    'fulfill_purchase_order',
    'create_material_from_order',
  ],
  EXPENSES: [
    'create_expense',
    'edit_expense',
    'delete_expense',
    'approve_expense',
    'reject_expense',
    'view_expenses',
  ],
  INITIAL_EXPENSES: [
    'create_initial_expense',
    'edit_initial_expense',
    'delete_initial_expense',
    'approve_initial_expense',
    'reject_initial_expense',
  ],
  PROJECTS: [
    'create_project',
    'edit_project',
    'delete_project',
    'view_projects',
    'manage_project_finances',
  ],
  CATEGORIES: [
    'create_category',
    'edit_category',
    'delete_category',
  ],
  FLOORS: [
    'create_floor',
    'edit_floor',
    'delete_floor',
  ],
  VIEWING: [
    'view_reports',
    'view_all_data',
    'view_dashboard',
  ],
  FINANCING: [
    'view_financing',
    'manage_investors',
    'view_investor_statements',
    'add_investor_contribution',
    'update_project_finances',
  ],
  SUPPLIER: [
    'upload_delivery_note',
    'view_supplier_materials',
  ],
  SUPPLIER_MANAGEMENT: [
    'manage_suppliers',
    'create_supplier',
    'edit_supplier',
    'delete_supplier',
    'view_suppliers',
  ],
  APPROVALS: [
    'view_approvals',
    'bulk_approve',
  ],
  USER_MANAGEMENT: [
    'manage_users',
    'assign_role',
    'revoke_access',
    'view_users',
    'invite_users',
  ],
};

export default PERMISSIONS;

