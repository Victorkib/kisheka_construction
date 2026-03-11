/**
 * Forecast Display Component
 * Displays spending forecasts for all cost categories
 */

'use client';

import { useState, useEffect } from 'react';

export function ForecastDisplay({ projectId }) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchForecast();
    }
  }, [projectId]);

  const fetchForecast = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectId}/forecast`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch forecast');
      }

      setForecast(result.data);
    } catch (err) {
      console.error('Fetch forecast error:', err);
      setError(err.message || 'Failed to load forecast');
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

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'ds-text-secondary ds-bg-surface-muted';
    }
  };

  const categoryLabels = {
    dcc: 'Direct Construction Costs',
    preconstruction: 'Preconstruction Costs',
    indirect: 'Indirect Costs',
    contingency: 'Contingency Reserve',
  };

  if (loading) {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-6 border-2 ds-border-subtle">
        <div className="animate-pulse">
          <div className="h-6 ds-bg-surface-muted rounded w-1/3 mb-4"></div>
          <div className="h-4 ds-bg-surface-muted rounded w-full mb-2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-6 border-2 ds-border-subtle">
        <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!forecast) {
    return null;
  }

  return (
    <div className="ds-bg-surface rounded-lg shadow p-6 border-2 ds-border-subtle">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold ds-text-primary flex items-center gap-2">
          <svg className="w-5 h-5 ds-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Spending Forecast
        </h3>
        <button
          onClick={fetchForecast}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Summary */}
      {forecast.summary && (
        <div className="mb-6 p-4 ds-bg-surface-muted rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs ds-text-secondary mb-1">Total Budgeted</p>
              <p className="text-sm font-semibold ds-text-primary">
                {formatCurrency(forecast.summary.totalBudgeted)}
              </p>
            </div>
            <div>
              <p className="text-xs ds-text-secondary mb-1">Current Spending</p>
              <p className="text-sm font-semibold ds-text-primary">
                {formatCurrency(forecast.summary.totalCurrentSpending)}
              </p>
            </div>
            <div>
              <p className="text-xs ds-text-secondary mb-1">Forecasted Total</p>
              <p className={`text-sm font-semibold ${
                forecast.summary.totalVariance >= 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatCurrency(forecast.summary.totalForecasted)}
              </p>
            </div>
            <div>
              <p className="text-xs ds-text-secondary mb-1">Variance</p>
              <p className={`text-sm font-semibold ${
                forecast.summary.totalVariance >= 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatCurrency(forecast.summary.totalVariance)} ({forecast.summary.totalVariancePercentage.toFixed(1)}%)
              </p>
            </div>
          </div>
          <div className="mt-3">
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getRiskColor(forecast.summary.overallRisk)}`}>
              Overall Risk: {forecast.summary.overallRisk.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Category Forecasts */}
      <div className="space-y-4">
        {Object.entries(forecast.forecasts || {}).map(([category, data]) => (
          <div key={category} className="border ds-border-subtle rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold ds-text-primary">
                {categoryLabels[category] || category}
              </h4>
              <span className={`px-2 py-1 text-xs font-semibold rounded ${getRiskColor(data.riskLevel)}`}>
                {data.riskLevel.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
              <div>
                <p className="text-xs ds-text-secondary mb-1">Budgeted</p>
                <p className="text-sm font-medium ds-text-primary">
                  {formatCurrency(data.budgeted)}
                </p>
              </div>
              <div>
                <p className="text-xs ds-text-secondary mb-1">Current</p>
                <p className="text-sm font-medium ds-text-primary">
                  {formatCurrency(data.currentSpending)}
                </p>
              </div>
              <div>
                <p className="text-xs ds-text-secondary mb-1">Forecasted</p>
                <p className={`text-sm font-medium ${
                  data.variance >= 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {formatCurrency(data.forecastedSpending)}
                </p>
              </div>
              <div>
                <p className="text-xs ds-text-secondary mb-1">Variance</p>
                <p className={`text-sm font-medium ${
                  data.variance >= 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {formatCurrency(data.variance)} ({data.variancePercentage.toFixed(1)}%)
                </p>
              </div>
            </div>

            <div className="text-xs ds-text-muted">
              Daily velocity: {formatCurrency(data.dailyVelocity)} | Days remaining: {data.daysRemaining} | Data points: {data.historyPoints}
            </div>
          </div>
        ))}
      </div>

      {forecast.generatedAt && (
        <div className="mt-4 text-xs ds-text-muted text-center">
          Forecast generated: {new Date(forecast.generatedAt).toLocaleString('en-KE')}
        </div>
      )}
    </div>
  );
}
