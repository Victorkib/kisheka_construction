/**
 * App Layout with Smart Navigation
 * Optional wrapper that uses SmartSidebar instead of regular Sidebar
 * Can be enabled via feature flag or environment variable
 */

'use client';

import { useState } from 'react';
import { SmartSidebar } from './SmartSidebar';
import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { SmartMobileNav } from '@/components/navigation/SmartMobileNav';
import { Header } from './header';
import { LoadingSpinner } from '@/components/loading';

/**
 * Check if smart navigation should be used
 * Can be controlled via:
 * 1. Environment variable: NEXT_PUBLIC_USE_SMART_NAV=true
 * 2. localStorage: 'use-smart-nav' = 'true'
 * 3. Default: false (use regular sidebar)
 */
function shouldUseSmartNav() {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_USE_SMART_NAV === 'true';
  }
  
  // Check localStorage first (user preference)
  const stored = localStorage.getItem('use-smart-nav');
  if (stored !== null) {
    return stored === 'true';
  }
  
  // Fall back to environment variable
  return process.env.NEXT_PUBLIC_USE_SMART_NAV === 'true';
}

export function AppLayoutWithSmartNav({ children, forceSmartNav = null }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  
  // Determine which sidebar to use
  const useSmartNav = forceSmartNav !== null ? forceSmartNav : shouldUseSmartNav();
  const SidebarComponent = useSmartNav ? SmartSidebar : Sidebar;
  const MobileNavComponent = useSmartNav ? SmartMobileNav : MobileNav;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <SidebarComponent
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile Navigation Drawer */}
      <MobileNavComponent isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <Header onMenuClick={() => setMobileNavOpen(true)} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children || (
            <div className="flex items-center justify-center min-h-[400px]">
              <LoadingSpinner size="lg" text="Loading..." />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default AppLayoutWithSmartNav;
