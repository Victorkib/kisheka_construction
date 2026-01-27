/**
 * Navigation Configuration Helpers
 * Defines navigation structure per role
 * Client-safe version (doesn't import server-only modules)
 */

// Import roles from centralized constants
import { ROLES } from './role-constants';

/**
 * Navigation item structure
 * @typedef {Object} NavItem
 * @property {string} label - Display label
 * @property {string} href - Route path
 * @property {string} icon - Icon name (optional)
 * @property {string[]} roles - Allowed roles
 * @property {NavItem[]} children - Sub-items (optional)
 */

/**
 * Navigation sections configuration
 * Organized by category for better UX
 */
export const NAVIGATION_SECTIONS = {
  dashboard: {
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'home',
    // Note: 'pm' is standard, 'project_manager' accepted for backward compatibility
    roles: ['owner', 'investor', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor', 'supplier'],
    badge: null, // Can be used for notification counts
  },
  projects: {
    label: 'Projects',
    href: '/projects',
    icon: 'building',
    roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
    children: [
      {
        label: 'All Projects',
        href: '/projects',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
      },
      {
        label: 'Create Project',
        href: '/projects/new',
        roles: ['owner', 'pm', 'project_manager'],
      },
      {
        label: 'Phases',
        href: '/phases',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
        icon: 'layers',
      },
      {
        label: 'Phase Templates',
        href: '/phase-templates',
        roles: ['owner', 'pm', 'project_manager'],
        icon: 'file-text',
      },
    ],
  },
  financial: {
    label: 'Financial',
    icon: 'dollar-sign',
    roles: ['owner', 'investor', 'accountant', 'pm', 'project_manager'],
    children: [
      {
        label: 'Financing',
        href: '/financing',
        roles: ['owner', 'investor', 'accountant'],
      },
      {
        label: 'Investors',
        href: '/investors',
        roles: ['owner'],
      },
      {
        label: 'Budget Reallocations',
        href: '/budget-reallocations',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
        icon: 'arrow-left-right',
      },
      {
        label: 'Initial Expenses',
        href: '/initial-expenses',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant'],
      },
      {
        label: 'Expenses',
        href: '/expenses',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant'],
      },
    ],
  },
  operations: {
    label: 'Operations',
    icon: 'briefcase',
    roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
    children: [
      {
        label: 'Materials',
        href: '/items',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
      },
      {
        label: 'Material Library',
        href: '/material-library',
        roles: ['owner', 'pm', 'project_manager'],
        icon: 'book',
      },
      {
        label: 'Bulk Material Request',
        href: '/material-requests/bulk',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'supervisor'],
        icon: 'shopping-cart',
      },
      {
        label: 'Material Requests',
        href: '/material-requests',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
        children: [
          {
            label: 'All Requests',
            href: '/material-requests',
            roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
          },
          {
            label: 'Pending Approval',
            href: '/material-requests?status=pending_approval',
            roles: ['owner', 'pm', 'project_manager', 'accountant'],
          },
          {
            label: 'Ready to Order',
            href: '/material-requests?status=ready_to_order',
            roles: ['owner', 'pm', 'project_manager'],
            badge: 'ready_to_order', // Will show count of approved requests ready for order creation
          },
          {
            label: 'Approved',
            href: '/material-requests?status=approved',
            roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
          },
        ],
      },
      {
        label: 'Purchase Orders',
        href: '/purchase-orders',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
        children: [
          {
            label: 'All Orders',
            href: '/purchase-orders',
            roles: ['owner', 'pm', 'project_manager', 'accountant'],
          },
          {
            label: 'Pending Response',
            href: '/purchase-orders?status=order_sent',
            roles: ['owner', 'pm', 'project_manager'],
          },
          {
            label: 'Rejections',
            href: '/purchase-orders/rejections',
            roles: ['owner', 'pm', 'project_manager'],
          },
          {
            label: 'Ready to Deliver',
            href: '/purchase-orders?status=ready_for_delivery',
            roles: ['owner', 'pm', 'project_manager'],
          },
        ],
      },
      {
        label: 'Stock Tracking',
        href: '/dashboard/stock',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
      },
      {
        label: 'Approvals',
        href: '/dashboard/approvals',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
        badge: 'pending', // Will show count of pending approvals
      },
      {
        label: 'Work Items',
        href: '/work-items',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'supervisor'],
        icon: 'check-square',
      },
      {
        label: 'Equipment',
        href: '/equipment',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
        icon: 'tool',
      },
      {
        label: 'Subcontractors',
        href: '/subcontractors',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
        icon: 'users',
      },
    ],
  },
  labour: {
    label: 'Labour',
    icon: 'users',
    roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
    children: [
      {
        label: 'Dashboard',
        href: '/labour',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
        icon: 'home',
      },
      {
        label: 'Quick Entry',
        href: '/labour/entries/new',
        roles: ['owner'],
        icon: 'plus',
      },
      {
        label: 'Bulk Entry',
        href: '/labour/batches/new',
        roles: ['owner'],
        icon: 'shopping-cart',
      },
      {
        label: 'All Entries',
        href: '/labour/entries',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
      },
      {
        label: 'Workers',
        href: '/labour/workers',
        roles: ['owner', 'pm', 'project_manager'],
        icon: 'users',
      },
      {
        label: 'Templates',
        href: '/labour/templates',
        roles: ['owner', 'pm', 'project_manager'],
        icon: 'file-text',
      },
      {
        label: 'Reports',
        href: '/labour/reports',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
        icon: 'bar-chart',
      },
      {
        label: 'Supervisor Submissions',
        href: '/labour/supervisor-submissions',
        roles: ['owner', 'pm', 'project_manager'],
        icon: 'message-square',
      },
      {
        label: 'Site Reports',
        href: '/labour/site-reports',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'supervisor'],
        icon: 'file-text',
      },
    ],
  },
  professionalServices: {
    label: 'Professionals',
    icon: 'users',
    roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant'],
    children: [
      {
        label: 'Assignments',
        href: '/professional-services',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant'],
      },
      {
        label: 'Library',
        href: '/professional-services-library',
        roles: ['owner', 'pm', 'project_manager'],
        icon: 'book',
      },
      {
        label: 'Activities',
        href: '/professional-activities',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant'],
      },
      {
        label: 'Bulk Activity Entry',
        href: '/professional-activities/bulk',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk'],
        icon: 'shopping-cart',
      },
      {
        label: 'Activity Templates',
        href: '/activity-templates',
        roles: ['owner', 'pm', 'project_manager'],
        icon: 'file-text',
      },
      {
        label: 'Fees',
        href: '/professional-fees',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
      },
      {
        label: 'Reports',
        href: '/reports/professional-services',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
        icon: 'bar-chart',
      },
    ],
  },
  // Supplier navigation removed - suppliers no longer have system access
  // They receive purchase orders via email/SMS/push and respond via secure token links
  management: {
    label: 'Management',
    icon: 'settings',
    roles: ['owner', 'pm', 'project_manager', 'accountant'],
    children: [
      {
        label: 'Users',
        href: '/dashboard/users',
        roles: ['owner'],
      },
      {
        label: 'Suppliers',
        href: '/suppliers',
        roles: ['owner', 'pm', 'project_manager'],
      },
      {
        label: 'Categories',
        href: '/categories',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
      },
      {
        label: 'Floors',
        href: '/floors',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
      },
    ],
  },
  analytics: {
    label: 'Analytics',
    icon: 'bar-chart',
    roles: ['owner', 'investor', 'accountant', 'pm', 'project_manager'],
    children: [
      {
        label: 'Wastage Analytics',
        href: '/dashboard/analytics/wastage',
        roles: ['owner', 'pm', 'project_manager', 'accountant', 'investor', 'supervisor'],
      },
      {
        label: 'Budget vs Actual',
        href: '/dashboard/budget',
        roles: ['owner', 'investor', 'accountant', 'pm', 'project_manager'],
      },
      {
        label: 'Phase Reports',
        href: '/reports/phases',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
        icon: 'bar-chart',
      },
    ],
  },
  archive: {
    label: 'Archive',
    icon: 'archive',
    roles: ['owner'],
    children: [
      {
        label: 'Archived Projects',
        href: '/projects/archive',
        roles: ['owner'],
      },
      {
        label: 'Archived Investors',
        href: '/investors/archive',
        roles: ['owner'],
      },
      {
        label: 'Archived Materials',
        href: '/items/archive',
        roles: ['owner'],
      },
      {
        label: 'Archived Expenses',
        href: '/expenses/archive',
        roles: ['owner'],
      },
      {
        label: 'Archived Initial Expenses',
        href: '/initial-expenses/archive',
        roles: ['owner'],
      },
    ],
  },
};

