/**
 * Sidebar Navigation Component
 * Collapsible sidebar with role-based navigation
 */

'use client';

import { useState, useEffect, useMemo, useRef, memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getNavigationForRole } from '@/lib/navigation-helpers';
import { usePermissions } from '@/hooks/use-permissions';
import { useProjectContext } from '@/contexts/ProjectContext';
import { SidebarDataProvider } from '@/components/layout/SidebarDataProvider';
import { ContextualQuickActions } from '@/components/navigation/ContextualQuickActions';
import { CurrentProjectContext } from '@/components/navigation/CurrentProjectContext';
import { RecentlyViewed } from '@/components/navigation/RecentlyViewed';
import { PendingActions } from '@/components/navigation/PendingActions';
import { SuggestedActions } from '@/components/navigation/SuggestedActions';
import { isRouteActive, getActiveState, getActiveRoute } from '@/lib/utils/route-matching';
import { getNavItemColors } from '@/lib/utils/navigation-colors';

/**
 * Icon component placeholder
 * In production, use lucide-react or similar icon library
 */
function Icon({ name, className = 'w-5 h-5' }) {
  const icons = {
    home: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    building: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    'dollar-sign': (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    briefcase: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    settings: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    'bar-chart': (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    chevron: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    ),
    archive: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
    users: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    book: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    'shopping-cart': (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    'file-text': (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    layers: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  };

  return icons[name] || null;
}

/**
 * Badge component for notification counts
 */
function Badge({ count, className = '' }) {
  if (!count || count === 0) return null;

  return (
    <span
      className={`ml-auto bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * Active Indicator Component
 * Visual indicator for active navigation items with dynamic colors
 */
function ActiveIndicator({ isActive, isParentActive, accentColor = 'bg-blue-600', className = '' }) {
  if (!isActive && !isParentActive) return null;
  
  return (
    <div
      className={`absolute left-0 top-0 bottom-0 w-0.5 ${accentColor} rounded-r transition-all duration-200 ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Navigation Section Component
 * Memoized to prevent unnecessary re-renders on navigation
 * Enhanced with sophisticated active state detection
 */
const NavSection = memo(function NavSection({ section, pathname, isCollapsed, onToggle, activeRouteInfo = null }) {
  const [isExpanded, setIsExpanded] = useState(!isCollapsed);
  const hasChildren = section.children && section.children.length > 0;
  
  // Use enhanced active state detection
  const activeState = getActiveState(pathname, section, activeRouteInfo);
  const { isActive, isParentActive, isChildActive } = activeState;
  
  // Get vibrant color theme for this section
  const colors = getNavItemColors(section.label, isActive, isParentActive || isChildActive);

  // Auto-expand if any child is active
  useEffect(() => {
    if (hasChildren && !isCollapsed) {
      const hasActiveChild = section.children.some((child) => {
        if (!child.href) return false;
        return isRouteActive(pathname, child.href, {
          exact: false,
          includeChildren: true,
          ignoreQuery: true,
        });
      });
      if (hasActiveChild) {
        setIsExpanded(true);
      }
    }
  }, [pathname, section.children, hasChildren, isCollapsed]);

  const handleToggle = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
      if (onToggle) onToggle(section.label);
    }
  };

  return (
    <div className="mb-0.5">
      {hasChildren ? (
        <>
          <button
            onClick={handleToggle}
            data-sidebar-active={isActive ? 'true' : undefined}
            className={`group relative w-full flex items-center px-3 py-2 text-sm rounded-lg transition-all duration-200 border ${colors.container} ${isActive ? 'shadow-sm' : 'hover:shadow-sm'}`}
          >
            <ActiveIndicator isActive={isActive} isParentActive={isParentActive} accentColor={colors.accent} />
            {section.icon && (
              <Icon
                name={section.icon}
                className={`w-5 h-5 mr-3 flex-shrink-0 transition-all duration-200 ${colors.icon} ${
                  isActive ? 'scale-110' : isParentActive || isChildActive ? 'scale-105' : 'group-hover:scale-105'
                }`}
              />
            )}
            {!isCollapsed && <span className="flex-1 text-left truncate">{section.label}</span>}
            {!isCollapsed && hasChildren && (
              <Icon
                name="chevron"
                className={`w-4 h-4 transition-transform duration-200 flex-shrink-0 ${
                  isExpanded ? 'transform rotate-90' : ''
                } ${isActive || isParentActive ? colors.icon.split(' ')[0] : 'text-gray-400'}`}
              />
            )}
            {!isCollapsed && section.badge && <Badge count={section.badge} />}
          </button>
          {isExpanded && !isCollapsed && (
            <div className="ml-8 mt-0.5 space-y-0.5">
              {section.children.map((child) => {
                const childActiveState = getActiveState(pathname, child, activeRouteInfo);
                const hasGrandChildren = child.children && child.children.length > 0;
                
                // If child has nested children, render as expandable section
                if (hasGrandChildren) {
                  return (
                    <NavSection
                      key={child.href || child.label}
                      section={child}
                      pathname={pathname}
                      isCollapsed={isCollapsed}
                      activeRouteInfo={activeRouteInfo}
                    />
                  );
                }
                
                // Regular child link with enhanced styling - inherit parent section colors
                const childColors = getNavItemColors(section.label, childActiveState.isActive, false);
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    data-sidebar-active={childActiveState.isActive ? 'true' : undefined}
                    className={`group relative flex items-center px-3 py-2 text-sm rounded-lg transition-all duration-200 border ${childColors.container} ${childActiveState.isActive ? 'shadow-sm font-semibold' : 'font-normal hover:shadow-sm hover:font-medium'}`}
                  >
                    <ActiveIndicator isActive={childActiveState.isActive} accentColor={childColors.accent} />
                    <span className="flex-1 truncate">{child.label}</span>
                    {child.badge && <Badge count={child.badge} />}
                  </Link>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <Link
          href={section.href}
          data-sidebar-active={isActive ? 'true' : undefined}
          className={`group relative flex items-center px-3 py-2 text-sm rounded-lg transition-all duration-200 border ${colors.container} ${isActive ? 'shadow-sm' : 'hover:shadow-sm'}`}
        >
          <ActiveIndicator isActive={isActive} accentColor={colors.accent} />
          {section.icon && (
            <Icon
              name={section.icon}
              className={`w-5 h-5 mr-3 flex-shrink-0 transition-all duration-200 ${colors.icon} ${
                isActive ? 'scale-110' : 'group-hover:scale-105'
              }`}
            />
          )}
          {!isCollapsed && <span className="flex-1 truncate">{section.label}</span>}
          {!isCollapsed && section.badge && <Badge count={section.badge} />}
        </Link>
      )}
    </div>
  );
});

/**
 * Main Sidebar Component
 * Memoized to prevent unnecessary re-renders and remounts
 */
export const Sidebar = memo(function Sidebar({ isCollapsed = false, onToggleCollapse }) {
  const pathname = usePathname();
  const { user, loading } = usePermissions();
  const { currentProject } = useProjectContext();
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [readyToOrderCount, setReadyToOrderCount] = useState(0);

  // Fetch pending approvals count for badge
  useEffect(() => {
    if (user && ['owner', 'pm', 'project_manager', 'accountant'].includes(user.role?.toLowerCase())) {
      fetch('/api/dashboard/summary')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data?.summary?.totalPendingApprovals) {
            setPendingApprovalsCount(data.data.summary.totalPendingApprovals);
          }
        })
        .catch((err) => console.error('Error fetching approvals count:', err));
    }
  }, [user]);

  // Fetch pending purchase orders count for supplier badge
  useEffect(() => {
    if (user && user.role?.toLowerCase() === 'supplier') {
      fetch('/api/purchase-orders?limit=0')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data?.orders) {
            const pendingCount = data.data.orders.filter(
              (order) => order.status === 'order_sent' || order.status === 'order_modified'
            ).length;
            setPendingOrdersCount(pendingCount);
          }
        })
        .catch((err) => console.error('Error fetching pending orders count:', err));
    }
  }, [user]);

  // Fetch ready to order count (approved requests without purchase orders) for PM/OWNER badge
  useEffect(() => {
    if (user && ['owner', 'pm', 'project_manager'].includes(user.role?.toLowerCase())) {
      fetch('/api/material-requests?status=ready_to_order&limit=0')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data?.pagination?.total !== undefined) {
            setReadyToOrderCount(data.data.pagination.total);
          } else if (data.success && data.data?.requests) {
            setReadyToOrderCount(data.data.requests.length);
          }
        })
        .catch((err) => console.error('Error fetching ready to order count:', err));
    }
  }, [user]);

  if (loading || !user) {
    return (
      <aside
        className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col h-screen ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </aside>
    );
  }

  // Memoize navigation to prevent recalculation on every render
  // Include project context for project-scoped navigation
  const projectId = currentProject?._id?.toString() || currentProject?._id || null;
  const navigation = useMemo(
    () => getNavigationForRole(user.role, projectId),
    [user.role, projectId]
  );
  
  // Memoize navigation with badges to prevent recalculation on every render
  const navigationWithBadges = useMemo(() => {
    return navigation.map((section) => {
      if (section.label === 'Operations' && section.children) {
        const updatedChildren = section.children.map((child) => {
          if (child.href === '/dashboard/approvals' && pendingApprovalsCount > 0) {
            return { ...child, badge: pendingApprovalsCount };
          }
          
          // Handle Material Requests children (nested children)
          if (child.label === 'Material Requests' && child.children) {
            const updatedMaterialRequestChildren = child.children.map((grandChild) => {
              // Apply ready to order badge
              if (grandChild.badge === 'ready_to_order' && readyToOrderCount > 0) {
                return { ...grandChild, badge: readyToOrderCount };
              }
              return grandChild;
            });
            return { ...child, children: updatedMaterialRequestChildren };
          }
          
          return child;
        });
        return { ...section, children: updatedChildren };
      }
      if (section.label === 'Purchase Orders' && section.children) {
        const updatedChildren = section.children.map((child) => {
          if (child.badge === 'pending_orders' && pendingOrdersCount > 0) {
            return { ...child, badge: pendingOrdersCount };
          }
          return child;
        });
        return { ...section, children: updatedChildren };
      }
      return section;
    });
  }, [navigation, pendingApprovalsCount, pendingOrdersCount, readyToOrderCount]);

  return (
    <SidebarDataProvider>
      <SidebarContent
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
        user={user}
        pathname={pathname}
        navigationWithBadges={navigationWithBadges}
      />
    </SidebarDataProvider>
  );
});

