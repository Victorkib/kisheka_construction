/**
 * Mobile Navigation Drawer Component
 * Slide-out drawer for mobile navigation
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getFlatNavigationForRole } from '@/lib/navigation-helpers';
import { usePermissions, clearUserCache } from '@/hooks/use-permissions';

/**
 * Icon component (same as sidebar)
 */
function Icon({ name, className = 'w-5 h-5' }) {
  const icons = {
    home: (
      <svg
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
    building: (
      <svg
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
    'dollar-sign': (
      <svg
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    briefcase: (
      <svg
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
    settings: (
      <svg
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
    'bar-chart': (
      <svg
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  };

  return icons[name] || null;
}

/**
 * Badge component
 */
function Badge({ count }) {
  if (!count || count === 0) return null;
  return (
    <span className="ml-auto bg-red-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * Mobile Navigation Drawer
 */
export function MobileNav({ isOpen, onClose }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = usePermissions();
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  // Fetch pending approvals count
  useEffect(() => {
    let isMounted = true;

    if (
      user &&
      ['owner', 'pm', 'project_manager', 'accountant'].includes(
        user.role?.toLowerCase(),
      )
    ) {
      fetch('/api/dashboard/summary')
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          
          if (data.success && data.data?.summary?.totalPendingApprovals) {
            setPendingApprovalsCount(data.data.summary.totalPendingApprovals);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error('Error fetching approvals count:', err);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Close drawer when route changes
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle keyboard navigation (ESC to close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus within drawer when open
  useEffect(() => {
    if (!isOpen) return;

    const drawer = document.querySelector('[role="dialog"][aria-label="Navigation menu"]');
    if (!drawer) return;

    const focusableElements = drawer.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    drawer.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      drawer.removeEventListener('keydown', handleTabKey);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      // Clear client-side caches
      clearUserCache();

      // Clear service worker cache
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
        }
      }

      // Clear sessionStorage and localStorage of any app data
      try {
        sessionStorage.clear();
        localStorage.removeItem('currentProjectId');
        // CRITICAL: Clear Supabase/PKCE state to avoid account-switch OAuth failures
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('sb-') || key.toLowerCase().includes('supabase')) {
            localStorage.removeItem(key);
          }
        }
        for (const key of Object.keys(sessionStorage)) {
          if (key.startsWith('sb-') || key.toLowerCase().includes('supabase')) {
            sessionStorage.removeItem(key);
          }
        }
      } catch (e) {
        // Storage might not be available
      }

      // Call logout API
      await fetch('/api/auth/logout', { method: 'POST' });

      // Redirect to login
      router.push('/auth/login');
    } catch (err) {
      console.error('Logout error:', err);
      // Still redirect even if there's an error
      router.push('/auth/login');
    }
  };

  if (loading || !user) {
    return null;
  }

  const navigation = getFlatNavigationForRole(user.role);

  // Update badges
  const navigationWithBadges = navigation.map((item) => {
    if (item.href === '/dashboard/approvals' && pendingApprovalsCount > 0) {
      return { ...item, badge: pendingApprovalsCount };
    }
    return item;
  });

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden transition-opacity duration-300"
          onClick={onClose}
          onTouchStart={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full h-[100dvh] w-64 sm:w-72 ds-bg-surface shadow-2xl z-50 transform transition-transform duration-300 ease-out lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex flex-col h-full safe-area-inset">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b ds-border-subtle flex items-center justify-between flex-shrink-0 ds-bg-surface">
            <Link
              href="/dashboard"
              className="text-lg sm:text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
              onClick={onClose}
            >
              Doshaki
            </Link>
            <button
              onClick={onClose}
              className="p-2 sm:p-2.5 rounded-md hover:ds-bg-surface-muted active:ds-bg-surface-muted ds-text-muted hover:ds-text-secondary transition-colors touch-manipulation focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Close menu"
            >
              <svg
                className="w-6 h-6 sm:w-7 sm:h-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            <div className="space-y-1">
              {navigationWithBadges.map((item, index) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + '/');
                // Use combination of label and href for unique key to handle duplicates
                const uniqueKey = `${item.href}-${item.label}-${index}`;
                return (
                  <Link
                    key={uniqueKey}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center px-3 sm:px-4 py-3 sm:py-3.5 text-base sm:text-base font-medium rounded-lg transition-all duration-200 touch-manipulation min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 shadow-sm'
                        : 'ds-text-secondary hover:ds-bg-surface-muted active:ds-bg-surface-muted'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.icon && (
                      <Icon name={item.icon} className="w-5 h-5 sm:w-6 sm:h-6 mr-3 flex-shrink-0" />
                    )}
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && <Badge count={item.badge} />}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 sm:p-5 border-t ds-border-subtle ds-bg-surface flex-shrink-0">
            {user && (
              <div className="mb-4 pb-4 border-b ds-border-subtle">
                <p className="font-medium ds-text-primary text-sm sm:text-base truncate">
                  {user.firstName || user.email}
                </p>
                <p className="ds-text-muted capitalize text-xs sm:text-sm mt-0.5">
                  {user.role || 'User'}
                </p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 sm:px-4 py-3 sm:py-3.5 text-base sm:text-base font-medium text-red-600 hover:bg-red-50 active:bg-red-100 rounded-lg transition-colors touch-manipulation min-h-[44px] flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              aria-label="Logout from account"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default MobileNav;
