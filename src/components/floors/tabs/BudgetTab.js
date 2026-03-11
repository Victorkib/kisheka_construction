/**
 * Floor Budget Tab Component
 * Displays budget breakdown by phase for the floor
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/loading';

export function FloorBudgetTab({ floor, project, formatCurrency, canEdit = false }) {
  const [phaseBudgets, setPhaseBudgets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectFinances, setProjectFinances] = useState(null);

  useEffect(() => {
    if (floor && project) {
      fetchPhaseBudgets();
      fetchProjectFinances();
    }
  }, [floor, project]);

  const fetchProjectFinances = async () => {
    if (!project?._id) return;
    try {
      const response = await fetch(`/api/project-finances?projectId=${project._id}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProjectFinances(data.data);
      }
    } catch (err) {
      console.error('Fetch project finances error:', err);
    }
  };

  const fetchPhaseBudgets = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all phases for the project
      const phasesResponse = await fetch(`/api/phases?projectId=${project._id}&includeFinancials=true`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      const phasesData = await phasesResponse.json();
      if (!phasesData.success) {
        throw new Error(phasesData.error || 'Failed to fetch phases');
      }

      const phases = phasesData.data || [];
      
      // Get floor's budget allocation by phase
      const floorBudgetAllocation = floor.budgetAllocation || { total: floor.totalBudget || 0, byPhase: {} };
      const byPhase = floorBudgetAllocation.byPhase || {};

      // Fetch floor's actual spending and committed costs
      const floorBudgetResponse = await fetch(`/api/floors/${floor._id}/budget`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      const floorBudgetData = await floorBudgetResponse.json();
      const floorActualSpending = floorBudgetData.success ? (floorBudgetData.data.actualSpending || {}) : {};
      const floorCommittedCosts = floorBudgetData.success ? (floorBudgetData.data.committedCosts || {}) : {};

      // Build phase budget breakdown with phase-specific spending
      const phaseBreakdown = phases.map(phase => {
        const phaseBudget = byPhase[phase.phaseCode] || { total: 0, materials: 0, labour: 0, equipment: 0, subcontractors: 0 };
        
        // Use phase-specific spending if available, otherwise fallback to proportional
        let phaseActual = 0;
        let phaseCommitted = 0;
        
        if (floorActualSpending.byPhase && floorActualSpending.byPhase[phase.phaseCode]) {
          // Use actual phase-specific spending
          phaseActual = floorActualSpending.byPhase[phase.phaseCode].total || 0;
        } else if (floorBudgetAllocation.total > 0 && phaseBudget.total > 0) {
          // Fallback to proportional if phase-specific not available
          phaseActual = (floorActualSpending.total || 0) * (phaseBudget.total / floorBudgetAllocation.total);
        }
        
        if (floorCommittedCosts.byPhase && floorCommittedCosts.byPhase[phase.phaseCode]) {
          // Use actual phase-specific committed costs
          phaseCommitted = floorCommittedCosts.byPhase[phase.phaseCode].total || 0;
        } else if (floorBudgetAllocation.total > 0 && phaseBudget.total > 0) {
          // Fallback to proportional if phase-specific not available
          phaseCommitted = (floorCommittedCosts.total || 0) * (phaseBudget.total / floorBudgetAllocation.total);
        }
        const phaseRemaining = Math.max(0, phaseBudget.total - phaseActual - phaseCommitted);
        const phaseVariance = phaseActual - phaseBudget.total;
        const phaseUtilization = phaseBudget.total > 0 ? (phaseActual / phaseBudget.total) * 100 : 0;

        return {
          phaseId: phase._id.toString(),
          phaseCode: phase.phaseCode,
          phaseName: phase.phaseName,
          budget: phaseBudget.total,
          materials: phaseBudget.materials || 0,
          labour: phaseBudget.labour || 0,
          equipment: phaseBudget.equipment || 0,
          subcontractors: phaseBudget.subcontractors || 0,
          actual: phaseActual,
          committed: phaseCommitted,
          remaining: phaseRemaining,
          variance: phaseVariance,
          utilization: phaseUtilization,
          isOverBudget: phaseVariance > 0,
          isLowBudget: phaseRemaining < phaseBudget.total * 0.2 && phaseBudget.total > 0
        };
      }).filter(p => p.budget > 0); // Only show phases with budget allocated

      setPhaseBudgets(phaseBreakdown);
    } catch (err) {
      console.error('Fetch phase budgets error:', err);
      setError(err.message || 'Failed to load phase budgets');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
        <span className="ml-2 ds-text-secondary">Loading phase budgets...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ds-bg-danger/10 border ds-border-danger/40 ds-text-danger px-4 py-3 rounded-lg">
        <p className="font-semibold">Error loading phase budgets</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const floorBudgetAllocation = floor.budgetAllocation || { total: floor.totalBudget || 0, byPhase: {} };
  const totalBudget = floorBudgetAllocation.total || 0;
  const totalActual = floor.actualCost || 0;
  const totalRemaining = totalBudget - totalActual;
  const totalVariance = totalActual - totalBudget;
  
  // Capital allocation data
  const capitalAllocation = floor.capitalAllocation || { total: 0, used: 0, committed: 0, remaining: 0 };
  const capitalTotal = capitalAllocation.total || 0;
  const capitalUsed = capitalAllocation.used || 0;
  const capitalCommitted = capitalAllocation.committed || 0;
  const capitalRemaining = capitalAllocation.remaining || 0;
  const capitalVsBudget = capitalTotal > 0 && totalBudget > 0 ? (capitalTotal / totalBudget) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <p className="text-sm ds-text-secondary">Total Budget</p>
          <p className="text-2xl font-bold ds-text-primary mt-1">
            {formatCurrency(totalBudget)}
          </p>
          <p className="text-xs ds-text-muted mt-1">
            Across {phaseBudgets?.length || 0} phase(s)
          </p>
        </div>
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <p className="text-sm ds-text-secondary">Actual Spending</p>
          <p className="text-2xl font-bold ds-text-accent-primary mt-1">
            {formatCurrency(totalActual)}
          </p>
        </div>
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <p className="text-sm ds-text-secondary">Remaining</p>
          <p className={`text-2xl font-bold mt-1 ${
            totalRemaining < 0 ? 'ds-text-danger' : 'ds-text-success'
          }`}>
            {formatCurrency(totalRemaining)}
          </p>
        </div>
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <p className="text-sm ds-text-secondary">Variance</p>
          <p className={`text-2xl font-bold mt-1 ${
            totalVariance > 0 ? 'ds-text-danger' : 'ds-text-success'
          }`}>
            {formatCurrency(totalVariance)}
          </p>
        </div>
      </div>

      {/* Capital Allocation Summary - Always show, even when zero */}
      <div className="ds-bg-accent-subtle border ds-border-accent-subtle rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold ds-text-primary">Capital Allocation</h3>
          <div className="flex items-center gap-3">
            {capitalTotal > 0 && (
              <div className="text-sm ds-text-secondary">
                {capitalVsBudget.toFixed(1)}% of budget
              </div>
            )}
            {canEdit && (
              <Link
                href={`/floors/${floor._id}/budget`}
                className="px-3 py-1.5 ds-bg-accent-primary text-white text-sm font-medium rounded-lg hover:ds-bg-accent-hover transition"
              >
                {capitalTotal > 0 ? 'Manage Capital' : 'Allocate Capital'}
              </Link>
            )}
          </div>
        </div>
        {capitalTotal > 0 ? (
          <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm ds-text-secondary">Total Capital</p>
              <p className="text-xl font-bold ds-text-accent-primary mt-1">
                {formatCurrency(capitalTotal)}
              </p>
            </div>
            <div>
              <p className="text-sm ds-text-secondary">Used</p>
              <p className="text-xl font-bold ds-text-accent-primary mt-1">
                {formatCurrency(capitalUsed)}
              </p>
            </div>
            <div>
              <p className="text-sm ds-text-secondary">Committed</p>
              <p className="text-xl font-bold ds-text-warning mt-1">
                {formatCurrency(capitalCommitted)}
              </p>
            </div>
            <div>
              <p className="text-sm ds-text-secondary">Remaining</p>
              <p className={`text-xl font-bold mt-1 ${
                capitalRemaining < 0 ? 'ds-text-danger' : 'ds-text-success'
              }`}>
                {formatCurrency(capitalRemaining)}
              </p>
            </div>
          </div>
          
          {/* Capital by Phase Breakdown */}
          {capitalAllocation.byPhase && Object.keys(capitalAllocation.byPhase).length > 0 && (
            <div className="mt-4 pt-4 border-t ds-border-accent-subtle">
              <h4 className="text-sm font-semibold ds-text-secondary mb-3">Capital by Phase</h4>
              <div className="space-y-2">
                {Object.entries(capitalAllocation.byPhase).map(([phaseCode, phaseCapital]) => {
                  if (phaseCapital.total === 0) return null;
                  const phaseName = phaseBudgets?.find(p => p.phaseCode === phaseCode)?.phaseName || phaseCode;
                  const phaseBudget = floorBudgetAllocation.byPhase?.[phaseCode]?.total || 0;
                  const phaseCapitalVsBudget = phaseBudget > 0 ? (phaseCapital.total / phaseBudget) * 100 : 0;
                  
                  return (
                    <div key={phaseCode} className="ds-bg-surface rounded-lg p-3 border ds-border-accent-subtle">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium ds-text-primary">{phaseName}</span>
                        <span className="text-xs ds-text-secondary">
                          {formatCurrency(phaseCapital.total)} ({phaseCapitalVsBudget.toFixed(1)}% of phase budget)
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="ds-text-secondary">Used:</span>
                          <span className="ml-1 font-medium ds-text-accent-primary">{formatCurrency(phaseCapital.used || 0)}</span>
                        </div>
                        <div>
                          <span className="ds-text-secondary">Committed:</span>
                          <span className="ml-1 font-medium ds-text-warning">{formatCurrency(phaseCapital.committed || 0)}</span>
                        </div>
                        <div>
                          <span className="ds-text-secondary">Remaining:</span>
                          <span className={`ml-1 font-medium ${
                            (phaseCapital.remaining || 0) < 0 ? 'ds-text-danger' : 'ds-text-success'
                          }`}>
                            {formatCurrency(phaseCapital.remaining || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Capital vs Budget Comparison */}
          <div className="mt-4 pt-4 border-t ds-border-accent-subtle">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium ds-text-secondary">Capital Coverage</span>
              <span className="text-sm ds-text-secondary">
                {formatCurrency(capitalTotal)} / {formatCurrency(totalBudget)}
              </span>
            </div>
            <div className="w-full ds-bg-surface-muted rounded-full h-3">
              <div
                className={`h-3 rounded-full ${
                  capitalVsBudget >= 100
                    ? 'ds-bg-success'
                    : capitalVsBudget >= 80
                    ? 'ds-bg-warning'
                    : 'ds-bg-danger'
                }`}
                style={{ width: `${Math.min(capitalVsBudget, 100)}%` }}
              />
            </div>
            {capitalVsBudget < 100 && (
              <p className="text-xs ds-text-secondary mt-2">
                Capital covers {capitalVsBudget.toFixed(1)}% of budget. 
                {capitalVsBudget < 80 && ' Consider allocating more capital to this floor.'}
              </p>
            )}
          </div>
          </>
        ) : (
          <div className="ds-bg-accent-subtle border ds-border-accent-subtle rounded-lg p-4">
            <p className="text-sm ds-text-accent-primary mb-3">
              <strong>No capital allocated</strong> to this floor yet.
            </p>
            {projectFinances && projectFinances.capitalBalance > 0 && (
              <p className="text-xs ds-text-accent-primary mb-3">
                Project Available Capital: <span className="font-semibold">{formatCurrency(projectFinances.capitalBalance)}</span>
              </p>
            )}
            {canEdit && (
              <Link
                href={`/floors/${floor._id}/budget`}
                className="inline-block px-4 py-2 ds-bg-accent-primary text-white text-sm font-medium rounded-lg hover:ds-bg-accent-hover transition"
              >
                Allocate Capital Now
              </Link>
            )}
            {(!canEdit || (projectFinances && projectFinances.capitalBalance === 0)) && (
              <p className="text-xs ds-text-accent-primary mt-2">
                {!canEdit 
                  ? 'Contact PM or OWNER to allocate capital.'
                  : 'No capital available. Allocate capital to the project first.'}
                {projectFinances && projectFinances.capitalBalance === 0 && (
                  <Link href="/investors" className="ml-1 underline hover:ds-text-accent-hover">
                    Go to Investors
                  </Link>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Phase Budget Breakdown */}
      {phaseBudgets && phaseBudgets.length > 0 ? (
        <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b ds-border-subtle">
            <h3 className="text-lg font-semibold ds-text-primary">Budget by Phase</h3>
            <p className="text-sm ds-text-secondary mt-1">
              Detailed breakdown of floor budget allocation across construction phases
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ds-border-subtle">
              <thead className="ds-bg-surface-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Phase
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Actual
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Committed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Remaining
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Variance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Utilization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                {phaseBudgets.map((phase) => (
                  <tr
                    key={phase.phaseId}
                    className={phase.isOverBudget ? 'ds-bg-danger/10' : phase.isLowBudget ? 'ds-bg-warning/10' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium ds-text-primary">{phase.phaseName}</p>
                        <p className="text-xs ds-text-muted">{phase.phaseCode}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm ds-text-primary">
                        <p className="font-semibold">{formatCurrency(phase.budget)}</p>
                        <div className="text-xs ds-text-muted mt-1">
                          <p>M: {formatCurrency(phase.materials)}</p>
                          <p>L: {formatCurrency(phase.labour)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium ds-text-accent-primary">
                        {formatCurrency(phase.actual)}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm ds-text-secondary">
                        {formatCurrency(phase.committed)}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className={`text-sm font-medium ${
                        phase.remaining < phase.budget * 0.2 && phase.budget > 0
                          ? 'ds-text-danger'
                          : phase.remaining < phase.budget * 0.5 && phase.budget > 0
                          ? 'ds-text-warning'
                          : 'ds-text-success'
                      }`}>
                        {formatCurrency(phase.remaining)}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className={`text-sm font-medium ${
                        phase.variance > 0 ? 'ds-text-danger' : 'ds-text-success'
                      }`}>
                        {formatCurrency(phase.variance)}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-1 ds-bg-surface-muted rounded-full h-2 mr-2">
                          <div
                            className={`h-2 rounded-full ${
                              phase.utilization > 100
                                ? 'ds-bg-danger'
                                : phase.utilization > 80
                                ? 'ds-bg-warning'
                                : 'ds-bg-success'
                            }`}
                            style={{ width: `${Math.min(phase.utilization, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs ds-text-secondary">
                          {phase.utilization.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/phases/${phase.phaseId}/budget`}
                        className="ds-text-accent-primary hover:ds-text-accent-hover font-medium"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <div className="text-center py-8">
            <p className="ds-text-secondary mb-4">No phase budgets allocated to this floor yet.</p>
            <p className="text-sm ds-text-muted">
              Allocate budgets to phases to see the breakdown here.
            </p>
            {project && (
              <Link
                href={`/projects/${project._id}/budget`}
                className="mt-4 inline-block px-4 py-2 ds-bg-accent-primary text-white rounded-lg hover:ds-bg-accent-hover transition"
              >
                Go to Project Budget
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Budget Allocation Summary */}
      {floorBudgetAllocation.byPhase && Object.keys(floorBudgetAllocation.byPhase).length > 0 && (
        <div className="ds-bg-accent-subtle border ds-border-accent-subtle rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold ds-text-accent-primary">Budget Allocation Summary</h4>
            <Link
              href={`/floors/${floor._id}/budget`}
              className="text-xs ds-text-accent-primary hover:ds-text-accent-hover font-medium underline"
            >
              Manage Budget →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {Object.entries(floorBudgetAllocation.byPhase).map(([phaseCode, phaseBudget]) => {
              if (phaseBudget.total === 0) return null;
              const phaseName = phaseBudgets?.find(p => p.phaseCode === phaseCode)?.phaseName || phaseCode;
              return (
                <div key={phaseCode}>
                  <p className="ds-text-accent-primary font-medium">{phaseName}</p>
                  <p className="ds-text-accent-primary">{formatCurrency(phaseBudget.total)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* No Budget Allocated State */}
      {(!floorBudgetAllocation.byPhase || Object.keys(floorBudgetAllocation.byPhase).length === 0 || 
        Object.values(floorBudgetAllocation.byPhase).every(p => p.total === 0)) && (
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <div className="text-center py-8">
            <p className="ds-text-secondary mb-4">No phase budgets allocated to this floor yet.</p>
            <p className="text-sm ds-text-muted mb-4">
              Allocate budgets to phases to see the breakdown here.
            </p>
            {project && (
              <div className="flex gap-3 justify-center">
                <Link
                  href={`/projects/${project._id}/budget`}
                  className="px-4 py-2 ds-bg-accent-primary text-white rounded-lg hover:ds-bg-accent-hover transition"
                >
                  Go to Project Budget
                </Link>
                <Link
                  href={`/floors/${floor._id}/budget`}
                  className="px-4 py-2 ds-bg-success text-white rounded-lg hover:bg-emerald-700 transition"
                >
                  Manage Floor Budget
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
