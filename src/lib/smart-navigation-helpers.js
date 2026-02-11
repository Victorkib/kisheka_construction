/**
 * Smart Navigation Configuration
 * Progressive disclosure with role-based prioritization
 * Reduces cognitive load while maintaining full feature access
 */

/**
 * Navigation item with smart defaults
 * @typedef {Object} SmartNavItem
 * @property {string} label - Display label
 * @property {string} href - Route path
 * @property {string} icon - Icon name
 * @property {string[]} roles - Allowed roles
 * @property {boolean} defaultExpanded - Should section be expanded by default
 * @property {boolean} alwaysVisible - Always show (not collapsible)
 * @property {string} priority - 'high' | 'medium' | 'low'
 * @property {SmartNavItem[]} children - Sub-items
 */

/**
 * Smart Navigation Sections
 * Organized with progressive disclosure in mind
 */
export const SMART_NAVIGATION_SECTIONS = {
  // PRIMARY - Always visible, never collapsed
  dashboard: {
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'home',
    roles: ['owner', 'investor', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor', 'supplier'],
    alwaysVisible: true,
    priority: 'high',
  },
  projects: {
    label: 'Projects',
    href: '/projects',
    icon: 'building',
    roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
    alwaysVisible: true,
    priority: 'high',
    children: [
      {
        label: 'All Projects',
        href: '/projects',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
        priority: 'high',
      },
      {
        label: 'Phases',
        href: '/phases',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
        icon: 'layers',
        priority: 'high',
      },
      {
        label: 'Floors',
        href: '/floors',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
        icon: 'building',
        priority: 'medium',
      },
      // Create Project removed - accessible via contextual actions or command palette
    ],
  },

  // SECONDARY - Collapsed by default, can be expanded
  operations: {
    label: 'Operations',
    icon: 'briefcase',
    roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
    defaultExpanded: false,
    priority: 'high',
    children: [
      {
        label: 'Materials',
        href: '/items',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
        priority: 'high',
      },
      {
        label: 'Material Requests',
        href: '/material-requests',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
        priority: 'high',
        // Status filters removed - use page filters instead
      },
      {
        label: 'Purchase Orders',
        href: '/purchase-orders',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
        priority: 'high',
        // Status filters removed - use page filters instead
      },
      {
        label: 'Stock Tracking',
        href: '/dashboard/stock',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
        priority: 'medium',
      },
      {
        label: 'Approvals',
        href: '/dashboard/approvals',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
        badge: 'pending',
        priority: 'high',
      },
      {
        label: 'Work Items',
        href: '/work-items',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'supervisor'],
        icon: 'check-square',
        priority: 'medium',
      },
      {
        label: 'Equipment',
        href: '/equipment',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
        icon: 'tool',
        priority: 'medium',
      },
      {
        label: 'Subcontractors',
        href: '/subcontractors',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
        icon: 'users',
        priority: 'low',
      },
    ],
  },
  labour: {
    label: 'Labour',
    icon: 'users',
    roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
    defaultExpanded: false,
    priority: 'high',
    children: [
      {
        label: 'Dashboard',
        href: '/labour',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
        icon: 'home',
        priority: 'high',
      },
      {
        label: 'All Entries',
        href: '/labour/entries',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant', 'supervisor'],
        priority: 'high',
      },
      {
        label: 'Workers',
        href: '/labour/workers',
        roles: ['owner', 'pm', 'project_manager'],
        icon: 'users',
        priority: 'medium',
      },
      {
        label: 'Reports',
        href: '/labour/reports',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
        icon: 'bar-chart',
        priority: 'medium',
      },
      {
        label: 'Site Reports',
        href: '/labour/site-reports',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'supervisor'],
        icon: 'file-text',
        priority: 'low',
      },
      // Quick Entry and Bulk Entry removed - accessible via contextual actions
      // Templates removed - consolidated in Settings
      // Supervisor Submissions removed - accessible via Approvals
    ],
  },
  financial: {
    label: 'Financial',
    icon: 'dollar-sign',
    roles: ['owner', 'investor', 'accountant', 'pm', 'project_manager'],
    defaultExpanded: false,
    priority: 'high',
    children: [
      {
        label: 'Financing',
        href: '/financing',
        roles: ['owner', 'investor', 'accountant'],
        priority: 'high',
      },
      {
        label: 'Investors',
        href: '/investors',
        roles: ['owner'],
        priority: 'high',
      },
      {
        label: 'Budget Reallocations',
        href: '/budget-reallocations',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
        icon: 'arrow-left-right',
        priority: 'medium',
      },
      {
        label: 'Expenses',
        href: '/expenses',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant'],
        priority: 'high',
      },
      {
        label: 'Initial Expenses',
        href: '/initial-expenses',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant'],
        priority: 'medium',
      },
    ],
  },
  professionals: {
    label: 'Professionals',
    icon: 'users',
    roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant'],
    defaultExpanded: false,
    priority: 'medium',
    children: [
      {
        label: 'Assignments',
        href: '/professional-services',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant'],
        priority: 'high',
      },
      {
        label: 'Activities',
        href: '/professional-activities',
        roles: ['owner', 'pm', 'project_manager', 'site_clerk', 'accountant'],
        priority: 'high',
      },
      {
        label: 'Fees',
        href: '/professional-fees',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
        priority: 'medium',
      },
      // Library, Templates, Bulk Entry removed - consolidated
      // Reports removed - consolidated in Analytics
    ],
  },
  analytics: {
    label: 'Analytics',
    icon: 'bar-chart',
    roles: ['owner', 'investor', 'accountant', 'pm', 'project_manager'],
    defaultExpanded: false,
    priority: 'medium',
    children: [
      {
        label: 'Dashboard Analytics',
        href: '/dashboard/analytics/wastage',
        roles: ['owner', 'pm', 'project_manager', 'accountant', 'investor', 'supervisor'],
        priority: 'high',
      },
      {
        label: 'Budget vs Actual',
        href: '/dashboard/budget',
        roles: ['owner', 'investor', 'accountant', 'pm', 'project_manager'],
        priority: 'high',
      },
      {
        label: 'All Reports',
        href: '/reports/phases',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
        icon: 'bar-chart',
        priority: 'medium',
      },
    ],
  },

  // TERTIARY - Hidden in settings menu
  settings: {
    label: 'Settings',
    icon: 'settings',
    roles: ['owner', 'pm', 'project_manager', 'accountant'],
    defaultExpanded: false,
    priority: 'low',
    children: [
      {
        label: 'Management',
        icon: 'settings',
        roles: ['owner', 'pm', 'project_manager', 'accountant'],
        priority: 'medium',
        children: [
          {
            label: 'Users',
            href: '/dashboard/users',
            roles: ['owner'],
            priority: 'high',
          },
          {
            label: 'Suppliers',
            href: '/suppliers',
            roles: ['owner', 'pm', 'project_manager'],
            priority: 'medium',
          },
          {
            label: 'Categories',
            href: '/categories',
            roles: ['owner', 'pm', 'project_manager', 'accountant'],
            priority: 'low',
          },
        ],
      },
      {
        label: 'Templates',
        icon: 'file-text',
        roles: ['owner', 'pm', 'project_manager'],
        priority: 'medium',
        children: [
          {
            label: 'Phase Templates',
            href: '/phase-templates',
            roles: ['owner', 'pm', 'project_manager'],
            priority: 'medium',
          },
          {
            label: 'Material Templates',
            href: '/material-templates',
            roles: ['owner', 'pm', 'project_manager'],
            priority: 'medium',
          },
          {
            label: 'Activity Templates',
            href: '/activity-templates',
            roles: ['owner', 'pm', 'project_manager'],
            priority: 'medium',
          },
          {
            label: 'Labour Templates',
            href: '/labour/templates',
            roles: ['owner', 'pm', 'project_manager'],
            priority: 'medium',
          },
        ],
      },
      {
        label: 'Archive',
        icon: 'archive',
        roles: ['owner'],
        priority: 'low',
        children: [
          {
            label: 'Archived Projects',
            href: '/projects/archive',
            roles: ['owner'],
            priority: 'low',
          },
          {
            label: 'Archived Investors',
            href: '/investors/archive',
            roles: ['owner'],
            priority: 'low',
          },
          {
            label: 'Archived Materials',
            href: '/items/archive',
            roles: ['owner'],
            priority: 'low',
          },
          {
            label: 'Archived Expenses',
            href: '/expenses/archive',
            roles: ['owner'],
            priority: 'low',
          },
          {
            label: 'Archived Initial Expenses',
            href: '/initial-expenses/archive',
            roles: ['owner'],
            priority: 'low',
          },
        ],
      },
    ],
  },
};

