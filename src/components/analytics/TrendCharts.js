/**
 * Trend Charts Component
 * Displays spending trend analysis with charts
 */

'use client';

import { useState, useEffect } from 'react';

export function TrendCharts({ projectId }) {
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchTrends();
    }
  }, [projectId]);

  const fetchTrends = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectId}/trends`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch trends');
      }

      setTrends(result.data);
      // Set first category as default selection
      if (result.data.analyses && Object.keys(result.data.analyses).length > 0) {
        setSelectedCategory(Object.keys(result.data.analyses)[0]);
      }
    } catch (err) {
      console.error('Fetch trends error:', err);
      setError(err.message || 'Failed to load trends');
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

  const getTrendColor = (direction) => {
    switch (direction) {
      case 'increasing':
        return 'text-red-600 bg-red-50';
      case 'decreasing':
        return 'text-green-600 bg-green-50';
      case 'stable':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getConsistencyColor = (consistency) => {
    switch (consistency) {
      case 'very_consistent':
        return 'text-green-600';
      case 'consistent':
        return 'text-blue-600';
      case 'variable':
        return 'text-yellow-600';
      case 'highly_variable':
        return 'text-red-600';
      default:
        return 'text-gray-600';
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
      <div className="bg-white rounded-lg shadow p-6 border-2 border-gray-200">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-2 border-gray-200">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!trends || !trends.analyses) {
    return null;
  }

  const categories = Object.keys(trends.analyses);

  return (
    <div className="bg-white rounded-lg shadow p-6 border-2 border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          Spending Trends
        </h3>
        <button
          onClick={fetchTrends}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              selectedCategory === category
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {categoryLabels[category] || category}
          </button>
        ))}
      </div>

      {/* Selected Category Analysis */}
      {selectedCategory && trends.analyses[selectedCategory] && (
        <div className="space-y-6">
          {(() => {
            const analysis = trends.analyses[selectedCategory];
            return (
              <>
                {/* Trend Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Trend Direction</p>
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getTrendColor(analysis.trend.direction)}`}>
                      {analysis.trend.direction.toUpperCase()}
                    </span>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Change Rate</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {analysis.trend.changeRate > 0 ? '+' : ''}{analysis.trend.changeRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Trend Strength</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {analysis.trend.strength}%
                    </p>
                  </div>
                </div>

                {/* Pattern Analysis */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Spending Patterns</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Average Daily</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(analysis.patterns.averageDaily)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Peak Amount</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(analysis.patterns.peakAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Consistency</p>
                      <p className={`text-sm font-medium ${getConsistencyColor(analysis.patterns.consistency)}`}>
                        {analysis.patterns.consistency.replace('_', ' ').toUpperCase()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Data Points</p>
                      <p className="text-sm font-medium text-gray-900">
                        {analysis.dataPoints}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Simple Trend Visualization */}
                {analysis.movingAverages && analysis.movingAverages.weekly && analysis.movingAverages.weekly.length > 0 && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Trend Visualization</h4>
                    <div className="h-32 flex items-end justify-between gap-1">
                      {analysis.movingAverages.weekly.slice(-14).map((avg, index) => {
                        const weeklyData = analysis.movingAverages.weekly.slice(-14);
                        const max = weeklyData.length > 0 ? Math.max(...weeklyData) : 1;
                        const height = max > 0 ? (avg / max) * 100 : 0;
                        return (
                          <div
                            key={index}
                            className="flex-1 bg-blue-500 rounded-t"
                            style={{ height: `${height}%` }}
                            title={`Week ${index + 1}: ${formatCurrency(avg)}`}
                          ></div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">7-day moving average (last 14 periods)</p>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Insights */}
      {trends.insights && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-gray-900 mb-2">Trend Insights</h4>
          {trends.insights.fastestGrowing && (
            <p className="text-sm text-gray-700 mb-1">
              <span className="font-medium">Fastest Growing:</span> {categoryLabels[trends.insights.fastestGrowing.category] || trends.insights.fastestGrowing.category} 
              ({trends.insights.fastestGrowing.changeRate.toFixed(1)}% increase)
            </p>
          )}
          {trends.insights.fastestDeclining && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Fastest Declining:</span> {categoryLabels[trends.insights.fastestDeclining.category] || trends.insights.fastestDeclining.category} 
              ({trends.insights.fastestDeclining.changeRate.toFixed(1)}% decrease)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
