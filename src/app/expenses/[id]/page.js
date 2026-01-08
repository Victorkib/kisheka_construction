/**
 * Expense Detail Page
 * Displays full expense details with approval history and activity log
 * 
 * Route: /expenses/[id]
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { ImagePreview } from '@/components/uploads/image-preview';
import { LoadingSpinner, LoadingCard, LoadingButton } from '@/components/loading';
import { AuditTrail } from '@/components/audit-trail';
import { usePermissions } from '@/hooks/use-permissions';
import { CapitalBalanceWarning } from '@/components/financial/capital-balance-warning';
import { ConfirmationModal, RestoreModal } from '@/components/modals';
import { ArchiveBadge } from '@/components/badges';
import { useToast } from '@/components/toast';

export default function ExpenseDetailPage() {
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

      const response = await fetch(`/api/expenses/${expenseId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch expense');
      }

      setExpense(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch expense error:', err);
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
      const response = await fetch(`/api/expenses/${expenseId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: approvalNotes || 'Approved via UI' }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve expense');
      }

      // Refresh expense data
      await fetchExpense();
      setApprovalNotes('');
      setShowApproveModal(false);
      toast.showSuccess('Expense approved successfully!');
    } catch (err) {
      toast.showError(err.message || 'Failed to approve expense');
      console.error('Approve expense error:', err);
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
      const response = await fetch(`/api/expenses/${expenseId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject expense');
      }

      // Refresh expense data
      await fetchExpense();
      setShowRejectModal(false);
      setRejectReason('');
      toast.showSuccess('Expense rejected successfully!');
    } catch (err) {
      toast.showError(err.message || 'Failed to reject expense');
      console.error('Reject expense error:', err);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleArchiveClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleArchiveConfirm = async () => {
    if (!expenseId) {
      toast.showError('Invalid expense ID');
      return;
    }

    setIsArchiving(true);
    try {
      const response = await fetch(`/api/expenses/${expenseId}/archive`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to archive expense');
      }

      toast.showSuccess(data.message || 'Expense archived successfully!');
      setShowDeleteModal(false);
      await fetchExpense();
    } catch (err) {
      toast.showError(err.message || 'Failed to archive expense');
      console.error('Archive expense error:', err);
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
      const response = await fetch(`/api/expenses/${expenseId}/restore`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to restore expense');
      }

      toast.showSuccess(data.message || 'Expense restored successfully!');
      setShowRestoreModal(false);
      await fetchExpense();
    } catch (err) {
      toast.showError(err.message || 'Failed to restore expense');
      console.error('Restore expense error:', err);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/expenses/${expenseId}?force=true`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete expense');
      }

      toast.showSuccess(data.message || 'Expense permanently deleted successfully!');
      setShowDeleteModal(false);
      // Redirect to expenses list
      setTimeout(() => {
        router.push('/expenses');
      }, 500);
    } catch (err) {
      toast.showError(err.message || 'Failed to delete expense');
      console.error('Delete expense error:', err);
    } finally {
      setIsDeleting(false);
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
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      PAID: 'bg-blue-100 text-blue-800',
      ARCHIVED: 'bg-gray-100 text-gray-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error || 'Expense not found'}
          </div>
          <Link
            href="/expenses"
            className="mt-4 inline-block text-blue-600 hover:text-blue-800"
          >
            ← Back to Expenses
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/expenses"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Expenses
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Expense Details</h1>
                {(expense.deletedAt || expense.status === 'ARCHIVED') && <ArchiveBadge />}
              </div>
              <p className="text-gray-600 mt-2">Expense Code: {expense.expenseCode || 'N/A'}</p>
            </div>
            <span
              className={`px-4 py-2 text-sm font-semibold rounded-full ${getStatusBadgeColor(
                expense.status
              )}`}
            >
              {expense.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Expense Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Expense Information</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Amount</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">
                    {formatCurrency(expense.amount, expense.currency)}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Category</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      {expense.category?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                      {expense.isIndirectCost && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800" title="Indirect Cost">
                          Indirect
                        </span>
                      )}
                    </div>
                  </dd>
                </div>
                
                {expense.isIndirectCost && expense.indirectCostCategory && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Indirect Cost Category</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-800">
                        {expense.indirectCostCategory.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        This expense is charged to the project-level indirect costs budget, not the phase budget.
                      </p>
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-sm font-medium text-gray-500">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900">{expense.description || 'N/A'}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Vendor</dt>
                  <dd className="mt-1 text-sm text-gray-900">{expense.vendor || 'N/A'}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(expense.date)}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Payment Method</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {expense.paymentMethod?.replace('_', ' ') || 'N/A'}
                  </dd>
                </div>

                {expense.referenceNumber && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Reference Number</dt>
                    <dd className="mt-1 text-sm text-gray-900">{expense.referenceNumber}</dd>
                  </div>
                )}

                <div>
                  <dt className="text-sm font-medium text-gray-500">Submitted By</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {expense.submittedBy?.name || expense.submittedBy?.email || 'N/A'}
                  </dd>
                </div>

                {expense.approvedBy && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Approved By</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {expense.approvalChain?.[expense.approvalChain.length - 1]?.approverName || 'N/A'}
                    </dd>
                  </div>
                )}

                {expense.notes && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Notes</dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{expense.notes}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Receipt */}
            {expense.receiptFileUrl && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Receipt</h2>
                <ImagePreview
                  url={expense.receiptFileUrl}
                  title="Receipt"
                  showDelete={false}
                />
              </div>
            )}

            {/* Approval History */}
            {expense.approvalHistory && expense.approvalHistory.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Approval History</h2>
                <div className="space-y-4">
                  {expense.approvalHistory.map((approval, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">
                            {approval.action === 'APPROVED' ? '✅ Approved' : '❌ Rejected'}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatDate(approval.timestamp)}
                          </p>
                          {approval.reason && (
                            <p className="text-sm text-gray-700 mt-2">{approval.reason}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Log */}
            <AuditTrail entityType="EXPENSE" entityId={expenseId} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Approval Actions */}
            {expense.status === 'PENDING' && canAccess('approve_expense') && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Actions</h3>
                {/* Capital Balance Warning */}
                {expense.projectId && (
                  <div className="mb-4">
                    <CapitalBalanceWarning
                      projectId={expense.projectId}
                      amountToApprove={expense.amount || 0}
                    />
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                      Approval Notes (Optional)
                    </label>
                    <textarea
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      rows={3}
                      placeholder="Add notes for approval/rejection..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <LoadingButton
                      onClick={handleApproveClick}
                      isLoading={isApproving}
                      loadingText="Processing..."
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Approve
                    </LoadingButton>
                    <LoadingButton
                      onClick={handleRejectClick}
                      isLoading={isApproving}
                      loadingText="Processing..."
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Reject
                    </LoadingButton>
                  </div>
                </div>
              </div>
            )}

            {/* Archive/Delete Actions */}
            {canAccess('delete_expense') && !expense.deletedAt && expense.status !== 'ARCHIVED' && (
              <div className="bg-white rounded-lg shadow p-6">
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
            {canAccess('delete_expense') && (expense.deletedAt || expense.status === 'ARCHIVED') && (
              <div className="bg-white rounded-lg shadow p-6">
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

            {/* Quick Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Info</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-semibold text-gray-700 leading-normal">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(expense.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-700 leading-normal">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(expense.updatedAt)}</dd>
                </div>
                {expense.approvalChain && expense.approvalChain.length > 0 && (
                  <div>
                    <dt className="text-sm font-semibold text-gray-700 leading-normal">Approvals</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {expense.approvalChain.length} approval(s)
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Approval Confirmation Modal */}
      <ConfirmationModal
        isOpen={showApproveModal}
        onClose={() => !isApproving && setShowApproveModal(false)}
        onConfirm={handleApproveConfirm}
        title="Approve Expense"
        message="Are you sure you want to approve this expense?"
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
                    Reject Expense
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-4">
                      Please provide a reason for rejecting this expense:
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
                  {isRejecting ? 'Rejecting...' : 'Reject Expense'}
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
        title={(expense?.deletedAt || expense?.status === 'ARCHIVED') ? 'Delete Expense Permanently' : 'Archive or Delete Expense'}
        message={
          expense ? (
            <>
              <p className="mb-3">
                {(expense.deletedAt || expense.status === 'ARCHIVED') ? (
                  <>
                    Are you sure you want to permanently delete <strong>"{expense.description || `expense of ${formatCurrency(expense.amount || 0)}`}"</strong>?
                    <br />
                    <span className="text-red-600 font-medium">This action cannot be undone.</span>
                  </>
                ) : (
                  <>
                    What would you like to do with <strong>"{expense.description || `expense of ${formatCurrency(expense.amount || 0)}`}"</strong>?
                  </>
                )}
              </p>
              {!expense.deletedAt && expense.status !== 'ARCHIVED' && (
                <>
                  <p className="mb-2 font-medium">Permanent deletion will:</p>
                  <ul className="list-disc list-inside mb-3 space-y-1 text-gray-600">
                    <li>Permanently remove the expense from the system</li>
                    {expense.status && ['APPROVED', 'PAID'].includes(expense.status) && expense.amount > 0 && (
                      <li>Recalculate project finances</li>
                    )}
                  </ul>
                  {expense.status && ['APPROVED', 'PAID'].includes(expense.status) && expense.amount > 0 && (
                    <p className="text-yellow-600 font-medium mb-2">
                      ⚠️ This expense has an amount of {formatCurrency(expense.amount)} and is {expense.status}.
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
        variant={(expense?.deletedAt || expense?.status === 'ARCHIVED') ? 'danger' : 'both'}
        isArchiving={isArchiving}
        isDeleting={isDeleting}
        showRecommendation={!expense?.deletedAt && expense?.status !== 'ARCHIVED' && expense?.status && ['APPROVED', 'PAID'].includes(expense.status) && expense.amount > 0}
      />

      {/* Restore Modal */}
      <RestoreModal
        isOpen={showRestoreModal}
        onClose={() => !isRestoring && setShowRestoreModal(false)}
        onRestore={handleRestoreConfirm}
        title="Restore Expense"
        message="Are you sure you want to restore this expense? Project finances will be recalculated if applicable."
        itemName={expense?.description || `Expense of ${formatCurrency(expense?.amount || 0)}`}
        isLoading={isRestoring}
      />
    </AppLayout>
  );
}

