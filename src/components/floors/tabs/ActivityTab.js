/**
 * Floor Activity Tab Component
 * Displays recent activity, ledger items, and phase breakdown for the floor
 */

'use client';

import Link from 'next/link';

export function FloorActivityTab({ floor, ledgerItems, phaseBreakdown, formatDate, formatCurrency, floorSummary }) {
  return (
    <div className="space-y-6">
      {/* Activity Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-600">Material Requests</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{floorSummary?.requests?.count || 0}</p>
          <p className="text-xs text-gray-500">{formatCurrency(floorSummary?.requests?.totalEstimated || 0)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-600">Purchase Orders</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{floorSummary?.purchaseOrders?.count || 0}</p>
          <p className="text-xs text-gray-500">{formatCurrency(floorSummary?.purchaseOrders?.totalCost || 0)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-600">Equipment</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{floorSummary?.equipment?.count || 0}</p>
          <p className="text-xs text-gray-500">{formatCurrency(floorSummary?.equipment?.totalCost || 0)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-600">Total Activity</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{ledgerItems.length}</p>
          <p className="text-xs text-gray-500">Recent items</p>
        </div>
      </div>

      {/* Recent Activity Ledger */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          <span className="text-xs text-gray-500">Last 20 items</span>
        </div>
        {ledgerItems.length === 0 ? (
          <p className="text-gray-500 text-sm">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {ledgerItems.slice(0, 20).map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-lg">{item.icon || '📝'}</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.label || item.title}</p>
                    <p className="text-xs text-gray-500">
                      {item.type} • {item.date ? formatDate(item.date) : 'Unknown date'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {item.amount && (
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(item.amount)}
                    </p>
                  )}
                  {item.link && (
                    <Link
                      href={item.link}
                      className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap"
                    >
                      View →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Phase Breakdown */}
      {phaseBreakdown.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Phase Breakdown</h3>
          <p className="text-sm text-gray-600 mb-4">
            Phases with work items on this floor
          </p>
          <div className="space-y-3">
            {phaseBreakdown.map((phase, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-lg">🏗️</span>
                  <div className="flex-1">
                    <Link
                      href={`/phases/${phase.phaseId}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {phase.phaseName}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {phase.count || phase.materials || 0} work item(s) • {phase.workItems || 0} work items
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(phase.totalCost || 0)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default FloorActivityTab;
