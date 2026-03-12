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
        // Defer state update to avoid cascading renders
        setTimeout(() => setIsExpanded(true), 0);
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
            <ChevronDown className="w-4 h-4 ds-text-muted flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 ds-text-muted flex-shrink-0" />
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
  const [showSettings, setShowSettings] = useState(false);

  // Load favorites - use lazy initialization
  const [favorites, setFavorites] = useState(() => getFavorites());

  useEffect(() => {
    const handleFavoritesUpdate = () => {
      setFavorites(getFavorites());
    };
    
    window.addEventListener('favorites-updated', handleFavoritesUpdate);
    return () => window.removeEventListener('favorites-updated', handleFavoritesUpdate);
  }, []);

  // Fetch badge counts (project-specific)
  useEffect(() => {
    let isMounted = true;

    if (user && ['owner', 'pm', 'project_manager', 'accountant'].includes(user.role?.toLowerCase())) {
      // If no project selected, set count to 0 (multi-project system)
      if (!currentProject?._id) {
        if (isMounted) {
          setPendingApprovalsCount(0);
        }
        return;
      }

      const projectId = currentProject._id?.toString() || currentProject._id;
      if (!projectId) {
        if (isMounted) {
          setPendingApprovalsCount(0);
        }
        return;
      }

      fetch(`/api/dashboard/summary?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          
          if (data.success && data.data?.summary?.totalPendingApprovals) {
            setPendingApprovalsCount(data.data.summary.totalPendingApprovals);
          } else {
            // If no data, set to 0 (no badge)
            setPendingApprovalsCount(0);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error('Error fetching approvals count:', err);
          setPendingApprovalsCount(0); // Set to 0 on error (no badge)
        });
    } else {
      // User doesn't have permission, set to 0
      if (isMounted) {
        setPendingApprovalsCount(0);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [user, currentProject]); // Add currentProject to dependencies

  const projectId = currentProject?._id?.toString() || currentProject?._id || null;
  
  // Get smart navigation - must be called before early return
  const navigation = useMemo(
    () => {
      if (!user) return [];
      return getSmartNavigationForRole(user.role, projectId, { showSettings });
    },
    [user?.role, projectId, showSettings]
  );

  // Get favorites section - must be called before early return
  const favoritesSection = useMemo(
    () => {
      if (!user) return null;
      return getFavoritesSection(favorites, user.role, projectId);
    },
    [favorites, user?.role, projectId]
  );

  // Add favorites to navigation if exists - must be called before early return
  const navigationWithFavorites = useMemo(() => {
    if (!favoritesSection) return navigation;
    return [favoritesSection, ...navigation];
  }, [navigation, favoritesSection]);

  // Add badges - must be called before early return
  const navigationWithBadges = useMemo(() => {
    return navigationWithFavorites.map((section) => {
      if (section.label === 'Operations' && section.children) {
        const updatedChildren = section.children.map((child) => {
          // ONLY add badge when count > 0 (fixes issue where badge shows even with 0 approvals)
          if (child.href === '/dashboard/approvals' && pendingApprovalsCount > 0) {
            return { ...child, badge: pendingApprovalsCount };
          }
          // When count is 0, return child WITHOUT badge property (no red highlighting)
          return child;
        });
        return { ...section, children: updatedChildren };
      }
      return section;
    });
  }, [navigationWithFavorites, pendingApprovalsCount]);

  if (loading || !user) {
    return (
      <aside
        className={`ds-bg-sidebar ds-border-sidebar border-r shadow-xl transition-all duration-300 flex flex-col h-screen ${
          isCollapsed ? 'w-16 lg:w-20' : 'w-64 lg:w-72'
        }`}
      >
        <div className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-500 rounded w-3/4"></div>
            <div className="h-4 bg-slate-500 rounded w-1/2"></div>
          </div>
        </div>
      </aside>
    );
  }

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
      className={`ds-bg-sidebar ds-border-sidebar border-r shadow-xl transition-all duration-300 flex flex-col h-screen ${
        isCollapsed ? 'w-16 lg:w-20' : 'w-64 lg:w-72'
      }`}
    >
      {/* Logo/Brand */}
      <div className="p-4 border-b ds-border-sidebar flex-shrink-0 ds-bg-sidebar-section-secondary z-10">
        <div className="flex items-center justify-between gap-2">
          {!isCollapsed && (
            <Link
              href="/dashboard"
              className="text-xl font-bold text-white hover:text-slate-50 transition-colors truncate"
            >
              Doshaki
            </Link>
          )}
          {isCollapsed && (
            <Link
              href="/dashboard"
              className="text-xl font-bold text-white hover:text-slate-50 transition-colors"
              title="Doshaki"
            >
              K
            </Link>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md hover:bg-slate-600 text-slate-200 hover:text-white transition-colors flex-shrink-0"
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
          <div className="px-3 py-2 border-b ds-border-subtle">
            <button
              onClick={() => {
                // Trigger command palette
                window.dispatchEvent(new KeyboardEvent('keydown', {
                  key: 'k',
                  metaKey: true,
                  ctrlKey: true,
                }));
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border ds-border-subtle hover:border-blue-400/60 hover:bg-blue-50 transition-colors ds-text-secondary"
            >
              <Search className="w-4 h-4" />
              <span className="flex-1 text-left">Search (⌘K)</span>
            </button>
          </div>
        )}

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
      <div className="flex-shrink-0 border-t ds-border-sidebar ds-bg-sidebar-section-secondary">
        {/* Contextual Quick Actions */}
        <ContextualQuickActions isCollapsed={isCollapsed} />

        {/* Settings Toggle */}
        {!isCollapsed && (
          <button
            onClick={onToggleSettings}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600 transition-colors border-t border-slate-600"
          >
            <Icon name="settings" className="w-4 h-4" />
            <span className="flex-1 text-left">{showSettings ? 'Hide' : 'Show'} Settings</span>
          </button>
        )}

        {/* User Info */}
        {!isCollapsed && user && (
          <div className="p-4 border-t border-slate-600">
            <div className="text-sm">
              <p className="font-medium text-white truncate">{user.firstName || user.email}</p>
              <p className="text-slate-200 capitalize text-xs truncate">{user.role || 'User'}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
});

export default SmartSidebar;
