'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ProjectSwitcher } from '@/components/project-switcher/ProjectSwitcher';

export function Header({ onMenuClick }) {
  const router = useRouter();
  const { user, loading } = usePermissions();
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  // Fetch pending approvals count
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
          if (data.success && data.data?.summary?.totalPendingApprovals) {
            setPendingApprovalsCount(data.data.summary.totalPendingApprovals);
          }
        })
        .catch((err) =>
          console.error('Error fetching approvals count:', err)
        );
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/auth/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Animated notification badge
  const ApprovalsBadge = () =>
    pendingApprovalsCount > 0 ? (
      <span
        className="ml-2 animate-bounce rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow"
        aria-label={`Pending approvals: ${pendingApprovalsCount}`}
        title="Pending approvals"
      >
        {pendingApprovalsCount}
      </span>
    ) : null;

  // Avatar with fallback
  const UserAvatar = () => (
    <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 overflow-hidden">
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
      <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-green-400"></span>
    </div>
  );

  return (
    <header
      className="sticky top-0 z-50 flex w-full items-center justify-between bg-white shadow-lg transition-all duration-300 ease-out px-4 py-3"
      role="banner"
      aria-label="Top Header"
    >
      {/* Left: Mobile menu button */}
      <button
        aria-label={menuOpen ? 'Close main menu' : 'Open main menu'}
        className="lg:hidden mr-2 rounded-md p-2 hover:bg-gray-100 transition"
        onClick={() => {
          setMenuOpen(!menuOpen);
          if (onMenuClick) onMenuClick();
        }}
      >
        {/* Hamburger icon */}
        <span className="sr-only">Menu</span>
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

      {/* Center: Logo / Home Link and Project Switcher */}
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90">
          <img
            src="/logo.png"
            alt="Doshaki Construction Logo"
            className="h-9 w-9 object-contain rounded-full"
            loading="eager"
          />
        </Link>
        <ProjectSwitcher />
      </div>

      {/* Right: User info & actions */}
      <div className="flex items-center gap-4">
        {/* Notification bell */}
        <div className="relative">
          <NotificationBell />
          <ApprovalsBadge />
        </div>
        {!loading && user && (
          <div className="flex items-center gap-2">
            <UserAvatar />
            <div className="ml-2 hidden md:flex flex-col">
              <span className="font-medium text-gray-800">
                {user.name}
              </span>
              <span className="text-xs text-gray-500">
                {user.role?.charAt(0).toUpperCase() +
                  user.role?.slice(1)}
              </span>
            </div>
            {/* Settings / Profile */}
            <Link
              href="/profile"
              aria-label="User profile"
              className="rounded-md px-2 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 transition"
            >
              Profile
            </Link>
            {/* Logout */}
            <button
              onClick={handleLogout}
              aria-label="Logout"
              className="rounded-md bg-gradient-to-r from-red-400 to-red-600 px-3 py-1.5 text-white font-semibold shadow hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-red-300 transition cursor-pointer"
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