/**
 * Sidebar Data Provider
 * Centralized data fetching for all sidebar components
 * Batches API requests and provides caching
 */

'use client';

import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useProjectContext } from '@/contexts/ProjectContext';

const SidebarDataContext = createContext(null);

/**
 * Extract project ID from pathname or search params
 */
function getProjectIdFromUrl(pathname, searchParams) {
  const objectIdPattern = /^[a-f\d]{24}$/i;
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  if (projectMatch) {
    const candidate = projectMatch[1];
    return objectIdPattern.test(candidate) ? candidate : null;
  }
  const queryProjectId = searchParams.get('projectId');
  return objectIdPattern.test(queryProjectId || '') ? queryProjectId : null;
}

/**
 * Sidebar Data Provider Component
 * Fetches all sidebar-related data in one place
 * Now uses ProjectContext to get current project, not just URL
 */
export function SidebarDataProvider({ children }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, canAccess } = usePermissions();
  const { currentProject, currentProjectId } = useProjectContext();
  
  const [data, setData] = useState({
    project: null,
    pendingActions: [],
    suggestions: [],
    loading: true,
    error: null,
  });

  // Prioritize ProjectContext over URL - this ensures sidebar respects project selection
  const projectIdFromUrl = useMemo(() => getProjectIdFromUrl(pathname, searchParams), [pathname, searchParams]);
  const projectId = useMemo(() => {
    // Use currentProjectId from context if available, otherwise fall back to URL
    const contextProjectId = currentProjectId || (currentProject?._id?.toString() || currentProject?._id || null);
    return contextProjectId || projectIdFromUrl;
  }, [currentProjectId, currentProject, projectIdFromUrl]);

  useEffect(() => {
    if (!user) {
      setData({ project: null, pendingActions: [], suggestions: [], loading: false, error: null });
      return;
    }

    fetchAllSidebarData();
  }, [user, pathname, searchParams, projectId, canAccess, currentProject]);

  const fetchAllSidebarData = async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      // Batch all API requests
      const promises = [];

      // Use currentProject from context if available, otherwise fetch
      if (currentProject && (currentProject._id?.toString() === projectId || currentProject._id === projectId)) {
        // Use project from context - no need to fetch
        promises.push(Promise.resolve({ type: 'project', data: { success: true, data: currentProject } }));
      } else if (projectId) {
        // Fetch project if not in context
        promises.push(
          fetch(`/api/projects/${projectId}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
          })
            .then(res => res.json())
            .then(data => ({ type: 'project', data }))
            .catch(err => ({ type: 'project', data: null, error: err }))
        );
      } else {
        promises.push(Promise.resolve({ type: 'project', data: null }));
      }

      // Fetch pending actions - filter by project if available
      if (canAccess && canAccess('approve_material_request')) {
        const summaryUrl = projectId 
          ? `/api/dashboard/summary?projectId=${projectId}`
          : '/api/dashboard/summary';
        promises.push(
          fetch(summaryUrl, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
          })
            .then(res => res.json())
            .then(data => ({ type: 'approvals', data }))
            .catch(err => ({ type: 'approvals', data: null, error: err }))
        );
      } else {
        promises.push(Promise.resolve({ type: 'approvals', data: null }));
      }

      // Fetch ready to order count - filter by project if available
      if (canAccess && (canAccess('create_purchase_order') || canAccess('view_material_requests'))) {
        const readyToOrderUrl = projectId
          ? `/api/material-requests?status=ready_to_order&limit=0&projectId=${projectId}`
          : '/api/material-requests?status=ready_to_order&limit=0';
        promises.push(
          fetch(readyToOrderUrl, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
          })
            .then(res => res.json())
            .then(data => ({ type: 'readyToOrder', data }))
            .catch(err => ({ type: 'readyToOrder', data: null, error: err }))
        );
      } else {
        promises.push(Promise.resolve({ type: 'readyToOrder', data: null }));
      }

      // Fetch pending purchase orders for suppliers - filter by project if available
      if (user?.role?.toLowerCase() === 'supplier') {
        const ordersUrl = projectId
          ? `/api/purchase-orders?limit=0&projectId=${projectId}`
          : '/api/purchase-orders?limit=0';
        promises.push(
          fetch(ordersUrl, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
          })
            .then(res => res.json())
            .then(data => ({ type: 'pendingOrders', data }))
            .catch(err => ({ type: 'pendingOrders', data: null, error: err }))
        );
      } else {
        promises.push(Promise.resolve({ type: 'pendingOrders', data: null }));
      }

      // Fetch prerequisites for suggestions (if on project page)
      if (projectId && pathname.match(/^\/projects\/[^/]+$/)) {
        promises.push(
          fetch(`/api/projects/${projectId}/prerequisites`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
          })
            .then(res => res.json())
            .then(data => ({ type: 'prerequisites', data }))
            .catch(err => ({ type: 'prerequisites', data: null, error: err }))
        );
      } else {
        promises.push(Promise.resolve({ type: 'prerequisites', data: null }));
      }

      // Fetch material request for suggestions (if on material request page)
      if (pathname.match(/^\/material-requests\/[^/]+$/)) {
        const requestId = pathname.split('/')[2];
        promises.push(
          fetch(`/api/material-requests/${requestId}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
          })
            .then(res => res.json())
            .then(data => ({ type: 'materialRequest', data }))
            .catch(err => ({ type: 'materialRequest', data: null, error: err }))
        );
      } else {
        promises.push(Promise.resolve({ type: 'materialRequest', data: null }));
      }

      // Wait for all requests
      const results = await Promise.all(promises);

      // Process results
      let project = null;
      const pendingActions = [];
      const suggestions = [];

      for (const result of results) {
        if (result.error) {
          console.error(`Error fetching ${result.type}:`, result.error);
          continue;
        }

        switch (result.type) {
          case 'project':
            if (result.data?.success) {
              project = result.data.data;
            }
            break;

          case 'approvals':
            if (result.data?.success && result.data.data?.summary?.totalPendingApprovals > 0) {
              const approvalsHref = projectId 
                ? `/dashboard/approvals?projectId=${projectId}`
                : '/dashboard/approvals';
              pendingActions.push({
                type: 'approval',
                label: `${result.data.data.summary.totalPendingApprovals} Material Request${result.data.data.summary.totalPendingApprovals !== 1 ? 's' : ''} Pending Approval`,
                href: approvalsHref,
                icon: '✅',
                priority: 'high',
                count: result.data.data.summary.totalPendingApprovals,
              });
            }
            break;

          case 'readyToOrder':
            if (result.data?.success) {
              let count = 0;
              if (result.data.data?.pagination?.total !== undefined) {
                count = result.data.data.pagination.total;
              } else if (result.data.data?.requests) {
                count = result.data.data.requests.length;
              }
              if (count > 0) {
                const readyToOrderHref = projectId
                  ? `/material-requests?status=ready_to_order&projectId=${projectId}`
                  : '/material-requests?status=ready_to_order';
                pendingActions.push({
                  type: 'ready_to_order',
                  label: `${count} Approved Request${count !== 1 ? 's' : ''} Ready to Order`,
                  href: readyToOrderHref,
                  icon: '🛒',
                  priority: 'medium',
                  count,
                });
              }
            }
            break;

          case 'pendingOrders':
            if (result.data?.success && result.data.data?.orders) {
              const pendingCount = result.data.data.orders.filter(
                (order) => order.status === 'order_sent' || order.status === 'order_modified'
              ).length;
              if (pendingCount > 0) {
                const ordersHref = projectId
                  ? `/purchase-orders?projectId=${projectId}`
                  : '/purchase-orders';
                pendingActions.push({
                  type: 'pending_order',
                  label: `${pendingCount} Purchase Order${pendingCount !== 1 ? 's' : ''} Awaiting Response`,
                  href: ordersHref,
                  icon: '📋',
                  priority: 'high',
                  count: pendingCount,
                });
              }
            }
            break;

          case 'prerequisites':
            if (result.data?.success && result.data.data) {
              const prereq = result.data.data;
              if (!prereq.readiness.readyForMaterials) {
                const missing = Object.entries(prereq.prerequisites)
                  .filter(([_, item]) => item.required && !item.completed);
                
                if (missing.length > 0) {
                  const firstMissing = missing[0];
                  suggestions.push({
                    type: 'setup',
                    label: `Complete ${firstMissing[0]} setup`,
                    href: firstMissing[1].actionUrl || `/projects/${projectId}`,
                    icon: '⚙️',
                    priority: 'high',
                  });
                }
              } else if (canAccess && canAccess('create_material_request')) {
                suggestions.push({
                  type: 'workflow',
                  label: 'Create Material Request',
                  href: `/material-requests/new?projectId=${projectId}`,
                  icon: '📦',
                  priority: 'medium',
                });
              }
            }
            break;

          case 'materialRequest':
            if (result.data?.success && result.data.data) {
              const request = result.data.data;
              if (request.status === 'approved' && canAccess && canAccess('create_purchase_order')) {
                suggestions.push({
                  type: 'workflow',
                  label: 'Create Purchase Order',
                  href: `/purchase-orders/new?materialRequestId=${request._id}`,
                  icon: '🛒',
                  priority: 'high',
                });
              }
            }
            break;
        }
      }

      setData({
        project,
        pendingActions,
        suggestions,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('Error fetching sidebar data:', err);
      setData(prev => ({
        ...prev,
        loading: false,
        error: err.message,
      }));
    }
  };

  const value = useMemo(
    () => ({
      ...data,
      projectId,
      refresh: fetchAllSidebarData,
    }),
    [data, projectId]
  );

  return <SidebarDataContext.Provider value={value}>{children}</SidebarDataContext.Provider>;
}

/**
 * Hook to access sidebar data
 */
export function useSidebarData() {
  const context = useContext(SidebarDataContext);
  if (!context) {
    throw new Error('useSidebarData must be used within SidebarDataProvider');
  }
  return context;
}