/**
 * Sidebar Content Component
 * Separated to use SidebarDataProvider context
 */
const SidebarContent = memo(function SidebarContent({
  isCollapsed,
  onToggleCollapse,
  user,
  pathname,
  navigationWithBadges,
}) {
  const scrollContainerRef = useRef(null);
  const scrollStorageKey = useMemo(() => {
    const userKey = user?._id || user?.id || user?.email || 'anonymous';
    return `sidebar-scroll-position:${userKey}`;
  }, [user]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || typeof window === 'undefined') return;

    const savedPosition = window.sessionStorage.getItem(scrollStorageKey);
    if (savedPosition !== null) {
      const parsedPosition = Number.parseInt(savedPosition, 10);
      container.scrollTop = Number.isNaN(parsedPosition) ? 0 : parsedPosition;
      return;
    }
    const activeElement = container.querySelector('[data-sidebar-active="true"]');
    if (activeElement) {
      activeElement.scrollIntoView({ block: 'nearest' });
    }
  }, [pathname, scrollStorageKey]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || typeof window === 'undefined') return;

    const handleScroll = () => {
      window.sessionStorage.setItem(scrollStorageKey, String(container.scrollTop));
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollStorageKey]);

  return (
    <aside
      className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col h-screen ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo/Brand - Sticky Top */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0 bg-white z-10">
        <div className="flex items-center justify-between gap-2">
          {!isCollapsed && (
            <Link href="/dashboard" className="text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors truncate">
              Doshaki
            </Link>
          )}
          {isCollapsed && (
            <Link href="/dashboard" className="text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors" title="Doshaki">
              K
            </Link>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Primary Sections - Sticky */}
      <div className="flex-shrink-0">
        {/* Current Project Context */}
        <CurrentProjectContext isCollapsed={isCollapsed} />
      </div>

      {/* Scrollable Middle Section */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
      >
        {/* Secondary Sections */}
        <div className="flex-shrink-0">
          {/* Pending Actions */}
          <PendingActions isCollapsed={isCollapsed} />

          {/* Suggested Actions */}
          <SuggestedActions isCollapsed={isCollapsed} />

          {/* Recently Viewed */}
          <RecentlyViewed isCollapsed={isCollapsed} />
        </div>

        {/* Main Navigation */}
        <nav className="px-3 py-2 space-y-1">
          {(() => {
            // Get active route info once for all sections
            const activeRouteInfo = getActiveRoute(pathname, navigationWithBadges);
            
            return navigationWithBadges.map((section) => (
              <NavSection
                key={section.label}
                section={section}
                pathname={pathname}
                isCollapsed={isCollapsed}
                activeRouteInfo={activeRouteInfo}
              />
            ));
          })()}
        </nav>
      </div>

      {/* Bottom Sections - Sticky */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white">
        {/* Contextual Quick Actions */}
        <ContextualQuickActions isCollapsed={isCollapsed} />

        {/* User Info (when not collapsed) */}
        {!isCollapsed && user && (
          <div className="p-4 border-t border-gray-200">
            <div className="text-sm">
              <p className="font-medium text-gray-900 truncate">{user.firstName || user.email}</p>
              <p className="text-gray-500 capitalize text-xs truncate">{user.role || 'User'}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
});

export default Sidebar;

