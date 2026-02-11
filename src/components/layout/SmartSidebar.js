/**
 * Smart Sidebar Component
 * Progressive disclosure with favorites, search, and contextual actions
 * Reduces cognitive load while maintaining full feature access
 */

'use client';

import { useState, useEffect, useMemo, useRef, memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSmartNavigationForRole, getFavoritesSection } from '@/lib/smart-navigation-helpers';
import { getFavorites } from '@/components/navigation/FavoritesManager';
import { usePermissions } from '@/hooks/use-permissions';
import { useProjectContext } from '@/contexts/ProjectContext';
import { SidebarDataProvider } from '@/components/layout/SidebarDataProvider';
import { ContextualQuickActions } from '@/components/navigation/ContextualQuickActions';
import { CurrentProjectContext } from '@/components/navigation/CurrentProjectContext';
import { RecentlyViewed } from '@/components/navigation/RecentlyViewed';
import { PendingActions } from '@/components/navigation/PendingActions';
import { SuggestedActions } from '@/components/navigation/SuggestedActions';
import { CommandPalette } from '@/components/navigation/CommandPalette';
import { FavoriteButton } from '@/components/navigation/FavoritesManager';
import { isRouteActive, getActiveState, getActiveRoute } from '@/lib/utils/route-matching';
import { getNavItemColors } from '@/lib/utils/navigation-colors';
import {
  Search, Star, ChevronRight, ChevronDown, Home, Building2,
  DollarSign, Briefcase, Users, Settings, BarChart3, Archive,
  Layers, FileText, ShoppingCart, CheckSquare, Wrench, ArrowLeftRight,
} from 'lucide-react';

/**
 * Icon component - using lucide-react
 */
function Icon({ name, className = 'w-5 h-5' }) {
  const icons = {
    home: <Home className={className} />,
    building: <Building2 className={className} />,
    'dollar-sign': <DollarSign className={className} />,
    briefcase: <Briefcase className={className} />,
    users: <Users className={className} />,
    settings: <Settings className={className} />,
    'bar-chart': <BarChart3 className={className} />,
    archive: <Archive className={className} />,
    star: <Star className={className} />,
    layers: <Layers className={className} />,
    'file-text': <FileText className={className} />,
    'shopping-cart': <ShoppingCart className={className} />,
    'check-square': <CheckSquare className={className} />,
    tool: <Wrench className={className} />,
    'arrow-left-right': <ArrowLeftRight className={className} />,
  };
  return icons[name] || null;
}

/**
 * Badge component for notification counts
 */
