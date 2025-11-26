/**
 * Owner Dashboard
 * Executive summary with full access to all features
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingCard } from '@/components/loading';

export default function OwnerDashboard() {
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [wastageSummary, setWastageSummary] = useState(null);
  const [readyToOrderCount, setReadyToOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        const [userResponse, summaryResponse, wastageResponse, readyToOrderResponse] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/dashboard/summary'),
          fetch('/api/discrepancies/widget-summary'),
          fetch('/api/material-requests?status=ready_to_order&limit=0'),
        ]);

        const userData = await userResponse.json();
        const summaryData = await summaryResponse.json();
        const wastageData = await wastageResponse.json();
        const readyToOrderData = await readyToOrderResponse.json();

        if (!userData.success) {
          router.push('/auth/login');
          return;
        }

        setUser(userData.data);
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
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

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

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Owner Dashboard</h1>
          <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Welcome back, {user.firstName || user.email}!</p>
        </div>

        {/* Summary Cards */}
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
                Expenses: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(summary.totalExpensesCost || 0)}
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
              <p className="text-sm text-gray-700 mt-1 leading-normal">
                {summary.capital ? (
                  <>
                    Raised: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(summary.capital.raised || 0)} | 
                    Used: {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(summary.capital.used || 0)}
                  </>
                ) : (
                  'Click to view financing dashboard'
                )}
              </p>
            </Link>
          </div>
        )}

        {/* Daily Tasks - Priority Section */}
        {readyToOrderCount > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Tasks</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {summary && summary.recentActivity && summary.recentActivity.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">Recent Activity</h2>
            <div className="space-y-3">
              {summary.recentActivity.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-base font-medium text-gray-900 leading-normal">
                      {activity.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-sm text-gray-700 mt-1 leading-normal">
                      {activity.entityType} • {new Date(activity.timestamp).toLocaleString('en-KE')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Financial Management Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">Financial Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/financing"
              className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">💰</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Financing Dashboard</h3>
                  <p className="text-base text-gray-700 leading-normal">View capital and finances</p>
                </div>
              </div>
            </Link>

            <Link
              href="/investors"
              className="p-4 border-2 border-teal-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">👥</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Investors</h3>
                  <p className="text-base text-gray-700 leading-normal">Manage investors</p>
                </div>
              </div>
            </Link>

            <Link
              href="/dashboard/budget"
              className="p-4 border-2 border-emerald-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">💵</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Budget vs Actual</h3>
                  <p className="text-base text-gray-700 leading-normal">Compare budget to spending</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* User Management Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">User Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/dashboard/users"
              className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">👥</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Manage Users</h3>
                  <p className="text-base text-gray-700 leading-normal">View and manage all users</p>
                </div>
              </div>
            </Link>

            <Link
              href="/dashboard/users/invite"
              className="p-4 border-2 border-blue-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">✉️</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Invite User</h3>
                  <p className="text-base text-gray-700 leading-normal">Invite new users to the system</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Operations Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">Operations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/items/new"
              className="p-4 border-2 border-blue-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">📦</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Add Material</h3>
                  <p className="text-base text-gray-700 leading-normal">Create new material entry</p>
                </div>
              </div>
            </Link>

            <Link
              href="/dashboard/approvals"
              className="p-4 border-2 border-yellow-200 rounded-lg hover:border-yellow-500 hover:bg-yellow-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">✅</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Approval Queue</h3>
                  <p className="text-sm text-gray-700">Review pending approvals</p>
                  {summary && summary.totalPendingApprovals > 0 && (
                    <p className="text-xs text-yellow-600 font-medium mt-1">
                      {summary.totalPendingApprovals} pending
                    </p>
                  )}
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
          </div>
        </div>

        {/* Wastage Summary Widget */}
        {wastageSummary && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-lg shadow-lg p-6 mb-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Wastage & Loss Alert</h2>
                <p className="text-sm text-gray-700 mt-1">Critical discrepancies requiring attention</p>
              </div>
              <Link
                href="/dashboard/analytics/wastage"
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
              >
                View Full Analytics →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border border-red-200">
                <p className="text-sm font-semibold text-gray-700 mb-1 leading-normal">Critical Issues</p>
                <p className="text-2xl font-bold text-red-600">{wastageSummary.summary.totalCritical || 0}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-orange-200">
                <p className="text-sm font-semibold text-gray-700 mb-1 leading-normal">High Severity</p>
                <p className="text-2xl font-bold text-orange-600">{wastageSummary.summary.totalHigh || 0}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-yellow-200">
                <p className="text-sm font-semibold text-gray-700 mb-1 leading-normal">Materials with Issues</p>
                <p className="text-2xl font-bold text-yellow-600">{wastageSummary.summary.totalMaterialsWithIssues || 0}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-red-200">
                <p className="text-sm font-semibold text-gray-700 mb-1 leading-normal">Total Cost Impact</p>
                <p className="text-lg font-bold text-red-600">
                  {new Intl.NumberFormat('en-KE', {
                    style: 'currency',
                    currency: 'KES',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(wastageSummary.summary.totalDiscrepancyCost || 0)}
                </p>
              </div>
            </div>
            {wastageSummary.projectSummaries && wastageSummary.projectSummaries.length > 0 && (
              <div className="mt-4 pt-4 border-t border-red-200">
                <p className="text-base font-semibold text-gray-700 mb-2 leading-normal">Top Projects with Issues:</p>
                <div className="flex flex-wrap gap-2">
                  {wastageSummary.projectSummaries.slice(0, 3).map((project) => (
                    <Link
                      key={project.projectId}
                      href={`/dashboard/analytics/wastage?projectId=${project.projectId}`}
                      className="px-3 py-1 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition text-sm"
                    >
                      {project.projectName} ({project.critical} critical)
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Analytics Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Analytics & Reports</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              href="/dashboard/budget"
              className="p-4 border-2 border-emerald-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">💵</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Budget Reports</h3>
                  <p className="text-sm text-gray-700">Detailed budget analysis</p>
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

