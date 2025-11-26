/**
 * Sidebar Navigation Component
 * Collapsible sidebar with role-based navigation
 */

'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getNavigationForRole } from '@/lib/navigation-helpers';
import { usePermissions } from '@/hooks/use-permissions';

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
 * Navigation Section Component
 * Memoized to prevent unnecessary re-renders on navigation
 */
const NavSection = memo(function NavSection({ section, pathname, isCollapsed, onToggle }) {
  const [isExpanded, setIsExpanded] = useState(!isCollapsed);
  const hasChildren = section.children && section.children.length > 0;
  const isActive = pathname === section.href || (section.href && pathname.startsWith(section.href + '/'));

  // Auto-expand if any child is active
  useEffect(() => {
    if (hasChildren && !isCollapsed) {
      const hasActiveChild = section.children.some((child) => pathname === child.href || pathname.startsWith(child.href + '/'));
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
    <div className="mb-1">
      {hasChildren ? (
        <>
          <button
            onClick={handleToggle}
            className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              isActive || isExpanded
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {section.icon && <Icon name={section.icon} className="w-5 h-5 mr-3" />}
            {!isCollapsed && <span className="flex-1 text-left">{section.label}</span>}
            {!isCollapsed && hasChildren && (
              <Icon
                name="chevron"
                className={`w-4 h-4 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`}
              />
            )}
            {!isCollapsed && section.badge && <Badge count={section.badge} />}
          </button>
          {isExpanded && !isCollapsed && (
            <div className="ml-8 mt-1 space-y-1">
              {section.children.map((child) => {
                const isChildActive = pathname === child.href || pathname.startsWith(child.href + '/');
                const hasGrandChildren = child.children && child.children.length > 0;
                
                // If child has nested children, render as expandable section
                if (hasGrandChildren) {
                  return (
                    <NavSection
                      key={child.href || child.label}
                      section={child}
                      pathname={pathname}
                      isCollapsed={isCollapsed}
                    />
                  );
                }
                
                // Regular child link
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={`flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                      isChildActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="flex-1">{child.label}</span>
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
          className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            isActive
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {section.icon && <Icon name={section.icon} className="w-5 h-5 mr-3" />}
          {!isCollapsed && <span className="flex-1">{section.label}</span>}
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
        className={`bg-white border-r border-gray-200 transition-all duration-300 ${
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
  const navigation = useMemo(() => getNavigationForRole(user.role), [user.role]);
  
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
    <aside
      className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col h-screen ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo/Brand */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <Link href="/dashboard" className="text-xl font-bold text-blue-600">
              Kisheka
            </Link>
          )}
          {isCollapsed && (
            <Link href="/dashboard" className="text-xl font-bold text-blue-600">
              K
            </Link>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-1 min-h-0">
        {navigationWithBadges.map((section) => (
          <NavSection
            key={section.label}
            section={section}
            pathname={pathname}
            isCollapsed={isCollapsed}
          />
        ))}
      </nav>

      {/* User Info (when not collapsed) */}
      {!isCollapsed && user && (
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <div className="text-sm">
            <p className="font-medium text-gray-900">{user.firstName || user.email}</p>
            <p className="text-gray-500 capitalize">{user.role || 'User'}</p>
          </div>
        </div>
      )}
    </aside>
  );
});

export default Sidebar;

