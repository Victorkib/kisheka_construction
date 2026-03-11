/**
 * Material Requests List Page
 * Displays all material requests with filtering, sorting, and pagination
 * 
 * Route: /material-requests
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingOverlay } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import { NoProjectsEmptyState } from '@/components/empty-states';
import { PhaseFilter } from '@/components/filters/PhaseFilter';
import { fetchNoCache } from '@/lib/fetch-helpers';
import { MaterialGuide } from '@/components/materials/MaterialGuide';

function MaterialRequestsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const {
    currentProject,
    currentProjectId,
    accessibleProjects,
    loading: projectLoading,
    isEmpty,
    switchProject,
  } = useProjectContext();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [projectCapital, setProjectCapital] = useState(null);
  
  // Get projectId from context (prioritize current project over URL param)
  const projectIdFromContext = normalizeProjectId(currentProject?._id) || currentProjectId || '';
  const projectIdFromUrl = searchParams.get('projectId');
  const activeProjectId = projectIdFromContext || projectIdFromUrl || '';
  
  // Filters
  const [filters, setFilters] = useState({
    projectId: activeProjectId || '',
    status: searchParams.get('status') || '',
    urgency: searchParams.get('urgency') || '',
    phaseId: searchParams.get('phaseId') || '',
    search: searchParams.get('search') || '',
  });

  useEffect(() => {
    if (projectIdFromContext && projectIdFromContext !== filters.projectId) {
      setFilters((prev) => ({ ...prev, projectId: projectIdFromContext, phaseId: '' }));
    }
  }, [projectIdFromContext, filters.projectId]);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query string
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.urgency && { urgency: filters.urgency }),
        ...(filters.phaseId && { phaseId: filters.phaseId }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/material-requests?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch material requests');
      }

      setRequests(data.data.requests || []);
      setPagination(prev => data.data.pagination || prev);
    } catch (err) {
      setError(err.message);
      console.error('Fetch material requests error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  // Fetch material requests
  useEffect(() => {
    // Don't fetch if empty state
    if (isEmpty) {
      setLoading(false);
      setRequests([]);
      return;
    }
    if (!filters.projectId) {
      if (projectLoading) return;
      setLoading(false);
      setRequests([]);
      return;
    }

    fetchRequests();
  }, [fetchRequests, isEmpty, projectLoading, filters.projectId]);

  // Fetch project-level capital when active project changes (for aggregate guidance only)
  useEffect(() => {
    const fetchProjectCapital = async () => {
      if (!filters.projectId || !canAccess('view_financing')) {
        setProjectCapital(null);
        return;
      }
      try {
        const response = await fetch(`/api/project-finances?projectId=${filters.projectId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });
        const data = await response.json();
        if (data.success) {
          setProjectCapital({
            available: data.data.availableCapital || data.data.capitalBalance || 0,
          });
        } else {
          setProjectCapital(null);
        }
      } catch (err) {
        console.error('Error fetching project capital for material requests list:', err);
        setProjectCapital(null);
      }
    };

    fetchProjectCapital();
  }, [filters.projectId, canAccess]);

  const handleFilterChange = (key, value) => {
    let updatedFilters = { ...filters, [key]: value };
    if (key === 'projectId') {
      updatedFilters = { ...filters, projectId: value, phaseId: '' };
      if (value && value !== currentProjectId) {
        switchProject(value).catch((err) => {
          console.error('Error switching project:', err);
        });
      }
    }
    setFilters(updatedFilters);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on filter change
    
    // Update URL params
    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/material-requests?${params.toString()}`, { scroll: false });
  };

  const handleApproveClick = (requestId) => {
    setSelectedRequestId(requestId);
    setApprovalNotes('');
    setShowApproveModal(true);
  };

  const handleApprove = async () => {
    if (!selectedRequestId) return;
    setActionLoading(true);
    setShowApproveModal(false);
    try {
      const response = await fetchNoCache(`/api/material-requests/${selectedRequestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes }),
      });

      const data = await response.json();
      if (data.success) {
        toast.showSuccess('Material request approved successfully!');
        if (data.data?.financialWarning) {
          toast.showWarning(data.data.financialWarning.message);
        }
        fetchRequests();
      } else {
        toast.showError(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
      setSelectedRequestId(null);
      setApprovalNotes('');
    }
  };

  const handleRejectClick = (requestId) => {
    setSelectedRequestId(requestId);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedRequestId) return;
    if (!rejectionReason.trim()) {
      toast.showError('Rejection reason is required');
      return;
    }
    setActionLoading(true);
    setShowRejectModal(false);
    try {
      const response = await fetchNoCache(`/api/material-requests/${selectedRequestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason }),
      });

      const data = await response.json();
      if (data.success) {
        toast.showSuccess('Material request rejected successfully!');
        fetchRequests();
      } else {
        toast.showError(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
      setSelectedRequestId(null);
      setRejectionReason('');
    }
  };

  // Bulk action handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRequests(new Set(requests.map(r => r._id)));
    } else {
      setSelectedRequests(new Set());
    }
  };

  const handleSelectRequest = (requestId) => {
    setSelectedRequests((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  const handleBulkAction = async (action) => {
    if (selectedRequests.size === 0) {
      toast.showError('Please select at least one request');
      return;
    }

    const requestIds = Array.from(selectedRequests);
    
    if (action === 'approve') {
      setShowBulkApproveModal(true);
    } else if (action === 'reject') {
      setShowBulkRejectModal(true);
    } else if (action === 'delete') {
      setShowBulkDeleteModal(true);
    }
  };

  const executeBulkAction = async (action, notes = '') => {
    if (selectedRequests.size === 0) return;

    setBulkActionLoading(true);
    const requestIds = Array.from(selectedRequests);

    try {
      const response = await fetch('/api/material-requests/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, requestIds, notes }),
      });

      const data = await response.json();
      if (data.success) {
        const { success, failed } = data.data.results;
        if (success.length > 0) {
          toast.showSuccess(`${action}ed ${success.length} request(s) successfully`);
        }
        if (failed.length > 0) {
          toast.showWarning(`${failed.length} request(s) failed: ${failed.map(f => f.reason).join(', ')}`);
        }
        setSelectedRequests(new Set());
        fetchRequests();
      } else {
        toast.showError(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setBulkActionLoading(false);
      setShowBulkApproveModal(false);
      setShowBulkRejectModal(false);
      setShowBulkDeleteModal(false);
      setApprovalNotes('');
      setRejectionReason('');
    }
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      requested: 'ds-bg-surface-muted ds-text-primary',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      converted_to_order: 'bg-blue-100 text-blue-800',
      cancelled: 'ds-bg-surface-muted ds-text-primary',
    };
    return colors[status] || 'ds-bg-surface-muted ds-text-primary';
  };

  const getUrgencyBadgeColor = (urgency) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[urgency] || 'ds-bg-surface-muted ds-text-primary';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Compute aggregate estimated cost for selected requests (for guidance only)
  const selectedRequestsArray = Array.from(selectedRequests);
  const selectedEstimatedTotal = selectedRequestsArray.reduce((sum, id) => {
    const req = requests.find((r) => r._id === id);
    if (!req || !req.estimatedCost) return sum;
    const cost = parseFloat(req.estimatedCost) || 0;
    return sum + (isNaN(cost) ? 0 : cost);
  }, 0);

  if (loading && requests.length === 0) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable />
        </div>
      </AppLayout>
    );
  }

  // Check empty state - no projects
  if (isEmpty && !loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">Material Requests</h1>
            <p className="text-base md:text-lg ds-text-secondary mt-2 leading-relaxed">Create and manage material requests</p>
          </div>
          <NoProjectsEmptyState
            canCreate={canAccess('create_project')}
            role={canAccess('create_project') ? 'owner' : 'site_clerk'}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingOverlay
          isLoading={bulkActionLoading || actionLoading}
          message="Processing material requests..."
          fullScreen
        />
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">Material Requests</h1>
            <p className="text-sm sm:text-base md:text-lg ds-text-secondary mt-2 leading-relaxed">Manage material procurement requests</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {canAccess('create_material_request') && (
              <Link
                href="/material-requests/new"
                className="ds-bg-accent-primary hover:bg-blue-700 active:bg-blue-800 text-white font-medium px-4 sm:px-6 py-2.5 rounded-lg transition-colors touch-manipulation text-sm sm:text-base"
              >
                + New Request
              </Link>
            )}
            {canAccess('create_bulk_material_request') && (
              <Link
                href="/material-requests/bulk"
                className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-medium px-4 sm:px-6 py-2.5 rounded-lg transition-colors touch-manipulation text-sm sm:text-base"
              >
                📦 Bulk Request
              </Link>
            )}
            {canAccess('view_material_library') && (
              <Link
                href="/material-library"
                className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-medium px-4 sm:px-6 py-2.5 rounded-lg transition-colors touch-manipulation text-sm sm:text-base"
              >
                📚 Material Library
              </Link>
            )}
          </div>
        </div>

        {/* Material Guide - Consolidated Quick Actions & Guide */}
        <MaterialGuide
          title="Start with projects and items"
          description="Material requests depend on projects and item or library definitions."
          prerequisites={[
            'Project is created',
            'Items or material library entries exist',
          ]}
          tip="Bulk requests are best for large lists from the library."
          projectId={activeProjectId}
        />

        {/* Filters */}
        <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div>
              <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">Project</label>
              <select
                value={filters.projectId}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="" className="ds-text-primary">All Projects</option>
                {accessibleProjects.map((project) => (
                  <option key={project._id} value={project._id} className="ds-text-primary">
                    {project.projectName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="" className="ds-text-primary">All Statuses</option>
                <option value="requested" className="ds-text-primary">Requested</option>
                <option value="pending_approval" className="ds-text-primary">Pending Approval</option>
                <option value="ready_to_order" className="ds-text-primary">Ready to Order</option>
                <option value="approved" className="ds-text-primary">Approved</option>
                <option value="rejected" className="ds-text-primary">Rejected</option>
                <option value="converted_to_order" className="ds-text-primary">Converted to Order</option>
                <option value="cancelled" className="ds-text-primary">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">Urgency</label>
              <select
                value={filters.urgency}
                onChange={(e) => handleFilterChange('urgency', e.target.value)}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="" className="ds-text-primary">All Urgencies</option>
                <option value="low" className="ds-text-primary">Low</option>
                <option value="medium" className="ds-text-primary">Medium</option>
                <option value="high" className="ds-text-primary">High</option>
                <option value="critical" className="ds-text-primary">Critical</option>
              </select>
            </div>
            <PhaseFilter
              projectId={filters.projectId}
              value={filters.phaseId}
              onChange={(phaseId) => handleFilterChange('phaseId', phaseId)}
            />
            <div>
              <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by material name..."
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted"
              />
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <button
                onClick={() => {
                  const resetFilters = { projectId: currentProjectId || '', status: '', urgency: '', phaseId: '', search: '' };
                  setFilters(resetFilters);
                  const params = new URLSearchParams();
                  Object.entries(resetFilters).forEach(([k, v]) => {
                    if (v) params.set(k, v);
                  });
                  router.push(`/material-requests?${params.toString()}`, { scroll: false });
                }}
                className="w-full px-4 py-2.5 border ds-border-subtle hover:ds-bg-surface-muted active:ds-bg-surface-muted ds-text-secondary font-medium rounded-lg transition-colors touch-manipulation"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Requests Table */}
        {requests.length === 0 && !loading ? (
          <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
            <p className="text-lg ds-text-secondary mb-4">No material requests found</p>
            {canAccess('create_material_request') && (
              <Link
                href="/material-requests/new"
                className="inline-block ds-bg-accent-primary hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
              >
                Create Your First Request
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Bulk Actions Toolbar + Aggregate Capital Guidance */}
            {selectedRequests.size > 0 && (
              <div className="bg-blue-50 border border-blue-400/60 rounded-lg px-4 sm:px-6 py-3 mb-4 space-y-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <span className="text-sm font-medium text-blue-900">
                      {selectedRequests.size} request(s) selected
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {canAccess('approve_material_request') && (
                        <button
                          onClick={() => handleBulkAction('approve')}
                          disabled={bulkActionLoading}
                          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors touch-manipulation"
                        >
                          Approve Selected
                        </button>
                      )}
                      {canAccess('reject_material_request') && (
                        <button
                          onClick={() => handleBulkAction('reject')}
                          disabled={bulkActionLoading}
                          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors touch-manipulation"
                        >
                          Reject Selected
                        </button>
                      )}
                      {canAccess('delete_material_request') && (
                        <button
                          onClick={() => handleBulkAction('delete')}
                          disabled={bulkActionLoading}
                          className="px-3 py-1.5 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors touch-manipulation"
                        >
                          Delete Selected
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedRequests(new Set())}
                    className="text-sm ds-text-accent-primary hover:ds-text-accent-hover font-medium transition-colors touch-manipulation"
                  >
                    Clear Selection
                  </button>
                </div>

                {/* Aggregate capital impact (guidance only, non-blocking) */}
                {canAccess('view_financing') && projectCapital && selectedEstimatedTotal > 0 && (
                  <div className="mt-1 text-xs sm:text-sm">
                    <p className="text-blue-900 font-medium">
                      Estimated total for selected requests:{' '}
                      <span className="font-semibold">
                        {formatCurrency(selectedEstimatedTotal)}
                      </span>
                    </p>
                    <p className="text-blue-900">
                      Current available capital:{' '}
                      <span className="font-semibold">
                        {formatCurrency(projectCapital.available)}
                      </span>
                      {selectedEstimatedTotal > projectCapital.available && (
                        <>
                          {' '}
                          <span className="text-red-700 font-semibold">
                            (shortfall {formatCurrency(selectedEstimatedTotal - projectCapital.available)})
                          </span>
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-[11px] sm:text-xs text-blue-800">
                      This is guidance only for planning. Capital is still enforced strictly later when
                      creating purchase orders (both single and bulk).
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Desktop Table View */}
            <div className="hidden md:block ds-bg-surface rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-ds-border-subtle">
                <thead className="ds-bg-surface-muted">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedRequests.size > 0 && selectedRequests.size === requests.length}
                        onChange={handleSelectAll}
                        className="rounded ds-border-subtle text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wider">
                      Request Number
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wider">
                      Batch
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wider">
                      Material
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wider">
                      Urgency
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wider">
                      Estimated Cost
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wider">
                      Requested By
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold ds-text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                  {requests.map((request) => {
                    const canApprove = canAccess('approve_material_request') && request.status === 'pending_approval';
                    const canReject = canAccess('reject_material_request') && request.status === 'pending_approval';
                    const canConvert = canAccess('create_purchase_order') && request.status === 'approved';
                    const canEdit = canAccess('edit_material_request') && ['requested', 'pending_approval'].includes(request.status);
                    const canView = canAccess('view_material_requests');

                    return (
                      <tr key={request._id} className="hover:ds-bg-surface-muted">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedRequests.has(request._id)}
                            onChange={() => handleSelectRequest(request._id)}
                            className="rounded ds-border-subtle ds-text-accent-primary focus:ring-ds-accent-focus"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/material-requests/${request._id}`}
                            className="ds-text-accent-primary hover:ds-text-accent-hover font-medium"
                          >
                            {request.requestNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {request.batchNumber ? (
                            <Link
                              href={`/material-requests/bulk/${request.batchId}`}
                              className="text-purple-600 hover:text-purple-800 font-medium text-sm"
                              title={request.batchName || 'View batch'}
                            >
                              {request.batchNumber}
                            </Link>
                          ) : (
                            <span className="text-sm ds-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium ds-text-primary">{request.materialName}</div>
                          {request.description && (
                            <div className="text-sm ds-text-secondary truncate max-w-xs">{request.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                          {request.quantityNeeded} {request.unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full leading-normal ${getUrgencyBadgeColor(request.urgency)}`}>
                            {request.urgency?.toUpperCase() || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                          {formatCurrency(request.estimatedCost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full leading-normal ${getStatusBadgeColor(request.status)}`}>
                            {request.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                          {request.requestedByName || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-secondary">
                          {formatDate(request.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            {canView && (
                              <Link
                                href={`/material-requests/${request._id}`}
                                className="ds-text-accent-primary hover:ds-text-accent-hover"
                              >
                                View
                              </Link>
                            )}
                            {canApprove && (
                              <button
                                onClick={() => handleApproveClick(request._id)}
                                disabled={actionLoading}
                                className="text-green-600 hover:text-green-800 disabled:opacity-50"
                              >
                                Approve
                              </button>
                            )}
                            {canReject && (
                              <button
                                onClick={() => handleRejectClick(request._id)}
                                disabled={actionLoading}
                                className="text-red-600 hover:text-red-800 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            )}
                            {canConvert && (
                              <Link
                                href={`/purchase-orders/new?requestId=${request._id}`}
                                className="text-purple-600 hover:text-purple-800"
                              >
                                Create Order
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="ds-bg-surface-muted px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t ds-border-subtle">
                  <div className="text-sm ds-text-secondary text-center sm:text-left">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} requests
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm ds-text-secondary flex items-center">
                      Page {pagination.page} of {pagination.pages}
                    </span>
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= pagination.pages}
                      className="px-4 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {requests.map((request) => {
                const canApprove = canAccess('approve_material_request') && request.status === 'pending_approval';
                const canReject = canAccess('reject_material_request') && request.status === 'pending_approval';
                const canConvert = canAccess('create_purchase_order') && request.status === 'approved';
                const canEdit = canAccess('edit_material_request') && ['requested', 'pending_approval'].includes(request.status);
                const canView = canAccess('view_material_requests');

                return (
                  <div
                    key={request._id}
                    className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle"
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="checkbox"
                            checked={selectedRequests.has(request._id)}
                            onChange={() => handleSelectRequest(request._id)}
                            className="rounded ds-border-subtle text-blue-600 focus:ring-blue-500 flex-shrink-0 mt-1"
                          />
                          <Link
                            href={`/material-requests/${request._id}`}
                            className="text-base font-semibold ds-text-accent-primary hover:ds-text-accent-hover truncate"
                          >
                            {request.requestNumber}
                          </Link>
                        </div>
                        <p className="text-sm font-medium ds-text-primary truncate">{request.materialName}</p>
                        {request.description && (
                          <p className="text-xs ds-text-secondary mt-1 line-clamp-2">{request.description}</p>
                        )}
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ml-2 ${getStatusBadgeColor(request.status)}`}>
                        {request.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown'}
                      </span>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs ds-text-muted mb-0.5">Quantity</p>
                        <p className="text-sm font-medium ds-text-primary">
                          {request.quantityNeeded} {request.unit}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs ds-text-muted mb-0.5">Estimated Cost</p>
                        <p className="text-sm font-medium ds-text-primary">
                          {formatCurrency(request.estimatedCost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs ds-text-muted mb-0.5">Urgency</p>
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getUrgencyBadgeColor(request.urgency)}`}>
                          {request.urgency?.toUpperCase() || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs ds-text-muted mb-0.5">Requested By</p>
                        <p className="text-sm ds-text-primary truncate">
                          {request.requestedByName || 'Unknown'}
                        </p>
                      </div>
                    </div>

                    {/* Batch Info */}
                    {request.batchNumber && (
                      <div className="mb-3 pb-3 border-b ds-border-subtle">
                        <p className="text-xs ds-text-muted mb-0.5">Batch</p>
                        <Link
                          href={`/material-requests/bulk/${request.batchId}`}
                          className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                        >
                          {request.batchNumber}
                        </Link>
                      </div>
                    )}

                    {/* Date */}
                    <div className="mb-3">
                      <p className="text-xs ds-text-muted mb-0.5">Date</p>
                      <p className="text-sm ds-text-secondary">{formatDate(request.createdAt)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-3 border-t ds-border-subtle">
                      {canView && (
                        <Link
                          href={`/material-requests/${request._id}`}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors touch-manipulation"
                        >
                          View
                        </Link>
                      )}
                      {canApprove && (
                        <button
                          onClick={() => handleApproveClick(request._id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-green-50 text-green-600 text-sm font-medium rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors touch-manipulation"
                        >
                          Approve
                        </button>
                      )}
                      {canReject && (
                        <button
                          onClick={() => handleRejectClick(request._id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors touch-manipulation"
                        >
                          Reject
                        </button>
                      )}
                      {canConvert && (
                        <Link
                          href={`/purchase-orders/new?requestId=${request._id}`}
                          className="px-3 py-1.5 bg-purple-50 text-purple-600 text-sm font-medium rounded-lg hover:bg-purple-100 transition-colors touch-manipulation"
                        >
                          Create Order
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Mobile Pagination */}
              {pagination.pages > 1 && (
                <div className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle">
                  <div className="text-sm ds-text-secondary text-center mb-3">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} requests
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="flex-1 px-4 py-2.5 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation font-medium"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2.5 text-sm ds-text-secondary font-medium">
                      {pagination.page} / {pagination.pages}
                    </span>
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= pagination.pages}
                      className="flex-1 px-4 py-2.5 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation font-medium"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Approve Modal */}
        <ConfirmationModal
          isOpen={showApproveModal}
          onClose={() => {
            setShowApproveModal(false);
            setSelectedRequestId(null);
            setApprovalNotes('');
          }}
          onConfirm={handleApprove}
          title="Approve Material Request"
          message="Are you sure you want to approve this material request?"
          confirmText="Approve"
          cancelText="Cancel"
          confirmColor="green"
        >
          <div className="mt-4">
            <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">Approval Notes (Optional)</label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder:ds-text-muted"
              placeholder="Add any notes about this approval..."
            />
          </div>
        </ConfirmationModal>

        {/* Reject Modal */}
        <ConfirmationModal
          isOpen={showRejectModal}
          onClose={() => {
            setShowRejectModal(false);
            setSelectedRequestId(null);
            setRejectionReason('');
          }}
          onConfirm={handleReject}
          title="Reject Material Request"
          message="Please provide a reason for rejecting this material request."
          confirmText="Reject"
          cancelText="Cancel"
          confirmColor="red"
        >
          <div className="mt-4">
            <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">Rejection Reason *</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              required
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:ds-text-muted"
              placeholder="Explain why this request is being rejected..."
            />
          </div>
        </ConfirmationModal>

        {/* Bulk Approve Modal */}
        <ConfirmationModal
          isOpen={showBulkApproveModal}
          onClose={() => {
            setShowBulkApproveModal(false);
            setApprovalNotes('');
          }}
          onConfirm={() => executeBulkAction('approve', approvalNotes)}
          title={`Approve ${selectedRequests.size} Material Request(s)`}
          message={`Are you sure you want to approve ${selectedRequests.size} material request(s)?`}
          confirmText="Approve All"
          cancelText="Cancel"
          confirmColor="green"
          isLoading={bulkActionLoading}
        >
          <div className="mt-4">
            <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">Approval Notes (Optional)</label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder:ds-text-muted"
              placeholder="Add notes for this approval..."
            />
          </div>
        </ConfirmationModal>

        {/* Bulk Reject Modal */}
        <ConfirmationModal
          isOpen={showBulkRejectModal}
          onClose={() => {
            setShowBulkRejectModal(false);
            setRejectionReason('');
          }}
          onConfirm={() => {
            if (!rejectionReason.trim()) {
              toast.showError('Rejection reason is required');
              return;
            }
            executeBulkAction('reject', rejectionReason);
          }}
          title={`Reject ${selectedRequests.size} Material Request(s)`}
          message={`Are you sure you want to reject ${selectedRequests.size} material request(s)?`}
          confirmText="Reject All"
          cancelText="Cancel"
          confirmColor="red"
          isLoading={bulkActionLoading}
        >
          <div className="mt-4">
            <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">Rejection Reason (Required)</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:ds-text-muted"
              placeholder="Enter rejection reason..."
              required
            />
          </div>
        </ConfirmationModal>

        {/* Bulk Delete Modal */}
        <ConfirmationModal
          isOpen={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          onConfirm={() => executeBulkAction('delete')}
          title={`Delete ${selectedRequests.size} Material Request(s)`}
          message={`Are you sure you want to permanently delete ${selectedRequests.size} material request(s)? This action cannot be undone.`}
          confirmText="Delete All"
          cancelText="Cancel"
          confirmColor="red"
          isLoading={bulkActionLoading}
        />
      </div>
    </AppLayout>
  );
}

export default function MaterialRequestsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable />
        </div>
      </AppLayout>
    }>
      <MaterialRequestsPageContent />
    </Suspense>
  );
}

