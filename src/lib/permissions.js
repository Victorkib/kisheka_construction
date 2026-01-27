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
  manage_project_team: [ROLES.OWNER, ROLES.PROJECT_MANAGER],

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
  // Phase Permissions
  // ============================================
  create_phase: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  edit_phase: [ROLES.PROJECT_MANAGER, ROLES.OWNER],
  delete_phase: [ROLES.OWNER],
  view_phases: [ROLES.SUPERVISOR, ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.CLERK, ROLES.ACCOUNTANT, ROLES.INVESTOR],
  manage_phase_budget: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],
  create_budget_reallocation: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],
  approve_budget_reallocation: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],
  reject_budget_reallocation: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],
  view_budget_reallocations: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],

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

  // ============================================
  // Professional Services Library Permissions
  // ============================================
  manage_professional_services_library: [ROLES.OWNER],
  view_professional_services_library: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.CLERK, ROLES.ACCOUNTANT],
  create_professional_service: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  edit_professional_service: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  delete_professional_service: [ROLES.OWNER],

  // ============================================
  // Professional Services (Project Assignments) Permissions
  // ============================================
  assign_professional_service: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  view_professional_services: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT, ROLES.CLERK],
  edit_professional_service_assignment: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  terminate_professional_service: [ROLES.OWNER],

  // ============================================
  // Professional Activities Permissions
  // ============================================
  create_professional_activity: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.CLERK],
  view_professional_activities: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT, ROLES.CLERK],
  edit_professional_activity: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.CLERK],
  delete_professional_activity: [ROLES.OWNER],
  approve_professional_activity: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  reject_professional_activity: [ROLES.OWNER, ROLES.PROJECT_MANAGER],

  // ============================================
  // Professional Fees Permissions
  // ============================================
  create_professional_fee: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],
  view_professional_fees: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT, ROLES.CLERK],
  edit_professional_fee: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],
  delete_professional_fee: [ROLES.OWNER],
  approve_professional_fee: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],
  reject_professional_fee: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],
  record_professional_fee_payment: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],

  // ============================================
  // Activity Templates Permissions
  // ============================================
  create_activity_template: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  view_activity_templates: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.CLERK, ROLES.ACCOUNTANT],
  manage_activity_templates: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  delete_activity_template: [ROLES.OWNER],
  use_activity_template: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.CLERK],
  validate_activity_template: [ROLES.OWNER],

  // ============================================
  // Work Items Permissions
  // ============================================
  create_work_item: [ROLES.PROJECT_MANAGER, ROLES.OWNER],
  edit_work_item: [ROLES.PROJECT_MANAGER, ROLES.OWNER],
  delete_work_item: [ROLES.OWNER],
  view_work_items: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.SUPERVISOR, ROLES.CLERK, ROLES.ACCOUNTANT],

  // ============================================
  // Equipment Permissions
  // ============================================
  create_equipment: [ROLES.PROJECT_MANAGER, ROLES.OWNER],
  edit_equipment: [ROLES.PROJECT_MANAGER, ROLES.OWNER],
  delete_equipment: [ROLES.OWNER],
  view_equipment: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.SUPERVISOR, ROLES.CLERK, ROLES.ACCOUNTANT],

  // ============================================
  // Subcontractor Permissions
  // ============================================
  create_subcontractor: [ROLES.PROJECT_MANAGER, ROLES.OWNER],
  edit_subcontractor: [ROLES.PROJECT_MANAGER, ROLES.OWNER],
  delete_subcontractor: [ROLES.OWNER],
  view_subcontractors: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.SUPERVISOR, ROLES.CLERK, ROLES.ACCOUNTANT],

  // ============================================
  // Labour Entry Permissions
  // ============================================
  create_labour_entry: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.SUPERVISOR, ROLES.CLERK],
  edit_labour_entry: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  delete_labour_entry: [ROLES.OWNER],
  approve_labour_entry: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  view_labour_entries: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.SUPERVISOR, ROLES.CLERK, ROLES.ACCOUNTANT],

  // ============================================
  // Labour Batch Permissions
  // ============================================
  create_labour_batch: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.SUPERVISOR, ROLES.CLERK],
  edit_labour_batch: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  delete_labour_batch: [ROLES.OWNER],
  approve_labour_batch: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  view_labour_batches: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.SUPERVISOR, ROLES.CLERK, ROLES.ACCOUNTANT],

  // ============================================
  // Worker Profile Permissions
  // ============================================
  create_worker_profile: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  edit_worker_profile: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  delete_worker_profile: [ROLES.OWNER],
  view_worker_profiles: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.SUPERVISOR, ROLES.CLERK, ROLES.ACCOUNTANT],

  // ============================================
  // Labour Template Permissions
  // ============================================
  create_labour_template: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  edit_labour_template: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  delete_labour_template: [ROLES.OWNER],
  apply_labour_template: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.SUPERVISOR, ROLES.CLERK],
  view_labour_templates: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.SUPERVISOR, ROLES.CLERK, ROLES.ACCOUNTANT],

  // ============================================
  // Supervisor Submission Permissions
  // ============================================
  create_supervisor_submission: [ROLES.SUPERVISOR, ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.CLERK],
  edit_supervisor_submission: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  delete_supervisor_submission: [ROLES.OWNER],
  approve_supervisor_submission: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  reject_supervisor_submission: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  view_supervisor_submissions: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.SUPERVISOR, ROLES.CLERK, ROLES.ACCOUNTANT],

  // ============================================
  // Site Report Permissions
  // ============================================
  create_site_report: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.SUPERVISOR, ROLES.CLERK],
  edit_site_report: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  approve_site_report: [ROLES.OWNER, ROLES.PROJECT_MANAGER],
  view_site_reports: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.SUPERVISOR, ROLES.CLERK, ROLES.ACCOUNTANT],

  // ============================================
  // Labour Reports Permissions
  // ============================================
  view_labour_reports: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT, ROLES.SUPERVISOR],
  view_labour_cost_summaries: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],
  view_labour_budget_alerts: [ROLES.OWNER, ROLES.PROJECT_MANAGER, ROLES.ACCOUNTANT],
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
    'manage_project_team',
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
  PROFESSIONAL_SERVICES_LIBRARY: [
    'manage_professional_services_library',
    'view_professional_services_library',
    'create_professional_service',
    'edit_professional_service',
    'delete_professional_service',
  ],
  PROFESSIONAL_SERVICES: [
    'assign_professional_service',
    'view_professional_services',
    'edit_professional_service_assignment',
    'terminate_professional_service',
  ],
  PROFESSIONAL_ACTIVITIES: [
    'create_professional_activity',
    'view_professional_activities',
    'edit_professional_activity',
    'delete_professional_activity',
    'approve_professional_activity',
    'reject_professional_activity',
  ],
  PROFESSIONAL_FEES: [
    'create_professional_fee',
    'view_professional_fees',
    'edit_professional_fee',
    'delete_professional_fee',
    'approve_professional_fee',
    'reject_professional_fee',
    'record_professional_fee_payment',
  ],
  ACTIVITY_TEMPLATES: [
    'create_activity_template',
    'view_activity_templates',
    'manage_activity_templates',
    'delete_activity_template',
    'use_activity_template',
    'validate_activity_template',
  ],
  WORK_ITEMS: [
    'create_work_item',
    'edit_work_item',
    'delete_work_item',
    'view_work_items',
  ],
  EQUIPMENT: [
    'create_equipment',
    'edit_equipment',
    'delete_equipment',
    'view_equipment',
  ],
  SUBCONTRACTORS: [
    'create_subcontractor',
    'edit_subcontractor',
    'delete_subcontractor',
    'view_subcontractors',
  ],
  LABOUR_ENTRIES: [
    'create_labour_entry',
    'edit_labour_entry',
    'delete_labour_entry',
    'approve_labour_entry',
    'view_labour_entries',
  ],
  LABOUR_BATCHES: [
    'create_labour_batch',
    'edit_labour_batch',
    'delete_labour_batch',
    'approve_labour_batch',
    'view_labour_batches',
  ],
  WORKER_PROFILES: [
    'create_worker_profile',
    'edit_worker_profile',
    'delete_worker_profile',
    'view_worker_profiles',
  ],
  LABOUR_TEMPLATES: [
    'create_labour_template',
    'edit_labour_template',
    'delete_labour_template',
    'apply_labour_template',
    'view_labour_templates',
  ],
  SUPERVISOR_SUBMISSIONS: [
    'create_supervisor_submission',
    'edit_supervisor_submission',
    'delete_supervisor_submission',
    'approve_supervisor_submission',
    'reject_supervisor_submission',
    'view_supervisor_submissions',
  ],
  SITE_REPORTS: [
    'create_site_report',
    'edit_site_report',
    'approve_site_report',
    'view_site_reports',
  ],
  LABOUR_REPORTS: [
    'view_labour_reports',
    'view_labour_cost_summaries',
    'view_labour_budget_alerts',
  ],
};

export default PERMISSIONS;

