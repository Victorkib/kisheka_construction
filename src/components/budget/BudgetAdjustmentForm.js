/**
 * Budget Adjustment Form Component
 * Allows users to request budget adjustments (increases/decreases) to cost categories
 */

'use client';

import { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/use-permissions';

export function BudgetAdjustmentForm({ projectId, onClose, onSuccess, initialData = null }) {
  const { canAccess } = usePermissions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [budgetInfo, setBudgetInfo] = useState(null);
  const [formData, setFormData] = useState({
    category: initialData?.category || '',
    adjustmentType: initialData?.adjustmentType || 'increase',
    adjustmentAmount: initialData?.adjustmentAmount?.toString() || '',
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
    if (projectId && formData.category && formData.adjustmentAmount) {
      const timeoutId = setTimeout(() => {
        validateAdjustment();
      }, 500); // Debounce
      return () => clearTimeout(timeoutId);
    } else {
      setBudgetInfo(null);
    }
  }, [projectId, formData.category, formData.adjustmentAmount, formData.adjustmentType]);

  const validateAdjustment = async () => {
    if (!formData.category || !formData.adjustmentAmount) {
      setBudgetInfo(null);
      return;
    }

    const amount = parseFloat(formData.adjustmentAmount);
    if (isNaN(amount) || amount <= 0) {
      setBudgetInfo(null);
      return;
    }

    try {
      // Fetch category budgets based on category
      let currentBudget = 0;
      
      if (formData.category === 'dcc') {
        const dccResponse = await fetch(`/api/projects/${projectId}/financial-overview`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const result = await dccResponse.json();
        if (result.success) {
          currentBudget = result.data.budget?.directConstructionCosts || 0;
        }
      } else if (formData.category === 'preconstruction') {
        const preconstructionResponse = await fetch(`/api/projects/${projectId}/preconstruction`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const result = await preconstructionResponse.json();
        if (result.success) {
          currentBudget = result.data.budgeted || 0;
        }
      } else if (formData.category === 'indirect') {
        const indirectResponse = await fetch(`/api/projects/${projectId}/indirect-costs`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const result = await indirectResponse.json();
        if (result.success) {
          currentBudget = result.data.budgeted || 0;
        }
      } else if (formData.category === 'contingency') {
        const contingencyResponse = await fetch(`/api/projects/${projectId}/contingency`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const result = await contingencyResponse.json();
        if (result.success) {
          currentBudget = result.data.budgeted || 0;
        }
      }

      const newBudget = formData.adjustmentType === 'increase' 
        ? currentBudget + amount 
        : currentBudget - amount;

      const isValid = formData.adjustmentType === 'increase' || newBudget >= 0;
      setBudgetInfo({
        currentBudget,
        newBudget,
        isValid,
        wouldBeNegative: formData.adjustmentType === 'decrease' && newBudget < 0,
      });
    } catch (err) {
      console.error('Budget validation error:', err);
      setBudgetInfo(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.category || !formData.adjustmentAmount || !formData.reason) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (budgetInfo && budgetInfo.wouldBeNegative) {
      setError(`Cannot decrease budget below 0. Current budget: ${formatCurrency(budgetInfo.currentBudget)}`);
      setLoading(false);
      return;
    }

    try {
      const adjustmentResponse = await fetch(`/api/projects/${projectId}/budget/adjustment`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          category: formData.category,
          adjustmentType: formData.adjustmentType,
          adjustmentAmount: parseFloat(formData.adjustmentAmount),
          reason: formData.reason,
        }),
      });

      const data = await adjustmentResponse.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create budget adjustment request');
      }

      if (onSuccess) {
        onSuccess(data.data);
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      setError(err.message);
      console.error('Create budget adjustment error:', err);
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
          <h3 className="text-xl font-semibold text-gray-900">Request Budget Adjustment</h3>
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
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => {
                  setFormData({ ...formData, category: e.target.value });
                  setBudgetInfo(null);
                }}
                required
                disabled={loading}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Adjustment Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.adjustmentType}
                onChange={(e) => {
                  setFormData({ ...formData, adjustmentType: e.target.value });
                  setBudgetInfo(null);
                }}
                required
                disabled={loading}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="increase">Increase Budget</option>
                <option value="decrease">Decrease Budget</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Adjustment Amount (KES) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.adjustmentAmount}
              onChange={(e) => setFormData({ ...formData, adjustmentAmount: e.target.value })}
              placeholder="0.00"
              min="0"
              step="0.01"
              required
              disabled={loading}
              className={`w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${
                budgetInfo?.wouldBeNegative ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {budgetInfo && (
              <div className="mt-2 space-y-1">
                <div className="text-xs text-gray-600">
                  Current Budget: {formatCurrency(budgetInfo.currentBudget)}
                </div>
                <div className={`text-xs font-semibold ${
                  budgetInfo.wouldBeNegative ? 'text-red-700' : 'text-green-700'
                }`}>
                  New Budget: {formatCurrency(budgetInfo.newBudget)}
                  {budgetInfo.wouldBeNegative && ' (Invalid - would be negative)'}
                </div>
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
              placeholder="Explain why this budget adjustment is needed..."
              required
              disabled={loading}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <p className="font-semibold mb-1">⚠️ Important Notes:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Budget adjustments require owner approval</li>
              <li>Decreases cannot make budget negative or below current spending</li>
              <li>Adjustment will be executed immediately upon approval</li>
              <li>Total project budget will be updated accordingly</li>
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
              disabled={loading || (budgetInfo && budgetInfo.wouldBeNegative) || !formData.category || !formData.adjustmentAmount || !formData.reason}
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
