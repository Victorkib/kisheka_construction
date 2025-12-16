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

  const handleFilterChange = useCallback((key, value) => {
    // Update URL - the useEffect will sync the filters state from URL
    const currentStatus = key === 'status' ? value : filters.status;
    const currentSearch = key === 'search' ? value : filters.search;
    
    const params = new URLSearchParams();
    if (currentStatus) params.set('status', currentStatus);
    if (currentSearch) params.set('search', currentSearch);
    
    router.push(`/projects?${params.toString()}`);
  }, [router, filters.status, filters.search]);

  const getStatusBadgeColor = (status) => {
    const colors = {
      planning: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-purple-100 text-purple-800',
      archived: 'bg-gray-100 text-gray-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Projects</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Manage construction projects</p>
          </div>
          {canCreate && (
            <Link
              href="/projects/new"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
            >
              + Create Project
            </Link>
          )}
        </div>

        {/* Summary Stats - Moved to top for quick reference */}
        {!loading && projects.length > 0 && (
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <p className="text-sm font-medium text-gray-600">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{projects.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <p className="text-sm font-medium text-gray-600">Active Projects</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {projects.filter((p) => p.status === 'active').length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
              <p className="text-sm font-medium text-gray-600">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(projects.reduce((sum, p) => sum + (p.budget?.total || 0), 0))}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
              <p className="text-sm font-medium text-gray-600">In Planning</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {projects.filter((p) => p.status === 'planning').length}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Search</label>
              <input
                type="text"
                placeholder="Search by name, code, or location..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Projects Table */}
        {loading ? (
          <LoadingTable rows={8} columns={8} showHeader={true} />
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">🏗️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-600 mb-6">
              {filters.search || filters.status
                ? 'Try adjusting your filters'
                : 'Get started by creating your first project'}
            </p>
            {canCreate && (
              <Link
                href="/projects/new"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
              >
                Create First Project
              </Link>
            )}
            {!canCreate && (
              <p className="text-sm text-gray-500">
                Contact a Project Manager or Owner to create a project
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Budget
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Financing
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {projects.map((project) => {
                      const totalInvested = project.statistics?.totalInvested || 0;
                      const capitalBalance = project.statistics?.capitalBalance || 0;
                      const availableCapital = capitalBalance;
                      const totalUsed = totalInvested - capitalBalance;
                      const usagePercentage = totalInvested > 0 ? (totalUsed / totalInvested) * 100 : 0;
                      
                      let capitalStatusColor = 'bg-green-100 text-green-800';
                      let capitalStatusText = 'Capital OK';
                      
                      if (totalInvested === 0) {
                        capitalStatusColor = 'bg-red-100 text-red-800';
                        capitalStatusText = 'No Capital';
                      } else if (availableCapital < 0) {
                        capitalStatusColor = 'bg-red-100 text-red-800';
                        capitalStatusText = 'Negative';
                      } else if (usagePercentage > 80) {
                        capitalStatusColor = 'bg-yellow-100 text-yellow-800';
                        capitalStatusText = 'Low Capital';
                      }

                      return (
                        <tr key={project._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <Link
                                href={`/projects/${project._id}`}
                                className="text-sm font-semibold text-gray-900 hover:text-blue-600"
                              >
                                {project.projectName}
                              </Link>
                              <p className="text-xs text-gray-500 mt-0.5">{project.projectCode}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                                project.status
                              )}`}
                            >
                              {project.status || 'planning'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(project.budget?.total || 0)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {project.statistics?.totalInvested !== undefined ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    {formatCurrency(project.statistics.totalInvested)}
                                  </span>
                                  <span 
                                    className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${capitalStatusColor}`}
                                    title={`Capital: ${formatCurrency(totalInvested)}, Available: ${formatCurrency(availableCapital)}`}
                                  >
                                    {capitalStatusText}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600">
                                  Balance: {formatCurrency(project.statistics.capitalBalance || 0)}
                                </div>
                                {project.statistics.budgetVsCapitalWarning && (
                                  <div className="text-xs text-yellow-600 flex items-center gap-1" title={project.statistics.budgetVsCapitalWarning}>
                                    <span>⚠️</span>
                                    <span>Budget exceeds capital</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">No financing</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-900">{project.location || 'N/A'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              href={`/projects/${project._id}`}
                              className="text-blue-600 hover:text-blue-900 font-medium"
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
                const usagePercentage = totalInvested > 0 ? (totalUsed / totalInvested) * 100 : 0;
                
                let capitalStatusColor = 'bg-green-100 text-green-800';
                let capitalStatusText = 'Capital OK';
                
                if (totalInvested === 0) {
                  capitalStatusColor = 'bg-red-100 text-red-800';
                  capitalStatusText = 'No Capital';
                } else if (availableCapital < 0) {
                  capitalStatusColor = 'bg-red-100 text-red-800';
                  capitalStatusText = 'Negative';
                } else if (usagePercentage > 80) {
                  capitalStatusColor = 'bg-yellow-100 text-yellow-800';
                  capitalStatusText = 'Low Capital';
                }

                return (
                  <div key={project._id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <Link
                          href={`/projects/${project._id}`}
                          className="text-base font-semibold text-gray-900 hover:text-blue-600 block"
                        >
                          {project.projectName}
                        </Link>
                        <p className="text-sm text-gray-500 mt-0.5">{project.projectCode}</p>
                      </div>
                      <span
                        className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                          project.status
                        )}`}
                      >
                        {project.status || 'planning'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-gray-500">Budget</p>
                        <p className="text-sm font-medium text-gray-900 mt-0.5">
                          {formatCurrency(project.budget?.total || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Location</p>
                        <p className="text-sm font-medium text-gray-900 mt-0.5">
                          {project.location || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {project.statistics?.totalInvested !== undefined && (
                      <div className="border-t border-gray-200 pt-3 mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-gray-500">Financing</p>
                          <span 
                            className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${capitalStatusColor}`}
                            title={`Capital: ${formatCurrency(totalInvested)}, Available: ${formatCurrency(availableCapital)}`}
                          >
                            {capitalStatusText}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-600">Capital Raised</span>
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(project.statistics.totalInvested)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-600">Balance</span>
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(project.statistics.capitalBalance || 0)}
                            </span>
                          </div>
                          {project.statistics.budgetVsCapitalWarning && (
                            <div className="text-xs text-yellow-600 flex items-center gap-1 mt-1" title={project.statistics.budgetVsCapitalWarning}>
                              <span>⚠️</span>
                              <span>Budget exceeds capital</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <Link
                        href={`/projects/${project._id}`}
                        className="block text-center text-sm font-medium text-blue-600 hover:text-blue-900 py-2"
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

