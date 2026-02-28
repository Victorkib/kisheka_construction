'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePermissions, clearUserCache } from '@/hooks/use-permissions';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ProjectSwitcher } from '@/components/project-switcher/ProjectSwitcher';
import { useTheme } from '@/contexts/ThemeContext';

/* ----------------------------------------
   Approvals Badge (DECLARED OUTSIDE RENDER)
----------------------------------------- */
function ApprovalsBadge({ count }) {
  if (!count || count <= 0) return null;

  return (
    <span
      className="ml-1 sm:ml-2 animate-bounce rounded-full bg-red-600 px-1.5 sm:px-2 py-0.5 text-xs font-bold text-white shadow"
      aria-label={`Pending approvals: ${count}`}
      title="Pending approvals"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/* ----------------------------------------
   User Avatar (DECLARED OUTSIDE RENDER)
----------------------------------------- */
function UserAvatar({ user, size = 'md' }) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-12 w-12 text-lg',
  };

  return (
    <div className={`relative flex ${sizeClasses[size]} items-center justify-center overflow-hidden rounded-full ds-bg-surface-muted`}>
      {user?.avatar ? (
        <img
          src={user.avatar}
          alt={user.name || 'User Avatar'}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className={`font-bold ds-text-secondary ${size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-base'}`}>
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
      <span className={`absolute bottom-0 right-0 ${size === 'sm' ? 'h-2 w-2' : size === 'lg' ? 'h-3.5 w-3.5' : 'h-3 w-3'} rounded-full bg-green-400 ring-2 ring-white`} />
    </div>
  );
}

/* ----------------------------------------
   Mobile User Menu Dropdown
----------------------------------------- */
function MobileUserMenu({ user, onLogout, isOpen, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Glassmorphism Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-md z-40 md:hidden transition-opacity duration-300 ease-out"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Glassmorphism Dropdown Menu */}
      <div
        ref={menuRef}
        className="absolute right-0 top-full mt-2 w-56 z-50 md:hidden rounded-xl animate-fadeInSlide ds-bg-surface border ds-border-subtle shadow-xl"
      >
        <div className="rounded-xl overflow-hidden">
          {/* User Info Header */}
          <div className="p-4 border-b ds-border-subtle/50 ds-bg-surface/50">
            <div className="flex items-center gap-3">
              <div className="relative">
                <UserAvatar user={user} size="md" />
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white shadow-sm"></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold ds-text-primary truncate text-sm">{user.name}</p>
                <p className="text-xs ds-text-secondary capitalize truncate mt-0.5">
                  {user.role || 'User'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Menu Items */}
          <div className="py-2 ds-bg-surface/40">
            <Link
              href="/profile"
              onClick={onClose}
              className="block px-4 py-3 text-sm ds-text-secondary hover:ds-bg-surface-muted active:ds-bg-surface transition-all duration-150 group"
            >
              <div className="flex items-center gap-3">
                <svg 
                  className="w-4 h-4 ds-text-muted group-hover:ds-text-accent-primary transition-colors" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-medium">Profile Settings</span>
              </div>
            </Link>
            
            <button
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition-all duration-150 flex items-center gap-3 group touch-manipulation"
            >
              <svg 
                className="w-4 h-4 group-hover:scale-110 transition-transform" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="font-semibold">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  /* Fetch pending approvals */
  useEffect(() => {
    if (
      user &&
      ['owner', 'pm', 'project_manager', 'accountant'].includes(
        user.role?.toLowerCase(),
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
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
        }
      }

      // Clear sessionStorage and localStorage of any app data
      try {
        sessionStorage.clear();
        localStorage.removeItem('currentProjectId');
        // CRITICAL: Clear Supabase/PKCE state to avoid account-switch OAuth failures
        // Supabase can store PKCE verifier / auth state keys under sb-* or supabase*
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

  return (
    <header
      className="sticky top-0 z-50 flex w-full items-center justify-between ds-bg-surface px-2 sm:px-4 py-2 sm:py-3 shadow-lg transition-all duration-300 ease-out"
      role="banner"
      aria-label="Top Header"
    >
      {/* Left: Mobile Menu Button */}
      <button
        aria-label={menuOpen ? 'Close main menu' : 'Open main menu'}
        className="flex-shrink-0 p-2 sm:p-2.5 rounded-md transition-colors hover:ds-bg-surface-muted active:ds-bg-surface lg:hidden touch-manipulation"
        onClick={() => {
          setMenuOpen(!menuOpen);
          onMenuClick?.();
        }}
      >
        <svg
          className={`h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-300 ${
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
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 justify-center lg:justify-start">
        <Link 
          href="/" 
          className="flex items-center gap-1 sm:gap-2 hover:opacity-90 transition-opacity flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md"
          aria-label="Go to home page"
        >
          <img
            src="/logo.png"
            alt="Doshaki Construction Logo"
            className="h-7 w-7 sm:h-9 sm:w-9 rounded-full object-contain"
            loading="eager"
            width="36"
            height="36"
          />
        </Link>
        <div className="flex-1 min-w-0 max-w-xs sm:max-w-md">
          <ProjectSwitcher />
        </div>
      </div>

      {/* Right: Theme toggle, Notifications & User */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0">
        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="hidden sm:inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium border ds-border-subtle ds-text-secondary hover:ds-bg-surface-muted active:ds-bg-surface transition-colors"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        {/* Notifications - Always visible */}
        <div className="relative">
          <NotificationBell />
          <ApprovalsBadge count={pendingApprovalsCount} />
        </div>

        {/* User Section */}
        {!loading && user && (
          <>
            {/* Desktop User Info & Actions */}
            <div className="hidden md:flex items-center gap-2 lg:gap-3">
              <UserAvatar user={user} />
              <div className="hidden lg:flex flex-col">
                <span className="font-medium ds-text-primary text-sm leading-tight">
                  {user.name}
                </span>
                <span className="text-xs ds-text-muted capitalize leading-tight">
                  {user.role || 'User'}
                </span>
              </div>
              <Link
                href="/profile"
                className="hidden xl:block rounded-md px-3 py-1.5 text-sm ds-text-accent-primary transition-colors hover:bg-blue-500/10 hover:text-blue-400 active:bg-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="View profile settings"
              >
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-md bg-gradient-to-r from-red-400 to-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow transition-all hover:opacity-90 active:opacity-80 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2"
                aria-label="Logout from account"
              >
                Logout
              </button>
            </div>

            {/* Mobile/Tablet User Menu Button */}
            <div className="relative md:hidden">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="p-1.5 rounded-md transition-colors hover:ds-bg-surface-muted active:ds-bg-surface touch-manipulation"
                aria-label="User menu"
                aria-expanded={userMenuOpen}
              >
                <UserAvatar user={user} size="sm" />
              </button>
              
              <MobileUserMenu
                user={user}
                onLogout={handleLogout}
                isOpen={userMenuOpen}
                onClose={() => setUserMenuOpen(false)}
              />
            </div>
          </>
        )}
      </div>
    </header>
  );
}

export default Header;
