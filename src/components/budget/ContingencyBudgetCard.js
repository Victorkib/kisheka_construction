/**
 * Contingency Budget Card Component
 * Displays contingency reserve budget, usage, and breakdown by type
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';

export function ContingencyBudgetCard({ projectId }) {
  const { canAccess } = usePermissions();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [showDrawForm, setShowDrawForm] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchContingencyData();
    }
  }, [projectId]);

  const fetchContingencyData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectId}/contingency`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch contingency data');
      }

      setData(result.data);
    } catch (err) {
      console.error('Fetch contingency data error:', err);
      setError(err.message || 'Failed to load contingency data');
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'exceeded':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'critical':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'exceeded':
        return 'Exceeded';
      case 'critical':
        return 'Critical';
      case 'warning':
        return 'Warning';
      default:
        return 'Healthy';
    }
  };

  const getProgressBarColor = (percentage) => {
    if (percentage >= 100) return 'bg-red-600';
    if (percentage >= 90) return 'bg-orange-600';
    if (percentage >= 80) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  const typeLabels = {
    design: 'Design Contingency',
    construction: 'Construction Contingency',
    owners_reserve: "Owner's Reserve",
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-2 border-orange-200">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-2 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-2 border-red-200">
        <div className="text-red-600">
          <p className="font-semibold mb-2">Error loading contingency data</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.budgeted === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-2 border-orange-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Contingency Risk & Reserve
          </h3>
        </div>
        <p className="text-sm text-gray-600">Contingency reserve not set. Please set a project budget first.</p>
      </div>
    );
  }

  const { budgeted, used, remaining, usagePercentage, status, byType, pendingDraws } = data;

  return (
    <div className="bg-white rounded-lg shadow p-6 border-2 border-orange-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Contingency Risk & Reserve
        </h3>
        <div className="flex items-center gap-2">
          {pendingDraws > 0 && (
            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full font-semibold">
              {pendingDraws} Pending
            </span>
          )}
          <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${getStatusColor(status)}`}>
            {getStatusLabel(status)}
          </span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-600 mb-1">Budgeted</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(budgeted)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Used</p>
          <p className="text-xl font-semibold text-orange-600">{formatCurrency(used)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Remaining</p>
          <p className={`text-xl font-semibold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(remaining)}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Usage</span>
          <span className={`text-sm font-semibold ${
            usagePercentage >= 100 ? 'text-red-600' :
            usagePercentage >= 90 ? 'text-orange-600' :
            usagePercentage >= 80 ? 'text-yellow-600' :
            'text-green-600'
          }`}>
            {usagePercentage.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${getProgressBarColor(usagePercentage)}`}
            style={{ width: `${Math.min(100, usagePercentage)}%` }}
          ></div>
        </div>
      </div>

      {/* Type Breakdown */}
      <div className="border-t pt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-left text-sm font-semibold text-gray-700 hover:text-gray-900"
        >
          <span>Usage by Type</span>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${expanded ? 'transform rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expanded && (
          <div className="mt-4 space-y-3">
            {Object.entries(byType).map(([type, amount]) => {
              const typePercentage = budgeted > 0 ? (amount / budgeted) * 100 : 0;
              return (
                <div key={type} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {typeLabels[type] || type}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, typePercentage)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {typePercentage.toFixed(1)}% of total reserve
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t flex gap-2">
        {canAccess('request_contingency_draw') && (
          <button
            onClick={() => setShowDrawForm(true)}
            className="flex-1 text-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition"
          >
            Request Draw
          </button>
        )}
        <Link
          href={`/projects/${projectId}/contingency`}
          className="flex-1 text-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition"
        >
          View History
        </Link>
      </div>

      {/* Draw Request Form Modal */}
      {showDrawForm && (
        <ContingencyDrawForm
          projectId={projectId}
          onClose={() => {
            setShowDrawForm(false);
            fetchContingencyData(); // Refresh data after draw request
          }}
        />
      )}
    </div>
  );
}

/**
 * Contingency Draw Request Form Component
 */
function ContingencyDrawForm({ projectId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    drawType: 'construction',
    amount: '',
    reason: '',
    linkedTo: null,
  });
  const [budgetInfo, setBudgetInfo] = useState(null);

  useEffect(() => {
    if (projectId && formData.amount) {
      validateBudget();
    }
  }, [projectId, formData.amount, formData.drawType]);

  const validateBudget = async () => {
    if (!formData.amount) {
      setBudgetInfo(null);
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setBudgetInfo(null);
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/contingency`);
      const result = await response.json();

      if (result.success) {
        const summary = result.data;
        const available = summary.remaining || 0;
        const isValid = amount <= available;
        const usageAfter = summary.budgeted > 0 
          ? ((summary.used + amount) / summary.budgeted) * 100 
          : 0;

        setBudgetInfo({
          available,
          isValid,
          shortfall: Math.max(0, amount - available),
          usageAfter,
          warning: usageAfter >= 80 && usageAfter < 100,
          exceeded: amount > available,
        });
      }
    } catch (err) {
      console.error('Budget validation error:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.amount || !formData.reason) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (budgetInfo && budgetInfo.exceeded) {
      setError(`Cannot request draw: Insufficient contingency reserve. Available: ${new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(budgetInfo.available)}`);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/contingency/draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create contingency draw request');
      }

      onClose();
    } catch (err) {
      setError(err.message);
      console.error('Create contingency draw error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Request Contingency Draw</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Draw Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.drawType}
              onChange={(e) => setFormData({ ...formData, drawType: e.target.value })}
              required
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="design">Design Contingency</option>
              <option value="construction">Construction Contingency</option>
              <option value="owners_reserve">Owner's Reserve</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Amount (KES) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
              min="0"
              step="0.01"
              required
              className={`w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                budgetInfo?.exceeded ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {budgetInfo && (
              <div className={`mt-2 p-2 rounded text-xs ${
                budgetInfo.exceeded 
                  ? 'bg-red-50 text-red-700' 
                  : budgetInfo.warning 
                    ? 'bg-yellow-50 text-yellow-700' 
                    : 'bg-green-50 text-green-700'
              }`}>
                {budgetInfo.exceeded 
                  ? `Insufficient reserve. Available: ${new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(budgetInfo.available)}`
                  : budgetInfo.warning
                    ? `Usage will be ${budgetInfo.usageAfter.toFixed(1)}% after this draw`
                    : 'Budget available'}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={3}
              placeholder="Explain why this contingency draw is needed..."
              required
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (budgetInfo && budgetInfo.exceeded)}
              className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
