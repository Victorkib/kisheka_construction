/**
 * Batch Approval Table Component
 * Displays material requests in batch with approval actions
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';

export function BatchApprovalTable({
  materialRequests = [],
  onApprove,
  onReject,
  onApproveAll,
  onRejectAll,
  loading = false,
  canApprove = false,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const handleSelectAll = () => {
    const pendingRequests = materialRequests.filter(
      (req) => ['requested', 'pending_approval'].includes(req.status)
    );
    if (selectedIds.size === pendingRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRequests.map((req) => req._id.toString())));
    }
  };

  const handleSelectRequest = (requestId) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  const handleApproveSelected = () => {
    if (selectedIds.size === 0) return;
    onApproveAll(Array.from(selectedIds), approvalNotes);
  };

  const handleRejectSelected = () => {
    if (selectedIds.size === 0) return;
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    onRejectAll(Array.from(selectedIds), rejectionReason);
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
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

  const pendingRequests = materialRequests.filter((req) =>
    ['requested', 'pending_approval'].includes(req.status)
  );
  const approvedRequests = materialRequests.filter((req) => req.status === 'approved');
  const rejectedRequests = materialRequests.filter((req) => req.status === 'rejected');

  if (materialRequests.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-600">No material requests in this batch</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Total Requests</p>
          <p className="text-2xl font-bold text-gray-900">{materialRequests.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
          <p className="text-sm text-yellow-700">Pending Approval</p>
          <p className="text-2xl font-bold text-yellow-900">{pendingRequests.length}</p>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <p className="text-sm text-green-700">Approved</p>
          <p className="text-2xl font-bold text-green-900">{approvedRequests.length}</p>
        </div>
      </div>

      {/* Bulk Actions */}
      {pendingRequests.length > 0 && canApprove && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.size > 0 && selectedIds.size === pendingRequests.length}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-blue-900">
                {selectedIds.size > 0
                  ? `${selectedIds.size} request(s) selected`
                  : 'Select requests to approve/reject'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleApproveSelected}
                disabled={selectedIds.size === 0 || loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Approve Selected
              </button>
              <button
                onClick={handleRejectSelected}
                disabled={selectedIds.size === 0 || loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Reject Selected
              </button>
            </div>
          </div>
          {selectedIds.size > 0 && (
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-1">
                  Approval Notes (Optional)
                </label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Add approval notes for selected requests..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-1">
                  Rejection Reason (Required for rejection)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide reason for rejection..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-gray-400"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      {pendingRequests.length > 0 && canApprove && (
        <div className="flex gap-3">
          <button
            onClick={() => onApproveAll(pendingRequests.map((r) => r._id.toString()), approvalNotes)}
            disabled={loading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Approve All ({pendingRequests.length})
          </button>
          <button
            onClick={() => {
              if (!rejectionReason.trim()) {
                alert('Please provide a rejection reason');
                return;
              }
              onRejectAll(pendingRequests.map((r) => r._id.toString()), rejectionReason);
            }}
            disabled={loading || !rejectionReason.trim()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Reject All ({pendingRequests.length})
          </button>
        </div>
      )}

      {/* Requests Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {canApprove && pendingRequests.length > 0 && (
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === pendingRequests.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Request Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Material
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Quantity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Estimated Cost
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Status
                </th>
                {canApprove && (
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {materialRequests.map((request) => {
                const isPending = ['requested', 'pending_approval'].includes(request.status);
                const isSelected = selectedIds.has(request._id.toString());

                return (
                  <tr
                    key={request._id}
                    className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    {canApprove && pendingRequests.length > 0 && (
                      <td className="px-4 py-3">
                        {isPending ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectRequest(request._id.toString())}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Link
                        href={`/material-requests/${request._id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        {request.requestNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{request.materialName}</div>
                      {request.description && (
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {request.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {request.quantityNeeded} {request.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatCurrency(request.estimatedCost)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                          request.status
                        )}`}
                      >
                        {request.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) ||
                          'Unknown'}
                      </span>
                    </td>
                    {canApprove && (
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        {isPending ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => onApprove(request._id.toString())}
                              disabled={loading}
                              className="text-green-600 hover:text-green-800 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('Please provide a rejection reason:');
                                if (reason && reason.trim()) {
                                  onReject(request._id.toString(), reason.trim());
                                }
                              }}
                              disabled={loading}
                              className="text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

