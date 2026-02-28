/**
 * Budget Adjustment Section Component
 * Displays budget adjustment history and allows requesting adjustments
 */

'use client';

import { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { BudgetAdjustmentForm } from './BudgetAdjustmentForm';

export function BudgetAdjustmentSection({ projectId }) {
  const { canAccess } = usePermissions();
  const [adjustments, setAdjustments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchAdjustments();
    }
  }, [projectId]);

  const fetchAdjustments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectId}/budget/adjustment`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch budget adjustments');
      }

      setAdjustments(result.data.adjustments || []);
      setSummary(result.data.summary || null);
    } catch (err) {
      console.error('Fetch budget adjustments error:', err);
      setError(err.message || 'Failed to load budget adjustments');
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
        return 'ds-bg-surface-muted ds-text-primary';
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
      <div className="ds-bg-surface rounded-lg shadow p-6 border-2 ds-border-subtle">
        <div className="animate-pulse">
          <div className="h-6 ds-bg-surface-muted rounded w-1/3 mb-4"></div>
          <div className="h-4 ds-bg-surface-muted rounded w-full mb-2"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="ds-bg-surface rounded-lg shadow p-6 border-2 ds-border-subtle">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold ds-text-primary flex items-center gap-2">
            <svg className="w-5 h-5 ds-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Budget Adjustments
          </h3>
          {canAccess('request_budget_adjustment') && (
            <button
              onClick={() => setShowAdjustmentForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
            >
              Request Adjustment
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-4 gap-4 mb-4 p-4 ds-bg-surface-muted rounded-lg">
            <div>
              <p className="text-xs ds-text-secondary mb-1">Pending</p>
              <p className="text-sm font-semibold text-yellow-600">
                {summary.pending.count}
              </p>
            </div>
            <div>
              <p className="text-xs ds-text-secondary mb-1">Approved</p>
              <p className="text-sm font-semibold text-blue-600">
                {summary.approved.count}
              </p>
            </div>
            <div>
              <p className="text-xs ds-text-secondary mb-1">Completed</p>
              <p className="text-sm font-semibold text-green-600">
                {summary.completed.count}
              </p>
            </div>
            <div>
              <p className="text-xs ds-text-secondary mb-1">Rejected</p>
              <p className="text-sm font-semibold text-red-600">
                {summary.rejected.count}
              </p>
            </div>
          </div>
        )}

        {/* Adjustment History */}
        {adjustments.length === 0 ? (
          <div className="text-center py-8 ds-text-muted">
            <p>No budget adjustments yet.</p>
            {canAccess('request_budget_adjustment') && (
              <button
                onClick={() => setShowAdjustmentForm(true)}
                className="mt-2 text-blue-600 hover:text-blue-800 font-medium"
              >
                Request your first adjustment
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {adjustments.map((adjustment) => (
              <div
                key={adjustment._id}
                className="border ds-border-subtle rounded-lg p-4 hover:ds-bg-surface-muted transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-sm font-semibold ${
                        adjustment.adjustmentType === 'increase' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {adjustment.adjustmentType === 'increase' ? '+' : '-'}
                        {formatCurrency(adjustment.adjustmentAmount)}
                      </span>
                      <span className="text-sm ds-text-secondary">for</span>
                      <span className="text-sm font-medium ds-text-secondary">
                        {categoryLabels[adjustment.category] || adjustment.category}
                      </span>
                    </div>
                    <div className="text-sm ds-text-secondary mb-2">
                      <span>From: {formatCurrency(adjustment.currentBudget)}</span>
                      <span className="mx-2">→</span>
                      <span>To: {formatCurrency(adjustment.newBudget)}</span>
                    </div>
                    {adjustment.reason && (
                      <p className="text-sm ds-text-secondary mb-2">{adjustment.reason}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs ds-text-muted">
                      <span>
                        Requested by: {adjustment.requestedBy?.name || 'Unknown'}
                      </span>
                      <span>{formatDate(adjustment.createdAt)}</span>
                      {adjustment.approvedBy && (
                        <span>
                          {adjustment.status === 'approved' ? 'Approved' : 'Rejected'} by: {adjustment.approvedBy.name || 'Unknown'}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                      adjustment.status
                    )}`}
                  >
                    {adjustment.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adjustment Form Modal */}
      {showAdjustmentForm && (
        <BudgetAdjustmentForm
          projectId={projectId}
          onClose={() => {
            setShowAdjustmentForm(false);
            fetchAdjustments(); // Refresh adjustments after form closes
          }}
          onSuccess={() => {
            setShowAdjustmentForm(false);
            fetchAdjustments(); // Refresh adjustments after successful adjustment
          }}
        />
      )}
    </>
  );
}
