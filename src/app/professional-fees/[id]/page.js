/**
 * Professional Fee Detail Page
 * Displays full professional fee details with payment history and approval actions
 * 
 * Route: /professional-fees/[id]
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingCard, LoadingButton } from '@/components/loading';
import { AuditTrail } from '@/components/audit-trail';
import { usePermissions } from '@/hooks/use-permissions';
import { ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';
import { ImagePreview } from '@/components/uploads/image-preview';
import { PAYMENT_METHODS } from '@/lib/constants/professional-fees-constants';

function ProfessionalFeeDetailPageContent() {
  const router = useRouter();
  const params = useParams();
  const feeId = params?.id;
  const { canAccess, user } = usePermissions();
  const toast = useToast();
  const [fee, setFee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    paymentMethod: '',
    paymentDate: new Date().toISOString().split('T')[0],
    referenceNumber: '',
    receiptUrl: '',
  });

  useEffect(() => {
    if (feeId) {
      fetchFee();
    } else {
      setError('Invalid fee ID');
      setLoading(false);
    }
  }, [feeId]);

  const fetchFee = async () => {
    if (!feeId) {
      setError('Invalid fee ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/professional-fees/${feeId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch professional fee');
      }

      setFee(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch fee error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClick = () => {
    setApprovalNotes('');
    setShowApproveModal(true);
  };

  const handleApproveConfirm = async () => {
    setIsApproving(true);
    try {
      const response = await fetch(`/api/professional-fees/${feeId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes: approvalNotes || 'Approved via UI' }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve fee');
      }

      await fetchFee();
      setApprovalNotes('');
      setShowApproveModal(false);
      toast.showSuccess('Professional fee approved successfully!');
      if (data.data?.financialWarning) {
        toast.showWarning(data.data.financialWarning.message);
      }
    } catch (err) {
      toast.showError(err.message || 'Failed to approve fee');
      console.error('Approve fee error:', err);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectClick = () => {
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectionReason.trim()) {
      toast.showError('Please provide a reason for rejection');
      return;
    }

    setIsRejecting(true);
    try {
      const response = await fetch(`/api/professional-fees/${feeId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject fee');
      }

      await fetchFee();
      setShowRejectModal(false);
      setRejectionReason('');
      toast.showSuccess('Professional fee rejected successfully!');
    } catch (err) {
      toast.showError(err.message || 'Failed to reject fee');
      console.error('Reject fee error:', err);
    } finally {
      setIsRejecting(false);
    }
  };

  const handlePaymentClick = () => {
    setPaymentData({
      paymentMethod: '',
      paymentDate: new Date().toISOString().split('T')[0],
      referenceNumber: '',
      receiptUrl: '',
    });
    setShowPaymentModal(true);
  };

  const handlePaymentConfirm = async () => {
    if (!paymentData.paymentMethod) {
      toast.showError('Please select a payment method');
      return;
    }

    if (!paymentData.paymentDate) {
      toast.showError('Please select a payment date');
      return;
    }

    setIsRecordingPayment(true);
    try {
      const response = await fetch(`/api/professional-fees/${feeId}/payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to record payment');
      }

      await fetchFee();
      setShowPaymentModal(false);
      setPaymentData({
        paymentMethod: '',
        paymentDate: new Date().toISOString().split('T')[0],
        referenceNumber: '',
        receiptUrl: '',
      });
      toast.showSuccess('Payment recorded successfully!');
    } catch (err) {
      toast.showError(err.message || 'Failed to record payment');
      console.error('Record payment error:', err);
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/professional-fees/${feeId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete fee');
      }

      toast.showSuccess('Professional fee deleted successfully!');
      setShowDeleteModal(false);
      router.push('/professional-fees');
    } catch (err) {
      toast.showError(err.message || 'Failed to delete fee');
      console.error('Delete fee error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (amount, currency = 'KES') => {
    if (!amount && amount !== 0) return 'N/A';
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

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
          <LoadingCard count={2} showHeader={true} lines={6} />
        </div>
      </AppLayout>
    );
  }

  if (error || !fee) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Professional fee not found'}
          </div>
          <Link
            href="/professional-fees"
            className="mt-4 inline-block text-blue-600 hover:text-blue-800"
          >
            ← Back to Fees
          </Link>
        </div>
      </AppLayout>
    );
  }

  const canApprove = canAccess('approve_professional_fee') && fee.status === 'PENDING';
  const canReject = canAccess('approve_professional_fee') && fee.status === 'PENDING';
  const canRecordPayment = canAccess('record_professional_fee_payment') && fee.status === 'APPROVED' && fee.paymentStatus !== 'PAID';
  const canEdit = canAccess('edit_professional_fee') && (fee.status !== 'PAID' || user?.role?.toLowerCase() === 'owner');
  const canDelete = canAccess('delete_professional_fee') && user?.role?.toLowerCase() === 'owner';

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/professional-fees"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Fees
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                  {fee.feeCode || 'Professional Fee'}
                </h1>
                <span
                  className={`px-4 py-2 text-sm font-semibold rounded-full ${getStatusBadgeColor(
                    fee.status
                  )}`}
                >
                  {fee.status || 'N/A'}
                </span>
                {fee.paymentStatus === 'PAID' && (
                  <span className="px-4 py-2 text-sm font-semibold rounded-full bg-blue-100 text-blue-800">
                    PAID
                  </span>
                )}
              </div>
              <p className="text-gray-600 mt-2">
                {formatCurrency(fee.amount, fee.currency || 'KES')} • {fee.feeType?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
              </p>
            </div>
            <div className="flex gap-2">
              {canApprove && (
                <button
                  onClick={handleApproveClick}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
                >
                  Approve
                </button>
              )}
              {canReject && (
                <button
                  onClick={handleRejectClick}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
                >
                  Reject
                </button>
              )}
              {canRecordPayment && (
                <button
                  onClick={handlePaymentClick}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  Record Payment
                </button>
              )}
              {canEdit && (
                <Link
                  href={`/professional-fees/${feeId}/edit`}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  Edit
                </Link>
              )}
              {canDelete && (
                <button
                  onClick={handleDeleteClick}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Fee Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Fee Information</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Amount</dt>
                  <dd className="mt-1 text-2xl font-bold text-gray-900">
                    {formatCurrency(fee.amount, fee.currency || 'KES')}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Fee Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {fee.feeType?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Professional Service</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {fee.professionalService ? (
                      <Link
                        href={`/professional-services/${fee.professionalService._id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {fee.professionalService.professionalCode || 'N/A'}
                      </Link>
                    ) : (
                      'N/A'
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Project</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {fee.project ? (
                      <Link
                        href={`/projects/${fee.project._id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {fee.project.projectCode} - {fee.project.projectName}
                      </Link>
                    ) : (
                      'N/A'
                    )}
                  </dd>
                </div>

                {fee.activity && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Linked Activity</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <Link
                        href={`/professional-activities/${fee.activity._id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {fee.activity.activityCode || 'N/A'}
                      </Link>
                    </dd>
                  </div>
                )}

                {fee.expense && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Linked Expense</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <Link
                        href={`/expenses/${fee.expense._id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {fee.expense.expenseCode || 'N/A'}
                      </Link>
                    </dd>
                  </div>
                )}

                {fee.invoiceNumber && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Invoice Number</dt>
                    <dd className="mt-1 text-sm text-gray-900">{fee.invoiceNumber}</dd>
                  </div>
                )}

                {fee.invoiceDate && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Invoice Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(fee.invoiceDate)}</dd>
                  </div>
                )}

                {fee.dueDate && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Due Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(fee.dueDate)}</dd>
                  </div>
                )}

                {fee.paymentMethod && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Payment Method</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {fee.paymentMethod?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                    </dd>
                  </div>
                )}

                {fee.referenceNumber && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Reference Number</dt>
                    <dd className="mt-1 text-sm text-gray-900">{fee.referenceNumber}</dd>
                  </div>
                )}

                {fee.paymentDate && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Payment Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(fee.paymentDate)}</dd>
                  </div>
                )}

                {fee.description && (
                  <div className="md:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Description</dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{fee.description}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Invoice Document */}
            {fee.invoiceUrl && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Invoice Document</h2>
                <ImagePreview
                  url={fee.invoiceUrl}
                  title="Invoice"
                  showDelete={false}
                />
              </div>
            )}

            {/* Receipt Document */}
            {fee.receiptUrl && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Receipt Document</h2>
                <ImagePreview
                  url={fee.receiptUrl}
                  title="Receipt"
                  showDelete={false}
                />
              </div>
            )}

            {/* Approval History */}
            {fee.approvalChain && fee.approvalChain.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Approval History</h2>
                <div className="space-y-4">
                  {fee.approvalChain.map((approval, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">
                            {approval.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {approval.approverName || 'N/A'} • {formatDateTime(approval.approvedAt || approval.timestamp)}
                          </p>
                          {approval.notes && (
                            <p className="text-sm text-gray-700 mt-2">{approval.notes}</p>
                          )}
                          {approval.reason && (
                            <p className="text-sm text-red-700 mt-2">{approval.reason}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment History */}
            {fee.paymentHistory && fee.paymentHistory.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Payment History</h2>
                <div className="space-y-4">
                  {fee.paymentHistory.map((payment, index) => (
                    <div key={index} className="border-l-4 border-green-500 pl-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">
                            {formatCurrency(payment.amount || fee.amount, fee.currency || 'KES')}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {payment.paymentMethod?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'} • {formatDate(payment.paymentDate || payment.timestamp)}
                          </p>
                          {payment.referenceNumber && (
                            <p className="text-sm text-gray-700 mt-1">Reference: {payment.referenceNumber}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Log */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
              <AuditTrail entityType="PROFESSIONAL_FEE" entityId={feeId} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Approval Actions */}
            {fee.status === 'PENDING' && (canApprove || canReject) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Actions</h3>
                <div className="space-y-4">
                  {canApprove && (
                    <div>
                      <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                        Approval Notes (Optional)
                      </label>
                      <textarea
                        value={approvalNotes}
                        onChange={(e) => setApprovalNotes(e.target.value)}
                        rows={3}
                        placeholder="Add notes for approval..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  )}
                  {canReject && (
                    <div>
                      <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                        Rejection Reason *
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={3}
                        placeholder="Explain why this fee is being rejected..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    {canApprove && (
                      <LoadingButton
                        onClick={handleApproveClick}
                        isLoading={isApproving}
                        loadingText="Processing..."
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        Approve
                      </LoadingButton>
                    )}
                    {canReject && (
                      <LoadingButton
                        onClick={handleRejectClick}
                        isLoading={isRejecting}
                        loadingText="Processing..."
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        Reject
                      </LoadingButton>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Payment Action */}
            {canRecordPayment && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Record Payment</h3>
                <button
                  onClick={handlePaymentClick}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  Record Payment
                </button>
              </div>
            )}

            {/* Quick Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Info</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-semibold text-gray-700">Created By</dt>
                  <dd className="mt-1 text-sm text-gray-900">{fee.createdByName || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-700">Created At</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDateTime(fee.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-700">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDateTime(fee.updatedAt)}</dd>
                </div>
                {fee.approvalChain && fee.approvalChain.length > 0 && (
                  <div>
                    <dt className="text-sm font-semibold text-gray-700">Approvals</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {fee.approvalChain.length} approval(s)
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
        title="Approve Professional Fee"
        message="Are you sure you want to approve this professional fee? This will automatically create an expense record."
        confirmText="Approve"
        cancelText="Cancel"
        variant="info"
        isLoading={isApproving}
      >
        <div className="mt-4">
          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Approval Notes (Optional)</label>
          <textarea
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
            rows={3}
            disabled={isApproving}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="Add any notes about this approval..."
          />
        </div>
      </ConfirmationModal>

      {/* Rejection Modal */}
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
                    Reject Professional Fee
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-4">
                      Please provide a reason for rejecting this fee:
                    </p>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
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
                  disabled={isRejecting || !rejectionReason.trim()}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRejecting ? 'Rejecting...' : 'Reject Fee'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" onClick={() => !isRecordingPayment && setShowPaymentModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full transform transition-all" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4" id="modal-title">
                  Record Payment
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Method *
                    </label>
                    <select
                      value={paymentData.paymentMethod}
                      onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isRecordingPayment}
                    >
                      <option value="">Select Payment Method</option>
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Date *
                    </label>
                    <input
                      type="date"
                      value={paymentData.paymentDate}
                      onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isRecordingPayment}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reference Number
                    </label>
                    <input
                      type="text"
                      value={paymentData.referenceNumber}
                      onChange={(e) => setPaymentData({ ...paymentData, referenceNumber: e.target.value })}
                      placeholder="e.g., Transaction ID, Cheque Number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isRecordingPayment}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={isRecordingPayment}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePaymentConfirm}
                  disabled={isRecordingPayment || !paymentData.paymentMethod || !paymentData.paymentDate}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRecordingPayment ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Professional Fee"
        message="Are you sure you want to delete this professional fee? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </AppLayout>
  );
}

export default function ProfessionalFeeDetailPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LoadingCard count={2} showHeader={true} lines={6} />
          </div>
        </AppLayout>
      }
    >
      <ProfessionalFeeDetailPageContent />
    </Suspense>
  );
}





