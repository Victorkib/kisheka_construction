/**
 * Financing Dashboard Page
 * Displays project finances overview with charts and tables
 *
 * Route: /financing
 * Auth: OWNER, INVESTOR, ACCOUNTANT
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingCard, LoadingSpinner } from '@/components/loading';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import { NoProjectsEmptyState } from '@/components/empty-states';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

function FinancingPageContent() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const {
    currentProject,
    currentProjectId,
    accessibleProjects,
    loading: projectLoading,
    isEmpty,
  } = useProjectContext();
  const [finances, setFinances] = useState(null);
  const [investors, setInvestors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Get projectId from context (prioritize current project over URL param)
  const projectIdFromContext =
    normalizeProjectId(currentProject?._id) || currentProjectId || '';
  const projectIdFromUrl = searchParams.get('projectId');
  const projectId = projectIdFromContext || projectIdFromUrl;

  const fetchFinances = async (forceRecalculate = false) => {
    try {
      if (forceRecalculate) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const queryParams = new URLSearchParams();
      if (projectId) queryParams.append('projectId', projectId);
      if (forceRecalculate) queryParams.append('forceRecalculate', 'true');

      const response = await fetch(
        `/api/project-finances?${queryParams.toString()}`,
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch project finances');
      }

      setFinances(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch finances error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchInvestors = async () => {
    try {
      if (!projectId) {
        setInvestors([]);
        return;
      }
      const response = await fetch(
        `/api/investors?projectId=${projectId}&status=ACTIVE`,
      );
      const data = await response.json();

      if (data.success) {
        setInvestors(data.data || []);
      }
    } catch (err) {
      console.error('Fetch investors error:', err);
    }
  };

  useEffect(() => {
    // Don't fetch if empty state
    if (isEmpty) {
      setLoading(false);
      setFinances(null);
      setInvestors([]);
      setProjects([]);
      return;
    }
    if (!projectId) {
      if (projectLoading) return;
      fetchProjectsOverview();
      return;
    }
    fetchFinances();
    fetchInvestors();
  }, [projectIdFromContext, projectId, isEmpty, projectLoading]);

  const fetchProjectsOverview = async () => {
    try {
      setProjectsLoading(true);
      const projectsList = accessibleProjects || [];
      const projectsWithFinances = await Promise.all(
        projectsList.map(async (project) => {
          try {
            // Fetch project-specific finances to get actual used amount
            const financesResponse = await fetch(
              `/api/project-finances?projectId=${project._id}`,
            );
            const financesData = await financesResponse.json();

            if (financesData.success) {
              return {
                ...project,
                finances: {
                  totalUsed: financesData.data.totalUsed || 0,
                  capitalBalance: financesData.data.capitalBalance || 0,
                },
              };
            }
            return project;
          } catch (err) {
            console.error(
              `Error fetching finances for project ${project._id}:`,
              err,
            );
            return project;
          }
        }),
      );
      setProjects(projectsWithFinances);
    } catch (err) {
      console.error('Fetch projects error:', err);
    } finally {
      setProjectsLoading(false);
    }
  };

  // Check empty state - no projects
  if (isEmpty && !loading && !projectsLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
              Financing Dashboard
            </h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">
              View and manage project finances
            </p>
          </div>
          <NoProjectsEmptyState canCreate={false} role="accountant" />
        </div>
      </AppLayout>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
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

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {returnTo && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-semibold">Return to bulk material request</p>
                <p className="text-xs">
                  Fund the project, then return to supplier assignment.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {projectId && (
                  <Link
                    href={`/investors?projectId=${projectId}&returnTo=${encodeURIComponent(returnTo)}`}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-blue-300 bg-white text-blue-800 hover:bg-blue-100"
                  >
                    Allocate via Investors
                  </Link>
                )}
                <Link
                  href={returnTo}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-blue-300 bg-white text-blue-800 hover:bg-blue-100"
                >
                  Back to Bulk Request
                </Link>
              </div>
            </div>
          </div>
        )}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
              Financing Dashboard
            </h1>
            <p className="mt-2 text-base md:text-lg text-gray-700 leading-relaxed">
              Overview of capital raised, used, and remaining balance
            </p>
          </div>
          <button
            onClick={() => fetchFinances(true)}
            disabled={refreshing || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Refresh financial data"
          >
            {refreshing ? (
              <>
                <span className="animate-spin">⟳</span>
                <span>Refreshing...</span>
              </>
            ) : (
              <>
                <span>⟳</span>
                <span>Refresh</span>
              </>
            )}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-base font-semibold text-gray-700 leading-normal">
              Capital Raised
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(finances?.totalInvested || 0)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-base font-semibold text-gray-700 leading-normal">
              Capital Used
            </div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {formatCurrency(finances?.totalUsed || 0)}
            </div>
            {finances?.totalInvested > 0 && (
              <div className="text-sm text-gray-700 mt-1">
                {((finances.totalUsed / finances.totalInvested) * 100).toFixed(
                  1,
                )}
                % utilized
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-base font-semibold text-gray-700 leading-normal">
              Remaining Balance
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {formatCurrency(finances?.capitalBalance || 0)}
            </div>
            {finances?.totalInvested > 0 && (
              <div className="text-sm text-gray-700 mt-1">
                {(
                  (finances.capitalBalance / finances.totalInvested) *
                  100
                ).toFixed(1)}
                % remaining
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-base font-semibold text-gray-700 leading-normal">
              Investors
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {finances?.investors?.count || 0}
            </div>
          </div>
        </div>

        {/* Warnings & Alerts */}
        {!projectId && projects.length > 0 && (
          <div className="mb-6 space-y-2">
            {(() => {
              const warnings = [];
              const totalBudget = projects.reduce(
                (sum, p) => sum + (p.budget?.total || 0),
                0,
              );
              const totalCapital = finances?.totalInvested || 0;

              if (totalBudget > totalCapital && totalCapital > 0) {
                warnings.push({
                  type: 'budget_exceeds_capital',
                  severity: 'warning',
                  message: `Total budget (${formatCurrency(totalBudget)}) exceeds total capital (${formatCurrency(totalCapital)}) by ${formatCurrency(totalBudget - totalCapital)}. Consider adjusting budgets or raising more capital.`,
                });
              }

              const lowCapitalProjects = projects.filter((p) => {
                const capitalBalance = p.statistics?.capitalBalance || 0;
                const totalInvested = p.statistics?.totalInvested || 0;
                return (
                  totalInvested > 0 &&
                  capitalBalance < totalInvested * 0.1 &&
                  capitalBalance > 0
                );
              });

              if (lowCapitalProjects.length > 0) {
                warnings.push({
                  type: 'low_capital_projects',
                  severity: 'warning',
                  message: `${lowCapitalProjects.length} project(s) have less than 10% capital remaining. Review and consider additional funding.`,
                });
              }

              const overspentProjects = projects.filter((p) => {
                const capitalBalance = p.statistics?.capitalBalance || 0;
                return capitalBalance < 0;
              });

              if (overspentProjects.length > 0) {
                warnings.push({
                  type: 'overspent_projects',
                  severity: 'error',
                  message: `${overspentProjects.length} project(s) have overspent their allocated capital. Immediate action required.`,
                });
              }

              return warnings.length > 0
                ? warnings.map((warning, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        warning.severity === 'error'
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                      }`}
                    >
                      <p className="font-semibold">
                        {warning.type.replace(/_/g, ' ').toUpperCase()}
                      </p>
                      <p className="text-sm">{warning.message}</p>
                    </div>
                  ))
                : null;
            })()}
          </div>
        )}

        {/* Budget vs Capital Comparison */}
        {!projectId && projects.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Budget vs Capital Comparison
              </h2>
              <Link
                href="/dashboard/budget"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View Budget vs Actual →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-700 font-medium">
                  Total Budget (Planning)
                </div>
                <div className="text-xl font-semibold text-gray-900 mt-1">
                  {formatCurrency(
                    projects.reduce(
                      (sum, p) => sum + (p.budget?.total || 0),
                      0,
                    ),
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-700 font-medium">
                  Total Capital (Reality)
                </div>
                <div className="text-xl font-semibold text-blue-600 mt-1">
                  {formatCurrency(finances?.totalInvested || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-700 font-medium">
                  Difference
                </div>
                <div
                  className={`text-xl font-semibold mt-1 ${
                    projects.reduce(
                      (sum, p) => sum + (p.budget?.total || 0),
                      0,
                    ) -
                      (finances?.totalInvested || 0) >
                    0
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}
                >
                  {formatCurrency(
                    projects.reduce(
                      (sum, p) => sum + (p.budget?.total || 0),
                      0,
                    ) - (finances?.totalInvested || 0),
                  )}
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  {finances?.totalInvested > 0
                    ? `${(((projects.reduce((sum, p) => sum + (p.budget?.total || 0), 0) - (finances?.totalInvested || 0)) / (finances?.totalInvested || 1)) * 100).toFixed(1)}% ${projects.reduce((sum, p) => sum + (p.budget?.total || 0), 0) - (finances?.totalInvested || 0) > 0 ? 'over' : 'under'} capital`
                    : 'No capital'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Projects Overview Table (when viewing all projects) */}
        {!projectId && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Projects Overview
              </h2>
              <Link
                href="/projects"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View All Projects →
              </Link>
            </div>
            {projectsLoading ? (
              <div className="animate-pulse">
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            ) : projects.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Budget
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Capital Raised
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Capital Used
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Remaining
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Utilization
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {projects.map((project) => {
                      const totalInvested =
                        project.statistics?.totalInvested || 0;
                      const totalUsed = project.finances?.totalUsed || 0;
                      const capitalBalance =
                        project.finances?.capitalBalance ??
                        project.statistics?.capitalBalance ??
                        totalInvested;
                      const budget = project.budget?.total || 0;

                      // Calculate utilization
                      const utilization =
                        totalInvested > 0
                          ? (totalUsed / totalInvested) * 100
                          : 0;

                      // Determine status
                      let status = 'healthy';
                      let statusColor = 'bg-green-100 text-green-800';
                      if (capitalBalance < 0) {
                        status = 'overspent';
                        statusColor = 'bg-red-100 text-red-800';
                      } else if (
                        capitalBalance < totalInvested * 0.1 &&
                        totalInvested > 0
                      ) {
                        status = 'low_capital';
                        statusColor = 'bg-yellow-100 text-yellow-800';
                      } else if (budget > totalInvested && totalInvested > 0) {
                        status = 'budget_exceeds';
                        statusColor = 'bg-orange-100 text-orange-800';
                      }

                      return (
                        <tr key={project._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <Link
                                href={`/projects/${project._id}`}
                                className="text-sm font-medium text-blue-600 hover:text-blue-900"
                              >
                                {project.projectCode}
                              </Link>
                              <div className="text-sm text-gray-700">
                                {project.projectName}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(budget)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(totalInvested)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                            {formatCurrency(totalUsed)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                            {formatCurrency(capitalBalance)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    utilization > 90
                                      ? 'bg-red-600'
                                      : utilization > 70
                                        ? 'bg-yellow-600'
                                        : 'bg-green-600'
                                  }`}
                                  style={{
                                    width: `${Math.min(utilization, 100)}%`,
                                  }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-900">
                                {utilization.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor}`}
                            >
                              {status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <Link
                              href={`/projects/${project._id}/finances`}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View Details →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-600">No projects found</p>
            )}
          </div>
        )}

        {/* Visualizations */}
        {!projectId && finances && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Capital Utilization Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Capital Utilization
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Used', value: finances.totalUsed || 0 },
                      {
                        name: 'Remaining',
                        value: finances.capitalBalance || 0,
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#ef4444" />
                    <Cell fill="#3b82f6" />
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Spending Breakdown Chart */}
            {finances.breakdown && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Spending Breakdown
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      {
                        name: 'Materials',
                        value: finances.breakdown.materials || 0,
                      },
                      {
                        name: 'Expenses',
                        value: finances.breakdown.expenses || 0,
                      },
                      {
                        name: 'Initial',
                        value: finances.breakdown.initialExpenses || 0,
                      },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Single Project View Enhancement */}
        {projectId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <p className="text-blue-800">
                <strong>Viewing project-specific financing.</strong> For
                portfolio overview,{' '}
                <Link href="/financing" className="underline font-semibold">
                  view all projects
                </Link>
                .
              </p>
              <Link
                href={`/projects/${projectId}/finances`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                View Full Financial Overview →
              </Link>
            </div>
          </div>
        )}

        {/* Breakdown */}
        {finances?.breakdown && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Expense Breakdown
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-700 font-medium">
                  Materials
                </div>
                <div className="text-xl font-semibold text-gray-900">
                  {formatCurrency(finances.breakdown.materials || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-700 font-medium">
                  Expenses
                </div>
                <div className="text-xl font-semibold text-gray-900">
                  {formatCurrency(finances.breakdown.expenses || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-700 font-medium">
                  Initial Expenses
                </div>
                <div className="text-xl font-semibold text-gray-900">
                  {formatCurrency(finances.breakdown.initialExpenses || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-700 font-medium">Total</div>
                <div className="text-xl font-semibold text-gray-900">
                  {formatCurrency(finances.breakdown.total || 0)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Investment Breakdown */}
        {finances?.investors && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Investment Breakdown
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-700 font-medium">
                  Total Invested
                </div>
                <div className="text-xl font-semibold text-gray-900">
                  {formatCurrency(finances.investors.totalInvested || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-700 font-medium">
                  Total Loans
                </div>
                <div className="text-xl font-semibold text-purple-600">
                  {formatCurrency(finances.investors.totalLoans || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-700 font-medium">
                  Total Equity
                </div>
                <div className="text-xl font-semibold text-blue-600">
                  {formatCurrency(finances.investors.totalEquity || 0)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Investors */}
        {investors.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Top Investors
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Total Invested
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {investors
                    .sort(
                      (a, b) => (b.totalInvested || 0) - (a.totalInvested || 0),
                    )
                    .slice(0, 10)
                    .map((investor) => (
                      <tr key={investor._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {investor.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {investor.investmentType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                          {formatCurrency(investor.totalInvested || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            href={`/investors/${investor._id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function FinancingPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <FinancingPageContent />
    </Suspense>
  );
}
