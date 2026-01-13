/**
 * Preconstruction Budget Card Component
 * Displays preconstruction budget, spending, and breakdown by category
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function PreconstructionBudgetCard({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchPreconstructionData();
    }
  }, [projectId]);

  const fetchPreconstructionData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectId}/preconstruction`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch preconstruction data');
      }

      setData(result.data);
    } catch (err) {
      console.error('Fetch preconstruction data error:', err);
      setError(err.message || 'Failed to load preconstruction data');
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

  const categoryLabels = {
    landAcquisition: 'Land Acquisition',
    legalRegulatory: 'Legal & Regulatory',
    permitsApprovals: 'Permits & Approvals',
    sitePreparation: 'Site Preparation',
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-2 border-purple-200">
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
          <p className="font-semibold mb-2">Error loading preconstruction data</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.budgeted === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-2 border-purple-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Preconstruction Costs
          </h3>
        </div>
        <p className="text-sm text-gray-600">Preconstruction budget not set. Please set a project budget first.</p>
      </div>
    );
  }

  const { budgeted, spent, remaining, usagePercentage, status, byCategory } = data;

  return (
    <div className="bg-white rounded-lg shadow p-6 border-2 border-purple-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Preconstruction Costs
        </h3>
        <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${getStatusColor(status)}`}>
          {getStatusLabel(status)}
        </span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-600 mb-1">Budgeted</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(budgeted)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600 mb-1">Spent</p>
          <p className="text-xl font-semibold text-purple-600">{formatCurrency(spent)}</p>
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

      {/* Category Breakdown */}
      <div className="border-t pt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-left text-sm font-semibold text-gray-700 hover:text-gray-900"
        >
          <span>Category Breakdown</span>
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
            {Object.entries(byCategory).map(([category, amount]) => {
              const categoryPercentage = budgeted > 0 ? (amount / budgeted) * 100 : 0;
              return (
                <div key={category} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {categoryLabels[category] || category}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, categoryPercentage)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {categoryPercentage.toFixed(1)}% of total budget
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t flex gap-2">
        <Link
          href={`/initial-expenses/new?projectId=${projectId}`}
          className="flex-1 text-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition"
        >
          Add Initial Expense
        </Link>
        <Link
          href={`/initial-expenses?projectId=${projectId}`}
          className="flex-1 text-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition"
        >
          View All
        </Link>
      </div>
    </div>
  );
}
