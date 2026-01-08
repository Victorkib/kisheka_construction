/**
 * Route Matching Utilities
 * Enhanced route matching for sidebar active state detection
 * Handles query parameters, dynamic routes, and nested routes
 */

/**
 * Normalize pathname by removing query parameters and trailing slashes
 * @param {string} pathname - Full pathname (may include query params)
 * @returns {string} Normalized pathname
 */
export function normalizePath(pathname) {
  if (!pathname) return '';
  
  // Remove query parameters
  const withoutQuery = pathname.split('?')[0];
  
  // Remove trailing slash (except for root)
  const normalized = withoutQuery === '/' ? '/' : withoutQuery.replace(/\/$/, '');
  
  return normalized;
}

/**
 * Extract base path from href (removes query params)
 * @param {string} href - Full href (may include query params)
 * @returns {string} Base path
 */
export function getBasePath(href) {
  if (!href) return '';
  return normalizePath(href);
}

/**
 * Check if pathname matches a dynamic route pattern
 * Supports patterns like: /items/[id], /projects/[id]/team
 * @param {string} pathname - Current pathname
 * @param {string} pattern - Route pattern (e.g., '/items/[id]')
 * @returns {boolean} True if matches
 */
export function matchDynamicRoute(pathname, pattern) {
  if (!pathname || !pattern) return false;
  
  const normalizedPath = normalizePath(pathname);
  const normalizedPattern = normalizePath(pattern);
  
  // Convert pattern to regex
  // Replace [id], [token], etc. with regex pattern
  const regexPattern = normalizedPattern
    .replace(/\[([^\]]+)\]/g, '[^/]+') // [id] -> [^/]+
    .replace(/\//g, '\\/'); // Escape slashes
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizedPath);
}

/**
 * Check if pathname is a child of the given href
 * @param {string} pathname - Current pathname
 * @param {string} href - Parent href
 * @returns {boolean} True if pathname is a child route
 */
export function isChildRoute(pathname, href) {
  if (!pathname || !href) return false;
  
  const normalizedPath = normalizePath(pathname);
  const normalizedHref = normalizePath(href);
  
  // Exact match is not a child
  if (normalizedPath === normalizedHref) return false;
  
  // Check if pathname starts with href + '/'
  return normalizedPath.startsWith(normalizedHref + '/');
}

/**
 * Check if route is active
 * @param {string} pathname - Current pathname
 * @param {string} href - Route href to check
 * @param {Object} options - Matching options
 * @param {boolean} options.exact - Require exact match (default: false)
 * @param {boolean} options.includeChildren - Include child routes (default: true)
 * @param {boolean} options.ignoreQuery - Ignore query parameters (default: true)
 * @returns {boolean} True if route is active
 */
export function isRouteActive(pathname, href, options = {}) {
  if (!pathname || !href) return false;
  
  const {
    exact = false,
    includeChildren = true,
    ignoreQuery = true,
  } = options;
  
  const normalizedPath = ignoreQuery ? normalizePath(pathname) : pathname.split('?')[0];
  const normalizedHref = ignoreQuery ? getBasePath(href) : href.split('?')[0];
  
  // Exact match (highest priority)
  if (normalizedPath === normalizedHref) {
    return true;
  }
  
  // If exact match required, return false
  if (exact) {
    return false;
  }
  
  // Check for child route
  if (includeChildren && isChildRoute(normalizedPath, normalizedHref)) {
    return true;
  }
  
  // Check dynamic route matching
  if (matchDynamicRoute(normalizedPath, normalizedHref)) {
    return true;
  }
  
  return false;
}

/**
 * Find active route in navigation tree
 * @param {string} pathname - Current pathname
 * @param {Array} navigation - Navigation items array
 * @returns {Object} Active route information
 */
export function getActiveRoute(pathname, navigation) {
  if (!pathname || !navigation || !Array.isArray(navigation)) {
    return {
      active: null,
      activeParent: null,
      activePath: [],
    };
  }
  
  let active = null;
  let activeParent = null;
  const activePath = [];
  
  // Recursive function to search navigation tree
  function searchNav(items, parent = null) {
    for (const item of items) {
      if (!item.href) continue;
      
      const isActive = isRouteActive(pathname, item.href, {
        exact: false,
        includeChildren: true,
        ignoreQuery: true,
      });
      
      if (isActive) {
        active = item;
        activeParent = parent;
        activePath.push(item);
        
        // If this item has children, check if any child is more specifically active
        if (item.children && Array.isArray(item.children)) {
          const childActive = searchNav(item.children, item);
          if (childActive) {
            return childActive;
          }
        }
        
        return item;
      }
      
      // Check children recursively
      if (item.children && Array.isArray(item.children)) {
        const childResult = searchNav(item.children, item);
        if (childResult) {
          activePath.push(item); // Add parent to path
          return childResult;
        }
      }
    }
    
    return null;
  }
  
  searchNav(navigation);
  
  return {
    active,
    activeParent,
    activePath: activePath.reverse(), // Reverse to get root-to-leaf path
  };
}

/**
 * Check if a navigation item should be highlighted as active
 * @param {string} pathname - Current pathname
 * @param {Object} item - Navigation item
 * @param {Object} activeRouteInfo - Active route information from getActiveRoute
 * @returns {Object} Active state information
 */
export function getActiveState(pathname, item, activeRouteInfo = null) {
  if (!pathname || !item || !item.href) {
    return {
      isActive: false,
      isParentActive: false,
      isChildActive: false,
    };
  }
  
  // Get active route info if not provided
  const activeInfo = activeRouteInfo || getActiveRoute(pathname, [item]);
  
  const isActive = isRouteActive(pathname, item.href, {
    exact: false,
    includeChildren: true,
    ignoreQuery: true,
  });
  
  // Check if any child is active
  let isChildActive = false;
  if (item.children && Array.isArray(item.children)) {
    isChildActive = item.children.some((child) => {
      if (!child.href) return false;
      return isRouteActive(pathname, child.href, {
        exact: false,
        includeChildren: true,
        ignoreQuery: true,
      });
    });
  }
  
  // Check if this is a parent of the active route
  const isParentActive = activeInfo.activePath.some(
    (pathItem) => pathItem.href === item.href && pathItem !== activeInfo.active
  );
  
  return {
    isActive,
    isParentActive: isParentActive || isChildActive,
    isChildActive,
  };
}

/**
 * Get all routes that should be highlighted for a given pathname
 * Useful for highlighting parent sections when child is active
 * @param {string} pathname - Current pathname
 * @param {Array} navigation - Navigation items array
 * @returns {Set<string>} Set of hrefs that should be highlighted
 */
export function getActiveRoutes(pathname, navigation) {
  const activeRoutes = new Set();
  const activeInfo = getActiveRoute(pathname, navigation);
  
  // Add active route
  if (activeInfo.active && activeInfo.active.href) {
    activeRoutes.add(activeInfo.active.href);
  }
  
  // Add all parents in active path
  activeInfo.activePath.forEach((item) => {
    if (item.href) {
      activeRoutes.add(item.href);
    }
  });
  
  return activeRoutes;
}






