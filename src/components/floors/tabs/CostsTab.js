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
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <p className="text-sm ds-text-secondary">Budget</p>
          <p className="text-2xl font-bold ds-text-primary mt-1">
            {formatCurrency(floor.budgetAllocation?.total || floor.totalBudget || 0)}
          </p>
        </div>
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <p className="text-sm ds-text-secondary">Actual Cost</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {formatCurrency(floor.actualCost || 0)}
          </p>
        </div>
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <p className="text-sm ds-text-secondary">Remaining</p>
          <p className={`text-2xl font-bold mt-1 ${
            ((floor.budgetAllocation?.total || floor.totalBudget || 0) - (floor.actualCost || 0)) < 0
              ? 'text-red-600'
              : 'text-green-600'
          }`}>
            {formatCurrency((floor.budgetAllocation?.total || floor.totalBudget || 0) - (floor.actualCost || 0))}
          </p>
        </div>
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <p className="text-sm ds-text-secondary">Utilization</p>
          <p className="text-2xl font-bold ds-text-primary mt-1">
            {(floor.budgetAllocation?.total || floor.totalBudget || 0) > 0
              ? `${((floor.actualCost || 0) / (floor.budgetAllocation?.total || floor.totalBudget || 0) * 100).toFixed(1)}%`
              : 'N/A'}
          </p>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="ds-bg-surface rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold ds-text-primary mb-4">Cost Breakdown</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center p-3 ds-bg-surface-muted rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-xl">📦</span>
              <div>
                <p className="font-medium ds-text-primary">Materials</p>
                <p className="text-sm ds-text-secondary">{floorSummary.materials.count} items</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold ds-text-primary">
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

          <div className="flex justify-between items-center p-3 ds-bg-surface-muted rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-xl">👷</span>
              <div>
                <p className="font-medium ds-text-primary">Labour</p>
                <p className="text-sm ds-text-secondary">
                  {floorSummary.labour.count} entries • {floorSummary.labour.totalHours.toFixed(0)} hrs
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold ds-text-primary">
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

          <div className="flex justify-between items-center p-3 ds-bg-surface-muted rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-xl">🔧</span>
              <div>
                <p className="font-medium ds-text-primary">Work Items</p>
                <p className="text-sm ds-text-secondary">{floorSummary.workItems.count} items</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold ds-text-primary">
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

          <div className="flex justify-between items-center p-3 ds-bg-surface-muted rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-xl">🚜</span>
              <div>
                <p className="font-medium ds-text-primary">Equipment</p>
                <p className="text-sm ds-text-secondary">{floorSummary.equipment.count} items</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold ds-text-primary">
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

      {/* Phase Cost Breakdown */}
      {(() => {
        const floorBudgetAllocation = floor.budgetAllocation || { total: floor.totalBudget || 0, byPhase: {} };
        const byPhase = floorBudgetAllocation.byPhase || {};
        const phasesWithBudget = Object.keys(byPhase).filter(phaseCode => byPhase[phaseCode]?.total > 0);
        
        if (phasesWithBudget.length === 0) {
          return null;
        }

        return (
          <div className="ds-bg-surface rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold ds-text-primary">Cost Breakdown by Phase</h3>
              <Link
                href={`/floors/${floor._id}?tab=phases`}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View Full Phase Breakdown →
              </Link>
            </div>
            <div className="space-y-3">
              {phasesWithBudget.map((phaseCode) => {
                const phaseBudget = byPhase[phaseCode] || { total: 0, materials: 0, labour: 0, equipment: 0, subcontractors: 0 };
                // Note: Actual costs would need to be fetched separately or passed as prop
                return (
                  <div key={phaseCode} className="border ds-border-subtle rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold ds-text-primary">{phaseCode}</h4>
                      <p className="text-sm font-semibold ds-text-primary">
                        {formatCurrency(phaseBudget.total)} budget
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="ds-text-muted">Materials</p>
                        <p className="font-semibold ds-text-primary">{formatCurrency(phaseBudget.materials)}</p>
                      </div>
                      <div>
                        <p className="ds-text-muted">Labour</p>
                        <p className="font-semibold ds-text-primary">{formatCurrency(phaseBudget.labour)}</p>
                      </div>
                      <div>
                        <p className="ds-text-muted">Equipment</p>
                        <p className="font-semibold ds-text-primary">{formatCurrency(phaseBudget.equipment)}</p>
                      </div>
                      <div>
                        <p className="ds-text-muted">Subcontractors</p>
                        <p className="font-semibold ds-text-primary">{formatCurrency(phaseBudget.subcontractors)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Budget Utilization Bar */}
      {((floor.budgetAllocation?.total || floor.totalBudget || 0) > 0) && (
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <div className="flex justify-between text-sm ds-text-secondary mb-2">
            <span>Budget Utilization</span>
            <span>
              {((floor.actualCost || 0) / (floor.budgetAllocation?.total || floor.totalBudget || 0) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full ds-bg-surface-muted rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                ((floor.actualCost || 0) / (floor.budgetAllocation?.total || floor.totalBudget || 0)) > 1
                  ? 'bg-red-600'
                  : ((floor.actualCost || 0) / (floor.budgetAllocation?.total || floor.totalBudget || 0)) > 0.8
                  ? 'bg-yellow-600'
                  : 'bg-green-600'
              }`}
              style={{
                width: `${Math.min(100, ((floor.actualCost || 0) / (floor.budgetAllocation?.total || floor.totalBudget || 0)) * 100)}%`
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default FloorCostsTab;
