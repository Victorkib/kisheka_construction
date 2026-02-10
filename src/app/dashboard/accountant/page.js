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
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Accountant Dashboard</h1>
            {user && (
              <p className="text-gray-700 mt-2">Welcome, {user.firstName || user.email}!</p>
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
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Accountant Dashboard</h1>
          <p className="text-gray-700 mt-2">Welcome back, {user.firstName || user.email}!</p>
        </div>

        {/* Financial Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-2 leading-normal">Total Cost</h2>
              <p className="text-3xl font-bold text-green-600">
                {new Intl.NumberFormat('en-KE', {
                  style: 'currency',
                  currency: 'KES',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(summary.totalOverallCost || 0)}
              </p>
              <p className="text-sm text-gray-700 mt-1 leading-normal">
                Materials: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(summary.totalMaterialsCost || 0)} | 
                Expenses: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(summary.totalExpensesCost || 0)} | 
                Labour: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(summary.totalLabourCost || 0)}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-2 leading-normal">Pending Approvals</h2>
              <p className="text-3xl font-bold text-yellow-600">{summary.totalPendingApprovals || 0}</p>
              {summary.totalPendingApprovals > 0 && (
                <p className="text-sm text-gray-700 mt-1 leading-normal">
                  {summary.pendingBreakdown?.materials || 0} materials, {summary.pendingBreakdown?.expenses || 0} expenses, {summary.pendingBreakdown?.initialExpenses || 0} initial
                </p>
              )}
            </div>

            <Link
              href="/financing"
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition col-span-2"
            >
              <h2 className="text-base font-semibold text-gray-700 mb-2 leading-normal">Financing Dashboard</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-700">Capital Raised</p>
                  <p className="text-xl font-bold text-purple-600 mt-1">
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
                  <p className="text-sm text-gray-700">Capital Balance</p>
                  <p className="text-xl font-bold text-blue-600 mt-1">
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
              <p className="text-sm text-gray-700 mt-2 leading-normal">Click to view full financing dashboard</p>
            </Link>
          </div>
        )}

        {/* Approval Queue - Priority Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Approval Queue</h2>
          <div className="mb-4">
            <Link
              href="/dashboard/approvals"
              className="inline-flex items-center px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
            >
              <span className="text-2xl mr-3">✅</span>
              <div className="text-left">
                <div className="font-semibold">Review Pending Approvals</div>
                {summary && summary.totalPendingApprovals > 0 && (
                  <div className="text-sm opacity-90">
                    {summary.totalPendingApprovals} items awaiting approval
                  </div>
                )}
              </div>
            </Link>
          </div>
        </div>

        {/* Financial Management Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/financing"
              className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">💰</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Financing Dashboard</h3>
                  <p className="text-sm text-gray-700">View capital and finances</p>
                </div>
              </div>
            </Link>

            <Link
              href="/initial-expenses"
              className="p-4 border-2 border-orange-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">🏛️</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Initial Expenses</h3>
                  <p className="text-sm text-gray-700">Track pre-construction costs</p>
                </div>
              </div>
            </Link>

            <Link
              href="/expenses"
              className="p-4 border-2 border-red-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">💸</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Expenses</h3>
                  <p className="text-sm text-gray-700">View and manage expenses</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Reports & Analytics Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Reports & Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/dashboard/budget"
              className="p-4 border-2 border-emerald-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">💵</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Budget vs Actual</h3>
                  <p className="text-sm text-gray-700">Compare budget to spending</p>
                </div>
              </div>
            </Link>

            <Link
              href="/dashboard/analytics/wastage"
              className="p-4 border-2 border-amber-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">📈</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Wastage Analytics</h3>
                  <p className="text-sm text-gray-700">View variance and wastage reports</p>
                </div>
              </div>
            </Link>

            <Link
              href="/dashboard/stock"
              className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">📊</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Stock Tracking</h3>
                  <p className="text-sm text-gray-700">Monitor inventory levels</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

