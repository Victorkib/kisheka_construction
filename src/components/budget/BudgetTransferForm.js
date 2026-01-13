/**
 * Budget Transfer Form Component
 * Allows users to request budget transfers between cost categories
 */

'use client';

import { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/use-permissions';

export function BudgetTransferForm({ projectId, onClose, onSuccess, initialData = null }) {
  const { canAccess } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [budgetInfo, setBudgetInfo] = useState(null);
  const [formData, setFormData] = useState({
    fromCategory: initialData?.fromCategory || '',
    toCategory: initialData?.toCategory || '',
    amount: initialData?.amount?.toString() || '',
    reason: initialData?.reason || '',
  });

  const categories = [
    { value: 'dcc', label: 'Direct Construction Costs (DCC)' },
    { value: 'preconstruction', label: 'Preconstruction Costs' },
    { value: 'indirect', label: 'Indirect Costs' },
    { value: 'contingency', label: 'Contingency Reserve' },
  ];

  // Fetch budget information when form data changes
  useEffect(() => {
    if (projectId && formData.fromCategory && formData.amount) {
      const timeoutId = setTimeout(() => {
        validateTransfer();
      }, 500); // Debounce
      return () => clearTimeout(timeoutId);
    } else {
      setBudgetInfo(null);
    }
  }, [projectId, formData.fromCategory, formData.amount]);

  const validateTransfer = async () => {
    if (!formData.fromCategory || !formData.toCategory || !formData.amount) {
      setBudgetInfo(null);
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setBudgetInfo(null);
      return;
    }

    try {
      // Fetch category budgets based on source category
      let available = 0;
      
      if (formData.fromCategory === 'dcc') {
        // Use dedicated DCC endpoint for accurate available budget
        const response = await fetch(`/api/projects/${projectId}/dcc`);
        const result = await response.json();
        if (result.success) {
          // Available = remaining DCC budget (budget - spent)
          available = result.data.remaining || 0;
        }
      } else if (formData.fromCategory === 'preconstruction') {
        const response = await fetch(`/api/projects/${projectId}/preconstruction`);
        const result = await response.json();
        if (result.success) {
          available = result.data.remaining || 0;
        }
      } else if (formData.fromCategory === 'indirect') {
        const response = await fetch(`/api/projects/${projectId}/indirect-costs`);
        const result = await response.json();
        if (result.success) {
          available = result.data.remaining || 0;
        }
      } else if (formData.fromCategory === 'contingency') {
        const response = await fetch(`/api/projects/${projectId}/contingency`);
        const result = await response.json();
        if (result.success) {
          available = result.data.remaining || 0;
        }
      }

      const isValid = amount <= available;
      setBudgetInfo({
        available,
        isValid,
        shortfall: Math.max(0, amount - available),
        exceeded: amount > available,
      });
    } catch (err) {
      console.error('Budget validation error:', err);
      setBudgetInfo(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check permission before submitting
    if (!canAccess('request_budget_transfer')) {
      setError('You do not have permission to request budget transfers. Please contact your administrator.');
      return;
    }
    
    setLoading(true);
    setError(null);

    if (!formData.fromCategory || !formData.toCategory || !formData.amount || !formData.reason) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (budgetInfo && budgetInfo.exceeded) {
      setError(`Cannot request transfer: Insufficient budget in ${formData.fromCategory}. Available: ${new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(budgetInfo.available)}`);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/budget/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create budget transfer request');
      }

      if (onSuccess) {
        onSuccess(data.data);
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      setError(err.message);
      console.error('Create budget transfer error:', err);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Request Budget Transfer</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            disabled={loading}
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                From Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.fromCategory}
                onChange={(e) => {
                  setFormData({ ...formData, fromCategory: e.target.value });
                  setBudgetInfo(null);
                }}
                required
                disabled={loading}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Select source category</option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                To Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.toCategory}
                onChange={(e) => setFormData({ ...formData, toCategory: e.target.value })}
                required
                disabled={loading}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Select target category</option>
                {categories
                  .filter(cat => cat.value !== formData.fromCategory && cat.value !== 'contingency')
                  .map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
              </select>
              {formData.fromCategory && (
                <p className="text-xs text-gray-500 mt-1">
                  Note: Cannot transfer to contingency reserve
                </p>
              )}
            </div>
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
              disabled={loading}
              className={`w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${
                budgetInfo?.exceeded ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {budgetInfo && (
              <div className={`mt-2 p-2 rounded text-xs ${
                budgetInfo.exceeded 
                  ? 'bg-red-50 text-red-700' 
                  : 'bg-green-50 text-green-700'
              }`}>
                {budgetInfo.exceeded 
                  ? `Insufficient budget. Available: ${formatCurrency(budgetInfo.available)}`
                  : `Available: ${formatCurrency(budgetInfo.available)}`}
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
              rows={4}
              placeholder="Explain why this budget transfer is needed..."
              required
              disabled={loading}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-semibold mb-1">⚠️ Important Notes:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Budget transfers require owner approval</li>
              <li>Cannot transfer to contingency reserve</li>
              <li>Cannot transfer from contingency if it has been used</li>
              <li>Transfer will be executed immediately upon approval</li>
            </ul>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (budgetInfo && budgetInfo.exceeded) || !formData.fromCategory || !formData.toCategory || !formData.amount || !formData.reason}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
