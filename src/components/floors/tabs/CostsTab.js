/**
 * Floor Costs Tab Component
 * Displays cost breakdown for the floor
 */

'use client';

import Link from 'next/link';

export function FloorCostsTab({ floor, floorSummary, formatCurrency }) {
  return (
    <div className="space-y-6">
      {/* Cost Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Budget</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(floor.totalBudget || 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Actual Cost</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {formatCurrency(floor.actualCost || 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Remaining</p>
          <p className={`text-2xl font-bold mt-1 ${
            (floor.totalBudget || 0) - (floor.actualCost || 0) < 0
              ? 'text-red-600'
              : 'text-green-600'
          }`}>
            {formatCurrency((floor.totalBudget || 0) - (floor.actualCost || 0))}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Utilization</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {floor.totalBudget > 0
              ? `${((floor.actualCost / floor.totalBudget) * 100).toFixed(1)}%`
              : 'N/A'}
          </p>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Breakdown</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-xl">📦</span>
              <div>
                <p className="font-medium text-gray-900">Materials</p>
                <p className="text-sm text-gray-600">{floorSummary.materials.count} items</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">
                {formatCurrency(floorSummary.materials.totalCost)}
              </p>
              <Link
                href={`/items?floorId=${floor._id}`}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                View →
              </Link>
            </div>
          </div>

          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-xl">👷</span>
              <div>
                <p className="font-medium text-gray-900">Labour</p>
                <p className="text-sm text-gray-600">
                  {floorSummary.labour.count} entries • {floorSummary.labour.totalHours.toFixed(0)} hrs
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">
                {formatCurrency(floorSummary.labour.totalCost)}
              </p>
              <Link
                href={`/labour/entries?floorId=${floor._id}`}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                View →
              </Link>
            </div>
          </div>

          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-xl">🔧</span>
              <div>
                <p className="font-medium text-gray-900">Work Items</p>
                <p className="text-sm text-gray-600">{floorSummary.workItems.count} items</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">
                {formatCurrency(floorSummary.workItems.totalCost)}
              </p>
              <Link
                href={`/work-items?floorId=${floor._id}`}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                View →
              </Link>
            </div>
          </div>

          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-xl">🚜</span>
              <div>
                <p className="font-medium text-gray-900">Equipment</p>
                <p className="text-sm text-gray-600">{floorSummary.equipment.count} items</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">
                {formatCurrency(floorSummary.equipment.totalCost)}
              </p>
              <Link
                href={`/equipment?floorId=${floor._id}`}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                View →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Utilization Bar */}
      {floor.totalBudget > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Budget Utilization</span>
            <span>
              {((floor.actualCost / floor.totalBudget) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                (floor.actualCost / floor.totalBudget) > 1
                  ? 'bg-red-600'
                  : (floor.actualCost / floor.totalBudget) > 0.8
                  ? 'bg-yellow-600'
                  : 'bg-green-600'
              }`}
              style={{
                width: `${Math.min(100, (floor.actualCost / floor.totalBudget) * 100)}%`
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default FloorCostsTab;
