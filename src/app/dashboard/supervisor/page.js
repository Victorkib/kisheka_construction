/**
 * Supervisor Dashboard
 * View and verification dashboard for supervisors
 * Focus: View materials, expenses, projects for verification (labour logs - Phase 3)
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingCard, LoadingSpinner } from '@/components/loading';
import { useProjectContext } from '@/contexts/ProjectContext';
import { NoProjectsEmptyState, ErrorState } from '@/components/empty-states';

export default function SupervisorDashboard() {
  const { isEmpty } = useProjectContext();
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
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

        const summaryResponse = await fetch('/api/dashboard/summary');
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
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Supervisor Dashboard</h1>
            {user && (
              <p className="text-gray-600 mt-2">Welcome, {user.firstName || user.email}!</p>
            )}
          </div>

          {/* Empty State - No Projects */}
          <NoProjectsEmptyState
            canCreate={false}
            userName={user?.firstName || user?.email}
            role="supervisor"
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
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Supervisor Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back, {user.firstName || user.email}!</p>
        </div>

        {/* Overview Cards */}
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
              <h2 className="text-base font-semibold text-gray-700 mb-2 leading-normal">Approved Materials</h2>
              <p className="text-3xl font-bold text-purple-600">
                {summary.totalMaterialsCost ? 
                  new Intl.NumberFormat('en-KE', {
                    style: 'currency',
                    currency: 'KES',
                    minimumFractionDigits: 0,
                  }).format(summary.totalMaterialsCost) : '0'}
              </p>
            </div>

            {summary.capital && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-base font-semibold text-gray-700 mb-2 leading-normal">Capital Used</h2>
                <p className="text-3xl font-bold text-orange-600">
                  {new Intl.NumberFormat('en-KE', {
                    style: 'currency',
                    currency: 'KES',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(summary.capital.used || 0)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* View & Verify Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">View & Verify</h2>
          <p className="text-sm text-gray-600 mb-4">
            As a supervisor, you can view materials, expenses, and projects for verification purposes.
            Labour log approval functionality will be available in Phase 3.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/items"
              className="p-4 border-2 border-blue-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">📦</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Materials</h3>
                  <p className="text-sm text-gray-600">View all materials</p>
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
                  <p className="text-sm text-gray-600">View all expenses</p>
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
                  <p className="text-sm text-gray-600">View project details</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Information Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-md font-semibold text-blue-900 mb-2">ℹ️ Supervisor Role Information</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• You have view-only access to materials, expenses, and projects</li>
            <li>• You cannot create, edit, delete, or approve materials/expenses</li>
            <li>• Labour log approval functionality will be available in Phase 3</li>
            <li>• Contact the Project Manager or Owner for approval requests</li>
          </ul>
        </div>
      </div>
    </AppLayout>
  );
}

