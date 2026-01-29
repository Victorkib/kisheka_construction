/**
 * usePermissions Hook
 * Client-side hook for role-based rendering and permission checking
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { roleHasPermission } from '@/lib/permissions';
import { normalizeRole } from '@/lib/role-normalizer';

// Module-level cache to prevent refetching on every mount
let cachedUser = null;
let cacheTimestamp = null;
let fetchPromise = null;
const CACHE_DURATION = 1 * 60 * 1000; // 1 minute (reduced from 5 to improve data freshness)

/**
 * Global function to clear user cache
 * Called on logout and when auth state changes
 */
export function clearUserCache() {
  cachedUser = null;
  cacheTimestamp = null;
  fetchPromise = null;
  // Also clear from sessionStorage if stored
  try {
    sessionStorage.removeItem('kisheka_user_cache');
  } catch (e) {
    // Ignore errors (sessionStorage might not be available)
  }
}

/**
 * Custom hook to check user permissions and role
 * Uses caching to prevent unnecessary refetches on navigation
 * @returns {Object} Permission checking functions and user data
 */
export function usePermissions() {
  const [user, setUser] = useState(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      // Check if we have a valid cache
      const now = Date.now();
      if (cachedUser && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
        setUser(cachedUser);
        setLoading(false);
        return;
      }

      // If there's already a fetch in progress, wait for it
      if (fetchPromise) {
        try {
          const cachedData = await fetchPromise;
          setUser(cachedData);
          setLoading(false);
          return;
        } catch (err) {
          // If the promise failed, continue with a new fetch
        }
      }

      try {
        setLoading(true);
        setError(null);
        
        // Create a new fetch promise
        fetchPromise = fetch('/api/auth/me')
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              cachedUser = data.data;
              cacheTimestamp = Date.now();
              return data.data;
            } else {
              throw new Error('Failed to fetch user');
            }
          })
          .finally(() => {
            fetchPromise = null;
          });

        const userData = await fetchPromise;
        setUser(userData);
      } catch (err) {
        console.error('Error fetching user:', err);
        setError(err.message);
        // Clear cache on error
        cachedUser = null;
        cacheTimestamp = null;
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const refetch = async () => {
    // Clear cache and refetch with no-cache
    clearUserCache();
    
    try {
      setLoading(true);
      setError(null);
      // Force fresh fetch from server, bypass browser cache
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      });
      const data = await response.json();

      if (data.success) {
        cachedUser = data.data;
        cacheTimestamp = Date.now();
        setUser(data.data);
      } else {
        setError('Failed to fetch user');
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if user has one of the required roles
   * @param {string|string[]} requiredRoles - Role(s) to check
   * @returns {boolean} True if user has required role
   */
  const hasRole = useCallback((requiredRoles) => {
    if (!user || !user.role) return false;

    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    const userRole = user.role.toLowerCase();

    return roles.some((role) => role.toLowerCase() === userRole);
  }, [user]);

  /**
   * Check if user has permission to perform an action
   * Uses centralized permissions from lib/permissions.js
   * @param {string} action - Action to check (e.g., 'create_material')
   * @returns {boolean} True if user has permission
   */
  const canAccess = useCallback((action) => {
    if (!user || !user.role) return false;

    // Normalize role using utility function
    const normalizedRole = normalizeRole(user.role);
    
    // Use centralized permissions
    return roleHasPermission(normalizedRole, action);
  }, [user]);

  /**
   * Check if user can access a specific route
   * @param {string} route - Route path
   * @returns {boolean} True if user can access route
   */
  const canAccessRoute = useCallback((route) => {
    if (!user || !user.role) return false;

    const role = user.role.toLowerCase();

    // Route-based access control
    // Note: 'pm' is the standard role name. 'project_manager' is accepted for backward compatibility
    const routePermissions = {
      '/dashboard': ['owner', 'investor', 'pm', 'site_clerk', 'accountant', 'supervisor', 'supplier'],
      '/projects': ['owner', 'pm', 'site_clerk', 'accountant', 'supervisor'],
      '/projects/new': ['owner', 'pm'],
      '/financing': ['owner', 'investor', 'accountant'],
      '/investors': ['owner'],
      '/initial-expenses': ['owner', 'pm', 'site_clerk', 'accountant'],
      '/items': ['owner', 'pm', 'site_clerk', 'accountant', 'supervisor'],
      '/dashboard/approvals': ['owner', 'pm', 'accountant'],
      '/dashboard/stock': ['owner', 'pm', 'site_clerk', 'accountant', 'supervisor'],
      '/expenses': ['owner', 'pm', 'site_clerk', 'accountant', 'supervisor'],
      '/categories': ['owner', 'pm', 'site_clerk', 'accountant'],
      '/floors': ['owner', 'pm', 'site_clerk', 'accountant'],
      '/dashboard/analytics/wastage': ['owner', 'pm', 'accountant', 'investor', 'supervisor'],
      '/dashboard/budget': ['owner', 'investor', 'accountant', 'pm'],
      '/supplier/delivery-notes': ['supplier'],
    };

    // Normalize role using utility function
    const normalizedRole = normalizeRole(role);
    
    // Check exact route or parent route
    const exactMatch = routePermissions[route];
    if (exactMatch) {
      return exactMatch.some((r) => r.toLowerCase() === normalizedRole);
    }

    // Check parent routes (e.g., /projects/new should check /projects)
    const parentRoute = route.split('/').slice(0, -1).join('/');
    const parentMatch = routePermissions[parentRoute];
    if (parentMatch) {
      return parentMatch.some((r) => r.toLowerCase() === normalizedRole);
    }

    // Default: allow access if user is authenticated
    return true;
  }, [user]);

  return {
    user,
    loading,
    error,
    hasRole,
    canAccess,
    canAccessRoute,
    refetch,
  };
}

