/**
 * Accountant Dashboard
 * Financial-focused dashboard with approval and reporting capabilities
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingCard, LoadingSpinner } from '@/components/loading';
import { useProjectContext } from '@/contexts/ProjectContext';
import { NoProjectsEmptyState, ErrorState } from '@/components/empty-states';
import { fetchNoCache } from '@/lib/fetch-helpers';

export default function AccountantDashboard() {
  const { isEmpty, loading: contextLoading, refreshAccessibleProjects } = useProjectContext();
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userError, setUserError] = useState(null);
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const router = useRouter();

  // CRITICAL FIX: Refresh ProjectContext when dashboard loads if it's empty
  useEffect(() => {
    if (!contextLoading && isEmpty && !hasRefreshed && refreshAccessibleProjects) {
      console.log('Accountant Dashboard: ProjectContext appears empty, refreshing...');
      setHasRefreshed(true);
      refreshAccessibleProjects().catch((err) => {
        console.error('Error refreshing accessible projects:', err);
      });
    }
  }, [contextLoading, isEmpty, hasRefreshed, refreshAccessibleProjects]);

  useEffect(() => {
    async function fetchData() {
      // Always fetch user data first, even if empty state
      try {
        setUserError(null);
        const userResponse = await fetchNoCache('/api/auth/me');
        const userData = await userResponse.json();

        if (!userData.success) {
          setUserError('Failed to load user data. Please try again.');
          setLoading(false);
          return;
        }

        setUser(userData.data);

        // Don't fetch other data if empty state
        if (isEmpty) {
          setLoading(false);
          return;
        }

        const summaryResponse = await fetchNoCache('/api/dashboard/summary');
        const summaryData = await summaryResponse.json();

        if (summaryData.success) {
          setSummary(summaryData.data.summary);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setUserError('Network error. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router, isEmpty]);

  // CRITICAL FIX: Wait for ProjectContext to finish loading before showing empty state
  const isActuallyEmpty = isEmpty && !contextLoading && hasRefreshed;

  if (loading || contextLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div className="animate-pulse">
              <div className="h-8 ds-bg-surface-muted rounded w-64 mb-2"></div>
              <div className="h-4 ds-bg-surface-muted rounded w-96"></div>
            </div>
            <LoadingCard count={4} showHeader={true} lines={3} />
          </div>
        </div>
      </AppLayout>
    );
  }

  // Check empty state FIRST - but only if context has finished loading and we've attempted refresh
  if (isActuallyEmpty) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">Accountant Dashboard</h1>
            {user && (
              <p className="ds-text-secondary mt-2">Welcome, {user.firstName || user.email}!</p>
            )}
          </div>

          {/* Empty State - No Projects */}
          <NoProjectsEmptyState
            canCreate={false}
            userName={user?.firstName || user?.email}
            role="accountant"
          />
        </div>
      </AppLayout>
    );
  }

  // Check for user error state
  if (userError) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorState
            title="Error Loading Dashboard"
            message={userError}
            onRetry={() => {
              setUserError(null);
              setLoading(true);
              window.location.reload();
            }}
          />
        </div>
      </AppLayout>
    );
  }

  // Check if user is null (shouldn't happen if fetch succeeded, but safety check)
  if (!user) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border-2 border-yellow-400/60 rounded-lg p-8 text-center">
            <div className="max-w-2xl mx-auto">
              <div className="text-5xl mb-4">⏳</div>
              <h2 className="text-2xl font-bold ds-text-primary mb-2">Loading User Data</h2>
              <p className="text-lg ds-text-secondary mb-6">Please wait while we load your information...</p>
              <LoadingSpinner />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight break-words">Accountant Dashboard</h1>
          <p className="text-sm sm:text-base ds-text-secondary mt-2">Welcome back, {user.firstName || user.email}!</p>
        </div>

        {/* Financial Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-xs sm:text-base font-semibold ds-text-secondary mb-2 leading-normal">Total Cost</h2>
              <p className="text-2xl sm:text-3xl font-bold text-green-600 break-words">
                {new Intl.NumberFormat('en-KE', {
                  style: 'currency',
                  currency: 'KES',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(summary.totalOverallCost || 0)}
              </p>
              <p className="text-xs sm:text-sm ds-text-secondary mt-1 leading-normal break-words">
                Materials: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(summary.totalMaterialsCost || 0)} | 
                Expenses: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(summary.totalExpensesCost || 0)} | 
                Labour: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(summary.totalLabourCost || 0)}
              </p>
            </div>

            <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-xs sm:text-base font-semibold ds-text-secondary mb-2 leading-normal">Pending Approvals</h2>
              <p className="text-2xl sm:text-3xl font-bold text-yellow-600">{summary.totalPendingApprovals || 0}</p>
              {summary.totalPendingApprovals > 0 && (
                <p className="text-xs sm:text-sm ds-text-secondary mt-1 leading-normal">
                  {summary.pendingBreakdown?.materials || 0} materials, {summary.pendingBreakdown?.expenses || 0} expenses, {summary.pendingBreakdown?.initialExpenses || 0} initial
                </p>
              )}
            </div>

            <Link
              href="/financing"
              className="ds-bg-surface rounded-lg shadow p-4 sm:p-6 hover:shadow-md active:shadow-lg transition-all touch-manipulation sm:col-span-2"
            >
              <h2 className="text-xs sm:text-base font-semibold ds-text-secondary mb-2 leading-normal">Financing Dashboard</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm ds-text-secondary">Capital Raised</p>
                  <p className="text-lg sm:text-xl font-bold text-purple-600 mt-1 break-words">
                    {summary.capital ? (
                      new Intl.NumberFormat('en-KE', {
                        style: 'currency',
                        currency: 'KES',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(summary.capital.raised || 0)
                    ) : (
                      'View Details'
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm ds-text-secondary">Capital Balance</p>
                  <p className="text-lg sm:text-xl font-bold text-blue-600 mt-1 break-words">
                    {summary.capital ? (
                      new Intl.NumberFormat('en-KE', {
                        style: 'currency',
                        currency: 'KES',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(summary.capital.balance || 0)
                    ) : (
                      'View Details'
                    )}
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm ds-text-secondary mt-2 leading-normal">Click to view full financing dashboard</p>
            </Link>
          </div>
        )}

        {/* Approval Queue - Priority Section */}
        <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold ds-text-primary mb-4">Approval Queue</h2>
          <div className="mb-4">
            <Link
              href="/dashboard/approvals"
              className="inline-flex items-center w-full sm:w-auto justify-center sm:justify-start px-4 sm:px-6 py-2.5 sm:py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 active:bg-yellow-800 transition-colors text-sm sm:text-base touch-manipulation"
            >
              <span className="text-xl sm:text-2xl mr-2 sm:mr-3">✅</span>
              <div className="text-left">
                <div className="font-semibold text-sm sm:text-base">Review Pending Approvals</div>
                {summary && summary.totalPendingApprovals > 0 && (
                  <div className="text-xs sm:text-sm opacity-90">
                    {summary.totalPendingApprovals} items awaiting approval
                  </div>
                )}
              </div>
            </Link>
          </div>
        </div>

        {/* Financial Management Section */}
        <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold ds-text-primary mb-4">Financial Management</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Link
              href="/financing"
              className="p-3 sm:p-4 border-2 border-purple-400/60 rounded-lg hover:border-purple-500 active:border-purple-600 hover:bg-purple-50 active:bg-purple-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">💰</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold ds-text-primary text-sm sm:text-base">Financing Dashboard</h3>
                  <p className="text-xs sm:text-sm ds-text-secondary">View capital and finances</p>
                </div>
              </div>
            </Link>

            <Link
              href="/initial-expenses"
              className="p-3 sm:p-4 border-2 border-orange-200 rounded-lg hover:border-orange-500 active:border-orange-600 hover:bg-orange-50 active:bg-orange-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">🏛️</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold ds-text-primary text-sm sm:text-base">Initial Expenses</h3>
                  <p className="text-xs sm:text-sm ds-text-secondary">Track pre-construction costs</p>
                </div>
              </div>
            </Link>

            <Link
              href="/expenses"
              className="p-3 sm:p-4 border-2 border-red-400/60 rounded-lg hover:border-red-500 active:border-red-600 hover:bg-red-50 active:bg-red-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">💸</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold ds-text-primary text-sm sm:text-base">Expenses</h3>
                  <p className="text-xs sm:text-sm ds-text-secondary">View and manage expenses</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Reports & Analytics Section */}
        <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold ds-text-primary mb-4">Reports & Analytics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Link
              href="/dashboard/budget"
              className="p-3 sm:p-4 border-2 border-emerald-200 rounded-lg hover:border-emerald-500 active:border-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">💵</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold ds-text-primary text-sm sm:text-base">Budget vs Actual</h3>
                  <p className="text-xs sm:text-sm ds-text-secondary">Compare budget to spending</p>
                </div>
              </div>
            </Link>

            <Link
              href="/dashboard/analytics/wastage"
              className="p-3 sm:p-4 border-2 border-amber-200 rounded-lg hover:border-amber-500 active:border-amber-600 hover:bg-amber-50 active:bg-amber-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">📈</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold ds-text-primary text-sm sm:text-base">Wastage Analytics</h3>
                  <p className="text-xs sm:text-sm ds-text-secondary">View variance and wastage reports</p>
                </div>
              </div>
            </Link>

            <Link
              href="/dashboard/stock"
              className="p-3 sm:p-4 border-2 border-purple-400/60 rounded-lg hover:border-purple-500 active:border-purple-600 hover:bg-purple-50 active:bg-purple-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">📊</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold ds-text-primary text-sm sm:text-base">Stock Tracking</h3>
                  <p className="text-xs sm:text-sm ds-text-secondary">Monitor inventory levels</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

