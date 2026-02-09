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

  // Close drawer when route changes
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    try {
      // Clear client-side caches
      clearUserCache();
      
      // Clear service worker cache
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
      }
      
      // Clear sessionStorage and localStorage of any app data
      try {
        sessionStorage.clear();
        localStorage.removeItem('currentProjectId');
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
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <Link href="/dashboard" className="text-xl font-bold text-blue-600" onClick={onClose}>
              Doshaki
            </Link>
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              aria-label="Close menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {navigationWithBadges.map((item, index) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                // Use combination of label and href for unique key to handle duplicates
                const uniqueKey = `${item.href}-${item.label}-${index}`;
                return (
                  <Link
                    key={uniqueKey}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center px-3 py-2 text-base font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {item.icon && <Icon name={item.icon} className="w-5 h-5 mr-3" />}
                    <span className="flex-1">{item.label}</span>
                    {item.badge && <Badge count={item.badge} />}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-gray-200">
            {user && (
              <div className="mb-4 text-sm">
                <p className="font-medium text-gray-900">{user.firstName || user.email}</p>
                <p className="text-gray-500 capitalize">{user.role || 'User'}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default MobileNav;

