/**
 * Labour Batches List Page
 * Displays all labour batches with filtering, sorting, and pagination
 * 
 * Route: /labour/batches
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingSpinner } from '@/components/loading';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast/toast-container';
import { Plus, Search, Filter, Calendar, Users, Clock, DollarSign } from 'lucide-react';
import { useProjectContext } from '@/contexts/ProjectContext';
import { NoProjectsEmptyState } from '@/components/empty-states';

function LabourBatchesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const {
    currentProjectId,
    accessibleProjects,
    loading: projectLoading,
    isEmpty,
    switchProject,
  } = useProjectContext();

  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [filters, setFilters] = useState({
    projectId: searchParams.get('projectId') || currentProjectId || '',
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
  });

  // Sync current project into filters
  useEffect(() => {
    if (currentProjectId && currentProjectId !== filters.projectId) {
      setFilters((prev) => ({ ...prev, projectId: currentProjectId }));
    }
  }, [currentProjectId, filters.projectId]);

  // Fetch batches when filters or page changes
  useEffect(() => {
    if (isEmpty) {
      setLoading(false);
      setBatches([]);
      return;
    }
    if (!filters.projectId) {
      if (projectLoading) return;
      setLoading(false);
      setBatches([]);
      return;
    }
    fetchBatches();
  }, [filters, pagination.page, isEmpty, projectLoading]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.status) params.append('status', filters.status);
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());

      const response = await fetch(`/api/labour/batches?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch batches');
      }

      setBatches(data.data.batches || []);
      setPagination((prev) => ({
        ...prev,
        total: data.data.pagination?.total || 0,
        totalPages: data.data.pagination?.totalPages || 0,
      }));
    } catch (err) {
      setError(err.message);
      console.error('Fetch batches error:', err);
      toast.showError(err.message || 'Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const updatedFilters = key === 'projectId'
      ? { ...filters, projectId: value }
      : { ...filters, [key]: value };
    setFilters(updatedFilters);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page
    if (key === 'projectId' && value && value !== currentProjectId) {
      switchProject(value).catch((err) => {
        console.error('Error switching project:', err);
      });
    }

    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/labour/batches?${params.toString()}`, { scroll: false });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchBatches();
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'KES 0';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
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

  const getStatusBadgeColor = (status) => {
    const colors = {
      draft: 'ds-bg-surface-muted ds-text-primary',
      submitted: 'bg-blue-100 text-blue-800',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'ds-bg-surface-muted ds-text-primary';
  };

  const getProjectName = (projectId) => {
    if (!projectId) return 'N/A';
    const project = accessibleProjects.find((p) => p._id === projectId);
    return project ? `${project.projectCode} - ${project.projectName}` : 'Unknown Project';
  };

  if (isEmpty && !loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold ds-text-primary">Labour Batches</h1>
            <p className="ds-text-secondary mt-1">View and manage all labour batches</p>
          </div>
          <NoProjectsEmptyState />
        </div>
      </AppLayout>
    );
  }

  if (loading && batches.length === 0) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <LoadingTable rows={10} columns={7} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold ds-text-primary">Labour Batches</h1>
              <p className="ds-text-secondary mt-1">View and manage all labour batches</p>
            </div>
            {canAccess('create_labour_batch') && (
              <Link
                href="/labour/batches/new"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Batch
              </Link>
            )}
          </div>

          <PrerequisiteGuide
            title="Batches organize multiple labour entries"
            description="Create batches after workers and project phases are defined."
            prerequisites={[
              'Workers are available',
              'Project and phase context is set',
            ]}
            actions={[
              { href: '/labour/workers/new', label: 'Add Worker' },
              { href: '/phases', label: 'View Phases' },
              { href: '/labour/batches/new', label: 'Create Batch' },
            ]}
            tip="Batch approvals speed up labour review."
          />

          {/* Filters */}
          <div className="ds-bg-surface rounded-lg shadow p-4 mb-6">
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">Project</label>
                <select
                  value={filters.projectId}
                  onChange={(e) => handleFilterChange('projectId', e.target.value)}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Projects</option>
                  {accessibleProjects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.projectCode} - {project.projectName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ds-text-muted" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Batch number, name..."
                    className="w-full pl-10 pr-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  Apply Filters
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Batches Table */}
        <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
          {batches.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 ds-text-muted mx-auto mb-4" />
              <p className="ds-text-secondary mb-4">No labour batches found</p>
              {canAccess('create_labour_batch') && (
                <Link
                  href="/labour/batches/new"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Create Your First Batch
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                        Batch Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                        Entries
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                        Hours
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                        Total Cost
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {batches.map((batch) => (
                      <tr key={batch._id} className="hover:ds-bg-surface-muted">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/labour/batches/${batch._id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {batch.batchNumber || 'N/A'}
                          </Link>
                          {batch.batchName && (
                            <div className="text-sm ds-text-muted">{batch.batchName}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                          {getProjectName(batch.projectId)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4 ds-text-muted" />
                            {batch.actualEntryCount || batch.totalEntries || 0} entries
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4 ds-text-muted" />
                            {batch.totalHours?.toFixed(1) || 0} hrs
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4 ds-text-muted" />
                            {formatCurrency(batch.totalCost || 0)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                              batch.status
                            )}`}
                          >
                            {batch.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 ds-text-muted" />
                            {formatDate(batch.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            href={`/labour/batches/${batch._id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="ds-bg-surface-muted px-6 py-4 border-t ds-border-subtle">
                  <div className="flex items-center justify-between">
                    <div className="text-sm ds-text-secondary">
                      Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} batches
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                        }
                        disabled={pagination.page === 1}
                        className="px-4 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        Previous
                      </button>
                      <span className="px-4 py-2 text-sm ds-text-secondary">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <button
                        onClick={() =>
                          setPagination((prev) => ({
                            ...prev,
                            page: Math.min(pagination.totalPages, prev.page + 1),
                          }))
                        }
                        disabled={pagination.page >= pagination.totalPages}
                        className="px-4 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        Next
                      </button>
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

export default function LabourBatchesPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-center min-h-[400px]">
              <LoadingSpinner size="lg" text="Loading..." />
            </div>
          </div>
        </AppLayout>
      }
    >
      <LabourBatchesPageContent />
    </Suspense>
  );
}
