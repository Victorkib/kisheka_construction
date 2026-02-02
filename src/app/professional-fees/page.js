/**
 * Professional Fees List Page
 * Displays all professional fees with filtering, sorting, and pagination
 * 
 * Route: /professional-fees
 */

 'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingOverlay } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ConfirmationModal } from '@/components/modals';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';
import { useProjectContext } from '@/contexts/ProjectContext';

function ProfessionalFeesPageContent() {
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
  
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [projects, setProjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  
  const [filters, setFilters] = useState({
    projectId: searchParams.get('projectId') || currentProjectId || '',
    professionalServiceId: searchParams.get('professionalServiceId') || '',
    feeType: searchParams.get('feeType') || '',
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  });

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedFeeId, setSelectedFeeId] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [paymentData, setPaymentData] = useState({
    paymentMethod: 'CASH',
    paymentDate: new Date().toISOString().split('T')[0],
    referenceNumber: '',
    receiptUrl: '',
  });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setProjects(accessibleProjects || []);
  }, [accessibleProjects]);

  useEffect(() => {
    if (currentProjectId && currentProjectId !== filters.projectId) {
      setFilters((prev) => ({ ...prev, projectId: currentProjectId }));
    }
  }, [currentProjectId, filters.projectId]);

  // Fetch assignments on mount
  useEffect(() => {
    fetchAssignments();
  }, []);

  // Memoize filter values
  const filterValues = useMemo(() => ({
    projectId: filters.projectId,
    professionalServiceId: filters.professionalServiceId,
    feeType: filters.feeType,
    status: filters.status,
    search: filters.search,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }), [filters.projectId, filters.professionalServiceId, filters.feeType, filters.status, filters.search, filters.sortBy, filters.sortOrder]);

  // Fetch fees when filters or page change
  const fetchFees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filterValues.projectId && { projectId: filterValues.projectId }),
        ...(filterValues.professionalServiceId && { professionalServiceId: filterValues.professionalServiceId }),
        ...(filterValues.feeType && { feeType: filterValues.feeType }),
        ...(filterValues.status && { status: filterValues.status }),
        ...(filterValues.search && { search: filterValues.search }),
        sortBy: filterValues.sortBy,
        sortOrder: filterValues.sortOrder,
      });

      const response = await fetch(`/api/professional-fees?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch professional fees');
      }

      setFees(data.data.fees || []);
      if (data.data.pagination) {
        setPagination((prev) => {
          const newPagination = data.data.pagination;
          if (
            prev.page === newPagination.page &&
            prev.limit === newPagination.limit &&
            prev.total === newPagination.total &&
            prev.pages === newPagination.pages
          ) {
            return prev;
          }
          return newPagination;
        });
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch fees error:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filterValues]);

  useEffect(() => {
    if (isEmpty) {
      setLoading(false);
      setFees([]);
      return;
    }
    if (!filters.projectId) {
      if (projectLoading) return;
      setLoading(false);
      setFees([]);
      return;
    }
    fetchFees();
  }, [fetchFees, filters.projectId, isEmpty, projectLoading]);

  const fetchAssignments = async () => {
    try {
      const response = await fetch('/api/professional-services?status=active');
      const data = await response.json();
      if (data.success) {
        setAssignments(data.data.assignments || []);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    }
  };

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      const newFilters = key === 'projectId'
        ? { ...prev, projectId: value }
        : { ...prev, [key]: value };
      
      setTimeout(() => {
        const params = new URLSearchParams();
        Object.entries(newFilters).forEach(([k, v]) => {
          if (v) params.set(k, v);
        });
        router.push(`/professional-fees?${params.toString()}`, { scroll: false });
      }, 0);
      
      return newFilters;
    });
    setPagination((prev) => {
      if (prev.page === 1) return prev;
      return { ...prev, page: 1 };
    });
    if (key === 'projectId' && value && value !== currentProjectId) {
      switchProject(value).catch((err) => {
        console.error('Error switching project:', err);
      });
    }
  }, [router, currentProjectId, switchProject]);

  const handleApproveClick = (feeId) => {
    setSelectedFeeId(feeId);
    setApprovalNotes('');
    setShowApproveModal(true);
  };

  const handleApprove = async () => {
    if (!selectedFeeId) return;
    setActionLoading(true);
    setShowApproveModal(false);
    try {
      const response = await fetch(`/api/professional-fees/${selectedFeeId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes }),
      });

      const data = await response.json();
      if (data.success) {
        toast.showSuccess('Fee approved successfully. Expense record created automatically.');
        if (data.data?.financialWarning) {
          toast.showWarning(data.data.financialWarning.message);
        }
        fetchFees();
      } else {
        toast.showError(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
      setSelectedFeeId(null);
      setApprovalNotes('');
    }
  };

  const handleQuickApprove = async (feeId) => {
    const targetId = feeId || selectedFeeId;
    if (!targetId) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/professional-fees/${targetId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes: 'Quick-approved from list' }),
      });

      const data = await response.json();
      if (data.success) {
        toast.showSuccess('Fee approved successfully. Expense record created automatically.');
        if (data.data?.financialWarning) {
          toast.showWarning(data.data.financialWarning.message);
        }
        fetchFees();
      } else {
        toast.showError(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectClick = (feeId) => {
    setSelectedFeeId(feeId);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedFeeId) return;
    if (!rejectionReason.trim()) {
      toast.showError('Rejection reason is required');
      return;
    }
    setActionLoading(true);
    setShowRejectModal(false);
    try {
      const response = await fetch(`/api/professional-fees/${selectedFeeId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason }),
      });

      const data = await response.json();
      if (data.success) {
        toast.showSuccess('Fee rejected successfully');
        fetchFees();
      } else {
        toast.showError(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
      setSelectedFeeId(null);
      setRejectionReason('');
    }
  };

  const handlePaymentClick = (feeId) => {
    setSelectedFeeId(feeId);
    setPaymentData({
      paymentMethod: 'CASH',
      paymentDate: new Date().toISOString().split('T')[0],
      referenceNumber: '',
      receiptUrl: '',
    });
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedFeeId) return;
    if (!paymentData.paymentDate) {
      toast.showError('Payment date is required');
      return;
    }
    setActionLoading(true);
    setShowPaymentModal(false);
    try {
      const response = await fetch(`/api/professional-fees/${selectedFeeId}/payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      });

      const data = await response.json();
      if (data.success) {
        toast.showSuccess('Payment recorded successfully');
        fetchFees();
      } else {
        toast.showError(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
      setSelectedFeeId(null);
      setPaymentData({
        paymentMethod: 'CASH',
        paymentDate: new Date().toISOString().split('T')[0],
        referenceNumber: '',
        receiptUrl: '',
      });
    }
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      PAID: 'bg-blue-100 text-blue-800',
      ARCHIVED: 'bg-gray-100 text-gray-800',
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
        <LoadingOverlay
          isLoading={actionLoading}
          message="Updating fee..."
          fullScreen
        />
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
              Fees
            </h1>
            <p className="text-gray-600 mt-2">
              Manage and track professional fees for architects and engineers
            </p>
          </div>
          {canAccess('create_professional_fee') && (
            <Link
              href="/professional-fees/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Fee
            </Link>
          )}
        </div>

        <PrerequisiteGuide
          title="Fees depend on assignments"
          description="Fees are tied to professional service assignments and projects."
          prerequisites={[
            'At least one professional assignment exists',
            'Project is selected for tracking',
          ]}
          actions={[
            { href: '/professional-services', label: 'View Assignments' },
            { href: '/professional-fees/new', label: 'Create Fee' },
          ]}
          tip="If you do not see a professional, add the assignment first."
        />

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <select
                value={filters.projectId}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Professional</label>
              <select
                value={filters.professionalServiceId}
                onChange={(e) => handleFilterChange('professionalServiceId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Professionals</option>
                {assignments.map((assignment) => (
                  <option key={assignment._id} value={assignment._id}>
                    {assignment.library?.name || 'N/A'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fee Type</label>
              <select
                value={filters.feeType}
                onChange={(e) => handleFilterChange('feeType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="design_fee">Design Fee</option>
                <option value="inspection_fee">Inspection Fee</option>
                <option value="revision_fee">Revision Fee</option>
                <option value="site_visit">Site Visit</option>
                <option value="retainer">Retainer</option>
                <option value="milestone_payment">Milestone Payment</option>
                <option value="lump_sum">Lump Sum</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search fees..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <LoadingTable rows={5} columns={7} />
        ) : fees.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No fees found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {canAccess('create_professional_fee') 
                ? 'Get started by creating a new professional fee.'
                : 'No professional fees have been created yet.'}
            </p>
            {canAccess('create_professional_fee') && (
              <div className="mt-6">
                <Link
                  href="/professional-fees/new"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Fee
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fee Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Professional
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type & Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {fees.map((fee) => (
                    <tr key={fee._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {fee.feeCode}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {fee.library?.name || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {fee.professionalService?.professionalCode || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {fee.project?.projectName || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(fee.amount)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {fee.feeType?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {fee.invoiceNumber ? (
                          <div>
                            <div>{fee.invoiceNumber}</div>
                            {fee.invoiceDate && (
                              <div className="text-xs">
                                {new Date(fee.invoiceDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">No invoice</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(fee.status)}`}>
                          {fee.status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/professional-fees/${fee._id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </Link>
                          {canAccess('approve_professional_fee') && fee.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApproveClick(fee._id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleQuickApprove(fee._id)}
                                className="text-emerald-600 hover:text-emerald-900"
                              >
                                Quick Approve
                              </button>
                              <button
                                onClick={() => handleRejectClick(fee._id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {canAccess('record_professional_fee_payment') && fee.status === 'APPROVED' && (
                            <button
                              onClick={() => handlePaymentClick(fee._id)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Record Payment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination - Similar structure as before */}
            {pagination.pages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.pages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(pagination.page * pagination.limit, pagination.total)}
                      </span>{' '}
                      of <span className="font-medium">{pagination.total}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={pagination.page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      {[...Array(pagination.pages)].map((_, i) => {
                        const page = i + 1;
                        if (
                          page === 1 ||
                          page === pagination.pages ||
                          (page >= pagination.page - 1 && page <= pagination.page + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => setPagination(prev => ({ ...prev, page }))}
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
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
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
          </div>
        )}

        {/* Approve Modal */}
        <ConfirmationModal
          isOpen={showApproveModal}
          onClose={() => {
            setShowApproveModal(false);
            setSelectedFeeId(null);
            setApprovalNotes('');
          }}
          onConfirm={handleApprove}
          title="Approve Fee"
          message={
            <div className="space-y-4">
              <p>Are you sure you want to approve this fee? An expense record will be created automatically.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Approval Notes (Optional)
                </label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any notes about this approval..."
                />
              </div>
            </div>
          }
          confirmText="Approve"
          cancelText="Cancel"
          confirmButtonClass="bg-green-600 hover:bg-green-700"
          loading={actionLoading}
        />

        {/* Reject Modal */}
        <ConfirmationModal
          isOpen={showRejectModal}
          onClose={() => {
            setShowRejectModal(false);
            setSelectedFeeId(null);
            setRejectionReason('');
          }}
          onConfirm={handleReject}
          title="Reject Fee"
          message={
            <div className="space-y-4">
              <p>Are you sure you want to reject this fee?</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Please provide a reason for rejection..."
                />
              </div>
            </div>
          }
          confirmText="Reject"
          cancelText="Cancel"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
          loading={actionLoading}
        />

        {/* Payment Modal */}
        <ConfirmationModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedFeeId(null);
            setPaymentData({
              paymentMethod: 'CASH',
              paymentDate: new Date().toISOString().split('T')[0],
              referenceNumber: '',
              receiptUrl: '',
            });
          }}
          onConfirm={handleRecordPayment}
          title="Record Payment"
          message={
            <div className="space-y-4">
              <p>Record payment for this fee.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={paymentData.paymentMethod}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CASH">Cash</option>
                    <option value="M_PESA">M-Pesa</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={paymentData.paymentDate}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, paymentDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    value={paymentData.referenceNumber}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, referenceNumber: e.target.value }))}
                    placeholder="Payment reference"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Receipt URL
                  </label>
                  <input
                    type="url"
                    value={paymentData.receiptUrl}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, receiptUrl: e.target.value }))}
                    placeholder="Cloudinary URL"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          }
          confirmText="Record Payment"
          cancelText="Cancel"
          confirmButtonClass="bg-indigo-600 hover:bg-indigo-700"
          loading={actionLoading}
        />
      </div>
    </AppLayout>
  );
}

export default function ProfessionalFeesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProfessionalFeesPageContent />
    </Suspense>
  );
}





