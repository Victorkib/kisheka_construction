/**
 * Dashboard Page
 * Main dashboard for authenticated users
 * Protected by middleware
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';

/**
 * Dashboard Router
 * Redirects users to their role-specific dashboard
 */
export default function DashboardPage() {
  const router = useRouter();
  const [error, setError] = useState(null);

  useEffect(() => {
    async function redirectToRoleDashboard() {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();

        if (!data.success) {
          router.push('/auth/login');
          return;
        }

        const user = data.data;
        const role = user.role?.toLowerCase();

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
  }, [router]);

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

