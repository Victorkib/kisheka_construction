/**
 * Work Item Labour Tracking Component
 * Displays labour entries and statistics for a work item
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, DollarSign, Users, TrendingUp, TrendingDown, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading';

export function WorkItemLabourTracking({ workItemId }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (workItemId) {
      fetchLabourData();
    }
  }, [workItemId]);

  const fetchLabourData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/work-items/${workItemId}/labour`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load labour data');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching work item labour data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text="Loading labour data..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800">Error loading labour data: {error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { workItem, summary, labourEntries, byWorker, bySkill, dailyBreakdown } = data;

  const hoursVariance = summary.hoursVariance || 0;
  const costVariance = summary.costVariance || 0;
  const hoursUtilization = summary.hoursUtilization || 0;
  const costUtilization = summary.costUtilization || 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Total Hours</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{summary.totalHours.toFixed(1)}</div>
          {workItem.estimatedHours > 0 && (
            <div className="text-xs text-gray-600 mt-1">
              of {workItem.estimatedHours} estimated
              {hoursUtilization > 0 && (
                <span className={`ml-2 ${hoursUtilization > 100 ? 'text-red-600' : 'text-green-600'}`}>
                  ({hoursUtilization.toFixed(1)}%)
                </span>
              )}
            </div>
          )}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Total Cost</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {summary.totalCost.toLocaleString()} KES
          </div>
          {workItem.estimatedCost > 0 && (
            <div className="text-xs text-gray-600 mt-1">
              of {workItem.estimatedCost.toLocaleString()} estimated
              {costUtilization > 0 && (
                <span className={`ml-2 ${costUtilization > 100 ? 'text-red-600' : 'text-green-600'}`}>
                  ({costUtilization.toFixed(1)}%)
                </span>
              )}
            </div>
          )}
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Workers</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">{summary.uniqueWorkers}</div>
          <div className="text-xs text-gray-600 mt-1">{summary.entryCount} entries</div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            {hoursVariance < 0 ? (
              <TrendingUp className="w-5 h-5 text-orange-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-green-600" />
            )}
            <span className="text-sm font-medium text-gray-700">Variance</span>
          </div>
          <div
            className={`text-2xl font-bold ${hoursVariance < 0 ? 'text-orange-600' : 'text-green-600'}`}
          >
            {hoursVariance > 0 ? '+' : ''}
            {hoursVariance.toFixed(1)} hrs
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {costVariance > 0 ? '+' : ''}
            {costVariance.toLocaleString()} KES
          </div>
        </div>
      </div>

      {/* Variance Alerts */}
      {(hoursUtilization > 100 || costUtilization > 100) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Over Budget</p>
              <p className="text-xs text-red-700 mt-1">
                {hoursUtilization > 100 &&
                  `Hours: ${(hoursUtilization - 100).toFixed(1)}% over estimate`}
                {hoursUtilization > 100 && costUtilization > 100 && ' • '}
                {costUtilization > 100 &&
                  `Cost: ${(costUtilization - 100).toFixed(1)}% over estimate`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown by Worker */}
      {byWorker && byWorker.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">By Worker</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Worker
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
                {byWorker.map((worker, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {worker.workerName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{worker.totalHours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {worker.totalCost.toLocaleString()} KES
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{worker.entryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Breakdown by Skill */}
      {bySkill && bySkill.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">By Skill Type</h3>
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
                    Workers
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bySkill.map((skill, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {skill.skillTypeLabel}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{skill.totalHours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {skill.totalCost.toLocaleString()} KES
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{skill.workerCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-blue-900 mb-1">Quick Actions</h3>
            <p className="text-xs text-blue-700">Create labour entries for this work item</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/labour/entries/new?workItemId=${workItemId}`}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Add Entry
            </Link>
            <Link
              href={`/labour/batches/new?workItemId=${workItemId}`}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Bulk Entry
            </Link>
            <Link
              href={`/labour/entries?workItemId=${workItemId}`}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              View All
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Labour Entries */}
      {labourEntries && labourEntries.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Recent Labour Entries</h3>
            <Link
              href={`/labour/entries?workItemId=${workItemId}`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View All →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Worker
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Skill
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Hours
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cost
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {labourEntries.slice(0, 10).map((entry) => (
                  <tr key={entry._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(entry.entryDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {entry.workerName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {entry.skillType?.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.totalHours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {entry.totalCost.toLocaleString()} KES
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          entry.status === 'approved' || entry.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Labour Entries */}
      {labourEntries && labourEntries.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600 mb-4">No labour entries found for this work item</p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href={`/labour/entries/new?workItemId=${workItemId}`}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Add Entry
            </Link>
            <Link
              href={`/labour/batches/new?workItemId=${workItemId}`}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Bulk Entry
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

