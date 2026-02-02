/**
 * Project Manager Dashboard
 * Task-oriented dashboard with approval queue and operations focus
 */

'use client';

export const revalidate = 60;

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingCard, LoadingSpinner } from '@/components/loading';
import { useProjectContext } from '@/contexts/ProjectContext';
import { NoProjectsEmptyState, ErrorState } from '@/components/empty-states';

export default function PMDashboard() {
  const { isEmpty } = useProjectContext();
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [wastageSummary, setWastageSummary] = useState(null);
  const [readyToOrderCount, setReadyToOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userError, setUserError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      // Always fetch user data first, even if empty state
      try {
        setUserError(null);
        const userResponse = await fetch('/api/auth/me');
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
          fetch('/api/dashboard/summary'),
          fetch('/api/discrepancies/widget-summary'),
          fetch('/api/material-requests?status=ready_to_order&limit=0'),
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

  if (loading) {
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

  // Check empty state FIRST - this is critical to prevent dark screen
  if (isEmpty) {
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
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Project Manager Dashboard</h1>
          <p className="text-gray-700 mt-2">Welcome back, {user.firstName || user.email}!</p>
        </div>

        {/* Daily Tasks - Priority Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Tasks</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/dashboard/approvals"
              className="p-4 border-2 border-yellow-200 rounded-lg hover:border-yellow-500 hover:bg-yellow-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">✅</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Pending Approvals</h3>
                  <p className="text-sm text-gray-700">Review and approve items</p>
                  {summary && summary.totalPendingApprovals > 0 && (
                    <p className="text-lg font-bold text-yellow-600 mt-2">
                      {summary.totalPendingApprovals} pending
                    </p>
                  )}
                </div>
              </div>
            </Link>

            <Link
              href="/items"
              className="p-4 border-2 border-blue-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">📦</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Materials</h3>
                  <p className="text-sm text-gray-700">View and manage materials</p>
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

            {readyToOrderCount > 0 && (
              <Link
                href="/material-requests?status=ready_to_order"
                className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">📋</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Ready to Order</h3>
                    <p className="text-sm text-gray-700">Create purchase orders from approved requests</p>
                    <p className="text-lg font-bold text-purple-600 mt-2">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-2 leading-normal">Total Projects</h2>
              <p className="text-3xl font-bold text-blue-600">{summary.totalProjects || 0}</p>
            </div>

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
            </div>

            <Link
              href="/financing"
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
            >
              <h2 className="text-base font-semibold text-gray-700 mb-2 leading-normal">Financing</h2>
              <p className="text-3xl font-bold text-purple-600">
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
              <p className="text-sm text-gray-700 mt-1 leading-normal">View financing dashboard</p>
            </Link>
          </div>
        )}

        {/* Operations Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Operations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/items/new"
              className="p-4 border-2 border-blue-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">📦</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Add Material</h3>
                  <p className="text-sm text-gray-700">Create new material entry</p>
                </div>
              </div>
            </Link>

            <Link
              href="/expenses/new"
              className="p-4 border-2 border-red-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">💸</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Add Expense</h3>
                  <p className="text-sm text-gray-700">Create new expense entry</p>
                </div>
              </div>
            </Link>

            <Link
              href="/projects"
              className="p-4 border-2 border-indigo-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">🏗️</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Projects</h3>
                  <p className="text-sm text-gray-700">View and manage projects</p>
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

            <Link
              href="/categories"
              className="p-4 border-2 border-cyan-200 rounded-lg hover:border-cyan-500 hover:bg-cyan-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">📁</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Categories</h3>
                  <p className="text-sm text-gray-700">Manage material categories</p>
                </div>
              </div>
            </Link>

            <Link
              href="/floors"
              className="p-4 border-2 border-pink-200 rounded-lg hover:border-pink-500 hover:bg-pink-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">🏢</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Floors</h3>
                  <p className="text-sm text-gray-700">Manage floor details</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Reports Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Reports</h2>
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
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

