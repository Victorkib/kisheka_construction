'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePermissions, clearUserCache } from '@/hooks/use-permissions';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ProjectSwitcher } from '@/components/project-switcher/ProjectSwitcher';

/* ----------------------------------------
   Approvals Badge (DECLARED OUTSIDE RENDER)
----------------------------------------- */
function ApprovalsBadge({ count }) {
  if (!count || count <= 0) return null;

  return (
    <span
      className="ml-2 animate-bounce rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow"
      aria-label={`Pending approvals: ${count}`}
      title="Pending approvals"
    >
      {count}
    </span>
  );
}

/* ----------------------------------------
   User Avatar (DECLARED OUTSIDE RENDER)
----------------------------------------- */
function UserAvatar({ user }) {
  return (
    <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-200">
      {user?.avatar ? (
        <img
          src={user.avatar}
          alt={user.name || 'User Avatar'}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-lg font-bold text-gray-600">
          {user?.name
            ? user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
            : '👤'}
        </span>
      )}

      {/* Online indicator */}
      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-400 ring-2 ring-white" />
    </div>
  );
}

/* ----------------------------------------
   Header Component
----------------------------------------- */
export function Header({ onMenuClick }) {
  const router = useRouter();
  const { user, loading } = usePermissions();

  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  /* Fetch pending approvals */
  useEffect(() => {
    if (
      user &&
      ['owner', 'pm', 'project_manager', 'accountant'].includes(
        user.role?.toLowerCase()
      )
    ) {
      fetch('/api/dashboard/summary')
        .then((res) => res.json())
        .then((data) => {
          if (data?.success && data?.data?.summary?.totalPendingApprovals) {
            setPendingApprovalsCount(data.data.summary.totalPendingApprovals);
          }
        })
        .catch((err) => console.error('Error fetching approvals count:', err));
    }
  }, [user]);

  /* Logout */
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

  return (
    <header
      className="sticky top-0 z-50 flex w-full items-center justify-between bg-white px-4 py-3 shadow-lg transition-all duration-300 ease-out"
      role="banner"
      aria-label="Top Header"
    >
      {/* Left: Mobile Menu */}
      <button
        aria-label={menuOpen ? 'Close main menu' : 'Open main menu'}
        className="mr-2 rounded-md p-2 transition hover:bg-gray-100 lg:hidden"
        onClick={() => {
          setMenuOpen(!menuOpen);
          onMenuClick?.();
        }}
      >
        <svg
          className={`h-6 w-6 transition-transform duration-300 ${
            menuOpen ? 'rotate-90' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {menuOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Center: Logo & Project Switcher */}
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90">
          <img
            src="/logo.png"
            alt="Doshaki Construction Logo"
            className="h-9 w-9 rounded-full object-contain"
          />
        </Link>
        <ProjectSwitcher />
      </div>

      {/* Right: Notifications & User */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <NotificationBell />
          <ApprovalsBadge count={pendingApprovalsCount} />
        </div>

        {!loading && user && (
          <div className="flex items-center gap-2">
            <UserAvatar user={user} />

            <div className="ml-2 hidden flex-col md:flex">
              <span className="font-medium text-gray-800">{user.name}</span>
              <span className="text-xs text-gray-500">
                {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
              </span>
            </div>

            <Link
              href="/profile"
              className="rounded-md px-2 py-1 text-blue-600 transition hover:bg-blue-100 hover:text-blue-800"
            >
              Profile
            </Link>

            <button
              onClick={handleLogout}
              className="cursor-pointer rounded-md bg-gradient-to-r from-red-400 to-red-600 px-3 py-1.5 font-semibold text-white shadow transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
