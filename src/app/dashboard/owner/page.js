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
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import { NoProjectsEmptyState, ErrorState } from '@/components/empty-states';
import { fetchNoCache } from '@/lib/fetch-helpers';

export default function OwnerDashboard() {
  const { currentProject, accessibleProjects, switchProject, isEmpty } =
    useProjectContext();
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [wastageSummary, setWastageSummary] = useState(null);
  const [readyToOrderCount, setReadyToOrderCount] = useState(0);
  const [phaseOverview, setPhaseOverview] = useState(null);
  const [loadingPhaseOverview, setLoadingPhaseOverview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userError, setUserError] = useState(null);
  const router = useRouter();

  const selectedProjectId = normalizeProjectId(currentProject?._id) || null;

  useEffect(() => {
    async function fetchData() {
      // Always fetch user data, even if empty state
      // This ensures user is available for empty state display
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

        // Don't fetch other data if no project selected or if empty state
        if (!currentProject || isEmpty) {
          setLoading(false);
          return;
        }

        const projectId = normalizeProjectId(currentProject._id);
        const projectIdParam = projectId ? `?projectId=${projectId}` : '';

        const [summaryResponse, wastageResponse, readyToOrderResponse] =
          await Promise.all([
            fetchNoCache(`/api/dashboard/summary${projectIdParam}`),
            fetchNoCache(`/api/discrepancies/widget-summary${projectIdParam}`),
            fetchNoCache(
              `/api/material-requests?status=ready_to_order&limit=0${projectId ? `&projectId=${projectId}` : ''}`,
            ),
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
          const count =
            readyToOrderData.data?.pagination?.total ||
            readyToOrderData.data?.requests?.length ||
            0;
          setReadyToOrderCount(count);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setUserError(
          'Network error. Please check your connection and try again.',
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router, currentProject, isEmpty]);

  // Fetch phase overview when project is selected or changes
  useEffect(() => {
    if (selectedProjectId) {
      fetchPhaseOverview(selectedProjectId);
    } else {
      setPhaseOverview(null);
    }
  }, [selectedProjectId]);

  const fetchPhaseOverview = async (projectId) => {
    setLoadingPhaseOverview(true);
    try {
      const response = await fetchNoCache(
        `/api/projects/${projectId}/phase-financial-overview`,
      );
      const data = await response.json();
      if (data.success) {
        setPhaseOverview(data.data);
      }
    } catch (error) {
      console.error('Error fetching phase overview:', error);
    } finally {
      setLoadingPhaseOverview(false);
    }
  };

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
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
              Owner Dashboard
            </h1>
            {user && (
              <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">
                Welcome, {user.firstName || user.email}!
              </p>
            )}
          </div>

          {/* Empty State - No Projects */}
          <NoProjectsEmptyState
            canCreate={true}
            userName={user?.firstName || user?.email}
            role="owner"
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Loading User Data
              </h2>
              <p className="text-lg text-gray-700 mb-6">
                Please wait while we load your information...
              </p>
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
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
            Owner Dashboard
          </h1>
          <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">
            Welcome back, {user.firstName || user.email}!
          </p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-2 leading-normal">
                Total Projects
              </h2>
              <p className="text-3xl font-bold text-blue-600">
                {summary.totalProjects || 0}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-2 leading-normal">
                Total Cost
              </h2>
              <p className="text-3xl font-bold text-green-600">
                {new Intl.NumberFormat('en-KE', {
                  style: 'currency',
                  currency: 'KES',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(summary.totalOverallCost || 0)}
              </p>
              <p className="text-sm text-gray-700 mt-1 leading-normal">
                Materials:{' '}
                {new Intl.NumberFormat('en-KE', {
                  style: 'currency',
                  currency: 'KES',
                  minimumFractionDigits: 0,
                }).format(summary.totalMaterialsCost || 0)}{' '}
                | Expenses:{' '}
                {new Intl.NumberFormat('en-KE', {
                  style: 'currency',
                  currency: 'KES',
                  minimumFractionDigits: 0,
                }).format(summary.totalExpensesCost || 0)}{' '}
                | Labour:{' '}
                {new Intl.NumberFormat('en-KE', {
                  style: 'currency',
                  currency: 'KES',
                  minimumFractionDigits: 0,
                }).format(summary.totalLabourCost || 0)}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-base font-semibold text-gray-700 mb-2 leading-normal">
                Pending Approvals
              </h2>
              <p className="text-3xl font-bold text-yellow-600">
                {summary.totalPendingApprovals || 0}
              </p>
              {summary.totalPendingApprovals > 0 && (
                <p className="text-sm text-gray-700 mt-1 leading-normal">
                  {summary.pendingBreakdown?.materials || 0} materials,{' '}
                  {summary.pendingBreakdown?.expenses || 0} expenses,{' '}
                  {summary.pendingBreakdown?.initialExpenses || 0} initial
                </p>
              )}
            </div>

            <Link
              href="/financing"
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
            >
              <h2 className="text-base font-semibold text-gray-700 mb-2 leading-normal">
                Financing
              </h2>
              <p className="text-3xl font-bold text-purple-600">
                {summary.capital
                  ? new Intl.NumberFormat('en-KE', {
                      style: 'currency',
                      currency: 'KES',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(summary.capital.balance || 0)
                  : 'View Details'}
              </p>
              <p className="text-sm text-gray-700 mt-1 leading-normal">
                {summary.capital ? (
                  <>
                    Raised:{' '}
                    {new Intl.NumberFormat('en-KE', {
                      style: 'currency',
                      currency: 'KES',
                      minimumFractionDigits: 0,
                    }).format(summary.capital.raised || 0)}{' '}
                    | Used:{' '}
                    {new Intl.NumberFormat('en-KE', {
                      style: 'currency',
                      currency: 'KES',
                      minimumFractionDigits: 0,
                    }).format(summary.capital.used || 0)}
                  </>
                ) : (
                  'Click to view financing dashboard'
                )}
              </p>
            </Link>
          </div>
        )}

        {/* Phase-Based Financial Overview */}
        {currentProject && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
                  Phase Financial Overview
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {currentProject.projectName} ({currentProject.projectCode})
                </p>
              </div>
              {accessibleProjects.length > 1 && (
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      switchProject(e.target.value);
                    }
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {accessibleProjects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.projectName || project.projectCode}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {loadingPhaseOverview ? (
              <div className="text-center py-8">
                <LoadingSpinner />
                <p className="text-gray-600 mt-2">
                  Loading phase financial data...
                </p>
              </div>
            ) : phaseOverview ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">
                      Total Budget
                    </h3>
                    <p className="text-2xl font-bold text-blue-600">
                      {new Intl.NumberFormat('en-KE', {
                        style: 'currency',
                        currency: 'KES',
                        minimumFractionDigits: 0,
                      }).format(phaseOverview.summary?.totalBudget || 0)}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">
                      Total Spent
                    </h3>
                    <p className="text-2xl font-bold text-green-600">
                      {new Intl.NumberFormat('en-KE', {
                        style: 'currency',
                        currency: 'KES',
                        minimumFractionDigits: 0,
                      }).format(phaseOverview.summary?.totalSpent || 0)}
                    </p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">
                      Committed
                    </h3>
                    <p className="text-2xl font-bold text-yellow-600">
                      {new Intl.NumberFormat('en-KE', {
                        style: 'currency',
                        currency: 'KES',
                        minimumFractionDigits: 0,
                      }).format(phaseOverview.summary?.totalCommitted || 0)}
                    </p>
                  </div>
                  <div
                    className={`rounded-lg p-4 ${(phaseOverview.summary?.overallVariancePercentage || 0) > 0 ? 'bg-red-50' : 'bg-gray-50'}`}
                  >
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">
                      Variance
                    </h3>
                    <p
                      className={`text-2xl font-bold ${(phaseOverview.summary?.overallVariancePercentage || 0) > 0 ? 'text-red-600' : 'text-gray-600'}`}
                    >
                      {phaseOverview.summary?.overallVariancePercentage > 0
                        ? '+'
                        : ''}
                      {phaseOverview.summary?.overallVariancePercentage || 0}%
                    </p>
                  </div>
                </div>

                {/* Risk Indicators */}
                {phaseOverview.riskIndicators &&
                  phaseOverview.riskIndicators.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                        ⚠️ Risk Indicators
                      </h3>
                      <ul className="space-y-2">
                        {phaseOverview.riskIndicators
                          .slice(0, 3)
                          .map((risk, idx) => (
                            <li key={idx} className="text-sm text-yellow-800">
                              • {risk.message}
                            </li>
                          ))}
                      </ul>
                      {phaseOverview.riskIndicators.length > 3 && (
                        <p className="text-xs text-yellow-700 mt-2">
                          +{phaseOverview.riskIndicators.length - 3} more risk
                          indicator(s)
                        </p>
                      )}
                    </div>
                  )}

                {/* Phase List */}
                {phaseOverview.phases && phaseOverview.phases.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Phases
                    </h3>
                    <div className="space-y-3">
                      {phaseOverview.phases.map((phase) => {
                        const variance =
                          phase.financialSummary?.variancePercentage || 0;
                        const utilization =
                          phase.financialSummary?.utilizationPercentage || 0;
                        return (
                          <Link
                            key={phase.id}
                            href={`/phases/${phase.id}`}
                            className="block p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="font-semibold text-gray-900">
                                    {phase.name}
                                  </h4>
                                  <span
                                    className={`px-2 py-1 text-xs rounded-full ${
                                      phase.status === 'completed'
                                        ? 'bg-green-100 text-green-800'
                                        : phase.status === 'in_progress'
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {phase.status.replace('_', ' ')}
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-600">
                                      Budget:{' '}
                                    </span>
                                    <span className="font-medium">
                                      {new Intl.NumberFormat('en-KE', {
                                        style: 'currency',
                                        currency: 'KES',
                                        minimumFractionDigits: 0,
                                      }).format(phase.budget?.total || 0)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">
                                      Spent:{' '}
                                    </span>
                                    <span className="font-medium">
                                      {new Intl.NumberFormat('en-KE', {
                                        style: 'currency',
                                        currency: 'KES',
                                        minimumFractionDigits: 0,
                                      }).format(phase.actual?.total || 0)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">
                                      Progress:{' '}
                                    </span>
                                    <span className="font-medium">
                                      {phase.completionPercentage || 0}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="ml-4 text-right">
                                <div
                                  className={`text-lg font-bold ${variance > 0 ? 'text-red-600' : variance < 0 ? 'text-green-600' : 'text-gray-600'}`}
                                >
                                  {variance > 0 ? '+' : ''}
                                  {variance.toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-600">
                                  variance
                                </div>
                              </div>
                            </div>
                            {utilization > 80 &&
                              phase.status !== 'completed' && (
                                <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                                  ⚠️ {utilization.toFixed(1)}% of budget
                                  utilized
                                </div>
                              )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Forecast Section */}
                {phaseOverview.forecast && phaseOverview.forecast.summary && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-purple-900 mb-2">
                      📊 Cost Forecast
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-purple-700">
                          Projected Total:{' '}
                        </span>
                        <span className="font-bold text-purple-900">
                          {new Intl.NumberFormat('en-KE', {
                            style: 'currency',
                            currency: 'KES',
                            minimumFractionDigits: 0,
                          }).format(
                            phaseOverview.forecast.summary.totalForecasted || 0,
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-purple-700">
                          Forecast Variance:{' '}
                        </span>
                        <span
                          className={`font-bold ${(phaseOverview.forecast.summary.totalVariancePercentage || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}
                        >
                          {(phaseOverview.forecast.summary
                            .totalVariancePercentage || 0) > 0
                            ? '+'
                            : ''}
                          {(
                            phaseOverview.forecast.summary
                              .totalVariancePercentage || 0
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                    </div>
                    {phaseOverview.forecast.summary.overallRisk === 'high' && (
                      <p className="text-sm text-red-700 mt-2 font-semibold">
                        ⚠️ High risk: Forecast indicates high budget variance
                        risk
                      </p>
                    )}
                  </div>
                )}

                <div className="text-center">
                  <Link
                    href={`/phases?projectId=${selectedProjectId}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View All Phases →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-600">
                No phase data available for this project
              </div>
            )}
          </div>
        )}

        {/* Daily Tasks - Priority Section */}
        {readyToOrderCount > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Daily Tasks
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/material-requests?status=ready_to_order"
                className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">📋</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      Ready to Order
                    </h3>
                    <p className="text-sm text-gray-700">
                      Create purchase orders from approved requests
                    </p>
                    <p className="text-lg font-bold text-purple-600 mt-2">
                      {readyToOrderCount}{' '}
                      {readyToOrderCount === 1 ? 'request' : 'requests'}
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {summary &&
          summary.recentActivity &&
          summary.recentActivity.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">
                Recent Activity
              </h2>
              <div className="space-y-3">
                {summary.recentActivity.slice(0, 5).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-base font-medium text-gray-900 leading-normal">
                        {activity.action
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </p>
                      <p className="text-sm text-gray-700 mt-1 leading-normal">
                        {activity.entityType} •{' '}
                        {new Date(activity.timestamp).toLocaleString('en-KE')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Financial Management Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">
            Financial Management
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/financing"
              className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">💰</div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Financing Dashboard
                  </h3>
                  <p className="text-base text-gray-700 leading-normal">
                    View capital and finances
                  </p>
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
                  <p className="text-base text-gray-700 leading-normal">
                    Manage investors
                  </p>
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
                  <h3 className="font-semibold text-gray-900">
                    Budget vs Actual
                  </h3>
                  <p className="text-base text-gray-700 leading-normal">
                    Compare budget to spending
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* User Management Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">
            User Management
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/dashboard/users"
              className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">👥</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Manage Users</h3>
                  <p className="text-base text-gray-700 leading-normal">
                    View and manage all users
                  </p>
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
                  <p className="text-base text-gray-700 leading-normal">
                    Invite new users to the system
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Operations Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 leading-tight">
            Operations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/items/new"
              className="p-4 border-2 border-blue-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">📦</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Add Material</h3>
                  <p className="text-base text-gray-700 leading-normal">
                    Create new material entry
                  </p>
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
                  <h3 className="font-semibold text-gray-900">
                    Approval Queue
                  </h3>
                  <p className="text-sm text-gray-700">
                    Review pending approvals
                  </p>
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
                  <p className="text-sm text-gray-700">
                    View and manage projects
                  </p>
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
                <h2 className="text-xl font-bold text-gray-900">
                  Wastage & Loss Alert
                </h2>
                <p className="text-sm text-gray-700 mt-1">
                  Critical discrepancies requiring attention
                </p>
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
                <p className="text-sm font-semibold text-gray-700 mb-1 leading-normal">
                  Critical Issues
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {wastageSummary.summary.totalCritical || 0}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-orange-200">
                <p className="text-sm font-semibold text-gray-700 mb-1 leading-normal">
                  High Severity
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {wastageSummary.summary.totalHigh || 0}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-yellow-200">
                <p className="text-sm font-semibold text-gray-700 mb-1 leading-normal">
                  Materials with Issues
                </p>
                <p className="text-2xl font-bold text-yellow-600">
                  {wastageSummary.summary.totalMaterialsWithIssues || 0}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-red-200">
                <p className="text-sm font-semibold text-gray-700 mb-1 leading-normal">
                  Total Cost Impact
                </p>
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
            {wastageSummary.projectSummaries &&
              wastageSummary.projectSummaries.length > 0 && (
                <div className="mt-4 pt-4 border-t border-red-200">
                  <p className="text-base font-semibold text-gray-700 mb-2 leading-normal">
                    Top Projects with Issues:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {wastageSummary.projectSummaries
                      .slice(0, 3)
                      .map((project) => (
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Analytics & Reports
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/dashboard/analytics/wastage"
              className="p-4 border-2 border-amber-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">📈</div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Wastage Analytics
                  </h3>
                  <p className="text-sm text-gray-700">
                    View variance and wastage reports
                  </p>
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
                  <h3 className="font-semibold text-gray-900">
                    Budget Reports
                  </h3>
                  <p className="text-sm text-gray-700">
                    Detailed budget analysis
                  </p>
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
                  <h3 className="font-semibold text-gray-900">
                    Stock Tracking
                  </h3>
                  <p className="text-sm text-gray-700">
                    Monitor inventory levels
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/reports/phases"
              className="p-4 border-2 border-indigo-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">📈</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Phase Reports</h3>
                  <p className="text-sm text-gray-700">
                    Comprehensive phase analytics
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
