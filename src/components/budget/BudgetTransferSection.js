/**
 * Budget Transfer Section Component
 * Displays budget transfer history and allows requesting transfers
 */

'use client';

import { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { BudgetTransferForm } from './BudgetTransferForm';

export function BudgetTransferSection({ projectId }) {
  const { canAccess } = usePermissions();
  const [transfers, setTransfers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTransferForm, setShowTransferForm] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchTransfers();
    }
  }, [projectId]);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectId}/budget/transfer`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch budget transfers');
      }

      setTransfers(result.data.transfers || []);
      setSummary(result.data.summary || null);
    } catch (err) {
      console.error('Fetch budget transfers error:', err);
      setError(err.message || 'Failed to load budget transfers');
    } finally {
      setLoading(false);
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

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const categoryLabels = {
    dcc: 'Direct Construction Costs',
    preconstruction: 'Preconstruction Costs',
    indirect: 'Indirect Costs',
    contingency: 'Contingency Reserve',
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-2 border-gray-200">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6 border-2 border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Budget Transfers
          </h3>
          <button
            onClick={() => setShowTransferForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
            title="Request a budget transfer between cost categories"
          >
            Request Transfer
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-600 mb-1">Pending</p>
              <p className="text-sm font-semibold text-yellow-600">
                {summary.pending.count} ({formatCurrency(summary.pending.totalAmount)})
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Approved</p>
              <p className="text-sm font-semibold text-blue-600">
                {summary.approved.count} ({formatCurrency(summary.approved.totalAmount)})
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Completed</p>
              <p className="text-sm font-semibold text-green-600">
                {summary.completed.count} ({formatCurrency(summary.completed.totalAmount)})
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Rejected</p>
              <p className="text-sm font-semibold text-red-600">
                {summary.rejected.count} ({formatCurrency(summary.rejected.totalAmount)})
              </p>
            </div>
          </div>
        )}

        {/* Transfer History */}
        {transfers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No budget transfers yet.</p>
            <button
              onClick={() => setShowTransferForm(true)}
              className="mt-2 text-blue-600 hover:text-blue-800 font-medium"
            >
              Request your first transfer
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {transfers.map((transfer) => (
              <div
                key={transfer._id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(transfer.amount)}
                      </span>
                      <span className="text-sm text-gray-600">from</span>
                      <span className="text-sm font-medium text-gray-700">
                        {categoryLabels[transfer.fromCategory] || transfer.fromCategory}
                      </span>
                      <span className="text-sm text-gray-600">to</span>
                      <span className="text-sm font-medium text-gray-700">
                        {categoryLabels[transfer.toCategory] || transfer.toCategory}
                      </span>
                    </div>
                    {transfer.reason && (
                      <p className="text-sm text-gray-600 mb-2">{transfer.reason}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>
                        Requested by: {transfer.requestedBy?.name || 'Unknown'}
                      </span>
                      <span>{formatDate(transfer.createdAt)}</span>
                      {transfer.approvedBy && (
                        <span>
                          {transfer.status === 'approved' ? 'Approved' : 'Rejected'} by: {transfer.approvedBy.name || 'Unknown'}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                      transfer.status
                    )}`}
                  >
                    {transfer.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transfer Form Modal */}
      {showTransferForm && (
        <BudgetTransferForm
          projectId={projectId}
          onClose={() => {
            setShowTransferForm(false);
            fetchTransfers(); // Refresh transfers after form closes
          }}
          onSuccess={() => {
            setShowTransferForm(false);
            fetchTransfers(); // Refresh transfers after successful transfer
          }}
        />
      )}
    </>
  );
}
