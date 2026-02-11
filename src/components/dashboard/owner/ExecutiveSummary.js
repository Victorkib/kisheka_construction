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
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthStatus = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-6 mb-8 border border-blue-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Portfolio Overview</h2>
        <span className="text-sm text-gray-600">Executive Summary</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <Link
          href="/projects"
          className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-all border border-gray-200 hover:border-blue-300"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Projects</span>
            <span className="text-2xl">🏗️</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{totalProjects}</p>
          <p className="text-xs text-gray-500">
            {activeProjects} active • {statusBreakdown?.completed || 0} completed
          </p>
        </Link>

        {/* Capital Status */}
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Capital</span>
            <span className="text-2xl">💰</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {formatCurrency(totalCapitalRaised)}
          </p>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Used: {formatCurrency(totalCapitalUsed)}</span>
              <span>{capitalUtilization}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  capitalUtilization > 90
                    ? 'bg-red-500'
                    : capitalUtilization > 75
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, capitalUtilization)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Portfolio Health */}
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Portfolio Health</span>
            <span className="text-2xl">📊</span>
          </div>
          <p className={`text-3xl font-bold mb-1 ${getHealthColor(portfolioHealthScore)}`}>
            {portfolioHealthScore}
          </p>
          <p className="text-xs text-gray-500">
            {getHealthStatus(portfolioHealthScore)} • {criticalIssues} critical issues
          </p>
        </div>

        {/* Monthly Spending */}
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Monthly Spending</span>
            <span className="text-2xl">📈</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-1">
            {formatCurrency(monthlySpending)}
          </p>
          <p className="text-xs text-gray-500">Last 30 days</p>
        </div>
      </div>

      {/* Available Capital Highlight */}
      <div className="mt-6 bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Available Capital</p>
            <p className={`text-2xl font-bold mt-1 ${
              availableCapital < 0
                ? 'text-red-600'
                : availableCapital < totalCapitalRaised * 0.1
                ? 'text-yellow-600'
                : 'text-green-600'
            }`}>
              {formatCurrency(availableCapital)}
            </p>
          </div>
          <Link
            href="/financing"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            View Finances →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ExecutiveSummary;
