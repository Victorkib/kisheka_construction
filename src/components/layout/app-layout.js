/**
 * App Layout Component
 * Wraps authenticated pages with sidebar and header
 * Use this component to wrap pages that need the full navigation
 */

'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { SmartSidebar } from './SmartSidebar';
import { MobileNav } from './mobile-nav';
import { SmartMobileNav } from '@/components/navigation/SmartMobileNav';
import { Header } from './header';
import { LoadingSpinner } from '@/components/loading';

/**
 * Check if smart navigation should be used
 * Can be enabled via localStorage or environment variable
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

export function AppLayout({ children, forceSmartNav = null }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  
  // Determine which navigation to use
  const useSmartNav = forceSmartNav !== null ? forceSmartNav : shouldUseSmartNav();
  const SidebarComponent = useSmartNav ? SmartSidebar : Sidebar;
  const MobileNavComponent = useSmartNav ? SmartMobileNav : MobileNav;

  return (
    <div className="h-screen h-[100dvh] bg-gray-50 flex overflow-hidden safe-area-inset">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        <SidebarComponent
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile Navigation Drawer */}
      <MobileNavComponent isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <Header onMenuClick={() => setMobileNavOpen(true)} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="min-h-full">
            {children || (
              <div className="flex items-center justify-center min-h-[400px] p-4">
                <LoadingSpinner size="lg" text="Loading..." />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;