/**
 * Get navigation items filtered by user role
 * @param {string} userRole - User's role (lowercase)
 * @param {string|null} projectId - Optional project ID for project-scoped navigation
 * @returns {Array} Filtered navigation items
 */
export function getNavigationForRole(userRole, projectId = null) {
  if (!userRole) return [];

  const role = userRole.toLowerCase();
  const filteredSections = [];

  // Define project-scoped routes (routes that should include projectId)
  const projectScopedRoutes = [
    '/items',
    '/phases',
    '/expenses',
    '/initial-expenses',
    '/material-requests',
    '/purchase-orders',
    '/professional-services',
    '/professional-activities',
    '/professional-fees',
    '/dashboard/budget',
    '/dashboard/analytics',
  ];

  // Helper to add project context to href
  const addProjectContext = (href) => {
    if (!projectId || !href) return href;
    
    // Check if route should be project-scoped
    const shouldScope = projectScopedRoutes.some((route) => href.startsWith(route));
    
    if (shouldScope) {
      // If it's a query string, add projectId to it
      if (href.includes('?')) {
        return `${href}&projectId=${projectId}`;
      }
      // Otherwise, add as query param
      return `${href}?projectId=${projectId}`;
    }
    
    return href;
  };

  // Check each section
  Object.values(NAVIGATION_SECTIONS).forEach((section) => {
    // Check if user has access to this section
    const hasSectionAccess = section.roles.some((r) => r.toLowerCase() === role);

    if (hasSectionAccess) {
      // If section has children, filter them too
      if (section.children && section.children.length > 0) {
        const filteredChildren = section.children
          .filter((child) => child.roles.some((r) => r.toLowerCase() === role))
          .map((child) => ({
            ...child,
            href: addProjectContext(child.href),
          }));

        // Only include section if it has accessible children or no children
        if (filteredChildren.length > 0 || !section.children) {
          filteredSections.push({
            ...section,
            href: addProjectContext(section.href),
            children: filteredChildren.length > 0 ? filteredChildren : undefined,
          });
        }
      } else {
        // Section has no children, include it if user has access
        filteredSections.push({
          ...section,
          href: addProjectContext(section.href),
        });
      }
    }
  });

  return filteredSections;
}

