/**
 * Sidebar Section Component
 * Reusable component for all sidebar sections with consistent styling,
 * collapse functionality, and badge support
 */

'use client';

import { useState, useEffect } from 'react';

const STORAGE_PREFIX = 'kisheka_sidebar_section_';

/**
 * Sidebar Section Component
 * @param {Object} props
 * @param {string} props.id - Unique identifier for the section (used for localStorage)
 * @param {string} props.title - Section title
 * @param {React.ReactNode} props.icon - Icon element or emoji
 * @param {React.ReactNode} props.children - Section content
 * @param {boolean} props.collapsible - Whether section can be collapsed
 * @param {boolean} props.defaultCollapsed - Default collapsed state
 * @param {number} props.badge - Badge count to display
 * @param {string} props.badgeColor - Badge color (red, blue, yellow, green)
 * @param {boolean} props.isCollapsed - Parent sidebar collapsed state
 * @param {string} props.variant - Section variant (default, primary, secondary)
 * @param {boolean} props.showBorder - Show bottom border
 * @param {string} props.className - Additional CSS classes
 */
export function SidebarSection({
  id,
  title,
  icon,
  children,
  collapsible = false,
  defaultCollapsed = false,
  badge = null,
  badgeColor = 'red',
  isCollapsed = false,
  variant = 'default',
  showBorder = true,
  className = '',
}) {
  const [isSectionCollapsed, setIsSectionCollapsed] = useState(defaultCollapsed);

  // Load saved preference from localStorage
  useEffect(() => {
    if (id && collapsible && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
        if (saved !== null) {
          setIsSectionCollapsed(JSON.parse(saved));
        }
      } catch (err) {
        console.error('Error loading sidebar section preference:', err);
      }
    }
  }, [id, collapsible]);

  // Save preference to localStorage
  const handleToggle = () => {
    if (!collapsible) return;
    
    const newState = !isSectionCollapsed;
    setIsSectionCollapsed(newState);
    
    if (id && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(newState));
      } catch (err) {
        console.error('Error saving sidebar section preference:', err);
      }
    }
  };

  // Don't render if parent sidebar is collapsed (unless it's a primary section)
  if (isCollapsed && variant !== 'primary') {
    // Show icon-only badge when collapsed
    if (badge && badge > 0) {
      return (
        <div className="p-2 border-b border-gray-200">
          <div className="relative flex items-center justify-center">
            <div className="text-xl">{icon}</div>
            <span
              className={`absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full ${
                badgeColor === 'red'
                  ? 'bg-red-500 text-white'
                  : badgeColor === 'blue'
                  ? 'bg-blue-500 text-white'
                  : badgeColor === 'yellow'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-green-500 text-white'
              }`}
              title={title}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          </div>
        </div>
      );
    }
    // Show icon only when collapsed
    if (icon) {
      return (
        <div className="p-2 border-b border-gray-200">
          <div className="flex items-center justify-center" title={title}>
            <div className="text-xl">{icon}</div>
          </div>
        </div>
      );
    }
    return null;
  }

  // Don't render if section is collapsed and not collapsible
  if (isSectionCollapsed && !collapsible) {
    return null;
  }

  // Variant styles
  const variantStyles = {
    default: 'bg-white',
    primary: 'bg-blue-50',
    secondary: 'bg-gray-50',
  };

  const variantBorderStyles = {
    default: 'border-gray-200',
    primary: 'border-blue-200',
    secondary: 'border-gray-200',
  };

  const badgeColorClasses = {
    red: 'bg-red-500 text-white',
    blue: 'bg-blue-500 text-white',
    yellow: 'bg-yellow-500 text-white',
    green: 'bg-green-500 text-white',
  };

  return (
    <div
      className={`${variantStyles[variant]} ${showBorder ? `border-b ${variantBorderStyles[variant]}` : ''} ${className}`}
    >
      {/* Section Header */}
      {(title || collapsible) && (
        <div className="px-4 py-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {icon && <div className="text-lg flex-shrink-0">{icon}</div>}
              {title && (
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
                  {title}
                </h3>
              )}
              {badge !== null && badge > 0 && !isSectionCollapsed && (
                <span
                  className={`flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full ${badgeColorClasses[badgeColor]}`}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </div>
            {collapsible && (
              <button
                onClick={handleToggle}
                className="ml-2 p-1 rounded-md hover:bg-gray-200 transition-colors flex-shrink-0"
                aria-label={isSectionCollapsed ? `Expand ${title}` : `Collapse ${title}`}
                aria-expanded={!isSectionCollapsed}
              >
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isSectionCollapsed ? '' : 'rotate-180'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Section Content */}
      {!isSectionCollapsed && (
        <div className={title || collapsible ? 'px-4 pb-4' : 'p-4'}>
          {children}
        </div>
      )}

      {/* Collapsed State Indicator */}
      {isSectionCollapsed && collapsible && badge !== null && badge > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-center">
            <span
              className={`px-2 py-1 text-xs font-semibold rounded-full ${badgeColorClasses[badgeColor]}`}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}



