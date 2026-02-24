/**
 * Project Manager Dashboard
 * Task-oriented dashboard with approval queue and operations focus
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

export default function PMDashboard() {
  const { isEmpty, loading: contextLoading, refreshAccessibleProjects } = useProjectContext();
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [wastageSummary, setWastageSummary] = useState(null);
  const [readyToOrderCount, setReadyToOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userError, setUserError] = useState(null);
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const router = useRouter();

  // CRITICAL FIX: Refresh ProjectContext when dashboard loads if it's empty
  useEffect(() => {
    if (!contextLoading && isEmpty && !hasRefreshed && refreshAccessibleProjects) {
      console.log('PM Dashboard: ProjectContext appears empty, refreshing...');
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

        const [summaryResponse, wastageResponse, readyToOrderResponse] = await Promise.all([
          fetchNoCache('/api/dashboard/summary'),
          fetchNoCache('/api/discrepancies/widget-summary'),
          fetchNoCache('/api/material-requests?status=ready_to_order&limit=0'),
        ]);

        const summaryData = await summaryResponse.json();
        const wastageData = await wastageResponse.json();
        const readyToOrderData = await readyToOrderResponse.json();

        if (summaryData.success) {
          setSummary(summaryData.data.summary);
        }
        if (wastageData.success) {
          setWastageSummary(wastageData.data);
        }
        if (readyToOrderData.success) {
          const count = readyToOrderData.data?.pagination?.total || readyToOrderData.data?.requests?.length || 0;
          setReadyToOrderCount(count);
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
              <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-96"></div>
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
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Project Manager Dashboard</h1>
            {user && (
              <p className="text-gray-700 mt-2">Welcome, {user.firstName || user.email}!</p>
            )}
          </div>

          {/* Empty State - No Projects */}
          <NoProjectsEmptyState
            canCreate={true}
            userName={user?.firstName || user?.email}
            role="pm"
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
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-8 text-center">
            <div className="max-w-2xl mx-auto">
              <div className="text-5xl mb-4">⏳</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading User Data</h2>
              <p className="text-lg text-gray-700 mb-6">Please wait while we load your information...</p>
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
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight break-words">Project Manager Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-700 mt-2">Welcome back, {user.firstName || user.email}!</p>
        </div>

        {/* Daily Tasks - Priority Section */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Daily Tasks</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Link
              href="/dashboard/approvals"
              className="p-3 sm:p-4 border-2 border-yellow-200 rounded-lg hover:border-yellow-500 active:border-yellow-600 hover:bg-yellow-50 active:bg-yellow-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">✅</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Pending Approvals</h3>
                  <p className="text-xs sm:text-sm text-gray-700">Review and approve items</p>
                  {summary && summary.totalPendingApprovals > 0 && (
                    <p className="text-base sm:text-lg font-bold text-yellow-600 mt-2">
                      {summary.totalPendingApprovals} pending
                    </p>
                  )}
                </div>
              </div>
            </Link>

            <Link
              href="/items"
              className="p-3 sm:p-4 border-2 border-blue-200 rounded-lg hover:border-blue-500 active:border-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">📦</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Materials</h3>
                  <p className="text-xs sm:text-sm text-gray-700">View and manage materials</p>
                </div>
              </div>
            </Link>

            <Link
              href="/expenses"
              className="p-3 sm:p-4 border-2 border-red-200 rounded-lg hover:border-red-500 active:border-red-600 hover:bg-red-50 active:bg-red-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">💸</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Expenses</h3>
                  <p className="text-xs sm:text-sm text-gray-700">View and manage expenses</p>
                </div>
              </div>
            </Link>

            {readyToOrderCount > 0 && (
              <Link
                href="/material-requests?status=ready_to_order"
                className="p-3 sm:p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 active:border-purple-600 hover:bg-purple-50 active:bg-purple-100 transition-colors touch-manipulation"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="text-xl sm:text-2xl flex-shrink-0">📋</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Ready to Order</h3>
                    <p className="text-xs sm:text-sm text-gray-700">Create purchase orders from approved requests</p>
                    <p className="text-base sm:text-lg font-bold text-purple-600 mt-2">
                      {readyToOrderCount} {readyToOrderCount === 1 ? 'request' : 'requests'}
                    </p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Project Overview */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-xs sm:text-base font-semibold text-gray-700 mb-2 leading-normal">Total Projects</h2>
              <p className="text-2xl sm:text-3xl font-bold text-blue-600">{summary.totalProjects || 0}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-xs sm:text-base font-semibold text-gray-700 mb-2 leading-normal">Total Cost</h2>
              <p className="text-2xl sm:text-3xl font-bold text-green-600 break-words">
                {new Intl.NumberFormat('en-KE', {
                  style: 'currency',
                  currency: 'KES',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(summary.totalOverallCost || 0)}
              </p>
              <p className="text-xs sm:text-sm text-gray-700 mt-1 leading-normal break-words">
                Materials: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(summary.totalMaterialsCost || 0)} | 
                Expenses: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(summary.totalExpensesCost || 0)} | 
                Labour: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(summary.totalLabourCost || 0)}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <h2 className="text-xs sm:text-base font-semibold text-gray-700 mb-2 leading-normal">Pending Approvals</h2>
              <p className="text-2xl sm:text-3xl font-bold text-yellow-600">{summary.totalPendingApprovals || 0}</p>
            </div>

            <Link
              href="/financing"
              className="bg-white rounded-lg shadow p-4 sm:p-6 hover:shadow-md active:shadow-lg transition-all touch-manipulation"
            >
              <h2 className="text-xs sm:text-base font-semibold text-gray-700 mb-2 leading-normal">Financing</h2>
              <p className="text-2xl sm:text-3xl font-bold text-purple-600 break-words">
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
              <p className="text-xs sm:text-sm text-gray-700 mt-1 leading-normal">View financing dashboard</p>
            </Link>
          </div>
        )}

        {/* Operations Section */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Operations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Link
              href="/items/new?entryType=retroactive_entry"
              className="p-3 sm:p-4 border-2 border-blue-200 rounded-lg hover:border-blue-500 active:border-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">📦</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Add Material</h3>
                  <p className="text-xs sm:text-sm text-gray-700">Create new material entry</p>
                </div>
              </div>
            </Link>

            <Link
              href="/expenses/new"
              className="p-3 sm:p-4 border-2 border-red-200 rounded-lg hover:border-red-500 active:border-red-600 hover:bg-red-50 active:bg-red-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">💸</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Add Expense</h3>
                  <p className="text-xs sm:text-sm text-gray-700">Create new expense entry</p>
                </div>
              </div>
            </Link>

            <Link
              href="/projects"
              className="p-3 sm:p-4 border-2 border-indigo-200 rounded-lg hover:border-indigo-500 active:border-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">🏗️</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Projects</h3>
                  <p className="text-xs sm:text-sm text-gray-700">View and manage projects</p>
                </div>
              </div>
            </Link>

            <Link
              href="/dashboard/stock"
              className="p-3 sm:p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 active:border-purple-600 hover:bg-purple-50 active:bg-purple-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">📊</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Stock Tracking</h3>
                  <p className="text-xs sm:text-sm text-gray-700">Monitor inventory levels</p>
                </div>
              </div>
            </Link>

            <Link
              href="/categories"
              className="p-3 sm:p-4 border-2 border-cyan-200 rounded-lg hover:border-cyan-500 active:border-cyan-600 hover:bg-cyan-50 active:bg-cyan-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">📁</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Categories</h3>
                  <p className="text-xs sm:text-sm text-gray-700">Manage material categories</p>
                </div>
              </div>
            </Link>

            <Link
              href="/floors"
              className="p-3 sm:p-4 border-2 border-pink-200 rounded-lg hover:border-pink-500 active:border-pink-600 hover:bg-pink-50 active:bg-pink-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">🏢</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Floors</h3>
                  <p className="text-xs sm:text-sm text-gray-700">Manage floor details</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Reports Section */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Reports</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Link
              href="/dashboard/budget"
              className="p-3 sm:p-4 border-2 border-emerald-200 rounded-lg hover:border-emerald-500 active:border-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-xl sm:text-2xl flex-shrink-0">💵</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Budget vs Actual</h3>
                  <p className="text-xs sm:text-sm text-gray-700">Compare budget to spending</p>
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
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Wastage Analytics</h3>
                  <p className="text-xs sm:text-sm text-gray-700">View variance and wastage reports</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

