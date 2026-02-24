/**
 * Financial Health Component
 * Displays portfolio-wide financial status
 */

'use client';

import Link from 'next/link';
import { getCapitalStatus, getBudgetStatus, formatPercentage, safePercentage } from '@/lib/financial-status-helpers';

export function FinancialHealth({ data, formatCurrency }) {
  if (!data) return null;

  const {
    totalRaised,
    totalUsed,
    available,
    budgetTotal,
    actualSpent,
    costBreakdown,
    budgetVariance,
    committedCost,
  } = data;

  // Use financial status helpers for accurate status determination
  const capitalStatus = getCapitalStatus(totalRaised, totalUsed, available, committedCost || 0);
  const budgetStatus = getBudgetStatus(budgetTotal, actualSpent);

  // Use safe percentage calculations
  const utilization = capitalStatus.utilization !== null ? capitalStatus.utilization.toFixed(1) : 'N/A';
  const budgetUtilization = budgetStatus.utilization !== null ? budgetStatus.utilization.toFixed(1) : 'N/A';

  // Calculate percentages for cost breakdown
  const totalCost = costBreakdown.materials + costBreakdown.labour + costBreakdown.expenses;
  const materialsPercent = totalCost > 0 ? ((costBreakdown.materials / totalCost) * 100).toFixed(1) : 0;
  const labourPercent = totalCost > 0 ? ((costBreakdown.labour / totalCost) * 100).toFixed(1) : 0;
  const expensesPercent = totalCost > 0 ? ((costBreakdown.expenses / totalCost) * 100).toFixed(1) : 0;

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6 sm:mb-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Financial Health</h2>
        <Link
          href="/financing"
          className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 active:text-blue-900 font-medium transition-colors touch-manipulation"
        >
          View Details →
        </Link>
      </div>

      {/* Capital Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 sm:p-6 border border-blue-200">
          <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Total Capital Raised</p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-900 break-words">{formatCurrency(totalRaised)}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 sm:p-6 border border-green-200">
          <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Total Capital Used</p>
          <p className="text-2xl sm:text-3xl font-bold text-green-900 break-words">{formatCurrency(totalUsed)}</p>
          <p className="text-xs text-gray-600 mt-2">{utilization}% utilized</p>
        </div>
        <div className={`rounded-lg p-4 sm:p-6 border ${
          available < 0
            ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
            : available < totalRaised * 0.1
            ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200'
            : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
        }`}>
          <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Available Capital</p>
          <p className={`text-2xl sm:text-3xl font-bold break-words ${
            available < 0
              ? 'text-red-900'
              : available < totalRaised * 0.1
              ? 'text-yellow-900'
              : 'text-green-900'
          }`}>
            {formatCurrency(available)}
          </p>
        </div>
      </div>

      {/* Capital Utilization Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Capital Utilization</span>
          <span>{capitalStatus.isOptional ? 'Not Set' : `${utilization}%`}</span>
        </div>
        {capitalStatus.isOptional ? (
          <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">{capitalStatus.message}</p>
          </div>
        ) : (
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all ${
                capitalStatus.status === 'overspent'
                  ? 'bg-red-500'
                  : capitalStatus.status === 'low'
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, capitalStatus.utilization || 0)}%` }}
            />
          </div>
        )}
      </div>

      {/* Budget vs Actual */}
      {budgetStatus.isOptional ? (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-blue-900">Budget Status</h3>
            <span className="text-xs sm:text-sm font-medium text-blue-700">Not Set</span>
          </div>
          <p className="text-xs sm:text-sm text-blue-800 mb-3 break-words">{budgetStatus.message}</p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <p className="text-xs text-blue-600 mb-1">Current Spending</p>
              <p className="text-base sm:text-lg font-bold text-blue-900 break-words">{formatCurrency(actualSpent)}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 mb-1">Budget</p>
              <p className="text-base sm:text-lg font-bold text-blue-700">Not Set</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Budget vs Actual</h3>
            <span className={`text-xs sm:text-sm font-bold ${
              budgetStatus.status === 'over_budget' ? 'text-red-600' : 
              budgetStatus.status === 'at_risk' ? 'text-yellow-600' : 
              'text-green-600'
            }`}>
              {budgetStatus.variance !== null && budgetStatus.variance < 0 ? '+' : ''}
              {budgetStatus.variance !== null ? formatPercentage(budgetStatus.variance, 'N/A') : 'N/A'} variance
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div>
              <p className="text-xs text-gray-600 mb-1">Budgeted</p>
              <p className="text-base sm:text-lg font-bold text-gray-900 break-words">{formatCurrency(budgetTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Actual Spent</p>
              <p className="text-base sm:text-lg font-bold text-blue-600 break-words">{formatCurrency(actualSpent)}</p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                budgetStatus.status === 'over_budget'
                  ? 'bg-red-500'
                  : budgetStatus.status === 'at_risk'
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, budgetStatus.utilization || 0)}%` }}
            />
          </div>
        </div>
      )}

      {/* Cost Breakdown */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Cost Breakdown</h3>
        <div className="space-y-2 sm:space-y-3">
          <div>
            <div className="flex justify-between text-xs sm:text-sm mb-1">
              <span className="text-gray-700">Materials</span>
              <span className="font-semibold text-gray-900 break-words">
                {formatCurrency(costBreakdown.materials)} ({materialsPercent}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${materialsPercent}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs sm:text-sm mb-1">
              <span className="text-gray-700">Labour</span>
              <span className="font-semibold text-gray-900 break-words">
                {formatCurrency(costBreakdown.labour)} ({labourPercent}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-green-500"
                style={{ width: `${labourPercent}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs sm:text-sm mb-1">
              <span className="text-gray-700">Expenses</span>
              <span className="font-semibold text-gray-900 break-words">
                {formatCurrency(costBreakdown.expenses)} ({expensesPercent}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-purple-500"
                style={{ width: `${expensesPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FinancialHealth;
