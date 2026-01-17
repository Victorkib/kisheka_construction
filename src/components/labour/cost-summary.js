/**
 * Labour Cost Summary Component
 * Displays comprehensive labour cost summary with breakdowns
 */

'use client';

import { useState, useEffect } from 'react';
import { Clock, DollarSign, Users, TrendingUp, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading';

export function LabourCostSummary({ projectId, phaseId = null, periodType = 'project_total' }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchCostSummary();
    }
  }, [projectId, phaseId, periodType]);

  const fetchCostSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        projectId,
        periodType,
        ...(phaseId ? { phaseId } : {}),
      });

      const response = await fetch(`/api/labour/cost-summaries?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load cost summary');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching cost summary:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const params = new URLSearchParams({
        projectId,
        periodType,
        recalculate: 'true',
        ...(phaseId ? { phaseId } : {}),
      });

      const response = await fetch(`/api/labour/cost-summaries?${params}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to recalculate cost summary');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error recalculating cost summary:', err);
      setError(err.message);
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text="Loading cost summary..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800">Error loading cost summary: {error}</p>
      </div>
    );
  }

  if (!data || !data.summary) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">No cost summary data available</p>
      </div>
    );
  }

  const { summary, budgetInfo } = data;
  const costs = summary.costs || {};

  return (
    <div className="space-y-6">
      {/* Header with Recalculate Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Labour Cost Summary</h3>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
          Recalculate
        </button>
      </div>

      {/* Budget Info Alert */}
      {budgetInfo && (
        <div
          className={`rounded-lg p-4 border ${
            budgetInfo.utilization > 100
              ? 'bg-red-50 border-red-200'
              : budgetInfo.utilization > 80
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-green-50 border-green-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {budgetInfo.utilization > 100 ? (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            ) : budgetInfo.utilization > 80 ? (
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 mb-1">Budget Utilization</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-600">
                  Used: <span className="font-semibold">{budgetInfo.used.toLocaleString()} KES</span>
                </span>
                <span className="text-gray-600">
                  Allocated: <span className="font-semibold">{budgetInfo.allocated.toLocaleString()} KES</span>
                </span>
                <span className="text-gray-600">
                  Remaining: <span className="font-semibold">{budgetInfo.remaining.toLocaleString()} KES</span>
                </span>
                <span
                  className={`font-semibold ${
                    budgetInfo.utilization > 100
                      ? 'text-red-600'
                      : budgetInfo.utilization > 80
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}
                >
                  {budgetInfo.utilization.toFixed(1)}% Used
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Total Hours</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {costs.total?.hours?.toFixed(1) || '0.0'}
          </div>
          <div className="text-xs text-gray-600 mt-1">{summary.totalEntries || 0} entries</div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Total Cost</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {costs.total?.cost?.toLocaleString() || '0'} KES
          </div>
          <div className="text-xs text-gray-600 mt-1">All labour types</div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Unique Workers</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">{summary.uniqueWorkers || 0}</div>
          <div className="text-xs text-gray-600 mt-1">
            Avg: {summary.averageWorkersPerDay?.toFixed(1) || '0.0'}/day
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-gray-700">Avg Rate</span>
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {costs.total?.hours > 0
              ? (costs.total.cost / costs.total.hours).toFixed(0)
              : '0'}{' '}
            KES/hr
          </div>
          <div className="text-xs text-gray-600 mt-1">Per hour</div>
        </div>
      </div>

      {/* Breakdown by Role */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h4 className="text-md font-semibold text-gray-900">Breakdown by Role</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Hours
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cost
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Entries
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  % of Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[
                { key: 'skilled', label: 'Skilled' },
                { key: 'unskilled', label: 'Unskilled' },
                { key: 'supervisory', label: 'Supervisory' },
                { key: 'specialized', label: 'Specialized' },
              ].map((role) => {
                const roleData = costs[role.key] || { hours: 0, cost: 0, entries: 0 };
                const percentage =
                  costs.total?.cost > 0 ? (roleData.cost / costs.total.cost) * 100 : 0;

                return (
                  <tr key={role.key} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{role.label}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{roleData.hours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {roleData.cost.toLocaleString()} KES
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{roleData.entries || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{percentage.toFixed(1)}%</td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {costs.total?.hours?.toFixed(1) || '0.0'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {costs.total?.cost?.toLocaleString() || '0'} KES
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{summary.totalEntries || 0}</td>
                <td className="px-4 py-3 text-sm text-gray-900">100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Direct vs Subcontractor vs Indirect Breakdown */}
      {summary.direct && summary.subcontractor && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200">
            <h4 className="text-md font-semibold text-gray-900">Labour Breakdown by Type</h4>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Direct Labour (Phase Budget)</p>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-blue-600">
                    {summary.direct.cost.toLocaleString()} KES
                  </p>
                  <p className="text-xs text-gray-600">
                    {summary.direct.hours.toFixed(1)} hours • {summary.direct.entries} entries
                  </p>
                  {costs.total?.cost > 0 && (
                    <p className="text-xs text-gray-600">
                      {((summary.direct.cost / costs.total.cost) * 100).toFixed(1)}% of total
                    </p>
                  )}
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Subcontractor Labour</p>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-green-600">
                    {summary.subcontractor.cost.toLocaleString()} KES
                  </p>
                  <p className="text-xs text-gray-600">
                    {summary.subcontractor.hours.toFixed(1)} hours • {summary.subcontractor.entries}{' '}
                    entries
                  </p>
                  {costs.total?.cost > 0 && (
                    <p className="text-xs text-gray-600">
                      {((summary.subcontractor.cost / costs.total.cost) * 100).toFixed(1)}% of total
                    </p>
                  )}
                  {summary.subcontractor.subcontractorCount > 0 && (
                    <p className="text-xs text-gray-600">
                      {summary.subcontractor.subcontractorCount} subcontractor
                      {summary.subcontractor.subcontractorCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
              {summary.indirect && summary.indirect.cost > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Indirect Labour (Project Budget)</p>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-amber-600">
                      {summary.indirect.cost.toLocaleString()} KES
                    </p>
                    <p className="text-xs text-gray-600">
                      {summary.indirect.hours.toFixed(1)} hours • {summary.indirect.entries} entries
                    </p>
                    {costs.total?.cost > 0 && (
                      <p className="text-xs text-gray-600">
                        {((summary.indirect.cost / costs.total.cost) * 100).toFixed(1)}% of total
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Breakdown by Skill Type */}
      {summary.bySkillType && Object.keys(summary.bySkillType).length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200">
            <h4 className="text-md font-semibold text-gray-900">Breakdown by Skill Type</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Skill Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Hours
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cost
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Entries
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(summary.bySkillType)
                  .sort((a, b) => b[1].cost - a[1].cost)
                  .map(([skillType, data]) => (
                    <tr key={skillType} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {skillType.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{data.hours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {data.cost.toLocaleString()} KES
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{data.entries || 0}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Last Updated */}
      {summary.calculatedAt && (
        <div className="text-xs text-gray-500 text-center">
          Last calculated: {new Date(summary.calculatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

