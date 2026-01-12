/**
 * Equipment Operator Tracking Component
 * Displays operator labour entries and statistics for equipment
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, DollarSign, Users, TrendingUp, AlertCircle, Wrench } from 'lucide-react';
import { LoadingSpinner } from '@/components/loading';

export function EquipmentOperatorTracking({ equipmentId }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (equipmentId) {
      fetchOperatorData();
    }
  }, [equipmentId]);

  const fetchOperatorData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/equipment/${equipmentId}/operators`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load operator data');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching equipment operator data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text="Loading operator data..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-800">Error loading operator data: {error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { equipment, summary, operators } = data;

  const utilizationPercentage = summary.utilizationPercentage || 0;
  const estimatedHours = equipment.estimatedHours || 0;
  const actualHours = equipment.actualHours || 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Operator Hours</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{actualHours.toFixed(1)}</div>
          {estimatedHours > 0 && (
            <div className="text-xs text-gray-600 mt-1">
              of {estimatedHours} estimated
              {utilizationPercentage > 0 && (
                <span className={`ml-2 ${utilizationPercentage > 100 ? 'text-red-600' : 'text-green-600'}`}>
                  ({utilizationPercentage.toFixed(1)}%)
                </span>
              )}
            </div>
          )}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Operator Cost</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {summary.totalCost.toLocaleString()} KES
          </div>
          <div className="text-xs text-gray-600 mt-1">{summary.entryCount} entries</div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Operators</span>
          </div>
          <div className="text-2xl font-bold text-purple-600">{summary.uniqueOperators}</div>
          <div className="text-xs text-gray-600 mt-1">Unique operators</div>
        </div>
      </div>

      {/* Utilization Alert */}
      {utilizationPercentage > 100 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-900">Over Utilization</p>
              <p className="text-xs text-red-700 mt-1">
                Equipment has been used {(utilizationPercentage - 100).toFixed(1)}% more than estimated
                ({actualHours.toFixed(1)} / {estimatedHours} hours)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Operators Table */}
      {operators && operators.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Operators</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Operator Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total Hours
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total Cost
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Entries
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Days Worked
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {operators.map((operator, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {operator.operatorName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{operator.totalHours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {operator.totalCost.toLocaleString()} KES
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{operator.entryCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{operator.daysWorked}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">Totals:</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {summary.totalHours.toFixed(1)} hrs
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {summary.totalCost.toLocaleString()} KES
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {summary.entryCount}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* No Operators */}
      {(!operators || operators.length === 0) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No operator labour entries found for this equipment</p>
          <Link
            href={`/labour/entries/new?equipmentId=${equipmentId}`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Add Operator Labour Entry →
          </Link>
        </div>
      )}

      {/* Utilization Progress */}
      {estimatedHours > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Utilization</h3>
            <span className="text-sm font-medium text-gray-600">
              {utilizationPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full ${
                utilizationPercentage > 100
                  ? 'bg-red-600'
                  : utilizationPercentage > 80
                  ? 'bg-yellow-500'
                  : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(100, utilizationPercentage)}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
            <span>{actualHours.toFixed(1)} / {estimatedHours} hours</span>
            <span>
              {actualHours > estimatedHours
                ? `${(actualHours - estimatedHours).toFixed(1)} hours over`
                : `${(estimatedHours - actualHours).toFixed(1)} hours remaining`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

