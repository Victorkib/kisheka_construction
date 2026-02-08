/**
 * Budget Reallocations List Page
 * Displays all budget reallocation requests with filtering
 * 
 * Route: /budget-reallocations
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingSpinner } from '@/components/loading';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';
import { usePermissions } from '@/hooks/use-permissions';
import { useProjectContext } from '@/contexts/ProjectContext';
import { NoProjectsEmptyState } from '@/components/empty-states';

function BudgetReallocationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const {
    currentProjectId,
    accessibleProjects,
    loading: projectLoading,
    isEmpty,
    switchProject,
  } = useProjectContext();
  const [reallocations, setReallocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [phases, setPhases] = useState([]);
  
  // Filters
  const [filters, setFilters] = useState({
    projectId: searchParams.get('projectId') || currentProjectId || '',
    status: searchParams.get('status') || '',
  });

  // Sync current project into filters
  useEffect(() => {
    if (currentProjectId && currentProjectId !== filters.projectId) {
      setFilters((prev) => ({ ...prev, projectId: currentProjectId }));
    }
  }, [currentProjectId, filters.projectId]);

  // Fetch reallocations when filters or page change
  useEffect(() => {
    if (isEmpty) {
      setLoading(false);
      setReallocations([]);
      return;
    }
    if (!filters.projectId) {
      if (projectLoading) return;
      setLoading(false);
      setReallocations([]);
      return;
    }
    fetchReallocations();
  }, [filters, pagination.page, isEmpty, projectLoading]);

  // Fetch phases when project is selected
  useEffect(() => {
    if (filters.projectId) {
      fetchPhases(filters.projectId);
    } else {
      setPhases([]);
    }
  }, [filters.projectId]);

  const fetchPhases = async (projectId) => {
    try {
      const response = await fetch(`/api/phases?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
      setPhases([]);
    }
  };

  const fetchReallocations = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query string
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.status && { status: filters.status }),
      });

      const response = await fetch(`/api/budget-reallocations?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch budget reallocations');
      }

      setReallocations(data.data.reallocations || []);
      setPagination(data.data.pagination || pagination);
    } catch (err) {
      setError(err.message);
      console.error('Fetch reallocations error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const updatedFilters = key === 'projectId'
      ? { ...filters, projectId: value }
      : { ...filters, [key]: value };
    setFilters(updatedFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
    if (key === 'projectId' && value && value !== currentProjectId) {
      switchProject(value).catch((err) => {
        console.error('Error switching project:', err);
      });
    }

    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/budget-reallocations?${params.toString()}`, { scroll: false });
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      executed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getReallocationTypeLabel = (type) => {
    const labels = {
      phase_to_phase: 'Phase → Phase',
      project_to_phase: 'Project → Phase',
      phase_to_project: 'Phase → Project',
    };
    return labels[type] || type;
  };

  if (isEmpty && !loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Budget Reallocations</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Manage budget transfers between phases and projects</p>
          </div>
          <NoProjectsEmptyState
            canCreate={canAccess('create_project')}
            role={canAccess('create_project') ? 'owner' : 'pm'}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Budget Reallocations</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Manage budget transfers between phases and projects</p>
          </div>
          {canAccess('create_budget_reallocation') && (
            <Link
              href="/budget-reallocations/new"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
            >
              + New Request
            </Link>
          )}
        </div>

        <PrerequisiteGuide
          title="Reallocations need budgets and approvals"
          description="Move budget between categories after the project budget is set."
          prerequisites={[
            'Project budget exists',
            'Categories are defined',
          ]}
          actions={[
            { href: '/projects', label: 'View Projects' },
            { href: '/dashboard/budget', label: 'Set Budgets' },
            { href: '/budget-reallocations/new', label: 'New Request' },
          ]}
          tip="Add clear notes to speed up approvals."
        />

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl md:text-2xl font-semibold mb-4 leading-tight">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Project</label>
              <select
                value={filters.projectId}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Projects</option>
                {accessibleProjects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectName || project.projectCode}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="executed">Executed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ projectId: '', status: '' });
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 font-medium transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Reallocations Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <LoadingTable rows={10} columns={7} showHeader={true} />
          ) : reallocations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No budget reallocation requests found</p>
              {canAccess('create_budget_reallocation') && (
                <Link
                  href="/budget-reallocations/new"
                  className="mt-4 inline-block text-blue-600 hover:text-blue-800 font-medium"
                >
                  Create your first reallocation request
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested By</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reallocations.map((reallocation) => (
                      <tr key={reallocation._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getReallocationTypeLabel(reallocation.reallocationType)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(reallocation.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {reallocation.fromPhaseId ? (
                            phases.find(p => p._id === reallocation.fromPhaseId)?.phaseName || 'Phase'
                          ) : (
                            'Project Budget'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {reallocation.toPhaseId ? (
                            phases.find(p => p._id === reallocation.toPhaseId)?.phaseName || 'Phase'
                          ) : (
                            'Project Budget'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(reallocation.status)}`}>
                            {reallocation.status.charAt(0).toUpperCase() + reallocation.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {reallocation.requestedByName || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {formatDate(reallocation.requestedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            href={`/budget-reallocations/${reallocation._id}`}
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

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                      disabled={pagination.page === pagination.pages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
                        <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
                        <span className="font-medium">{pagination.total}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                          disabled={pagination.page === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        {[...Array(pagination.pages)].map((_, i) => {
                          const page = i + 1;
                          if (page === 1 || page === pagination.pages || (page >= pagination.page - 1 && page <= pagination.page + 1)) {
                            return (
                              <button
                                key={page}
                                onClick={() => setPagination((prev) => ({ ...prev, page }))}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                  page === pagination.page
                                    ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                {page}
                              </button>
                            );
                          } else if (page === pagination.page - 2 || page === pagination.page + 2) {
                            return <span key={page} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>;
                          }
                          return null;
                        })}
                        <button
                          onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                          disabled={pagination.page === pagination.pages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function BudgetReallocationsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    }>
      <BudgetReallocationsPageContent />
    </Suspense>
  );
}



