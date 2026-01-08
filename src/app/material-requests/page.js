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
import { LoadingTable } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import { NoProjectsEmptyState } from '@/components/empty-states';
import { PhaseFilter } from '@/components/filters/PhaseFilter';

function MaterialRequestsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const { currentProject, isEmpty } = useProjectContext();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [projects, setProjects] = useState([]);
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
  
  // Get projectId from context (prioritize current project over URL param)
  const projectIdFromContext = normalizeProjectId(currentProject?._id);
  const projectIdFromUrl = searchParams.get('projectId');
  const activeProjectId = projectIdFromContext || projectIdFromUrl || '';
  
  // Filters
  const [filters, setFilters] = useState({
    projectId: activeProjectId,
    status: searchParams.get('status') || '',
    urgency: searchParams.get('urgency') || '',
    phaseId: searchParams.get('phaseId') || '',
    search: searchParams.get('search') || '',
  });

  // Fetch projects for filter dropdown
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data.projects || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

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
    
    fetchRequests();
  }, [fetchRequests, isEmpty]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on filter change
    
    // Update URL params
    const params = new URLSearchParams();
    Object.entries({ ...filters, [key]: value }).forEach(([k, v]) => {
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
      const response = await fetch(`/api/material-requests/${selectedRequestId}/approve`, {
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
      const response = await fetch(`/api/material-requests/${selectedRequestId}/reject`, {
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
      requested: 'bg-gray-100 text-gray-800',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      converted_to_order: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getUrgencyBadgeColor = (urgency) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[urgency] || 'bg-gray-100 text-gray-800';
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
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Material Requests</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Create and manage material requests</p>
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
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Material Requests</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Manage material procurement requests</p>
          </div>
          <div className="flex gap-2">
            {canAccess('create_material_request') && (
              <Link
                href="/material-requests/new"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
              >
                + New Request
              </Link>
            )}
            {canAccess('create_bulk_material_request') && (
              <Link
                href="/material-requests/bulk"
                className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2 rounded-lg transition"
              >
                📦 Bulk Request
              </Link>
            )}
            {canAccess('view_bulk_material_requests') && (
              <Link
                href="/material-requests/batches"
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-2 rounded-lg transition"
              >
                📋 View Batches
              </Link>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Project</label>
              <select
                value={filters.projectId}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="" className="text-gray-900">All Projects</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id} className="text-gray-900">
                    {project.projectName}
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
                <option value="" className="text-gray-900">All Statuses</option>
                <option value="requested" className="text-gray-900">Requested</option>
                <option value="pending_approval" className="text-gray-900">Pending Approval</option>
                <option value="ready_to_order" className="text-gray-900">Ready to Order</option>
                <option value="approved" className="text-gray-900">Approved</option>
                <option value="rejected" className="text-gray-900">Rejected</option>
                <option value="converted_to_order" className="text-gray-900">Converted to Order</option>
                <option value="cancelled" className="text-gray-900">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Urgency</label>
              <select
                value={filters.urgency}
                onChange={(e) => handleFilterChange('urgency', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="" className="text-gray-900">All Urgencies</option>
                <option value="low" className="text-gray-900">Low</option>
                <option value="medium" className="text-gray-900">Medium</option>
                <option value="high" className="text-gray-900">High</option>
                <option value="critical" className="text-gray-900">Critical</option>
              </select>
            </div>
            <PhaseFilter
              projectId={filters.projectId}
              value={filters.phaseId}
              onChange={(phaseId) => handleFilterChange('phaseId', phaseId)}
            />
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by material name..."
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ projectId: '', status: '', urgency: '', phaseId: '', search: '' });
                  router.push('/material-requests', { scroll: false });
                }}
                className="w-full px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Requests Table */}
        {requests.length === 0 && !loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-lg text-gray-700 mb-4">No material requests found</p>
            {canAccess('create_material_request') && (
              <Link
                href="/material-requests/new"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
              >
                Create Your First Request
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Bulk Actions Toolbar */}
            {selectedRequests.size > 0 && (
              <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedRequests.size} request(s) selected
                  </span>
                  {canAccess('approve_material_request') && (
                    <button
                      onClick={() => handleBulkAction('approve')}
                      disabled={bulkActionLoading}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve Selected
                    </button>
                  )}
                  {canAccess('reject_material_request') && (
                    <button
                      onClick={() => handleBulkAction('reject')}
                      disabled={bulkActionLoading}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject Selected
                    </button>
                  )}
                  {canAccess('delete_material_request') && (
                    <button
                      onClick={() => handleBulkAction('delete')}
                      disabled={bulkActionLoading}
                      className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
                    >
                      Delete Selected
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setSelectedRequests(new Set())}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Clear Selection
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedRequests.size > 0 && selectedRequests.size === requests.length}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Request Number
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Batch
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Material
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Urgency
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Estimated Cost
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Requested By
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requests.map((request) => {
                    const canApprove = canAccess('approve_material_request') && request.status === 'pending_approval';
                    const canReject = canAccess('reject_material_request') && request.status === 'pending_approval';
                    const canConvert = canAccess('create_purchase_order') && request.status === 'approved';
                    const canEdit = canAccess('edit_material_request') && ['requested', 'pending_approval'].includes(request.status);
                    const canView = canAccess('view_material_requests');

                    return (
                      <tr key={request._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedRequests.has(request._id)}
                            onChange={() => handleSelectRequest(request._id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/material-requests/${request._id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
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
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{request.materialName}</div>
                          {request.description && (
                            <div className="text-sm text-gray-700 truncate max-w-xs">{request.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {request.quantityNeeded} {request.unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full leading-normal ${getUrgencyBadgeColor(request.urgency)}`}>
                            {request.urgency?.toUpperCase() || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(request.estimatedCost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full leading-normal ${getStatusBadgeColor(request.status)}`}>
                            {request.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {request.requestedByName || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {formatDate(request.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            {canView && (
                              <Link
                                href={`/material-requests/${request._id}`}
                                className="text-blue-600 hover:text-blue-800"
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
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} requests
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-700">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.pages}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
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
            <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Approval Notes (Optional)</label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder:text-gray-400"
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
            <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Rejection Reason *</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              required
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-gray-400"
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
            <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Approval Notes (Optional)</label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder:text-gray-400"
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
            <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Rejection Reason (Required)</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-gray-400"
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

