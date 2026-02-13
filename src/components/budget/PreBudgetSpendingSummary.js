/**
 * Pre-Budget Spending Summary Component
 * Displays comprehensive spending summary for projects with zero budget
 * Shows spending by category, phase, and floor with recommendations
 */

'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function PreBudgetSpendingSummary({ projectId, onRecommendationClick }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    phases: false,
    floors: false,
    breakdown: true
  });

  useEffect(() => {
    if (projectId) {
      fetchSummary();
    }
  }, [projectId]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectId}/pre-budget-summary`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch spending summary');
      }

      setData(result.data);
    } catch (err) {
      console.error('Fetch pre-budget summary error:', err);
      setError(err.message || 'Failed to load spending summary');
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 text-sm">{error}</p>
        <button
          onClick={fetchSummary}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || !data.hasSpending) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-700 text-sm">
          No spending has been recorded yet. You can add a budget at any time.
        </p>
      </div>
    );
  }

  const { totalSpending, dccBreakdown, phaseSpending, floorSpending, recommendations, summary } = data;

  // Prepare chart data
  const categoryData = [
    { name: 'DCC', value: totalSpending.dcc, recommended: recommendations.dcc },
    { name: 'Pre-Construction', value: totalSpending.preConstruction, recommended: recommendations.preConstruction },
    { name: 'Indirect', value: totalSpending.indirect, recommended: recommendations.indirect },
    { name: 'Contingency', value: totalSpending.contingency, recommended: recommendations.contingency },
  ].filter(item => item.value > 0);

  const dccBreakdownData = [
    { name: 'Materials', value: dccBreakdown.materials },
    { name: 'Labour', value: dccBreakdown.labour },
    { name: 'Equipment', value: dccBreakdown.equipment },
    { name: 'Expenses', value: dccBreakdown.expenses },
    { name: 'Work Items', value: dccBreakdown.workItems },
  ].filter(item => item.value > 0);

  const phaseData = phaseSpending
    .filter(p => p.actualSpending > 0)
    .map(phase => ({
      name: phase.phaseName,
      spent: phase.actualSpending,
      committed: phase.committedCost,
      minimum: phase.minimumRequired,
      recommended: data.phaseRecommendations?.find(r => r.phaseId === phase.phaseId)?.recommended || 0
    }));

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Existing Spending Summary</h2>
            <p className="text-sm text-gray-600 mt-1">
              Review current spending before adding budget. Budget allocations will account for existing spending.
            </p>
          </div>
          {onRecommendationClick && (
            <button
              onClick={() => onRecommendationClick(recommendations)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
            >
              Use Recommended Budget
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-900">Total Spent</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{formatCurrency(summary.totalSpent)}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-900">Committed</p>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{formatCurrency(summary.totalCommitted)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-900">Minimum Required</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{formatCurrency(summary.totalRequired)}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm font-medium text-green-900">Recommended</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(summary.recommendedBudget)}</p>
          <p className="text-xs text-green-600 mt-1">+10% buffer</p>
        </div>
      </div>

      {/* Spending by Category Chart */}
      {categoryData.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="value" fill="#3b82f6" name="Current Spending" />
              <Bar dataKey="recommended" fill="#10b981" name="Recommended Budget" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* DCC Breakdown */}
      {dccBreakdownData.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">DCC Spending Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={dccBreakdownData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dccBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {dccBreakdownData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Phase Spending */}
      {phaseSpending.length > 0 && phaseSpending.some(p => p.actualSpending > 0) && (
        <div>
          <button
            onClick={() => setExpandedSections(prev => ({ ...prev, phases: !prev.phases }))}
            className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 mb-4 hover:text-blue-600 transition"
          >
            <span>Phase Spending Details</span>
            <svg
              className={`w-5 h-5 transition-transform ${expandedSections.phases ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.phases && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phase
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Spent
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Committed
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Minimum Required
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recommended
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {phaseSpending
                    .filter(p => p.actualSpending > 0 || p.committedCost > 0)
                    .map((phase) => {
                      const recommendation = data.phaseRecommendations?.find(r => r.phaseId === phase.phaseId);
                      return (
                        <tr key={phase.phaseId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {phase.phaseName}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {formatCurrency(phase.actualSpending)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {formatCurrency(phase.committedCost)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                            {formatCurrency(phase.minimumRequired)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                            {formatCurrency(recommendation?.recommended || 0)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Floor Spending (if applicable) */}
      {floorSpending && floorSpending.length > 0 && floorSpending.some(f => f.actualSpending > 0) && (
        <div>
          <button
            onClick={() => setExpandedSections(prev => ({ ...prev, floors: !prev.floors }))}
            className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 mb-4 hover:text-blue-600 transition"
          >
            <span>Floor Spending Details</span>
            <svg
              className={`w-5 h-5 transition-transform ${expandedSections.floors ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSections.floors && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Floor
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Spent
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Committed
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Minimum Required
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {floorSpending
                    .filter(f => f.actualSpending > 0 || f.committedCosts > 0)
                    .map((floor) => {
                      const recommendation = data.floorRecommendations?.find(r => r.floorId === floor.floorId);
                      return (
                        <tr key={floor.floorId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {floor.floorName}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {formatCurrency(floor.actualSpending)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700">
                            {formatCurrency(floor.committedCosts)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                            {formatCurrency(floor.minimumRequired)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recommendations Summary */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-green-900 mb-2">Recommended Budget Allocation</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-green-700">DCC</p>
            <p className="font-semibold text-green-900">{formatCurrency(recommendations.dcc)}</p>
          </div>
          <div>
            <p className="text-green-700">Pre-Construction</p>
            <p className="font-semibold text-green-900">{formatCurrency(recommendations.preConstruction)}</p>
          </div>
          <div>
            <p className="text-green-700">Indirect</p>
            <p className="font-semibold text-green-900">{formatCurrency(recommendations.indirect)}</p>
          </div>
          <div>
            <p className="text-green-700">Contingency</p>
            <p className="font-semibold text-green-900">{formatCurrency(recommendations.contingency)}</p>
          </div>
        </div>
        <p className="text-xs text-green-600 mt-2">
          Recommendations include a 10% buffer above minimum required. Click "Use Recommended Budget" to apply.
        </p>
      </div>
    </div>
  );
}
