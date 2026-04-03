/**
 * Projects List Page
 * Displays all projects with filtering, sorting, and project management
 *
 * Route: /projects
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingSpinner } from '@/components/loading';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';

function ProjectsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canCreate, setCanCreate] = useState(false);

  // Initialize filters from URL params only once, then sync separately
  const [filters, setFilters] = useState(() => ({
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
  }));

  // Sync filters with URL params when they change (but only if different)
  useEffect(() => {
    const urlStatus = searchParams.get('status') || '';
    const urlSearch = searchParams.get('search') || '';

    setFilters((prev) => {
      // Only update if values actually changed to prevent unnecessary re-renders
      if (prev.status !== urlStatus || prev.search !== urlSearch) {
        return {
          status: urlStatus,
          search: urlSearch,
        };
      }
      return prev; // Return same reference if unchanged
    });
  }, [searchParams]);

  // Fetch user and check permissions (only once on mount)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (data.success) {
          setUser(data.data);
          const role = data.data.role?.toLowerCase();
          setCanCreate(['owner', 'pm', 'project_manager'].includes(role));
        }
      } catch (err) {
        console.error('Fetch user error:', err);
      }
    };

    fetchUser();
  }, []);

  // Memoize fetchProjects to prevent recreation on every render
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query string
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.search) queryParams.append('search', filters.search);

      const response = await fetch(`/api/projects?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch projects');
      }

      setProjects(data.data || []);
    } catch (err) {
      setError(err.message);
      console.error('Fetch projects error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.search]); // Only depend on filter values, not the object

  // Fetch projects when user is loaded or filters change
  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user, fetchProjects]);

  const handleFilterChange = useCallback(
    (key, value) => {
      // Update URL - the useEffect will sync the filters state from URL
      const currentStatus = key === 'status' ? value : filters.status;
      const currentSearch = key === 'search' ? value : filters.search;

      const params = new URLSearchParams();
      if (currentStatus) params.set('status', currentStatus);
      if (currentSearch) params.set('search', currentSearch);

      router.push(`/projects?${params.toString()}`);
    },
    [router, filters.status, filters.search],
  );

  const getStatusBadgeColor = (status) => {
    const colors = {
      planning: 'ds-status-planning',
      active: 'ds-status-active',
      paused: 'ds-status-paused',
      completed: 'ds-status-completed',
      archived: 'ds-status-archived',
    };
    return colors[status] || 'ds-status-archived';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">
              Projects
            </h1>
            <p className="text-base md:text-lg ds-text-secondary mt-2 leading-relaxed">
              Manage construction projects
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/projects/archive"
              className="inline-flex items-center gap-2 px-4 py-2 border ds-border-subtle rounded-lg text-sm font-medium ds-text-secondary hover:ds-bg-surface-muted transition"
            >
              <span className="text-base">🗂️</span>
              Archived Projects
            </Link>
            {canCreate && (
              <Link
                href="/projects/new"
                className="ds-bg-accent-primary hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
              >
                + Create Project
              </Link>
            )}
          </div>
        </div>

        <PrerequisiteGuide
          title="Projects are the foundation"
          description="Create a project first, then add phases, budgets, and teams."
          prerequisites={[
            'Project scope and timeline are known',
            'Budget categories are planned',
          ]}
          actions={[
            { href: '/projects/new', label: 'Create Project' },
            { href: '/phases/new', label: 'Create Phase' },
            { href: '/projects', label: 'Set Budgets' },
          ]}
          tip="Add phases early to unlock assignments and reports."
        />

        {/* Summary Stats - Moved to top for quick reference */}
        {!loading && projects.length > 0 && (
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="ds-bg-surface rounded-lg shadow p-4 border-l-4 border-blue-500">
              <p className="text-sm font-medium ds-text-secondary">
                Total Projects
              </p>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {projects.length}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4 border-l-4 border-green-500">
              <p className="text-sm font-medium ds-text-secondary">
                Active Projects
              </p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {projects.filter((p) => p.status === 'active').length}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4 border-l-4 border-purple-500">
              <p className="text-sm font-medium ds-text-secondary">Total Budget</p>
              <p className="text-2xl font-bold ds-text-primary mt-1">
                {formatCurrency(
                  projects.reduce((sum, p) => sum + (p.budget?.total || 0), 0),
                )}
              </p>
            </div>
            <div className="ds-bg-surface rounded-lg shadow p-4 border-l-4 border-yellow-500">
              <p className="text-sm font-medium ds-text-secondary">In Planning</p>
              <p className="text-2xl font-bold ds-text-accent-primary mt-1">
                {projects.filter((p) => p.status === 'planning').length}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="ds-bg-surface rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">
                Search
              </label>
              <input
                type="text"
                placeholder="Search by name, code, or location..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted"
              />
            </div>
            <div>
              <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted"
              >
                <option value="">All Statuses</option>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  router.push('/projects');
                }}
                className="w-full px-4 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Projects Table */}
        {loading ? (
          <LoadingTable rows={8} columns={8} showHeader={true} />
        ) : projects.length === 0 ? (
          <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">🏗️</div>
            <h3 className="text-xl font-semibold ds-text-primary mb-2">
              No projects found
            </h3>
            <p className="ds-text-secondary mb-6">
              {filters.search || filters.status
                ? 'Try adjusting your filters'
                : 'Get started by creating your first project'}
            </p>
            {canCreate && (
              <Link
                href="/projects/new"
                className="inline-block ds-bg-accent-primary hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
              >
                Create First Project
              </Link>
            )}
            {!canCreate && (
              <p className="text-sm ds-text-muted">
                Contact a Project Manager or Owner to create a project
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block ds-bg-surface rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                        Budget
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                        Financing
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {projects.map((project) => {
                      const totalInvested =
                        project.statistics?.totalInvested || 0;
                      const capitalBalance =
                        project.statistics?.capitalBalance || 0;
                      const availableCapital = capitalBalance;
                      const totalUsed = totalInvested - capitalBalance;
                      const usagePercentage =
                        totalInvested > 0
                          ? (totalUsed / totalInvested) * 100
                          : 0;

                    let capitalStatusColor = 'ds-bg-success ds-border-success ds-text-success';
                    let capitalStatusText = 'Capital OK';

                    if (totalInvested === 0) {
                      capitalStatusColor = 'ds-bg-danger ds-border-danger ds-text-danger';
                      capitalStatusText = 'No Capital';
                    } else if (availableCapital < 0) {
                      capitalStatusColor = 'ds-bg-danger ds-border-danger ds-text-danger';
                      capitalStatusText = 'Negative';
                    } else if (usagePercentage > 80) {
                      capitalStatusColor = 'ds-bg-warning ds-border-warning ds-text-warning';
                      capitalStatusText = 'Low Capital';
                    }

                      return (
                        <tr
                          key={project._id}
                          className="hover:ds-bg-surface-muted transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div>
                              <Link
                                href={`/projects/${project._id}`}
                                className="text-sm font-semibold ds-text-primary hover:ds-text-accent-primary"
                              >
                                {project.projectName}
                              </Link>
                              <p className="text-xs ds-text-muted mt-0.5">
                                {project.projectCode}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                                project.status,
                              )}`}
                            >
                              {project.status || 'planning'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium ds-text-primary">
                              {formatCurrency(project.budget?.total || 0)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {project.statistics?.totalInvested !== undefined ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium ds-text-primary">
                                    {formatCurrency(
                                      project.statistics.totalInvested,
                                    )}
                                  </span>
                                  <span
                                    className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${capitalStatusColor}`}
                                    title={`Capital: ${formatCurrency(totalInvested)}, Available: ${formatCurrency(availableCapital)}`}
                                  >
                                    {capitalStatusText}
                                  </span>
                                </div>
                                <div className="text-xs ds-text-secondary">
                                  Balance:{' '}
                                  {formatCurrency(
                                    project.statistics.capitalBalance || 0,
                                  )}
                                </div>
                                {project.statistics.budgetVsCapitalWarning && (
                                  <div
                                    className="text-xs ds-text-warning flex items-center gap-1"
                                    title={
                                      project.statistics.budgetVsCapitalWarning
                                    }
                                  >
                                    <span>⚠️</span>
                                    <span>Budget exceeds capital</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm ds-text-muted">
                                No financing
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm ds-text-primary">
                              {project.location || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              href={`/projects/${project._id}`}
                              className="ds-text-accent-primary hover:ds-text-accent-hover font-medium"
                            >
                              View →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {projects.map((project) => {
                const totalInvested = project.statistics?.totalInvested || 0;
                const capitalBalance = project.statistics?.capitalBalance || 0;
                const availableCapital = capitalBalance;
                const totalUsed = totalInvested - capitalBalance;
                const usagePercentage =
                  totalInvested > 0 ? (totalUsed / totalInvested) * 100 : 0;

                    let capitalStatusColor = 'ds-bg-success ds-border-success ds-text-success';
                    let capitalStatusText = 'Capital OK';

                    if (totalInvested === 0) {
                      capitalStatusColor = 'ds-bg-danger ds-border-danger ds-text-danger';
                      capitalStatusText = 'No Capital';
                    } else if (availableCapital < 0) {
                      capitalStatusColor = 'ds-bg-danger ds-border-danger ds-text-danger';
                      capitalStatusText = 'Negative';
                    } else if (usagePercentage > 80) {
                      capitalStatusColor = 'ds-bg-warning ds-border-warning ds-text-warning';
                      capitalStatusText = 'Low Capital';
                    }

                return (
                  <div
                    key={project._id}
                    className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <Link
                          href={`/projects/${project._id}`}
                          className="text-base font-semibold ds-text-primary hover:ds-text-accent-primary block"
                        >
                          {project.projectName}
                        </Link>
                        <p className="text-sm ds-text-muted mt-0.5">
                          {project.projectCode}
                        </p>
                      </div>
                      <span
                        className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                          project.status,
                        )}`}
                      >
                        {project.status || 'planning'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs ds-text-muted">Budget</p>
                        <p className="text-sm font-medium ds-text-primary mt-0.5">
                          {formatCurrency(project.budget?.total || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs ds-text-muted">Location</p>
                        <p className="text-sm font-medium ds-text-primary mt-0.5">
                          {project.location || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {project.statistics?.totalInvested !== undefined && (
                      <div className="border-t ds-border-subtle pt-3 mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs ds-text-muted">Financing</p>
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${capitalStatusColor}`}
                            title={`Capital: ${formatCurrency(totalInvested)}, Available: ${formatCurrency(availableCapital)}`}
                          >
                            {capitalStatusText}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-xs ds-text-secondary">
                              Capital Raised
                            </span>
                            <span className="text-sm font-medium ds-text-primary">
                              {formatCurrency(project.statistics.totalInvested)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs ds-text-secondary">
                              Balance
                            </span>
                            <span className="text-sm font-medium ds-text-primary">
                              {formatCurrency(
                                project.statistics.capitalBalance || 0,
                              )}
                            </span>
                          </div>
                          {project.statistics.budgetVsCapitalWarning && (
                            <div
                              className="text-xs ds-text-warning flex items-center gap-1 mt-1"
                              title={project.statistics.budgetVsCapitalWarning}
                            >
                              <span>⚠️</span>
                              <span>Budget exceeds capital</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t ds-border-subtle">
                      <Link
                        href={`/projects/${project._id}`}
                        className="block text-center text-sm font-medium ds-text-accent-primary hover:ds-text-accent-hover py-2"
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LoadingTable rows={8} columns={8} showHeader={true} />
          </div>
        </AppLayout>
      }
    >
      <ProjectsPageContent />
    </Suspense>
  );
}
