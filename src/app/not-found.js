/**
 * Custom 404 Not Found Page
 * Designed for Doshaki Construction System
 * Provides helpful navigation and matches system design
 */

'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';

function NotFoundContent() {
  const router = useRouter();
  // Use useSearchParams to ensure Suspense boundary is recognized
  const searchParams = useSearchParams();

  return (
    <AppLayout>
      <div className="min-h-screen flex items-center justify-center ds-bg-app px-4">
        <div className="max-w-2xl w-full text-center">
          {/* Large 404 Display */}
          <div className="mb-8">
            <div className="text-9xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 mb-4">
              404
            </div>
            <div className="text-6xl mb-4">🏗️</div>
            <h1 className="text-4xl md:text-5xl font-bold ds-text-primary mb-4">
              Page Not Found
            </h1>
            <p className="text-xl ds-text-secondary mb-2">
              Looks like this construction site is still under development!
            </p>
            <p className="text-lg ds-text-secondary">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          {/* Helpful Actions */}
          <div className="ds-bg-surface rounded-xl shadow-lg p-8 mb-8 border ds-border-subtle">
            <h2 className="text-2xl font-semibold ds-text-primary mb-6">
              Where would you like to go?
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Link
                href="/dashboard/owner"
                className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-400/60 hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <div className="text-3xl mb-2">📊</div>
                <h3 className="font-semibold ds-text-primary mb-1 group-hover:ds-text-accent-primary transition-colors">
                  Dashboard
                </h3>
                <p className="text-sm ds-text-secondary">
                  Return to your main dashboard
                </p>
              </Link>

              <Link
                href="/projects"
                className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border-2 border-purple-400/60 hover:border-purple-400 hover:shadow-md transition-all group"
              >
                <div className="text-3xl mb-2">🏗️</div>
                <h3 className="font-semibold ds-text-primary mb-1 group-hover:text-purple-600 transition-colors">
                  Projects
                </h3>
                <p className="text-sm ds-text-secondary">
                  View all construction projects
                </p>
              </Link>

              <Link
                href="/items"
                className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-green-400/60 hover:border-green-400 hover:shadow-md transition-all group"
              >
                <div className="text-3xl mb-2">📦</div>
                <h3 className="font-semibold ds-text-primary mb-1 group-hover:text-green-600 transition-colors">
                  Materials
                </h3>
                <p className="text-sm ds-text-secondary">
                  Manage materials and inventory
                </p>
              </Link>

              <Link
                href="/phases"
                className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border-2 border-orange-200 hover:border-orange-400 hover:shadow-md transition-all group"
              >
                <div className="text-3xl mb-2">📋</div>
                <h3 className="font-semibold ds-text-primary mb-1 group-hover:text-orange-600 transition-colors">
                  Phases
                </h3>
                <p className="text-sm ds-text-secondary">
                  View project phases
                </p>
              </Link>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 border-t ds-border-subtle">
              <button
                onClick={() => router.back()}
                className="px-6 py-3 ds-bg-surface-muted hover:ds-bg-surface-muted ds-text-secondary font-semibold rounded-lg transition-colors"
              >
                ← Go Back
              </button>
              <Link
                href="/"
                className="px-6 py-3 ds-bg-accent-primary hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg text-center"
              >
                Go to Homepage
              </Link>
            </div>
          </div>

          {/* Helpful Information */}
          <div className="bg-blue-500/10 border border-blue-400/60 rounded-lg p-6">
            <h3 className="font-semibold ds-text-accent-primary mb-2">
              Need Help?
            </h3>
            <p className="text-sm ds-text-accent-primary mb-4">
              If you believe this is an error, please contact your system administrator or check the URL for typos.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="px-3 py-1 ds-bg-surface rounded-full text-xs ds-text-secondary border ds-border-subtle">
                Common pages: Projects, Phases, Materials, Expenses
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function NotFound() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center ds-bg-surface-muted">
        <div className="text-center">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      </div>
    }>
      <NotFoundContent />
    </Suspense>
  );
}
