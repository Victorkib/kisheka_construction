/**
 * Material Request Financial Status Component
 * 
 * Displays comprehensive financial status for material requests including:
 * - Phase budget status
 * - Capital availability
 * - Floor budget status (if applicable)
 * - Visual indicators and warnings
 * 
 * @component
 * @param {Object} props
 * @param {string} props.projectId - Project ID
 * @param {string} props.phaseId - Phase ID
 * @param {string} props.floorId - Floor ID (optional)
 * @param {number} props.estimatedCost - Estimated cost of the material request
 * @param {boolean} props.loading - Loading state
 */

'use client';

import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/loading';

export function MaterialRequestFinancialStatus({ 
  projectId, 
  phaseId, 
  floorId, 
  estimatedCost,
  loading: externalLoading = false 
}) {
  const [financialData, setFinancialData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (projectId && phaseId && estimatedCost !== undefined && estimatedCost !== null) {
      fetchFinancialStatus();
    } else {
      setFinancialData(null);
    }
  }, [projectId, phaseId, floorId, estimatedCost]);

  const fetchFinancialStatus = async () => {
    if (!projectId || !phaseId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch phase data with financial summary
      const phaseResponse = await fetch(`/api/phases/${phaseId}?includeFinancials=true`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      let phaseData = null;
      if (phaseResponse.ok) {
        const phaseResult = await phaseResponse.json();
        if (phaseResult.success && phaseResult.data) {
          phaseData = phaseResult.data;
        }
      }

      // Fetch project financial overview
      const financeResponse = await fetch(`/api/projects/${projectId}/financial-overview`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      let financeData = null;
      if (financeResponse.ok) {
        const financeResult = await financeResponse.json();
        if (financeResult.success && financeResult.data) {
          financeData = financeResult.data;
        }
      }

      // Fetch floor budget if floorId provided
      let floorBudgetData = null;
      if (floorId) {
        try {
          const floorResponse = await fetch(`/api/floors/${floorId}/budget`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
          });
          if (floorResponse.ok) {
            const floorResult = await floorResponse.json();
            if (floorResult.success && floorResult.data) {
              floorBudgetData = floorResult.data;
            }
          }
        } catch (floorError) {
          console.error('Error fetching floor budget:', floorError);
        }
      }

      // Calculate phase budget status
      // Note: financialStates.committed and estimated are totals, not broken down by category
      // For materials, we'll use the phase's actualSpending.materials and estimate committed from material requests
      const phaseMaterialBudget = phaseData?.budgetAllocation?.materials || 0;
      const phaseActualSpending = phaseData?.actualSpending?.materials || 0;
      
      // Fetch committed material costs from material requests
      let phaseCommittedCost = 0;
      let phaseEstimatedCost = 0;
      try {
        const materialRequestsResponse = await fetch(`/api/material-requests?phaseId=${phaseId}&status=approved&limit=1000`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        if (materialRequestsResponse.ok) {
          const requestsData = await materialRequestsResponse.json();
          if (requestsData.success && requestsData.data?.requests) {
            const approvedRequests = requestsData.data.requests.filter(req => !req.linkedPurchaseOrderId);
            phaseCommittedCost = approvedRequests.reduce((sum, req) => sum + (req.estimatedCost || 0), 0);
            phaseEstimatedCost = phaseCommittedCost; // For now, use same value
          }
        }
      } catch (err) {
        console.error('Error fetching material requests for committed cost:', err);
        // Fallback: use financialStates if available (though it's total, not materials-specific)
        phaseCommittedCost = phaseData?.financialStates?.committed || 0;
        phaseEstimatedCost = phaseData?.financialStates?.estimated || 0;
      }
      
      const phaseTotalUsed = phaseActualSpending + phaseCommittedCost + phaseEstimatedCost;
      const phaseAvailable = Math.max(0, phaseMaterialBudget - phaseTotalUsed);
      const phaseBudgetStatus = phaseMaterialBudget === 0 
        ? 'not_set' 
        : (estimatedCost <= phaseAvailable ? 'sufficient' : 'insufficient');

      // Calculate capital status
      const totalInvested = financeData?.financing?.totalInvested || 0;
      const totalUsed = financeData?.financing?.totalUsed || 0;
      const committedCost = financeData?.financing?.committedCost || 0;
      const availableCapital = Math.max(0, totalInvested - totalUsed - committedCost);
      const capitalStatus = totalInvested === 0 
        ? 'not_set' 
        : (estimatedCost <= availableCapital ? 'sufficient' : 'insufficient');

      // Calculate floor budget status if applicable
      let floorBudgetStatus = null;
      if (floorId && floorBudgetData) {
        const floorMaterialBudget = floorBudgetData.budgetAllocation?.materials || 0;
        const floorActualSpending = floorBudgetData.actualSpending?.materials || 0;
        const floorCommittedCost = floorBudgetData.committedCosts?.materials || 0;
        const floorTotalUsed = floorActualSpending + floorCommittedCost;
        const floorAvailable = Math.max(0, floorMaterialBudget - floorTotalUsed);
        floorBudgetStatus = {
          budget: floorMaterialBudget,
          available: floorAvailable,
          used: floorTotalUsed,
          status: floorMaterialBudget === 0 
            ? 'not_set' 
            : (estimatedCost <= floorAvailable ? 'sufficient' : 'insufficient'),
        };
      }

      setFinancialData({
        phase: {
          budget: phaseMaterialBudget,
          available: phaseAvailable,
          used: phaseTotalUsed,
          actual: phaseActualSpending,
          committed: phaseCommittedCost,
          estimated: phaseEstimatedCost,
          status: phaseBudgetStatus,
        },
        capital: {
          totalInvested,
          available: availableCapital,
          used: totalUsed,
          committed: committedCost,
          status: capitalStatus,
        },
        floor: floorBudgetStatus,
      });
    } catch (err) {
      console.error('Error fetching financial status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sufficient':
        return 'text-green-700 bg-green-50 border-green-400/60';
      case 'insufficient':
        return 'text-red-700 bg-red-50 border-red-400/60';
      case 'not_set':
        return 'text-blue-700 bg-blue-50 border-blue-400/60';
      default:
        return 'ds-text-secondary ds-bg-surface-muted ds-border-subtle';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'sufficient':
        return 'Sufficient';
      case 'insufficient':
        return 'Insufficient';
      case 'not_set':
        return 'Not Set';
      default:
        return 'Unknown';
    }
  };

  if (externalLoading || loading) {
    return (
      <div className="ds-bg-surface rounded-lg border ds-border-subtle p-4">
        <div className="flex items-center gap-2 text-sm ds-text-secondary">
          <LoadingSpinner size="sm" />
          <span>Loading financial status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-400/60 rounded-lg p-4">
        <p className="text-sm text-red-700">Error loading financial status: {error}</p>
      </div>
    );
  }

  if (!financialData || !estimatedCost || estimatedCost <= 0) {
    return null;
  }

  const { phase, capital, floor } = financialData;

  return (
    <div className="ds-bg-surface rounded-lg border ds-border-subtle p-4 space-y-4">
      <h3 className="text-sm font-semibold ds-text-primary">Financial Status</h3>
      
      {/* Phase Budget Status */}
      <div className={`rounded-lg border p-3 ${getStatusColor(phase.status)}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Phase Material Budget</span>
          <span className={`text-xs px-2 py-1 rounded ${getStatusColor(phase.status)}`}>
            {getStatusLabel(phase.status)}
          </span>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Budget:</span>
            <span className="font-semibold">{formatCurrency(phase.budget)}</span>
          </div>
          <div className="flex justify-between">
            <span>Used:</span>
            <span>{formatCurrency(phase.used)}</span>
          </div>
          <div className="flex justify-between">
            <span>Available:</span>
            <span className="font-semibold">{formatCurrency(phase.available)}</span>
          </div>
          <div className="flex justify-between">
            <span>Request Amount:</span>
            <span className="font-semibold">{formatCurrency(estimatedCost)}</span>
          </div>
          {phase.status === 'insufficient' && (
            <div className="mt-2 pt-2 border-t border-red-400/60">
              <span className="text-red-800 font-medium">
                Shortfall: {formatCurrency(estimatedCost - phase.available)}
              </span>
            </div>
          )}
          {phase.status === 'not_set' && (
            <div className="mt-2 pt-2 border-t border-blue-400/60">
              <span className="text-blue-800 text-xs">
                No budget set. Spending will be tracked. Set budget later to enable validation.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Capital Status */}
      <div className={`rounded-lg border p-3 ${getStatusColor(capital.status)}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Capital Availability</span>
          <span className={`text-xs px-2 py-1 rounded ${getStatusColor(capital.status)}`}>
            {getStatusLabel(capital.status)}
          </span>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Total Invested:</span>
            <span className="font-semibold">{formatCurrency(capital.totalInvested)}</span>
          </div>
          <div className="flex justify-between">
            <span>Used:</span>
            <span>{formatCurrency(capital.used)}</span>
          </div>
          <div className="flex justify-between">
            <span>Committed:</span>
            <span>{formatCurrency(capital.committed)}</span>
          </div>
          <div className="flex justify-between">
            <span>Available:</span>
            <span className="font-semibold">{formatCurrency(capital.available)}</span>
          </div>
          <div className="flex justify-between">
            <span>Request Amount:</span>
            <span className="font-semibold">{formatCurrency(estimatedCost)}</span>
          </div>
          {capital.status === 'insufficient' && (
            <div className="mt-2 pt-2 border-t border-red-400/60">
              <span className="text-red-800 font-medium">
                Shortfall: {formatCurrency(estimatedCost - capital.available)}
              </span>
              <p className="text-red-700 text-xs mt-1">
                Warning: Insufficient capital. Add capital before converting to purchase order.
              </p>
            </div>
          )}
          {capital.status === 'not_set' && (
            <div className="mt-2 pt-2 border-t border-blue-400/60">
              <span className="text-blue-800 text-xs">
                No capital invested. Capital validation will occur when converting to purchase order.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Floor Budget Status (if applicable) */}
      {floor && (
        <div className={`rounded-lg border p-3 ${getStatusColor(floor.status)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Floor Material Budget</span>
            <span className={`text-xs px-2 py-1 rounded ${getStatusColor(floor.status)}`}>
              {getStatusLabel(floor.status)}
            </span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Budget:</span>
              <span className="font-semibold">{formatCurrency(floor.budget)}</span>
            </div>
            <div className="flex justify-between">
              <span>Used:</span>
              <span>{formatCurrency(floor.used)}</span>
            </div>
            <div className="flex justify-between">
              <span>Available:</span>
              <span className="font-semibold">{formatCurrency(floor.available)}</span>
            </div>
            {floor.status === 'not_set' && (
              <div className="mt-2 pt-2 border-t border-blue-400/60">
                <span className="text-blue-800 text-xs">
                  No floor budget set. Phase budget validation applies.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary Message */}
      <div className="pt-2 border-t ds-border-subtle">
        {phase.status === 'sufficient' && capital.status === 'sufficient' && (
          <p className="text-xs text-green-700 font-medium">
            ✓ Budget and capital validation passed. Request can proceed.
          </p>
        )}
        {phase.status === 'insufficient' && (
          <p className="text-xs text-red-700 font-medium">
            ✗ Phase budget exceeded. Request will be blocked.
          </p>
        )}
        {phase.status === 'sufficient' && capital.status === 'insufficient' && (
          <p className="text-xs text-yellow-700 font-medium">
            ⚠ Budget validation passed. However, insufficient capital. Add capital before converting to purchase order.
          </p>
        )}
        {phase.status === 'not_set' && capital.status === 'not_set' && (
          <p className="text-xs text-blue-700">
            ℹ No budget or capital set. Spending will be tracked. Set budget/capital later to enable validation.
          </p>
        )}
      </div>
    </div>
  );
}
