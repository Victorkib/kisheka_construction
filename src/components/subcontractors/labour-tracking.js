/**
 * Subcontractor Labour Tracking Component
 * Displays labour entries and statistics for a subcontractor
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, DollarSign, Users, TrendingUp, FileText, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading';

export function SubcontractorLabourTracking({ subcontractorId }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (subcontractorId) {
      fetchLabourData();
    }
  }, [subcontractorId]);

  const fetchLabourData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/subcontractors/${subcontractorId}/labour`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load labour data');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching subcontractor labour data:', err);
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

  const { subcontractor, summary, labourEntries, byWorker, dailyBreakdown } = data;

  const contractUtilization = summary.contractUtilization || 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Total Hours</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{summary.totalHours.toFixed(1)}</div>
          <div className="text-xs text-gray-600 mt-1">{summary.entryCount} entries</div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Total Cost</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {summary.totalCost.toLocaleString()} KES
          </div>
          {subcontractor.contractValue > 0 && (
            <div className="text-xs text-gray-600 mt-1">
              of {subcontractor.contractValue.toLocaleString()} contract
              {contractUtilization > 0 && (
                <span className={`ml-2 ${contractUtilization > 100 ? 'text-red-600' : 'text-green-600'}`}>
                  ({contractUtilization.toFixed(1)}%)
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
          <div className="text-xs text-gray-600 mt-1">Unique workers</div>
        </div>
      </div>

      {/* Contract Utilization Alert */}
      {contractUtilization > 100 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Over Contract Value</p>
              <p className="text-xs text-red-700 mt-1">
                Labour cost exceeds contract value by{' '}
                {(summary.totalCost - subcontractor.contractValue).toLocaleString()} KES (
                {(contractUtilization - 100).toFixed(1)}% over)
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
                    Worker Name
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

      {/* Recent Labour Entries */}
      {labourEntries && labourEntries.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Recent Labour Entries</h3>
            <Link
              href={`/labour/entries?subcontractorId=${subcontractorId}`}
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
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No labour entries found for this subcontractor</p>
          <Link
            href={`/labour/entries/new?subcontractorId=${subcontractorId}`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Add Labour Entry →
          </Link>
        </div>
      )}
    </div>
  );
}

