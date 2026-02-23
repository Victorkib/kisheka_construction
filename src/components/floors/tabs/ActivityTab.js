/**
 * Floor Activity Tab Component
 * Displays recent activity, ledger items, and phase breakdown for the floor
 */

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

export function FloorActivityTab({ floor, ledgerItems, phaseBreakdown, formatDate, formatCurrency, floorSummary }) {
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState('all');
  
  // Filter ledger items by selected phase
  const filteredLedgerItems = useMemo(() => {
    if (selectedPhaseFilter === 'all' || !selectedPhaseFilter) {
      return ledgerItems;
    }
    // Filter items that have phaseId matching the selected phase
    return ledgerItems.filter(item => {
      const itemPhaseId = item.phaseId?.toString();
      return itemPhaseId === selectedPhaseFilter.toString();
    });
  }, [ledgerItems, selectedPhaseFilter]);
  
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
          <p className="text-lg font-bold text-gray-900 mt-1">{filteredLedgerItems.length}</p>
          <p className="text-xs text-gray-500">
            {selectedPhaseFilter === 'all' ? 'All phases' : 'Filtered'}
          </p>
        </div>
      </div>

      {/* Phase Filter */}
      {phaseBreakdown && phaseBreakdown.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Filter by Phase</h3>
            <Link
              href={`/floors/${floor._id}?tab=phases`}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              View Full Phase Breakdown →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedPhaseFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                selectedPhaseFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Phases
            </button>
            {phaseBreakdown.map((phase) => (
              <button
                key={phase.phaseId || phase._id}
                onClick={() => setSelectedPhaseFilter(phase.phaseId || phase._id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  selectedPhaseFilter === (phase.phaseId || phase._id)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {phase.phaseCode || phase.phaseName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Ledger */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          <span className="text-xs text-gray-500">
            {selectedPhaseFilter === 'all' 
              ? `Last ${Math.min(20, filteredLedgerItems.length)} items`
              : `${filteredLedgerItems.length} item(s) for selected phase`}
          </span>
        </div>
        {filteredLedgerItems.length === 0 ? (
          <p className="text-gray-500 text-sm">
            {selectedPhaseFilter === 'all' 
              ? 'No recent activity'
              : 'No activity for the selected phase'}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredLedgerItems.slice(0, 20).map((item, index) => (
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

      {/* Phase Filter */}
      {phaseBreakdown.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Filter by Phase</h3>
            <Link
              href={`/floors/${floor._id}?tab=phases`}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              View Full Phase Breakdown →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedPhaseFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                selectedPhaseFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Phases
            </button>
            {phaseBreakdown.map((phase) => (
              <button
                key={phase.phaseId}
                onClick={() => setSelectedPhaseFilter(phase.phaseId)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  selectedPhaseFilter === phase.phaseId
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {phase.phaseCode || phase.phaseName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Phase Breakdown */}
      {phaseBreakdown && phaseBreakdown.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Phase Breakdown</h3>
              <p className="text-sm text-gray-600 mt-1">
                Phases with activity on this floor
              </p>
            </div>
            <Link
              href={`/floors/${floor._id}?tab=phases`}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View Full Breakdown →
            </Link>
          </div>
          <div className="space-y-3">
            {phaseBreakdown.map((phase, index) => (
              <div
                key={phase.phaseId || phase._id || index}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-lg">🏗️</span>
                  <div className="flex-1">
                    {phase.phaseId ? (
                      <Link
                        href={`/phases/${phase.phaseId}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {phase.phaseName || 'Unknown Phase'}
                      </Link>
                    ) : (
                      <span className="font-medium text-gray-900">
                        {phase.phaseName || 'Unknown Phase'}
                      </span>
                    )}
                    <p className="text-xs text-gray-500">
                      {phase.count || 0} item(s) • {formatCurrency(phase.totalCost || 0)} total
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
