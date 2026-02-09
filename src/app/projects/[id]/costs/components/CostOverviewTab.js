/**
 * Cost Overview Tab
 * Summary view of all cost categories with quick access
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PreconstructionBudgetCard } from '@/components/budget/PreconstructionBudgetCard';
import { IndirectCostsBudgetCard } from '@/components/budget/IndirectCostsBudgetCard';
import { ContingencyBudgetCard } from '@/components/budget/ContingencyBudgetCard';

export function CostOverviewTab({ projectId }) {
  const [financialOverview, setFinancialOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchFinancialOverview();
    }
  }, [projectId]);

  const fetchFinancialOverview = async () => {
    try {
      setLoading(true);
      setError(null);

      const [overviewRes, dccRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/financial-overview`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
        fetch(`/api/projects/${projectId}/dcc`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
      ]);

      const overviewResult = await overviewRes.json();
      let dccData = null;
      
      if (dccRes) {
        const dccResult = await dccRes.json();
        if (dccResult.success) {
          dccData = dccResult.data;
        }
      }

      if (!overviewResult.success) {
        throw new Error(overviewResult.error || 'Failed to fetch financial overview');
      }

      const data = overviewResult.data;
      if (dccData) {
        data.dcc = dccData;
      }
      setFinancialOverview(data);
    } catch (err) {
      console.error('Fetch financial overview error:', err);
      setError(err.message || 'Failed to load financial overview');
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
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'at_risk':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
        <div className="animate-pulse">
          <div className="h-5 sm:h-6 bg-gray-200 rounded w-1/3 mb-3 sm:mb-4"></div>
          <div className="h-3 sm:h-4 bg-gray-200 rounded w-full mb-2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base">
          {error}
        </div>
      </div>
    );
  }

  const budget = financialOverview?.budget || {};
  const status = financialOverview?.status || {};

  // Calculate DCC summary - use comprehensive DCC data if available
  const dccBudget = budget.enhanced?.directConstructionCosts || 0;
  const dccData = financialOverview?.dcc;
  let dccSpent = 0;
  if (dccData && dccData.spent !== undefined) {
    dccSpent = dccData.spent;
  } else {
    // Fallback to phase spending
    const phases = financialOverview?.phases || [];
    dccSpent = phases.reduce((sum, phase) => sum + (phase.actualSpending?.total || 0), 0);
  }
  const dccRemaining = dccData?.remaining !== undefined ? dccData.remaining : (dccBudget - dccSpent);
  const dccUsage = dccBudget > 0 ? (dccSpent / dccBudget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Overall Budget Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Budget</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{formatCurrency(budget.total || 0)}</p>
          </div>
          <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Spent</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
              {formatCurrency(financialOverview?.financing?.totalUsed || 0)}
            </p>
          </div>
          <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Remaining</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{formatCurrency(budget.remaining || 0)}</p>
          </div>
          <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Status</p>
            <span
              className={`inline-flex px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold rounded-full ${getStatusColor(
                status.overall || 'unknown'
              )}`}
            >
              {status.overall === 'healthy' ? 'Healthy' : status.overall === 'at_risk' ? 'At Risk' : status.overall === 'critical' ? 'Critical' : 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Cost Category Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* DCC Card */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200 hover:border-blue-300 transition">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-2">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-lg sm:text-xl">🏗️</span>
              <span className="break-words">Direct Construction Costs</span>
            </h3>
            <Link
              href={`/projects/${projectId}/costs?tab=dcc`}
              className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
            >
              View Details →
            </Link>
          </div>
          <div className="space-y-2 sm:space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">Budgeted</span>
              <span className="text-xs sm:text-sm font-semibold text-gray-900 break-words text-right ml-2">{formatCurrency(dccBudget)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">Spent</span>
              <span className="text-xs sm:text-sm font-semibold text-gray-900 break-words text-right ml-2">{formatCurrency(dccSpent)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-gray-600">Remaining</span>
              <span className="text-xs sm:text-sm font-semibold text-gray-900 break-words text-right ml-2">{formatCurrency(dccRemaining)}</span>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Usage</span>
                <span>{dccUsage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    dccUsage >= 100
                      ? 'bg-red-600'
                      : dccUsage >= 80
                      ? 'bg-yellow-600'
                      : 'bg-green-600'
                  }`}
                  style={{ width: `${Math.min(100, dccUsage)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Preconstruction Card */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-2">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-lg sm:text-xl">📋</span>
              <span className="break-words">Preconstruction Costs</span>
            </h3>
            <Link
              href={`/projects/${projectId}/costs?tab=preconstruction`}
              className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
            >
              View Details →
            </Link>
          </div>
          <PreconstructionBudgetCard projectId={projectId} />
        </div>

        {/* Indirect Costs Card */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-2">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-lg sm:text-xl">⚙️</span>
              <span className="break-words">Indirect Costs</span>
            </h3>
            <Link
              href={`/projects/${projectId}/costs?tab=indirect`}
              className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
            >
              View Details →
            </Link>
          </div>
          <IndirectCostsBudgetCard projectId={projectId} />
        </div>

        {/* Contingency Card */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 gap-2">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-lg sm:text-xl">🛡️</span>
              <span className="break-words">Contingency Reserve</span>
            </h3>
            <Link
              href={`/projects/${projectId}/costs?tab=contingency`}
              className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
            >
              View Details →
            </Link>
          </div>
          <ContingencyBudgetCard projectId={projectId} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <Link
            href={`/projects/${projectId}/costs?tab=transfers`}
            className="p-3 sm:p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <div className="text-xl sm:text-2xl mb-2">🔄</div>
            <div className="text-sm sm:text-base font-semibold text-gray-900">Request Budget Transfer</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1">Move funds between categories</div>
          </Link>
          <Link
            href={`/projects/${projectId}/costs?tab=adjustments`}
            className="p-3 sm:p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <div className="text-xl sm:text-2xl mb-2">📝</div>
            <div className="text-sm sm:text-base font-semibold text-gray-900">Request Budget Adjustment</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1">Increase or decrease budgets</div>
          </Link>
          <Link
            href={`/projects/${projectId}/costs?tab=reports`}
            className="p-3 sm:p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-center"
          >
            <div className="text-xl sm:text-2xl mb-2">📄</div>
            <div className="text-sm sm:text-base font-semibold text-gray-900">Generate Report</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1">Create financial reports</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
