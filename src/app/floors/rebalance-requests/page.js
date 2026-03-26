/**
 * Capital Rebalancing Requests Page
 * View and approve pending capital rebalancing requests
 *
 * Route: /floors/rebalance-requests
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { BaseModal, ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';

function RebalanceRequestsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [canApprove, setCanApprove] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(
    searchParams.get('projectId') || ''
  );
  const [filterStatus, setFilterStatus] = useState('pending');
  const [user, setUser] = useState(null);

  // Approval modal state
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchRequests();
    }
  }, [selectedProjectId, filterStatus]);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        const role = data.data.role?.toLowerCase();
        setCanApprove(['owner', 'pm', 'project_manager'].includes(role));
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/floors/rebalance/requests?projectId=${selectedProjectId}&status=${filterStatus}`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch requests');
      }

      setRequests(data.data.requests || []);
      setCanApprove(data.data.canApprove);
    } catch (err) {
      toast.showError(err.message || 'Failed to load requests');
      console.error('Fetch requests error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest?._id) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/floors/rebalance/${selectedRequest._id}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          action: 'approve'
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve request');
      }

      toast.showSuccess('Capital rebalancing approved and executed');
      setShowApprovalModal(false);
      setSelectedRequest(null);
      fetchRequests();
    } catch (err) {
      toast.showError(err.message || 'Failed to approve request');
      console.error('Approve error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest?._id) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/floors/rebalance/${selectedRequest._id}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          action: 'reject',
          rejectionReason: rejectionReason.trim()
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject request');
      }

      toast.showSuccess('Capital rebalancing request rejected');
      setShowApprovalModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
      fetchRequests();
    } catch (err) {
      toast.showError(err.message || 'Failed to reject request');
      console.error('Reject error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority) => {
    const colors = {
      urgent: 'bg-red-100 text-red-800 border-red-400/60',
      high: 'bg-orange-100 text-orange-800 border-orange-400/60',
      normal: 'bg-blue-100 text-blue-800 border-blue-400/60',
      low: 'bg-gray-100 text-gray-800 border-gray-400/60'
    };
    return colors[priority] || colors.normal;
  };

  if (!selectedProjectId) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-400/60 rounded-lg p-6 text-center">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">No Project Selected</h2>
            <p className="text-yellow-600 mb-4">Please select a project to view rebalancing requests</p>
            <Link
              href="/projects"
              className="inline-block px-4 py-2 bg-yellow-600 text-white font-medium rounded-lg hover:bg-yellow-700"
            >
              Go to Projects
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <Breadcrumbs
            items={[
              { label: 'Projects', href: '/projects' },
              { label: 'Floors', href: `/floors?projectId=${selectedProjectId}` },
              { label: 'Dashboard', href: `/floors/dashboard?projectId=${selectedProjectId}` },
              { label: 'Rebalancing Requests', href: null, current: true },
            ]}
          />
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold ds-text-primary">🔄 Capital Rebalancing Requests</h1>
            <p className="ds-text-secondary mt-1">Review and approve capital transfer requests</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-4 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Project</option>
              {/* Would need to fetch projects here */}
            </select>
            <Link
              href={`/floors/dashboard?projectId=${selectedProjectId}`}
              className="px-4 py-2 ds-bg-surface ds-text-accent-primary border ds-border-subtle rounded-lg hover:ds-bg-surface-muted"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="ds-bg-surface rounded-lg shadow p-1 mb-6">
          <nav className="flex space-x-1">
            {['pending', 'approved', 'rejected', 'all'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`flex-1 py-2.5 px-3 rounded-md font-medium text-sm transition-colors ${
                  filterStatus === status
                    ? 'ds-bg-accent-primary text-white'
                    : 'ds-text-muted hover:ds-text-secondary hover:ds-bg-surface-muted'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="text-center py-12">
            <LoadingSpinner size="lg" />
            <p className="mt-4 ds-text-secondary">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold ds-text-primary mb-2">No Requests Found</h3>
            <p className="ds-text-secondary">
              {filterStatus === 'pending'
                ? 'No pending rebalancing requests'
                : `No ${filterStatus} requests`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request._id}
                className="ds-bg-surface rounded-lg shadow p-6 border-l-4 border-purple-500"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(request.priority)}`}>
                        {request.priority}
                      </span>
                      <span className="text-sm ds-text-secondary">
                        Requested {formatDate(request.createdAt)}
                      </span>
                      {request.requestedBy && (
                        <span className="text-sm ds-text-muted">
                          by {request.requestedByName || 'Unknown'}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold ds-text-primary mb-2">
                      {request.fromFloorName} → {request.toFloorName}
                    </h3>
                    {request.reason && (
                      <p className="text-sm ds-text-secondary italic">
                        "{request.reason}"
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-700">
                      {formatCurrency(request.amount)}
                    </p>
                    <p className="text-xs ds-text-secondary mt-1">
                      Status: <span className="font-medium">{request.status}</span>
                    </p>
                  </div>
                </div>

                {/* Impact Preview */}
                <div className="grid grid-cols-2 gap-4 p-4 ds-bg-surface-muted rounded-lg mb-4">
                  <div>
                    <p className="text-xs ds-text-secondary mb-1">From: {request.fromFloorName}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="ds-text-muted">Before:</span>
                      <span className="font-medium">{formatCurrency(request.fromFloorBefore?.remaining || 0)}</span>
                      <span className="ds-text-muted">→</span>
                      <span className="font-medium text-red-600">{formatCurrency(request.fromFloorAfter?.remaining || 0)}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs ds-text-secondary mb-1">To: {request.toFloorName}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="ds-text-muted">Before:</span>
                      <span className="font-medium">{formatCurrency(request.toFloorBefore?.remaining || 0)}</span>
                      <span className="ds-text-muted">→</span>
                      <span className="font-medium text-green-600">{formatCurrency(request.toFloorAfter?.remaining || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Current Status Info */}
                {request.status === 'approved' && request.approvedAt && (
                  <div className="text-xs ds-text-secondary">
                    Approved {formatDate(request.approvedAt)}
                    {request.executedAt && ` • Executed ${formatDate(request.executedAt)}`}
                  </div>
                )}

                {request.status === 'rejected' && request.rejectionReason && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-400/60 rounded-lg">
                    <p className="text-sm text-red-800">
                      <strong>Rejection Reason:</strong> {request.rejectionReason}
                    </p>
                  </div>
                )}

                {/* Actions */}
                {canApprove && request.status === 'pending' && (
                  <div className="flex gap-3 mt-4 pt-4 border-t ds-border-subtle">
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowApprovalModal(true);
                      }}
                      className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setRejectionReason('');
                        setShowApprovalModal(true);
                      }}
                      className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval/Rejection Modal */}
      <BaseModal
        isOpen={showApprovalModal}
        onClose={() => !processing && setShowApprovalModal(false)}
        title={selectedRequest?.status === 'pending' ? 'Review Rebalancing Request' : 'Request Details'}
        maxWidth="max-w-lg"
        isLoading={processing}
        loadingMessage="Processing..."
      >
        {selectedRequest && (
          <div className="p-4 space-y-4">
            <div className="p-4 ds-bg-surface-muted rounded-lg">
              <p className="text-sm font-medium ds-text-primary mb-2">Request Summary:</p>
              <p className="text-sm ds-text-secondary">
                Transfer {formatCurrency(selectedRequest.amount)} from {selectedRequest.fromFloorName} to {selectedRequest.toFloorName}
              </p>
              {selectedRequest.reason && (
                <p className="text-sm ds-text-secondary mt-2 italic">"{selectedRequest.reason}"</p>
              )}
            </div>

            {selectedRequest.status === 'pending' && (
              <>
                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    disabled={processing}
                    className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {processing ? 'Processing...' : 'Approve & Execute'}
                  </button>
                  <button
                    onClick={() => setRejectionReason('REJECTION_REQUIRED')}
                    disabled={processing}
                    className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>

                {rejectionReason === 'REJECTION_REQUIRED' && (
                  <div className="p-4 bg-red-50 border border-red-400/60 rounded-lg">
                    <label className="block text-sm font-medium text-red-800 mb-2">
                      Rejection Reason (Required)
                    </label>
                    <textarea
                      value={rejectionReason === 'REJECTION_REQUIRED' ? '' : rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Explain why this request is being rejected..."
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleReject}
                        disabled={processing || !rejectionReason.trim()}
                        className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => setRejectionReason('')}
                        disabled={processing}
                        className="flex-1 px-4 py-2 ds-bg-surface ds-text-secondary border ds-border-subtle rounded-lg hover:ds-bg-surface-muted disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {selectedRequest.status !== 'pending' && (
              <div className="text-center ds-text-secondary">
                <p>This request has already been {selectedRequest.status}</p>
                <button
                  onClick={() => setShowApprovalModal(false)}
                  className="mt-4 px-4 py-2 ds-bg-surface ds-text-secondary border ds-border-subtle rounded-lg hover:ds-bg-surface-muted"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        )}
      </BaseModal>
    </AppLayout>
  );
}

export default function RebalanceRequestsPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <LoadingSpinner size="lg" />
              <p className="mt-4 ds-text-secondary">Loading requests...</p>
            </div>
          </div>
        </AppLayout>
      }
    >
      <RebalanceRequestsContent />
    </Suspense>
  );
}
