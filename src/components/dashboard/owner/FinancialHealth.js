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
    <div className="ds-bg-surface rounded-lg shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 border ds-border-subtle">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold ds-text-primary">Financial Health</h2>
        <Link
          href="/financing"
          className="text-xs sm:text-sm ds-text-accent-primary hover:ds-bg-accent-focus/10 active:ds-bg-accent-focus/20 font-medium transition-colors touch-manipulation"
        >
          View Details →
        </Link>
      </div>

      {/* Capital Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <div className="ds-bg-info rounded-lg p-4 sm:p-6 border ds-border-info">
          <p className="text-xs sm:text-sm font-medium ds-text-secondary mb-2">Total Capital Raised</p>
          <p className="text-2xl sm:text-3xl font-bold ds-text-info break-words">{formatCurrency(totalRaised)}</p>
        </div>
        <div className="ds-bg-success rounded-lg p-4 sm:p-6 border ds-border-success">
          <p className="text-xs sm:text-sm font-medium ds-text-secondary mb-2">Total Capital Used</p>
          <p className="text-2xl sm:text-3xl font-bold ds-text-success break-words">{formatCurrency(totalUsed)}</p>
          <p className="text-xs ds-text-muted mt-2">{utilization}% utilized</p>
        </div>
        <div className={`rounded-lg p-4 sm:p-6 border ${
          available < 0
            ? 'ds-bg-danger ds-border-danger'
            : available < totalRaised * 0.1
            ? 'ds-bg-warning ds-border-warning'
            : 'ds-bg-success ds-border-success'
        }`}>
          <p className="text-xs sm:text-sm font-medium ds-text-secondary mb-2">Available Capital</p>
          <p className={`text-2xl sm:text-3xl font-bold break-words ${
            available < 0
              ? 'ds-text-danger'
              : available < totalRaised * 0.1
              ? 'ds-text-warning'
              : 'ds-text-success'
          }`}>
            {formatCurrency(available)}
          </p>
        </div>
      </div>

      {/* Capital Utilization Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm ds-text-secondary mb-2">
          <span>Capital Utilization</span>
          <span>{capitalStatus.isOptional ? 'Not Set' : `${utilization}%`}</span>
        </div>
        {capitalStatus.isOptional ? (
          <div className="w-full ds-bg-info border ds-border-info rounded-lg p-3">
            <p className="text-sm ds-text-info">{capitalStatus.message}</p>
          </div>
        ) : (
          <div className="w-full ds-bg-surface-muted rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all ${
                capitalStatus.status === 'overspent'
                  ? 'ds-progress-danger'
                  : capitalStatus.status === 'low'
                  ? 'ds-progress-warning'
                  : 'ds-progress-success'
              }`}
              style={{ width: `${Math.min(100, capitalStatus.utilization || 0)}%` }}
            />
          </div>
        )}
      </div>

      {/* Budget vs Actual */}
      {budgetStatus.isOptional ? (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 ds-bg-info rounded-lg border ds-border-info">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold ds-text-info">Budget Status</h3>
            <span className="text-xs sm:text-sm font-medium ds-text-info-muted">Not Set</span>
          </div>
          <p className="text-xs sm:text-sm ds-text-info mb-3 break-words">{budgetStatus.message}</p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <p className="text-xs ds-text-info-muted mb-1">Current Spending</p>
              <p className="text-base sm:text-lg font-bold ds-text-info break-words">{formatCurrency(actualSpent)}</p>
            </div>
            <div>
              <p className="text-xs ds-text-info-muted mb-1">Budget</p>
              <p className="text-base sm:text-lg font-bold ds-text-info-muted">Not Set</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 ds-bg-surface-muted rounded-lg border ds-border-subtle">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold ds-text-primary">Budget vs Actual</h3>
            <span className={`text-xs sm:text-sm font-bold ${
              budgetStatus.status === 'over_budget' ? 'ds-text-danger' :
              budgetStatus.status === 'at_risk' ? 'ds-text-warning' :
              'ds-text-success'
            }`}>
              {budgetStatus.variance !== null && budgetStatus.variance < 0 ? '+' : ''}
              {budgetStatus.variance !== null ? formatPercentage(budgetStatus.variance, 'N/A') : 'N/A'} variance
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div>
              <p className="text-xs ds-text-secondary mb-1">Budgeted</p>
              <p className="text-base sm:text-lg font-bold ds-text-primary break-words">{formatCurrency(budgetTotal)}</p>
            </div>
            <div>
              <p className="text-xs ds-text-secondary mb-1">Actual Spent</p>
              <p className="text-base sm:text-lg font-bold ds-text-accent-primary break-words">{formatCurrency(actualSpent)}</p>
            </div>
          </div>
          <div className="w-full ds-bg-surface-muted rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                budgetStatus.status === 'over_budget'
                  ? 'ds-progress-danger'
                  : budgetStatus.status === 'at_risk'
                  ? 'ds-progress-warning'
                  : 'ds-progress-success'
              }`}
              style={{ width: `${Math.min(100, budgetStatus.utilization || 0)}%` }}
            />
          </div>
        </div>
      )}

      {/* Cost Breakdown */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold ds-text-primary mb-3 sm:mb-4">Cost Breakdown</h3>
        <div className="space-y-2 sm:space-y-3">
          <div>
            <div className="flex justify-between text-xs sm:text-sm mb-1">
              <span className="ds-text-secondary">Materials</span>
              <span className="font-semibold ds-text-primary break-words">
                {formatCurrency(costBreakdown.materials)} ({materialsPercent}%)
              </span>
            </div>
            <div className="w-full ds-bg-surface-muted rounded-full h-2">
              <div
                className="h-2 rounded-full ds-progress-info"
                style={{ width: `${materialsPercent}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs sm:text-sm mb-1">
              <span className="ds-text-secondary">Labour</span>
              <span className="font-semibold ds-text-primary break-words">
                {formatCurrency(costBreakdown.labour)} ({labourPercent}%)
              </span>
            </div>
            <div className="w-full ds-bg-surface-muted rounded-full h-2">
              <div
                className="h-2 rounded-full ds-progress-success"
                style={{ width: `${labourPercent}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs sm:text-sm mb-1">
              <span className="ds-text-secondary">Expenses</span>
              <span className="font-semibold ds-text-primary break-words">
                {formatCurrency(costBreakdown.expenses)} ({expensesPercent}%)
              </span>
            </div>
            <div className="w-full ds-bg-surface-muted rounded-full h-2">
              <div
                className="h-2 rounded-full ds-progress-warning"
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