/**
 * Check if a navigation item should be visible for a role
 * @param {NavItem} item - Navigation item
 * @param {string} userRole - User's role
 * @returns {boolean} True if item should be visible
 */
export function isNavItemVisible(item, userRole) {
  if (!item.roles || !userRole) return false;
  const role = userRole.toLowerCase();
  return item.roles.some((r) => r.toLowerCase() === role);
}

/**
 * Get flat list of all navigation links for a role (for mobile menu)
 * @param {string} userRole - User's role
 * @param {string|null} projectId - Optional project ID for project-scoped navigation
 * @returns {Array} Flat list of navigation links (deduplicated by href)
 */
export function getFlatNavigationForRole(userRole, projectId = null) {
  if (!userRole) return [];

  const role = userRole.toLowerCase();
  const flatNav = [];
  const seenHrefs = new Set(); // Track seen hrefs to prevent duplicates

  // Define project-scoped routes
  const projectScopedRoutes = [
    '/items',
    '/phases',
    '/expenses',
    '/initial-expenses',
    '/material-requests',
    '/purchase-orders',
    '/professional-services',
    '/professional-activities',
    '/professional-fees',
    '/dashboard/budget',
    '/dashboard/analytics',
    '/work-items',
    '/equipment',
    '/subcontractors',
  ];

  // Helper to add project context to href
  const addProjectContext = (href) => {
    if (!projectId || !href) return href;
    
    const shouldScope = projectScopedRoutes.some((route) => href.startsWith(route));
    
    if (shouldScope) {
      if (href.includes('?')) {
        return `${href}&projectId=${projectId}`;
      }
      return `${href}?projectId=${projectId}`;
    }
    
    return href;
  };

  Object.values(NAVIGATION_SECTIONS).forEach((section) => {
    // Check section access
    if (section.roles.some((r) => r.toLowerCase() === role)) {
      // Add section itself if it has a direct href
      if (section.href && !section.children) {
        const href = addProjectContext(section.href);
        if (!seenHrefs.has(href)) {
          flatNav.push({
            label: section.label,
            href: href,
            icon: section.icon,
            badge: section.badge,
          });
          seenHrefs.add(href);
        }
      }

      // Add children
      if (section.children) {
        section.children.forEach((child) => {
          if (child.roles.some((r) => r.toLowerCase() === role)) {
            const href = addProjectContext(child.href);
            // Only add if we haven't seen this href before
            if (!seenHrefs.has(href)) {
              flatNav.push({
                label: child.label,
                href: href,
                icon: child.icon,
                badge: child.badge,
              });
              seenHrefs.add(href);
            }
          }
        });
      }
    }
  });

  return flatNav;
}

/**
 * Get badge count for navigation items (e.g., pending approvals)
 * This will be populated by API calls in components
 * @param {string} badgeType - Type of badge ('pending', etc.)
 * @returns {number|null} Badge count or null
 */
export function getBadgeCount(badgeType) {
  // This will be implemented with actual API calls in components
  // For now, return null
  return null;
}