function Badge({ count, className = '' }) {
  if (!count || count === 0) return null;
  return (
    <span className={`ml-auto bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full ${className}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * Active Indicator Component
 */
function ActiveIndicator({ isActive, accentColor = 'bg-blue-600', className = '' }) {
  if (!isActive) return null;
  return (
    <div
      className={`absolute left-0 top-0 bottom-0 w-0.5 ${accentColor} rounded-r transition-all duration-200 ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Smart Navigation Section Component
 * Supports progressive disclosure with expand/collapse
 */
const SmartNavSection = memo(function SmartNavSection({
  section,
  pathname,
  isCollapsed,
  activeRouteInfo = null,
  defaultExpanded = false,
  onToggleFavorite,
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || section.defaultExpanded === false ? false : true);
  const hasChildren = section.children && section.children.length > 0;
  
  const activeState = getActiveState(pathname, section, activeRouteInfo);
  const { isActive, isParentActive, isChildActive } = activeState;
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
    }
  };

  // If always visible and no children, render as link
  if (section.alwaysVisible && !hasChildren) {
    return (
      <div className="mb-0.5">
        <Link
          href={section.href}
          data-sidebar-active={isActive ? 'true' : undefined}
          className={`group relative flex items-center px-3 py-2 text-sm rounded-lg transition-all duration-200 border ${colors.container} ${isActive ? 'shadow-sm' : 'hover:shadow-sm'}`}
        >
          <ActiveIndicator isActive={isActive} accentColor={colors.accent} />
          {section.icon && <Icon name={section.icon} className={`w-5 h-5 mr-3 flex-shrink-0 ${colors.icon}`} />}
          {!isCollapsed && <span className="flex-1 truncate">{section.label}</span>}
        </Link>
      </div>
    );
  }

  // Section with children
  return (
    <div className="mb-0.5">
      <button
        onClick={handleToggle}
        data-sidebar-active={isActive ? 'true' : undefined}
        className={`group relative w-full flex items-center px-3 py-2 text-sm rounded-lg transition-all duration-200 border ${colors.container} ${isActive ? 'shadow-sm' : 'hover:shadow-sm'}`}
      >
        <ActiveIndicator isActive={isActive} accentColor={colors.accent} />
        {section.icon && (
          <Icon
            name={section.icon}
            className={`w-5 h-5 mr-3 flex-shrink-0 transition-all duration-200 ${colors.icon}`}
          />
        )}
        {!isCollapsed && <span className="flex-1 text-left truncate">{section.label}</span>}
        {!isCollapsed && hasChildren && (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )
        )}
        {!isCollapsed && section.badge && <Badge count={section.badge} />}
      </button>
      {isExpanded && !isCollapsed && hasChildren && (
        <div className="ml-8 mt-0.5 space-y-0.5">
          {section.children.map((child) => {
            const childActiveState = getActiveState(pathname, child, activeRouteInfo);
            const hasGrandChildren = child.children && child.children.length > 0;
            
            if (hasGrandChildren) {
              return (
                <SmartNavSection
                  key={child.href || child.label}
                  section={child}
                  pathname={pathname}
                  isCollapsed={isCollapsed}
                  activeRouteInfo={activeRouteInfo}
                  defaultExpanded={false}
                />
              );
            }
            
            const childColors = getNavItemColors(section.label, childActiveState.isActive, false);
            return (
              <div key={child.href} className="flex items-center group/item">
                <Link
                  href={child.href}
                  data-sidebar-active={childActiveState.isActive ? 'true' : undefined}
                  className={`flex-1 flex items-center px-3 py-2 text-sm rounded-lg transition-all duration-200 border ${childColors.container} ${childActiveState.isActive ? 'shadow-sm font-semibold' : 'font-normal hover:shadow-sm hover:font-medium'}`}
                >
                  <ActiveIndicator isActive={childActiveState.isActive} accentColor={childColors.accent} />
                  <span className="flex-1 truncate">{child.label}</span>
                  {child.badge && <Badge count={child.badge} />}
                </Link>
                {!isCollapsed && (
                  <FavoriteButton
                    item={child}
                    className="opacity-0 group-hover/item:opacity-100 transition-opacity ml-1"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

/**
 * Main Smart Sidebar Component
 */
export const SmartSidebar = memo(function SmartSidebar({ isCollapsed = false, onToggleCollapse }) {
  const pathname = usePathname();
  const { user, loading } = usePermissions();
  const { currentProject } = useProjectContext();
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [readyToOrderCount, setReadyToOrderCount] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [showSettings, setShowSettings] = useState(false);

  // Load favorites
  useEffect(() => {
    setFavorites(getFavorites());
    
    const handleFavoritesUpdate = () => {
      setFavorites(getFavorites());
    };
    
    window.addEventListener('favorites-updated', handleFavoritesUpdate);
    return () => window.removeEventListener('favorites-updated', handleFavoritesUpdate);
  }, []);

  // Fetch badge counts
  useEffect(() => {
    if (user && ['owner', 'pm', 'project_manager', 'accountant'].includes(user.role?.toLowerCase())) {
      fetch('/api/dashboard/summary', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data?.summary?.totalPendingApprovals) {
            setPendingApprovalsCount(data.data.summary.totalPendingApprovals);
          }
        })
        .catch((err) => console.error('Error fetching approvals count:', err));
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

  const projectId = currentProject?._id?.toString() || currentProject?._id || null;
  
  // Get smart navigation
  const navigation = useMemo(
    () => getSmartNavigationForRole(user.role, projectId, { showSettings }),
    [user.role, projectId, showSettings]
  );

  // Get favorites section
  const favoritesSection = useMemo(
    () => getFavoritesSection(favorites, user.role, projectId),
    [favorites, user.role, projectId]
  );

  // Add favorites to navigation if exists
  const navigationWithFavorites = useMemo(() => {
    if (!favoritesSection) return navigation;
    return [favoritesSection, ...navigation];
  }, [navigation, favoritesSection]);

  // Add badges
  const navigationWithBadges = useMemo(() => {
    return navigationWithFavorites.map((section) => {
      if (section.label === 'Operations' && section.children) {
        const updatedChildren = section.children.map((child) => {
          if (child.href === '/dashboard/approvals' && pendingApprovalsCount > 0) {
            return { ...child, badge: pendingApprovalsCount };
          }
          return child;
        });
        return { ...section, children: updatedChildren };
      }
      return section;
    });
  }, [navigationWithFavorites, pendingApprovalsCount]);

  return (
    <>
      {/* Command Palette - Desktop only */}
      <div className="hidden lg:block">
        <CommandPalette />
      </div>
      <SidebarDataProvider>
        <SmartSidebarContent
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
          user={user}
          pathname={pathname}
          navigationWithBadges={navigationWithBadges}
          showSettings={showSettings}
          onToggleSettings={() => setShowSettings(!showSettings)}
        />
      </SidebarDataProvider>
    </>
  );
});

/**
 * Smart Sidebar Content Component
 */
const SmartSidebarContent = memo(function SmartSidebarContent({
  isCollapsed,
  onToggleCollapse,
  user,
  pathname,
  navigationWithBadges,
  showSettings,
  onToggleSettings,
}) {
  const scrollContainerRef = useRef(null);

  return (
    <aside
      className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col h-screen ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo/Brand */}
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

      {/* Current Project Context */}
      <div className="flex-shrink-0">
        <CurrentProjectContext isCollapsed={isCollapsed} />
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400"
      >
        {/* Quick Actions Section */}
        {!isCollapsed && (
          <div className="px-3 py-2 border-b border-gray-200">
            <button
              onClick={() => {
                // Trigger command palette
                window.dispatchEvent(new KeyboardEvent('keydown', {
                  key: 'k',
                  metaKey: true,
                  ctrlKey: true,
                }));
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-gray-700"
            >
              <Search className="w-4 h-4" />
              <span className="flex-1 text-left">Search (⌘K)</span>
            </button>
          </div>
        )}

        {/* Pending Actions */}
        <PendingActions isCollapsed={isCollapsed} />

        {/* Suggested Actions */}
        <SuggestedActions isCollapsed={isCollapsed} />

        {/* Recently Viewed */}
        <RecentlyViewed isCollapsed={isCollapsed} />

        {/* Main Navigation */}
        <nav className="px-3 py-2 space-y-1">
          {(() => {
            const activeRouteInfo = getActiveRoute(pathname, navigationWithBadges);
            return navigationWithBadges.map((section) => (
              <SmartNavSection
                key={section.key || section.label}
                section={section}
                pathname={pathname}
                isCollapsed={isCollapsed}
                activeRouteInfo={activeRouteInfo}
                defaultExpanded={section.defaultExpanded}
              />
            ));
          })()}
        </nav>
      </div>

      {/* Bottom Sections */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white">
        {/* Contextual Quick Actions */}
        <ContextualQuickActions isCollapsed={isCollapsed} />

        {/* Settings Toggle */}
        {!isCollapsed && (
          <button
            onClick={onToggleSettings}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-200"
          >
            <Icon name="settings" className="w-4 h-4" />
            <span className="flex-1 text-left">{showSettings ? 'Hide' : 'Show'} Settings</span>
          </button>
        )}

        {/* User Info */}
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

export default SmartSidebar;
