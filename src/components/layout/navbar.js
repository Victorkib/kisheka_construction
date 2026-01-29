/**
 * Navigation Bar Component
 * Provides main navigation for authenticated users
 * Now integrated with sidebar and mobile drawer
 */

'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { Header } from './header';
import { clearUserCache } from '@/hooks/use-permissions';

/**
 * Navbar Component - Integrated Navigation System
 * Provides sidebar for desktop and mobile drawer for mobile
 * Wraps page content with the navigation system
 */
export function Navbar({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // If children are provided, wrap them with the layout
  if (children) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Mobile Navigation Drawer */}
        <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <Header onMenuClick={() => setMobileNavOpen(true)} />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Legacy mode: Render sidebar + header for existing pages
  // Sidebar is fixed, header is in normal flow with margin
  return (
    <>
      {/* Desktop Sidebar - Fixed */}
      <div className="hidden lg:block fixed left-0 top-0 bottom-0 z-20">
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile Navigation Drawer */}
      <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Header - In normal flow with margin for sidebar */}
      <div className={`${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} transition-all duration-300`}>
        <Header onMenuClick={() => setMobileNavOpen(true)} />
      </div>
    </>
  );
}

/**
 * Legacy Navbar (for pages that don't use the new layout)
 * This maintains backward compatibility
 */
export function LegacyNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

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

  const isActive = (path) => pathname === path || pathname.startsWith(path + '/');

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/dashboard" className="text-xl font-bold text-blue-600">
                Doshaki
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/dashboard"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/dashboard') && !pathname.includes('/dashboard/')
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Dashboard
              </Link>
              {user && user.role?.toLowerCase() === 'supplier' && (
                <Link
                  href="/supplier/delivery-notes"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isActive('/supplier/delivery-notes')
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Delivery Notes
                </Link>
              )}
              {user && user.role?.toLowerCase() !== 'supplier' && (
                <>
                  <Link
                    href="/projects"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive('/projects')
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Projects
                  </Link>
                  {user && ['owner', 'investor', 'accountant'].includes(user.role?.toLowerCase()) && (
                    <Link
                      href="/financing"
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive('/financing')
                          ? 'border-blue-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Financing
                    </Link>
                  )}
                  {user && user.role?.toLowerCase() === 'owner' && (
                    <Link
                      href="/investors"
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive('/investors')
                          ? 'border-blue-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Investors
                    </Link>
                  )}
                  <Link
                    href="/initial-expenses"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive('/initial-expenses')
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Initial Expenses
                  </Link>
                  <Link
                    href="/items"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive('/items')
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Materials
                  </Link>
                  <Link
                    href="/dashboard/approvals"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive('/dashboard/approvals')
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Approvals
                  </Link>
                  <Link
                    href="/dashboard/stock"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive('/dashboard/stock')
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Stock
                  </Link>
                  <Link
                    href="/expenses"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive('/expenses')
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Expenses
                  </Link>
                  <Link
                    href="/categories"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive('/categories')
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Categories
                  </Link>
                  <Link
                    href="/floors"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive('/floors')
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Floors
                  </Link>
                  <Link
                    href="/dashboard/analytics/wastage"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive('/dashboard/analytics')
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Analytics
                  </Link>
                  {user && ['owner', 'investor', 'accountant', 'pm', 'project_manager'].includes(user.role?.toLowerCase()) && (
                    <Link
                      href="/dashboard/budget"
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive('/dashboard/budget')
                          ? 'border-blue-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Budget
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <div className="ml-3 relative">
              <div className="flex items-center gap-4">
                {user && (
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">{user.firstName || user.email}</span>
                    <span className="text-gray-500 ml-2">({user.role})</span>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
          <div className="sm:hidden flex items-center">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {showMenu ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {showMenu && (
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
            <Link
              href="/dashboard"
              className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                isActive('/dashboard') && !pathname.includes('/dashboard/')
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300'
              }`}
              onClick={() => setShowMenu(false)}
            >
              Dashboard
            </Link>
            {user && user.role?.toLowerCase() === 'supplier' && (
              <Link
                href="/supplier/delivery-notes"
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  isActive('/supplier/delivery-notes')
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                }`}
                onClick={() => setShowMenu(false)}
              >
                Delivery Notes
              </Link>
            )}
            {user && user.role?.toLowerCase() !== 'supplier' && (
              <>
                <Link
                  href="/projects"
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                    isActive('/projects')
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                  onClick={() => setShowMenu(false)}
                >
                  Projects
                </Link>
                {user && ['owner', 'investor', 'accountant'].includes(user.role?.toLowerCase()) && (
                  <Link
                    href="/financing"
                    className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                      isActive('/financing')
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                    onClick={() => setShowMenu(false)}
                  >
                    Financing
                  </Link>
                )}
                {user && user.role?.toLowerCase() === 'owner' && (
                  <Link
                    href="/investors"
                    className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                      isActive('/investors')
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                    onClick={() => setShowMenu(false)}
                  >
                    Investors
                  </Link>
                )}
                <Link
                  href="/initial-expenses"
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                    isActive('/initial-expenses')
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                  onClick={() => setShowMenu(false)}
                >
                  Initial Expenses
                </Link>
                <Link
                  href="/items"
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                    isActive('/items')
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                  onClick={() => setShowMenu(false)}
                >
                  Materials
                </Link>
                <Link
                  href="/dashboard/approvals"
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                    isActive('/dashboard/approvals')
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                  onClick={() => setShowMenu(false)}
                >
                  Approvals
                </Link>
                <Link
                  href="/dashboard/stock"
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                    isActive('/dashboard/stock')
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                  onClick={() => setShowMenu(false)}
                >
                  Stock
                </Link>
                <Link
                  href="/expenses"
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                    isActive('/expenses')
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                  onClick={() => setShowMenu(false)}
                >
                  Expenses
                </Link>
                <Link
                  href="/categories"
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                    isActive('/categories')
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                  onClick={() => setShowMenu(false)}
                >
                  Categories
                </Link>
                <Link
                  href="/floors"
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                    isActive('/floors')
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                  onClick={() => setShowMenu(false)}
                >
                  Floors
                </Link>
                <Link
                  href="/dashboard/analytics/wastage"
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                    isActive('/dashboard/analytics')
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                  onClick={() => setShowMenu(false)}
                >
                  Analytics
                </Link>
                {user && ['owner', 'investor', 'accountant', 'pm', 'project_manager'].includes(user.role?.toLowerCase()) && (
                  <Link
                    href="/dashboard/budget"
                    className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                      isActive('/dashboard/budget')
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                    onClick={() => setShowMenu(false)}
                  >
                    Budget
                  </Link>
                )}
              </>
            )}
            <div className="border-t border-gray-200 pt-4 pb-3">
              {user && (
                <div className="px-4 text-sm text-gray-500 mb-2">
                  {user.firstName || user.email} ({user.role})
                </div>
              )}
              <button
                onClick={() => {
                  setShowMenu(false);
                  handleLogout();
                }}
                className="block w-full text-left pl-3 pr-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-50"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
