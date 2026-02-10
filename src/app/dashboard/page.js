/**
 * Dashboard Page
 * Main dashboard for authenticated users
 * Protected by middleware
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { fetchNoCache } from '@/lib/fetch-helpers';

/**
 * Dashboard Router
 * Redirects users to their role-specific dashboard
 * CRITICAL FIX: Prevents redirect loops by checking current pathname
 */
export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [error, setError] = useState(null);
  const hasRedirected = useRef(false);

  useEffect(() => {
    // CRITICAL FIX: Check if we're already on a role-specific dashboard
    // This prevents redirect loops when user clicks dashboard link while already on dashboard
    const currentPath = pathname || window.location.pathname;
    const isAlreadyOnRoleDashboard = currentPath.match(/^\/dashboard\/(owner|investor|pm|clerk|accountant|supervisor|supplier)$/);
    
    if (isAlreadyOnRoleDashboard) {
      // Already on a role dashboard, don't redirect
      return;
    }

    // CRITICAL FIX: Only redirect once per mount
    if (hasRedirected.current) {
      return;
    }

    async function redirectToRoleDashboard() {
      try {
        // CRITICAL FIX: Double-check we're still on /dashboard before redirecting
        const currentPath = window.location.pathname;
        if (currentPath !== '/dashboard' && !currentPath.startsWith('/dashboard/')) {
          // User navigated away, don't redirect
          return;
        }

        const response = await fetchNoCache('/api/auth/me');
        const data = await response.json();

        if (!data.success) {
          router.push('/auth/login');
          return;
        }

        const user = data.data;
        const role = user.role?.toLowerCase();

        // CRITICAL FIX: Mark as redirected before actually redirecting
        hasRedirected.current = true;

        // Route to role-specific dashboard
        switch (role) {
          case 'owner':
            router.replace('/dashboard/owner');
            break;
          case 'investor':
            router.replace('/dashboard/investor');
            break;
          case 'pm':
          case 'project_manager':
            router.replace('/dashboard/pm');
            break;
          case 'clerk':
          case 'site_clerk':
            router.replace('/dashboard/clerk');
            break;
          case 'accountant':
            router.replace('/dashboard/accountant');
            break;
          case 'supervisor':
            router.replace('/dashboard/supervisor');
            break;
          case 'supplier':
            router.replace('/dashboard/supplier');
            break;
          default:
            // Fallback to a generic dashboard or owner dashboard
            router.replace('/dashboard/owner');
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        setError('Failed to load dashboard. Redirecting to login...');
        setTimeout(() => {
          router.push('/auth/login');
        }, 2000);
      }
    }

    redirectToRoleDashboard();
  }, [router, pathname]);

  if (error) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-600 mb-4">{error}</div>
            <LoadingSpinner size="md" text="Redirecting..." />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" text="Redirecting to your dashboard..." />
        </div>
      </div>
    </AppLayout>
  );
}

