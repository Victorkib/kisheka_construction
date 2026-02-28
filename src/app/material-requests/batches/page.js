/**
 * Bulk Material Request Batches List Page
 * Displays all bulk material request batches with filtering, sorting, and pagination
 * 
 * Route: /material-requests/batches
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { useProjectContext } from '@/contexts/ProjectContext';
import { NoProjectsEmptyState } from '@/components/empty-states';

function BatchesPageContent() {
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
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

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

  // Fetch batches
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

      // Build query string
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/material-requests/bulk?${queryParams}`, {
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
      setPagination(data.data.pagination || pagination);
    } catch (err) {
      setError(err.message);
      console.error('Fetch batches error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const updatedFilters = key === 'projectId'
      ? { ...filters, projectId: value }
      : { ...filters, [key]: value };
    setFilters(updatedFilters);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on filter change

    // Update URL params
    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/material-requests/batches?${params.toString()}`, { scroll: false });
    if (key === 'projectId' && value && value !== currentProjectId) {
      switchProject(value).catch((err) => {
        console.error('Error switching project:', err);
      });
    }
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
      partially_ordered: 'bg-orange-100 text-orange-800',
      fully_ordered: 'bg-purple-100 text-purple-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'ds-bg-surface-muted ds-text-primary';
  };

  const getProjectName = (projectId) => {
    const project = accessibleProjects.find((p) => p._id === projectId);
    return project ? `${project.projectCode} - ${project.projectName}` : 'Unknown Project';
  };

  const canAssignSuppliers = canAccess('create_bulk_purchase_orders');

  if (isEmpty && !loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold ds-text-primary">Bulk Material Request Batches</h1>
            <p className="ds-text-secondary mt-2">View and manage all bulk material request batches</p>
          </div>
          <NoProjectsEmptyState />
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable rows={10} columns={7} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs
          items={[
            { label: 'Material Requests', href: '/material-requests' },
            { label: 'Batches', href: '/material-requests/batches' },
          ]}
        />

        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold ds-text-primary">Bulk Material Request Batches</h1>
              <p className="ds-text-secondary mt-2">View and manage all bulk material request batches</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/material-requests/bulk"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                + Create Batch
              </Link>
              <Link
                href="/material-requests"
                className="px-4 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted ds-text-secondary font-medium"
              >
                View Requests
              </Link>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="ds-bg-surface rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-1">Project</label>
              <select
                value={filters.projectId}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="partially_ordered">Partially Ordered</option>
                <option value="fully_ordered">Fully Ordered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Batch number or name..."
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ projectId: '', status: '', search: '' });
                  setPagination((prev) => ({ ...prev, page: 1 }));
                  router.push('/material-requests/batches', { scroll: false });
                }}
                className="w-full px-4 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted ds-text-secondary font-medium"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Batches Table */}
        <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
          {batches.length === 0 ? (
            <div className="text-center py-12">
              <p className="ds-text-secondary mb-4">No batches found</p>
              <Link
                href="/material-requests/bulk"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Create your first batch →
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                        Batch Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                        Materials
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                        Estimated Cost
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold ds-text-secondary uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {batches.map((batch) => (
                      <tr key={batch._id} className="hover:ds-bg-surface-muted">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/material-requests/bulk/${batch._id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {batch.batchNumber}
                          </Link>
                          {batch.batchName && (
                            <div className="text-sm ds-text-muted">{batch.batchName}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                          {getProjectName(batch.projectId)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                          {batch.totalMaterials || 0} material(s)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                          {formatCurrency(batch.totalEstimatedCost || 0)}
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
                          {formatDate(batch.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/material-requests/bulk/${batch._id}`}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              View
                            </Link>
                            {batch.status === 'approved' && canAssignSuppliers && (
                              <Link
                                href={`/material-requests/bulk/${batch._id}/assign-suppliers`}
                                className="text-green-600 hover:text-green-800 font-semibold"
                              >
                                Assign Suppliers →
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="ds-bg-surface-muted px-6 py-4 border-t ds-border-subtle flex items-center justify-between">
                  <div className="text-sm ds-text-secondary">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} batches
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= pagination.pages}
                      className="px-4 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      Next
                    </button>
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

export default function BatchesPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LoadingTable rows={10} columns={7} />
          </div>
        </AppLayout>
      }
    >
      <BatchesPageContent />
    </Suspense>
  );
}




