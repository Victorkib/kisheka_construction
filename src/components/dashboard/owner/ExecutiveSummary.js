/**
 * Executive Summary Component
 * Displays top-level KPIs for owner dashboard
 */

'use client';

import Link from 'next/link';

export function ExecutiveSummary({ data, formatCurrency }) {
  if (!data) return null;

  const {
    totalProjects,
    activeProjects,
    statusBreakdown,
    totalCapitalRaised,
    totalCapitalUsed,
    availableCapital,
    portfolioHealthScore,
    criticalIssues,
    monthlySpending,
  } = data;

  const capitalUtilization = totalCapitalRaised > 0
    ? ((totalCapitalUsed / totalCapitalRaised) * 100).toFixed(1)
    : 0;

  const getHealthColor = (score) => {
    if (score >= 80) return 'ds-text-success';
    if (score >= 60) return 'ds-text-info';
    if (score >= 40) return 'ds-text-warning';
    return 'ds-text-danger';
  };

  const getHealthStatus = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="ds-bg-surface rounded-xl shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 border ds-border-subtle">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold ds-text-primary">Portfolio Overview</h2>
        <span className="text-xs sm:text-sm ds-text-secondary">Executive Summary</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Projects */}
        <Link
          href="/projects"
          className="ds-bg-surface rounded-lg p-4 sm:p-6 shadow-md hover:shadow-lg active:shadow-xl transition-all border ds-border-subtle hover:border-blue-400/60 active:border-blue-500/60 touch-manipulation"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium ds-text-secondary">Total Projects</span>
            <span className="text-xl sm:text-2xl">🏗️</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold ds-text-primary mb-1">{totalProjects}</p>
          <p className="text-xs ds-text-muted">
            {activeProjects} active • {statusBreakdown?.completed || 0} completed
          </p>
        </Link>

        {/* Capital Status */}
        <div className="ds-bg-surface rounded-lg p-4 sm:p-6 shadow-md border ds-border-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium ds-text-secondary">Total Capital</span>
            <span className="text-xl sm:text-2xl">💰</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold ds-text-primary mb-1 break-words">
            {formatCurrency(totalCapitalRaised)}
          </p>
          <div className="mt-2">
            <div className="flex justify-between text-xs ds-text-secondary mb-1">
              <span>Used: {formatCurrency(totalCapitalUsed)}</span>
              <span>{capitalUtilization}%</span>
            </div>
            <div className="w-full ds-bg-surface-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  capitalUtilization > 90
                    ? 'ds-progress-danger'
                    : capitalUtilization > 75
                    ? 'ds-progress-warning'
                    : 'ds-progress-success'
                }`}
                style={{ width: `${Math.min(100, capitalUtilization)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Portfolio Health */}
        <div className="ds-bg-surface rounded-lg p-4 sm:p-6 shadow-md border ds-border-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium ds-text-secondary">Portfolio Health</span>
            <span className="text-xl sm:text-2xl">📊</span>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold mb-1 ${getHealthColor(portfolioHealthScore)}`}>
            {portfolioHealthScore}
          </p>
          <p className="text-xs ds-text-muted">
            {getHealthStatus(portfolioHealthScore)} • {criticalIssues} critical issues
          </p>
        </div>

        {/* Monthly Spending */}
        <div className="ds-bg-surface rounded-lg p-4 sm:p-6 shadow-md border ds-border-subtle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm font-medium ds-text-secondary">Monthly Spending</span>
            <span className="text-xl sm:text-2xl">📈</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold ds-text-primary mb-1 break-words">
            {formatCurrency(monthlySpending)}
          </p>
          <p className="text-xs ds-text-muted">Last 30 days</p>
        </div>
      </div>

      {/* Available Capital Highlight */}
      <div className="mt-4 sm:mt-6 ds-bg-surface rounded-lg p-4 border ds-border-subtle">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium ds-text-secondary">Available Capital</p>
            <p className={`text-xl sm:text-2xl font-bold mt-1 break-words ${
              availableCapital < 0
                ? 'ds-text-danger'
                : availableCapital < totalCapitalRaised * 0.1
                ? 'ds-text-warning'
                : 'ds-text-success'
            }`}>
              {formatCurrency(availableCapital)}
            </p>
          </div>
          <Link
            href="/financing"
            className="w-full sm:w-auto px-4 py-2.5 ds-bg-accent-primary ds-text-inverse rounded-lg hover:ds-bg-accent-focus transition-colors text-sm font-medium text-center touch-manipulation"
          >
            View Finances →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ExecutiveSummary;
