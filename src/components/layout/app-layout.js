/**
 * App Layout Component
 * Wraps authenticated pages with sidebar and header
 * Use this component to wrap pages that need the full navigation
 */

'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { Header } from './header';
import { LoadingSpinner } from '@/components/loading';

export function AppLayout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

export default AppLayout;

