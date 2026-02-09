/**
 * Initial Expense Detail Page
 * Displays full initial expense details with approval history
 * 
 * Route: /initial-expenses/[id]
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { ImagePreview } from '@/components/uploads/image-preview';
import { LoadingButton, LoadingCard, LoadingOverlay } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { CapitalBalanceWarning } from '@/components/financial/capital-balance-warning';
import { ConfirmationModal, RestoreModal } from '@/components/modals';
import { ArchiveBadge } from '@/components/badges';
import { useToast } from '@/components/toast';

export default function InitialExpenseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const expenseId = params?.id;
  const { user, canAccess } = usePermissions();
  const toast = useToast();
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (expenseId) {
      fetchExpense();
    } else {
      setError('Invalid expense ID');
      setLoading(false);
    }
  }, [expenseId]);

  const fetchExpense = async () => {
    if (!expenseId) {
      setError('Invalid expense ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/initial-expenses/${expenseId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch initial expense');
      }

      setExpense(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch initial expense error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClick = () => {
    setShowApproveModal(true);
  };

  const handleApproveConfirm = async () => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/initial-expenses/${expenseId}/approve`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        body: JSON.stringify({ approved: true, notes: approvalNotes || 'Approved via UI' }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve initial expense');
      }

      await fetchExpense();
      setApprovalNotes('');
      setShowApproveModal(false);
      toast.showSuccess('Initial expense approved successfully!');
    } catch (err) {
      toast.showError(err.message || 'Failed to approve initial expense');
      console.error('Approve initial expense error:', err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectClick = () => {
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }

    setIsRejecting(true);
    try {
      const response = await fetch(`/api/initial-expenses/${expenseId}/approve`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        body: JSON.stringify({ approved: false, notes: rejectReason.trim() }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject initial expense');
      }

      await fetchExpense();
      setShowRejectModal(false);
      setRejectReason('');
      toast.showSuccess('Initial expense rejected successfully!');
    } catch (err) {
      toast.showError(err.message || 'Failed to reject initial expense');
      console.error('Reject initial expense error:', err);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/initial-expenses/${expenseId}?force=true`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete initial expense');
      }

      toast.showSuccess(data.message || 'Initial expense permanently deleted successfully!');
      setShowDeleteModal(false);
      // Redirect to initial expenses list
      setTimeout(() => {
        router.push('/initial-expenses');
      }, 500);
    } catch (err) {
      toast.showError(err.message || 'Failed to delete initial expense');
      console.error('Delete initial expense error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchiveClick = () => {
    setShowDeleteModal(true);
  };

  const handleArchiveConfirm = async () => {
    if (!expenseId) {
      toast.showError('Invalid expense ID');
      return;
    }

    setIsArchiving(true);
    try {
      const response = await fetch(`/api/initial-expenses/${expenseId}/archive`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to archive initial expense');
      }

      toast.showSuccess(data.message || 'Initial expense archived successfully!');
      setShowDeleteModal(false);
      await fetchExpense();
    } catch (err) {
      toast.showError(err.message || 'Failed to archive initial expense');
      console.error('Archive initial expense error:', err);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRestoreClick = () => {
    setShowRestoreModal(true);
  };

  const handleRestoreConfirm = async () => {
    if (!expenseId) {
      toast.showError('Invalid expense ID');
      return;
    }

    setIsRestoring(true);
    try {
      const response = await fetch(`/api/initial-expenses/${expenseId}/restore`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to restore initial expense');
      }

      toast.showSuccess(data.message || 'Initial expense restored successfully!');
      setShowRestoreModal(false);
      await fetchExpense();
    } catch (err) {
      toast.showError(err.message || 'Failed to restore initial expense');
      console.error('Restore initial expense error:', err);
    } finally {
      setIsRestoring(false);
    }
  };

  const formatCurrency = (amount, currency = 'KES') => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      deleted: 'bg-gray-200 text-gray-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const categoryLabels = {
    land: 'Land Purchase',
    transfer_fees: 'Transfer Fees',
    county_fees: 'County Fees',
    permits: 'Permits',
    approvals: 'Approvals',
    boreholes: 'Boreholes',
    electricity: 'Electricity',
    other: 'Other',
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-48"></div>
            </div>
            <LoadingCard count={2} showHeader={true} lines={6} />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !expense) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading initial expense...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !expense) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error || 'Initial expense not found'}
          </div>
          <Link
            href="/initial-expenses"
            className="mt-4 inline-block text-blue-600 hover:text-blue-800"
          >
            ← Back to Initial Expenses
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingOverlay
          isLoading={isDeleting}
          message="Deleting initial expense..."
          fullScreen
        />
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/initial-expenses"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Initial Expenses
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">{expense.itemName}</h1>
                {expense.status === 'deleted' && <ArchiveBadge />}
              </div>
              <p className="text-gray-600 mt-1">Expense Code: {expense.expenseCode}</p>
            </div>
            <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getStatusBadgeColor(expense.status)}`}>
              {expense.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        </div>

        {/* Approval Actions (if pending) */}
        {expense.status === 'pending_approval' && canAccess('approve_initial_expense') && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Pending Approval</h3>
            {/* Capital Balance Warning */}
            {expense.projectId && (
              <div className="mb-3 text-gray-900">
                <CapitalBalanceWarning
                  projectId={expense.projectId}
                  amountToApprove={expense.amount || 0}
                />
              </div>
            )}
            <div className="space-y-3">
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add approval notes (optional)..."
                rows={2}
                className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-gray-900"
              />
              <div className="flex gap-3">
                <LoadingButton
                  onClick={handleApproveClick}
                  isLoading={isApproving}
                  loadingText="Processing..."
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium px-6 py-2 rounded-lg transition"
                >
                  Approve
                </LoadingButton>
                <LoadingButton
                  onClick={handleRejectClick}
                  isLoading={isApproving}
                  loadingText="Processing..."
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium px-6 py-2 rounded-lg transition"
                >
                  Reject
                </LoadingButton>
              </div>
            </div>
          </div>
        )}

        {/* Archive/Delete Actions */}
        {canAccess('delete_initial_expense') && expense.status !== 'deleted' && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Actions</h3>
            <div className="flex gap-2">
              <button
                onClick={handleArchiveClick}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Archive
              </button>
              <button
                onClick={handleDeleteClick}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        )}
        {canAccess('delete_initial_expense') && expense.status === 'deleted' && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Actions</h3>
            <div className="flex gap-2">
              <button
                onClick={handleRestoreClick}
                disabled={isRestoring}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {isRestoring ? 'Restoring...' : 'Restore'}
              </button>
              <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Basic Information</h2>
              <dl className="grid grid-cols-2 gap-4">
                {expense.project && (
                  <div className="col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Project</dt>
                    <dd className="mt-1">
                      <Link
                        href={`/projects/${expense.projectId}`}
                        className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                      >
                        {expense.project.projectName || expense.project.projectCode || 'View Project'}
                        <span className="text-xs">→</span>
                      </Link>
                      {expense.project.projectCode && expense.project.projectName && (
                        <p className="text-sm text-gray-600 mt-1 leading-normal">Code: {expense.project.projectCode}</p>
                      )}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Category</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {categoryLabels[expense.category] || expense.category}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Amount</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                    {formatCurrency(expense.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Supplier/Agency</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {expense.supplier || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Receipt Number</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {expense.receiptNumber || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Date Paid</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDate(expense.datePaid)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDate(expense.createdAt)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Notes */}
            {expense.notes && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">Notes</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{expense.notes}</p>
              </div>
            )}

            {/* Documents */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Documents</h2>
              <div className="space-y-4">
                {expense.receiptFileUrl && (
                  <div>
                    <p className="text-base font-semibold text-gray-700 mb-2 leading-normal">Receipt/Invoice</p>
                    <ImagePreview fileUrl={expense.receiptFileUrl} />
                  </div>
                )}
                {expense.supportingDocuments && expense.supportingDocuments.length > 0 && (
                  <div>
                    <p className="text-base font-semibold text-gray-700 mb-2 leading-normal">Supporting Documents</p>
                    <div className="grid grid-cols-2 gap-4">
                      {expense.supportingDocuments.map((doc, index) => (
                        <div key={index}>
                          <ImagePreview fileUrl={doc.fileUrl || doc} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!expense.receiptFileUrl && (!expense.supportingDocuments || expense.supportingDocuments.length === 0) && (
                  <p className="text-sm text-gray-500">No documents uploaded</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Approval History */}
          <div className="space-y-6">
            {/* Project Information */}
            {expense.project && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">Project</h2>
                <div className="space-y-2">
                  <Link
                    href={`/projects/${expense.projectId}`}
                    className="block text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {expense.project.projectName || expense.project.projectCode || 'View Project'}
                  </Link>
                  {expense.project.projectCode && (
                    <p className="text-sm text-gray-600">Code: {expense.project.projectCode}</p>
                  )}
                  {expense.project.location && (
                    <p className="text-sm text-gray-600">📍 {expense.project.location}</p>
                  )}
                </div>
              </div>
            )}

            {/* Approval Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Approval Information</h2>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(expense.status)}`}>
                      {expense.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </dd>
                </div>
                
                {/* Entered By User */}
                {expense.enteredBy && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-2">Entered By</dt>
                    <dd className="mt-1">
                      {expense.enteredByUser ? (
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                              {expense.enteredByUser.firstName?.[0] || ''}{expense.enteredByUser.lastName?.[0] || ''}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {expense.enteredByUser.firstName} {expense.enteredByUser.lastName}
                              </p>
                              <p className="text-sm text-gray-600 leading-normal">{expense.enteredByUser.email}</p>
                            </div>
                          </div>
                          {expense.enteredByUser.role && (
                            <p className="text-xs text-gray-600 mt-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {expense.enteredByUser.role.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                              </span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">
                          User not found (ID: {expense.enteredBy})
                        </div>
                      )}
                    </dd>
                  </div>
                )}

                {/* Approved By User */}
                {expense.approvedBy && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-2">Approved By</dt>
                    <dd className="mt-1">
                      {expense.approvedByUser ? (
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm">
                              {expense.approvedByUser.firstName?.[0] || ''}{expense.approvedByUser.lastName?.[0] || ''}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {expense.approvedByUser.firstName} {expense.approvedByUser.lastName}
                              </p>
                              <p className="text-sm text-gray-600 leading-normal">{expense.approvedByUser.email}</p>
                            </div>
                          </div>
                          {expense.approvedByUser.role && (
                            <p className="text-xs text-gray-600 mt-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                {expense.approvedByUser.role.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                              </span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">
                          User not found (ID: {expense.approvedBy})
                        </div>
                      )}
                    </dd>
                  </div>
                )}

                {expense.approvalNotes && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Approval Notes</dt>
                    <dd className="mt-1 text-sm text-gray-900 bg-gray-50 rounded-lg p-3">{expense.approvalNotes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Quick Actions */}
            {expense.status === 'draft' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">Quick Actions</h2>
                <div className="space-y-2">
                  <Link
                    href={`/initial-expenses/${expense._id}/edit`}
                    className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition"
                  >
                    Edit Expense
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approval Confirmation Modal */}
      <ConfirmationModal
        isOpen={showApproveModal}
        onClose={() => !isApproving && setShowApproveModal(false)}
        onConfirm={handleApproveConfirm}
        title="Approve Initial Expense"
        message="Are you sure you want to approve this initial expense?"
        confirmText="Approve"
        cancelText="Cancel"
        variant="info"
        isLoading={isApproving}
      />

      {/* Rejection Modal with Reason Input */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" onClick={() => !isRejecting && setShowRejectModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full transform transition-all" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-2" id="modal-title">
                    Reject Initial Expense
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-4">
                      Please provide a reason for rejecting this initial expense:
                    </p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Enter rejection reason..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      rows="4"
                      disabled={isRejecting}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-yellow-200">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  disabled={isRejecting}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRejectConfirm}
                  disabled={isRejecting || !rejectReason.trim()}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRejecting ? 'Rejecting...' : 'Reject Initial Expense'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive/Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && !isArchiving && setShowDeleteModal(false)}
        onArchive={handleArchiveConfirm}
        onDelete={handleDeleteConfirm}
        title={expense?.status === 'deleted' ? 'Delete Initial Expense Permanently' : 'Archive or Delete Initial Expense'}
        message={
          expense ? (
            <>
              <p className="mb-3">
                {expense.status === 'deleted' ? (
                  <>
                    Are you sure you want to permanently delete <strong>"{expense.itemName || expense.description || `initial expense of ${formatCurrency(expense.amount || 0)}`}"</strong>?
                    <br />
                    <span className="text-red-600 font-medium">This action cannot be undone.</span>
                  </>
                ) : (
                  <>
                    What would you like to do with <strong>"{expense.itemName || expense.description || `initial expense of ${formatCurrency(expense.amount || 0)}`}"</strong>?
                  </>
                )}
              </p>
              {expense.status !== 'deleted' && (
                <>
                  <p className="mb-2 font-medium">Permanent deletion will:</p>
                  <ul className="list-disc list-inside mb-3 space-y-1 text-gray-600">
                    <li>Permanently remove the initial expense from the system</li>
                    {expense.status === 'approved' && expense.amount > 0 && (
                      <li>Recalculate project finances</li>
                    )}
                  </ul>
                  {expense.status === 'approved' && expense.amount > 0 && (
                    <p className="text-yellow-600 font-medium mb-2">
                      ⚠️ This initial expense has an amount of {formatCurrency(expense.amount)} and is approved.
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            'Are you sure you want to proceed?'
          )
        }
        archiveLabel="Archive"
        deleteLabel="Delete Permanently"
        cancelText="Cancel"
        variant={expense?.status === 'deleted' ? 'danger' : 'both'}
        isArchiving={isArchiving}
        isDeleting={isDeleting}
        showRecommendation={expense?.status !== 'deleted' && expense?.status === 'approved' && expense.amount > 0}
      />

      {/* Restore Modal */}
      <RestoreModal
        isOpen={showRestoreModal}
        onClose={() => !isRestoring && setShowRestoreModal(false)}
        onRestore={handleRestoreConfirm}
        title="Restore Initial Expense"
        message="Are you sure you want to restore this initial expense? Project finances will be recalculated if applicable."
        itemName={expense?.itemName || expense?.description || `Initial expense of ${formatCurrency(expense?.amount || 0)}`}
        isLoading={isRestoring}
      />
    </AppLayout>
  );
}

