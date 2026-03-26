/**
 * Capital Requests Approval Queue Component
 * Shows pending capital allocation requests for approval
 *
 * Usage:
 * <CapitalRequestsQueue
 *   projectId={projectId}
 *   onApprove={handleApprove}
 *   onReject={handleReject}
 * />
 */

'use client';

import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/loading';
import { BaseModal, ConfirmationModal } from '@/components/modals';
import { useToast } from '@/components/toast';
import { formatCurrency } from '@/lib/capital-authorization';

export function CapitalRequestsQueue({ projectId, onApprove, onReject }) {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canApprove, setCanApprove] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchRequests();
    }
  }, [projectId]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/capital/requests?projectId=${projectId}&status=pending`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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

  const handleApproveClick = (request) => {
    setSelectedRequest(request);
    setShowApprovalModal(true);
  };

  const handleRejectClick = (request) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setShowRejectionModal(true);
  };

  const handleApproveConfirm = async () => {
    if (!selectedRequest?._id) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/capital/requests/${selectedRequest._id}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({ action: 'approve' }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to approve request');
      }

      toast.showSuccess('Capital allocation approved and executed');
      setShowApprovalModal(false);
      setSelectedRequest(null);
      fetchRequests();
      onApprove?.(data.data);
    } catch (err) {
      toast.showError(err.message || 'Failed to approve request');
      console.error('Approve error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!selectedRequest?._id) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/capital/requests/${selectedRequest._id}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({ action: 'reject', rejectionReason: rejectionReason.trim() }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject request');
      }

      toast.showSuccess('Capital allocation request rejected');
      setShowRejectionModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
      fetchRequests();
      onReject?.(data.data);
    } catch (err) {
      toast.showError(err.message || 'Failed to reject request');
      console.error('Reject error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const getAuthLevelColor = (level) => {
    const colors = {
      Small: 'text-green-600 bg-green-50',
      Medium: 'text-blue-600 bg-blue-50',
      Large: 'text-orange-600 bg-orange-50',
      'Very Large': 'text-red-600 bg-red-50'
    };
    return colors[level] || 'text-gray-600 bg-gray-50';
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <LoadingSpinner size="lg" />
        <p className="mt-4 ds-text-secondary">Loading requests...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-xl font-semibold ds-text-primary mb-2">All Caught Up!</h3>
        <p className="ds-text-secondary">No pending capital allocation requests</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold ds-text-primary">
          💰 Pending Capital Requests ({requests.length})
        </h2>
        <button
          onClick={fetchRequests}
          className="text-sm ds-text-accent-primary hover:ds-text-accent-hover font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {requests.map((request) => (
          <div
            key={request._id}
            className="ds-bg-surface rounded-lg shadow border ds-border-subtle p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getAuthLevelColor(request.authLevel)}`}>
                    {request.authLevel}
                  </span>
                  <span className="text-xs ds-text-secondary capitalize">
                    {request.operationType.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-2xl font-bold ds-text-accent-primary">
                  {formatCurrency(request.amount)}
                </p>
                {request.floorName && (
                  <p className="text-sm ds-text-secondary mt-1">
                    Floor: {request.floorName}
                  </p>
                )}
                {request.description && (
                  <p className="text-sm ds-text-secondary mt-2 italic">
                    "{request.description}"
                  </p>
                )}
              </div>
            </div>

            {/* Request Info */}
            <div className="grid grid-cols-2 gap-3 text-xs ds-text-secondary mb-3">
              <div>
                <span className="font-medium ds-text-primary">Requested by:</span> {request.requestedByName}
              </div>
              <div>
                <span className="font-medium ds-text-primary">Role:</span> {request.requestedByRole}
              </div>
              <div>
                <span className="font-medium ds-text-primary">Available:</span> {formatCurrency(request.projectFinancesSnapshot?.availableCapital || 0)}
              </div>
              <div>
                <span className="font-medium ds-text-primary">Requested:</span> {new Date(request.createdAt).toLocaleDateString()}
              </div>
            </div>

            {/* Actions */}
            {canApprove && (
              <div className="flex gap-2 pt-3 border-t ds-border-subtle">
                <button
                  onClick={() => handleApproveClick(request)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => handleRejectClick(request)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  ✕ Reject
                </button>
              </div>
            )}

            {!canApprove && (
              <div className="text-xs ds-text-secondary text-center py-2">
                Waiting for Owner/PM approval
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Approval Confirmation Modal */}
      <ConfirmationModal
        isOpen={showApprovalModal}
        onClose={() => !processing && setShowApprovalModal(false)}
        onConfirm={handleApproveConfirm}
        title="Approve Capital Allocation"
        message={
          selectedRequest && (
            <div>
              <p className="mb-3">
                Are you sure you want to approve this capital allocation?
              </p>
              <div className="p-3 ds-bg-surface-muted rounded-lg">
                <p className="text-lg font-bold ds-text-accent-primary mb-2">
                  {formatCurrency(selectedRequest.amount)}
                </p>
                {selectedRequest.floorName && (
                  <p className="text-sm ds-text-secondary">Floor: {selectedRequest.floorName}</p>
                )}
              </div>
              <p className="text-sm ds-text-secondary mt-3">
                This action will immediately allocate capital to the specified floor.
              </p>
            </div>
          )
        }
        confirmText="Approve Allocation"
        cancelText="Cancel"
        confirmColor="green"
        isLoading={processing}
      />

      {/* Rejection Modal */}
      <BaseModal
        isOpen={showRejectionModal}
        onClose={() => !processing && setShowRejectionModal(false)}
        title="Reject Capital Allocation"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm ds-text-secondary">
            Please provide a reason for rejecting this capital allocation request:
          </p>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="e.g., Insufficient project funds, requires additional documentation, etc."
          />
          <div className="flex gap-3 pt-4 border-t ds-border-subtle">
            <button
              onClick={() => setShowRejectionModal(false)}
              disabled={processing}
              className="flex-1 px-4 py-2 text-sm font-medium ds-text-secondary ds-bg-surface border ds-border-subtle rounded-lg hover:ds-bg-surface-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectConfirm}
              disabled={processing || !rejectionReason.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Reject Request'}
            </button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}

export default CapitalRequestsQueue;
