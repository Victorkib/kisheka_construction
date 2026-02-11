/**
 * Financial Health Component
 * Displays portfolio-wide financial status
 */

'use client';

import Link from 'next/link';

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
  } = data;

  const utilization = totalRaised > 0 ? ((totalUsed / totalRaised) * 100).toFixed(1) : 0;
  const budgetUtilization = budgetTotal > 0 ? ((actualSpent / budgetTotal) * 100).toFixed(1) : 0;

  // Calculate percentages for cost breakdown
  const totalCost = costBreakdown.materials + costBreakdown.labour + costBreakdown.expenses;
  const materialsPercent = totalCost > 0 ? ((costBreakdown.materials / totalCost) * 100).toFixed(1) : 0;
  const labourPercent = totalCost > 0 ? ((costBreakdown.labour / totalCost) * 100).toFixed(1) : 0;
  const expensesPercent = totalCost > 0 ? ((costBreakdown.expenses / totalCost) * 100).toFixed(1) : 0;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Financial Health</h2>
        <Link
          href="/financing"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          View Details →
        </Link>
      </div>

      {/* Capital Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
          <p className="text-sm font-medium text-gray-700 mb-2">Total Capital Raised</p>
          <p className="text-3xl font-bold text-blue-900">{formatCurrency(totalRaised)}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
          <p className="text-sm font-medium text-gray-700 mb-2">Total Capital Used</p>
          <p className="text-3xl font-bold text-green-900">{formatCurrency(totalUsed)}</p>
          <p className="text-xs text-gray-600 mt-2">{utilization}% utilized</p>
        </div>
        <div className={`rounded-lg p-6 border ${
          available < 0
            ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
            : available < totalRaised * 0.1
            ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200'
            : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
        }`}>
          <p className="text-sm font-medium text-gray-700 mb-2">Available Capital</p>
          <p className={`text-3xl font-bold ${
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
          <span>{utilization}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${
              utilization > 90
                ? 'bg-red-500'
                : utilization > 75
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(100, utilization)}%` }}
          />
        </div>
      </div>

      {/* Budget vs Actual */}
      {budgetTotal > 0 && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Budget vs Actual</h3>
            <span className={`text-sm font-bold ${
              budgetVariance > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {budgetVariance > 0 ? '+' : ''}{budgetVariance.toFixed(1)}% variance
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-600 mb-1">Budgeted</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(budgetTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Actual Spent</p>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(actualSpent)}</p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                budgetUtilization > 100
                  ? 'bg-red-500'
                  : budgetUtilization > 80
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, budgetUtilization)}%` }}
            />
          </div>
        </div>
      )}

      {/* Cost Breakdown */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Breakdown</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">Materials</span>
              <span className="font-semibold text-gray-900">
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
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">Labour</span>
              <span className="font-semibold text-gray-900">
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
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700">Expenses</span>
              <span className="font-semibold text-gray-900">
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
