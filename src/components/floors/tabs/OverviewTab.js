/**
 * Floor Overview Tab Component
 * Displays floor overview, status, and key metrics with comprehensive data
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function FloorOverviewTab({ floor, project, canEdit, onStatusChange, formatDate, formatCurrency, getStatusColor, floorSummary }) {
  const [phases, setPhases] = useState([]);
  const [phasesLoading, setPhasesLoading] = useState(true);

  useEffect(() => {
    if (floor?._id && floor?.projectId) {
      fetchPhases();
    }
  }, [floor?._id, floor?.projectId]);

  const fetchPhases = async () => {
    try {
      setPhasesLoading(true);
      // Fetch phases that have work items on this floor
      const response = await fetch(`/api/work-items?floorId=${floor._id}&projectId=${floor.projectId}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await response.json();
      
      if (data.success) {
        const workItems = data.data?.workItems || data.data || [];
        // Get unique phase IDs
        const phaseIds = [...new Set(workItems.map(item => item.phaseId?.toString()).filter(Boolean))];
        
        if (phaseIds.length > 0) {
          // Fetch phase details
          const phasesRes = await fetch(`/api/phases?projectId=${floor.projectId}`, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' },
          });
          const phasesData = await phasesRes.json();
          
          if (phasesData.success) {
            const allPhases = phasesData.data || [];
            const relevantPhases = allPhases.filter(p => phaseIds.includes(p._id?.toString()));
            setPhases(relevantPhases);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
    } finally {
      setPhasesLoading(false);
    }
  };

  // Use budgetAllocation.total with fallback to totalBudget for backward compatibility
  const floorBudget = floor.budgetAllocation?.total || floor.totalBudget || 0;
  const budgetUtilization = floorBudget > 0 
    ? ((floor.actualCost || 0) / floorBudget) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Floor Status and Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <p className="text-sm ds-text-secondary mb-2">Status</p>
          {canEdit ? (
            <select
              value={floor.status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus ds-text-primary"
            >
              <option value="NOT_STARTED" className="ds-text-primary">Not Started</option>
              <option value="IN_PROGRESS" className="ds-text-primary">In Progress</option>
              <option value="COMPLETED" className="ds-text-primary">Completed</option>
              <option value="ON_HOLD" className="ds-text-primary">On Hold</option>
              <option value="CANCELLED" className="ds-text-primary">Cancelled</option>
            </select>
          ) : (
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(floor.status)}`}>
              {floor.status?.replace('_', ' ')}
            </span>
          )}
        </div>

        <div className="ds-bg-surface rounded-lg shadow p-6">
          <p className="text-sm ds-text-secondary mb-2">Floor Number</p>
          <p className="text-lg font-semibold ds-text-primary">{floor.floorNumber}</p>
          <p className="text-sm ds-text-secondary mt-4">Type</p>
          <p className="text-sm font-semibold ds-text-primary">
            {floor.floorNumber < 0 ? 'Basement' : floor.floorNumber === 0 ? 'Ground' : 'Upper'}
          </p>
        </div>

        <div className="ds-bg-surface rounded-lg shadow p-6">
          <p className="text-sm ds-text-secondary mb-2">Timeline</p>
          <div className="space-y-2 text-sm">
            {floor.startDate && (
              <div>
                <span className="ds-text-muted">Start:</span>{' '}
                <span className="font-medium ds-text-primary">{formatDate(floor.startDate)}</span>
              </div>
            )}
            {floor.completionDate && (
              <div>
                <span className="ds-text-muted">Completed:</span>{' '}
                <span className="font-medium ds-text-success">{formatDate(floor.completionDate)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="ds-bg-surface rounded-lg shadow p-4">
          <p className="text-xs ds-text-secondary">Materials</p>
          <p className="text-lg font-bold ds-text-primary mt-1">{floorSummary?.materials?.count || 0}</p>
          <p className="text-xs ds-text-muted">{formatCurrency(floorSummary?.materials?.totalCost || 0)}</p>
        </div>
        <div className="ds-bg-surface rounded-lg shadow p-4">
          <p className="text-xs ds-text-secondary">Labour</p>
          <p className="text-lg font-bold ds-text-primary mt-1">{floorSummary?.labour?.count || 0}</p>
          <p className="text-xs ds-text-muted">{formatCurrency(floorSummary?.labour?.totalCost || 0)}</p>
        </div>
        <div className="ds-bg-surface rounded-lg shadow p-4">
          <p className="text-xs ds-text-secondary">Work Items</p>
          <p className="text-lg font-bold ds-text-primary mt-1">{floorSummary?.workItems?.count || 0}</p>
          <p className="text-xs ds-text-muted">{formatCurrency(floorSummary?.workItems?.totalCost || 0)}</p>
        </div>
        <div className="ds-bg-surface rounded-lg shadow p-4">
          <p className="text-xs ds-text-secondary">Budget Used</p>
          <p className="text-lg font-bold ds-text-primary mt-1">{budgetUtilization.toFixed(1)}%</p>
          <p className="text-xs ds-text-muted">{formatCurrency(floor.actualCost || 0)} / {formatCurrency(floorBudget)}</p>
        </div>
      </div>

      {/* Capital Allocation Quick Summary */}
      {(() => {
        const capitalAllocation = floor.capitalAllocation || { total: 0, used: 0, committed: 0, remaining: 0 };
        const capitalTotal = capitalAllocation.total || 0;
        const capitalRemaining = capitalAllocation.remaining || 0;
        
        return (
          <div className="ds-bg-accent-subtle border ds-border-accent-subtle rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold ds-text-primary">Capital Allocation</h3>
              {canEdit && (
                <Link
                  href={`/floors/${floor._id}/budget`}
                  className="text-xs ds-text-accent-primary hover:ds-text-accent-hover font-medium underline"
                >
                  Manage →
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs ds-text-secondary">Total Capital</p>
                <p className="text-base font-bold ds-text-accent-primary mt-1">
                  {formatCurrency(capitalTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs ds-text-secondary">Used</p>
                <p className="text-base font-bold ds-text-accent-primary mt-1">
                  {formatCurrency(capitalAllocation.used || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs ds-text-secondary">Committed</p>
                <p className="text-base font-bold ds-text-warning mt-1">
                  {formatCurrency(capitalAllocation.committed || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs ds-text-secondary">Remaining</p>
                <p className={`text-base font-bold mt-1 ${
                  capitalRemaining < 0 ? 'ds-text-danger' : 'ds-text-success'
                }`}>
                  {formatCurrency(capitalRemaining)}
                </p>
              </div>
            </div>
            {capitalTotal === 0 && canEdit && (
              <div className="mt-3 pt-3 border-t ds-border-accent-subtle">
                <p className="text-xs ds-text-accent-primary mb-2">No capital allocated yet.</p>
                <Link
                  href={`/floors/${floor._id}/budget`}
                  className="inline-block px-3 py-1.5 ds-bg-accent-primary text-white text-xs font-medium rounded-lg hover:ds-bg-accent-hover transition"
                >
                  Allocate Capital
                </Link>
              </div>
            )}
          </div>
        );
      })()}

      {/* Phase Summary */}
      {(() => {
        const floorBudgetAllocation = floor.budgetAllocation || { total: floor.totalBudget || 0, byPhase: {} };
        const byPhase = floorBudgetAllocation.byPhase || {};
        const phasesWithBudget = Object.keys(byPhase).filter(phaseCode => byPhase[phaseCode]?.total > 0);
        
        if (phasesWithBudget.length === 0) {
          return null;
        }

        return (
          <div className="ds-bg-accent-subtle border ds-border-accent-subtle rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold ds-text-primary">Phase Budget Summary</h3>
              <Link
                href={`/floors/${floor._id}?tab=phases`}
                className="text-sm ds-text-accent-primary hover:ds-text-accent-hover font-medium underline"
              >
                View Full Breakdown →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {phasesWithBudget.map((phaseCode) => {
                const phaseBudget = byPhase[phaseCode] || { total: 0 };
                // Note: Actual spending would need to be fetched separately or passed as prop
                return (
                  <div key={phaseCode} className="ds-bg-surface rounded-lg p-3 border ds-border-accent-subtle">
                    <p className="text-xs ds-text-secondary font-medium">{phaseCode}</p>
                    <p className="text-sm font-bold ds-text-primary mt-1">
                      {formatCurrency(phaseBudget.total)}
                    </p>
                    <p className="text-xs ds-text-muted mt-1">Budget allocated</p>
                  </div>
                );
              })}
            </div>
            {phasesWithBudget.length === 0 && (
              <p className="text-sm ds-text-secondary text-center py-2">
                No phase budgets allocated yet. Allocate budgets from the Budget tab.
              </p>
            )}
          </div>
        );
      })()}

      {/* Phases Working on This Floor */}
      {!phasesLoading && phases.length > 0 && (
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold ds-text-primary">Phases Working on This Floor</h3>
            <Link
              href={`/floors/${floor._id}?tab=phases`}
              className="text-sm ds-text-accent-primary hover:ds-text-accent-hover font-medium"
            >
              View Phase Breakdown →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {phases.map((phase) => (
              <Link
                key={phase._id}
                href={`/phases/${phase._id}`}
                className="p-3 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium ds-text-primary">{phase.phaseName}</p>
                    <p className="text-xs ds-text-muted">{phase.phaseCode}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(phase.status)}`}>
                    {phase.status?.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Floor Description */}
      {floor.description && (
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold ds-text-primary mb-2">Description</h3>
          <p className="ds-text-secondary whitespace-pre-wrap">{floor.description}</p>
        </div>
      )}

      {/* Project Link */}
      {project && (
        <div className="ds-bg-accent-subtle border ds-border-accent-subtle rounded-lg p-4">
          <p className="text-sm ds-text-accent-primary">
            <span className="font-medium">Project:</span>{' '}
            <Link
              href={`/projects/${project._id}`}
              className="ds-text-accent-primary hover:ds-text-accent-hover underline"
            >
              {project.projectName}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

export default FloorOverviewTab;
