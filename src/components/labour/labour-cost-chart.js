/**
 * Labour Cost Chart Component
 * Visualizes labour costs over time and by category
 */

'use client';

import { DollarSign, TrendingUp, TrendingDown, Clock, Users } from 'lucide-react';

export function LabourCostChart({ data }) {
  if (!data) {
    return (
      <div className="ds-bg-surface-muted border ds-border-subtle rounded-lg p-8 text-center">
        <p className="ds-text-secondary">No cost data available</p>
      </div>
    );
  }

  const summary = data.summary || {};
  const groupedData = data.groupedData || [];
  const isTimeBased = data.period?.type === 'time_period';

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <p className="text-sm font-medium ds-text-secondary">Total Cost</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {summary.totalCost?.toLocaleString() || '0'} KES
          </p>
        </div>
        <div className="bg-green-50 border border-green-400/60 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium ds-text-secondary">Total Hours</p>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {summary.totalHours?.toFixed(1) || '0.0'}
          </p>
        </div>
        <div className="bg-purple-50 border border-purple-400/60 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-purple-600" />
            <p className="text-sm font-medium ds-text-secondary">Workers</p>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {summary.uniqueWorkers || 0}
          </p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-orange-600" />
            <p className="text-sm font-medium ds-text-secondary">Avg Rate</p>
          </div>
          <p className="text-2xl font-bold text-orange-600">
            {summary.totalHours > 0
              ? (summary.totalCost / summary.totalHours).toFixed(0)
              : '0'}{' '}
            KES/hr
          </p>
        </div>
      </div>

      {/* Cost Breakdown Table */}
      <div className="ds-bg-surface rounded-lg shadow">
        <div className="px-4 py-3 border-b ds-border-subtle">
          <h3 className="text-lg font-semibold ds-text-primary">
            {isTimeBased ? 'Cost Over Time' : 'Cost Breakdown'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ds-border-subtle">
            <thead className="ds-bg-surface-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                  {isTimeBased
                    ? 'Period'
                    : data.groupBy === 'phase'
                    ? 'Phase'
                    : data.groupBy === 'worker'
                    ? 'Worker'
                    : data.groupBy === 'skill'
                    ? 'Skill Type'
                    : 'Item'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                  Hours
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                  Cost
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                  % of Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                  Cost/Hour
                </th>
              </tr>
            </thead>
            <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
              {groupedData.map((item, index) => {
                const totalCost = summary.totalCost || 1;
                const percentage = (item.totalCost / totalCost) * 100;
                const costPerHour = item.totalHours > 0 ? item.totalCost / item.totalHours : 0;

                return (
                  <tr key={index} className="hover:ds-bg-surface-muted">
                    <td className="px-4 py-3 text-sm font-medium ds-text-primary">
                      {item.period ||
                        item.phaseName ||
                        item.workerName ||
                        item.skillType ||
                        'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm ds-text-secondary">
                      {item.totalHours?.toFixed(1) || '0.0'}
                    </td>
                    <td className="px-4 py-3 text-sm ds-text-secondary">
                      {item.totalCost?.toLocaleString() || '0'} KES
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 ds-bg-surface-muted rounded-full h-2 max-w-[100px]">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm ds-text-secondary w-12 text-right">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm ds-text-secondary">
                      {costPerHour.toFixed(0)} KES
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Budget Utilization (if available) */}
      {summary.budgetAllocated && (
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold ds-text-primary mb-4">Budget Utilization</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="ds-text-secondary">
                  Used: {summary.budgetUsed?.toLocaleString() || '0'} KES
                </span>
                <span className="ds-text-secondary">
                  Allocated: {summary.budgetAllocated.toLocaleString()} KES
                </span>
              </div>
              <div className="w-full ds-bg-surface-muted rounded-full h-4">
                <div
                  className={`h-4 rounded-full ${
                    summary.budgetUtilization > 100
                      ? 'bg-red-500'
                      : summary.budgetUtilization > 80
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{
                    width: `${Math.min(summary.budgetUtilization || 0, 100)}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs ds-text-secondary mt-1">
                <span>
                  {summary.budgetUtilization?.toFixed(1) || '0'}% Used
                </span>
                <span>
                  Remaining:{' '}
                  {(summary.budgetAllocated - (summary.budgetUsed || 0)).toLocaleString()} KES
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