/**
 * Get smart navigation for role with progressive disclosure
 * @param {string} userRole - User's role
 * @param {string|null} projectId - Optional project ID
 * @param {Object} options - Options for navigation
 * @param {boolean} options.showSettings - Show settings section
 * @param {Array} options.favorites - User's favorite items
 * @returns {Array} Filtered navigation items
 */
export function getSmartNavigationForRole(userRole, projectId = null, options = {}) {
  if (!userRole) return [];

  const role = userRole.toLowerCase();
  const { showSettings = false, favorites = [] } = options;
  const filteredSections = [];

  // Helper to add project context
  const addProjectContext = (href) => {
    if (!projectId || !href) return href;
    const projectScopedRoutes = [
      '/items', '/phases', '/expenses', '/initial-expenses',
      '/material-requests', '/purchase-orders', '/professional-services',
      '/professional-activities', '/professional-fees', '/dashboard/budget',
      '/dashboard/analytics', '/work-items', '/equipment', '/subcontractors',
    ];
    const shouldScope = projectScopedRoutes.some(route => href.startsWith(route));
    if (shouldScope) {
      return href.includes('?') ? `${href}&projectId=${projectId}` : `${href}?projectId=${projectId}`;
    }
    return href;
  };

  // Helper to filter children
  const filterChildren = (children) => {
    if (!children) return undefined;
    return children
      .filter(child => {
        if (child.roles) {
          return child.roles.some(r => r.toLowerCase() === role);
        }
        return true;
      })
      .map(child => ({
        ...child,
        href: child.href ? addProjectContext(child.href) : undefined,
        children: filterChildren(child.children),
      }))
      .filter(child => {
        // Only include if has href or has accessible children
        return child.href || (child.children && child.children.length > 0);
      });
  };

  // Process each section
  Object.entries(SMART_NAVIGATION_SECTIONS).forEach(([key, section]) => {
    // Skip settings if not requested
    if (key === 'settings' && !showSettings) return;

    // Check role access
    if (!section.roles.some(r => r.toLowerCase() === role)) return;

    const filteredChildren = filterChildren(section.children);

    // Only include if has accessible children or is always visible
    if (filteredChildren && filteredChildren.length > 0 || section.alwaysVisible) {
      filteredSections.push({
        ...section,
        key,
        href: section.href ? addProjectContext(section.href) : undefined,
        children: filteredChildren,
      });
    }
  });

  // Sort by priority (high first)
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  filteredSections.sort((a, b) => {
    const aPriority = priorityOrder[a.priority] ?? 1;
    const bPriority = priorityOrder[b.priority] ?? 1;
    return aPriority - bPriority;
  });

  return filteredSections;
}

/**
 * Get favorites section for navigation
 * @param {Array} favorites - Favorite items
 * @param {string} userRole - User's role
 * @param {string|null} projectId - Optional project ID
 * @returns {Object|null} Favorites section
 */
export function getFavoritesSection(favorites, userRole, projectId = null) {
  if (!favorites || favorites.length === 0) return null;

  const addProjectContext = (href) => {
    if (!projectId || !href) return href;
    const projectScopedRoutes = [
      '/items', '/phases', '/expenses', '/initial-expenses',
      '/material-requests', '/purchase-orders', '/professional-services',
      '/professional-activities', '/professional-fees', '/dashboard/budget',
      '/dashboard/analytics', '/work-items', '/equipment', '/subcontractors',
    ];
    const shouldScope = projectScopedRoutes.some(route => href.startsWith(route));
    if (shouldScope) {
      return href.includes('?') ? `${href}&projectId=${projectId}` : `${href}?projectId=${projectId}`;
    }
    return href;
  };

  return {
    label: 'Favorites',
    icon: 'star',
    key: 'favorites',
    alwaysVisible: true,
    priority: 'high',
    children: favorites.map(fav => ({
      ...fav,
      href: addProjectContext(fav.href),
    })),
  };
}
