/**
 * Productivity Chart Component
 * Visualizes worker productivity metrics
 */

'use client';

import { TrendingUp, TrendingDown, Star, Clock, DollarSign } from 'lucide-react';

export function ProductivityChart({ data }) {
  if (!data || !data.productivity) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">No productivity data available</p>
      </div>
    );
  }

  const { productivity, summary } = data;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-5 h-5 text-blue-600" />
            <p className="text-sm font-medium text-gray-700">Avg Quality Rating</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {summary.averageQualityRating?.toFixed(1) || '0.0'}/5.0
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-gray-700">Avg Productivity</p>
          </div>
          <p className="text-2xl font-bold text-green-600">
            {summary.averageProductivityRating?.toFixed(1) || '0.0'}/5.0
          </p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-purple-600" />
            <p className="text-sm font-medium text-gray-700">Total Hours</p>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {summary.totalHours?.toFixed(1) || '0.0'}
          </p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-orange-600" />
            <p className="text-sm font-medium text-gray-700">Cost per Hour</p>
          </div>
          <p className="text-2xl font-bold text-orange-600">
            {summary.averageCostPerHour
              ? summary.averageCostPerHour.toFixed(0)
              : '0'}{' '}
            KES
          </p>
        </div>
      </div>

      {/* Productivity Breakdown */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Productivity Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {data.groupBy === 'worker' ? 'Worker' : data.groupBy === 'skill' ? 'Skill Type' : 'Phase'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Quality
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Productivity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Hours
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cost/Hour
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Quantity
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {productivity.map((item, index) => {
                const qualityRating = item.averageQualityRating || 0;
                const productivityRating = item.averageProductivityRating || 0;
                const costPerHour = item.totalHours > 0 ? item.totalCost / item.totalHours : 0;

                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {item.workerName || item.skillType || item.phaseName || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${(qualityRating / 5) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-8 text-right">
                          {qualityRating.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${(productivityRating / 5) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-8 text-right">
                          {productivityRating.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.totalHours?.toFixed(1) || '0.0'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {costPerHour.toFixed(0)} KES
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.totalQuantityCompleted || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Performers */}
      {data.groupBy === 'worker' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Top Quality Workers</h4>
            <div className="space-y-2">
              {productivity
                .sort((a, b) => (b.averageQualityRating || 0) - (a.averageQualityRating || 0))
                .slice(0, 5)
                .map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{item.workerName}</span>
                    <span className="font-semibold text-green-600">
                      {(item.averageQualityRating || 0).toFixed(1)}/5.0
                    </span>
                  </div>
                ))}
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Top Productivity Workers</h4>
            <div className="space-y-2">
              {productivity
                .sort(
                  (a, b) =>
                    (b.averageProductivityRating || 0) - (a.averageProductivityRating || 0)
                )
                .slice(0, 5)
                .map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{item.workerName}</span>
                    <span className="font-semibold text-blue-600">
                      {(item.averageProductivityRating || 0).toFixed(1)}/5.0
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

