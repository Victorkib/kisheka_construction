/**
 * Smart Mobile Navigation Component
 * Bottom sheet navigation for mobile devices
 * Uses smart navigation structure with progressive disclosure
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSmartNavigationForRole, getFavoritesSection } from '@/lib/smart-navigation-helpers';
import { getFavorites } from '@/components/navigation/FavoritesManager';
import { usePermissions } from '@/hooks/use-permissions';
import { useProjectContext } from '@/contexts/ProjectContext';
import { isRouteActive, getActiveState } from '@/lib/utils/route-matching';
import { getNavItemColors } from '@/lib/utils/navigation-colors';
import {
  X, Home, Building2, DollarSign, Briefcase, Users, Settings,
  BarChart3, Archive, ChevronRight, Star, Search, Layers, FileText,
  ShoppingCart, CheckSquare, Wrench, ArrowLeftRight,
} from 'lucide-react';
import { CommandPaletteMobile } from './CommandPaletteMobile';
import { FavoriteButton } from './FavoritesManager';

/**
 * Icon component for mobile
 */
function MobileIcon({ name, className = 'w-5 h-5' }) {
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
 * Mobile Navigation Section
 */
function MobileNavSection({
  section,
  pathname,
  level = 0,
  onNavigate,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = section.children && section.children.length > 0;
  const activeState = getActiveState(pathname, section);
  const { isActive, isChildActive } = activeState;
  const colors = getNavItemColors(section.label, isActive, isChildActive);

  // Auto-expand if active
  useEffect(() => {
    if (isActive || isChildActive) {
      setIsExpanded(true);
    }
  }, [isActive, isChildActive]);

  const handleToggle = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    } else if (section.href) {
      onNavigate(section.href);
    }
  };

  const paddingLeft = level * 16 + 16;

  return (
    <div>
      <button
        onClick={handleToggle}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation ${
          isActive ? 'bg-blue-50 border-l-4 border-blue-600' : ''
        }`}
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        {section.icon && (
          <MobileIcon
            name={section.icon}
            className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-600'}`}
          />
        )}
        <span className={`flex-1 font-medium ${isActive ? 'text-blue-900' : 'text-gray-900'}`}>
          {section.label}
        </span>
        {hasChildren && (
          <ChevronRight
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isExpanded ? 'transform rotate-90' : ''
            }`}
          />
        )}
        {section.badge && section.badge > 0 && (
          <span className="bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            {section.badge > 99 ? '99+' : section.badge}
          </span>
        )}
      </button>
      {isExpanded && hasChildren && (
        <div>
          {section.children.map((child) => {
            const hasGrandChildren = child.children && child.children.length > 0;
            if (hasGrandChildren) {
              return (
                <MobileNavSection
                  key={child.href || child.label}
                  section={child}
                  pathname={pathname}
                  level={level + 1}
                  onNavigate={onNavigate}
                />
              );
            }
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={() => onNavigate(child.href)}
                className={`flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation ${
                  isRouteActive(pathname, child.href) ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
                style={{ paddingLeft: `${paddingLeft + 16}px` }}
              >
                <span className="flex-1 text-gray-900">{child.label}</span>
                {child.badge && child.badge > 0 && (
                  <span className="bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                    {child.badge > 99 ? '99+' : child.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Smart Mobile Navigation Component
 */
export function SmartMobileNav({ isOpen, onClose }) {
  const pathname = usePathname();
  const { user, loading } = usePermissions();
  const { currentProject } = useProjectContext();
  const [favorites, setFavorites] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

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
        .catch(() => {});
    }
  }, [user]);

  // Get navigation
  const projectId = currentProject?._id?.toString() || currentProject?._id || null;
  const navigation = useMemo(
    () => getSmartNavigationForRole(user?.role, projectId, { showSettings }),
    [user?.role, projectId, showSettings]
  );

  // Get favorites section
  const favoritesSection = useMemo(
    () => getFavoritesSection(favorites, user?.role, projectId),
    [favorites, user?.role, projectId]
  );

  // Add favorites to navigation
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

  const handleNavigate = (href) => {
    onClose();
  };

  if (loading || !user) {
    return null;
  }

  if (!isOpen) return null;

  return (
    <>
      <CommandPaletteMobile
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />
      
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden">
        <div className="bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 max-h-[90vh] flex flex-col">
          {/* Handle */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-12 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {/* Search Button */}
          <div className="px-4 py-3 border-b border-gray-200">
            <button
              onClick={() => setShowCommandPalette(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-gray-700"
            >
              <Search className="w-5 h-5 text-gray-400" />
              <span className="flex-1 text-left">Search (⌘K)</span>
            </button>
          </div>

          {/* Navigation Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {navigationWithBadges.map((section) => (
              <MobileNavSection
                key={section.key || section.label}
                section={section}
                pathname={pathname}
                onNavigate={handleNavigate}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
            >
              <Settings className="w-5 h-5 text-gray-400" />
              <span className="flex-1 text-left font-medium">
                {showSettings ? 'Hide' : 'Show'} Settings
              </span>
            </button>
            <div className="mt-2 text-xs text-gray-500 text-center">
              {user.firstName || user.email} • {user.role}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
