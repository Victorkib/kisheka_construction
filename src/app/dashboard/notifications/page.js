/**
 * Notifications Page
 * Full notifications management page
 * Route: /dashboard/notifications
 * Auth: All authenticated users
 */

import { Suspense } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import NotificationsPageClient from './NotificationsPageClient';

export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading notifications..." />
          </div>
        </AppLayout>
      }
    >
      <NotificationsPageClient />
    </Suspense>
  );
}
