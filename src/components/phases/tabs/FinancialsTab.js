/**
 * Phase Financials Tab Component
 * Displays comprehensive financial information for the phase
 */

'use client';

import Link from 'next/link';
import { getPhaseBudgetStatus, formatPercentage, safePercentage } from '@/lib/financial-status-helpers';

export function FinancialsTab({ phase, formatCurrency }) {
  const financialSummary = phase.financialSummary || {
    budgetTotal: phase.budgetAllocation?.total || 0,
    actualTotal: phase.actualSpending?.total || 0,
    committedTotal: phase.financialStates?.committed || 0,
    estimatedTotal: phase.financialStates?.estimated || 0,
    remaining: phase.financialStates?.remaining || 0,
    variance: 0,
    variancePercentage: 0,
    utilizationPercentage: 0
  };

  // Get phase budget status with optional awareness
  const phaseStatus = getPhaseBudgetStatus(
    phase,
    phase.actualSpending || {},
    phase.financialStates || {}
  );

  return (
    <div className="space-y-6">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Budget Allocated</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(financialSummary.budgetTotal)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Actual Spending</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(financialSummary.actualTotal)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Committed Costs</p>
          <p className="text-2xl font-bold text-orange-600">
            {formatCurrency(financialSummary.committedTotal)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Remaining Budget</p>
          <p className={`text-2xl font-bold ${
            financialSummary.remaining < 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {formatCurrency(financialSummary.remaining)}
          </p>
        </div>
      </div>

      {/* Budget vs Actual Comparison */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget vs Actual</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Budget Utilization</span>
              <span>{phaseStatus.isOptional ? 'Not Set' : formatPercentage(phaseStatus.utilization, 'N/A')}</span>
            </div>
            {phaseStatus.isOptional ? (
              <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">{phaseStatus.message}</p>
              </div>
            ) : (
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all ${
                    phaseStatus.status === 'over_budget'
                      ? 'bg-red-600'
                      : phaseStatus.status === 'at_risk'
                      ? 'bg-yellow-600'
                      : 'bg-green-600'
                  }`}
                  style={{
                    width: `${Math.min(100, phaseStatus.utilization || 0)}%`
                  }}
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-gray-600">Variance</p>
              {phaseStatus.isOptional ? (
                <>
                  <p className="text-lg font-semibold mt-1 text-gray-500">N/A</p>
                  <p className="text-xs text-gray-500">Budget not set</p>
                </>
              ) : (
                <>
                  <p className={`text-lg font-semibold mt-1 ${
                    phaseStatus.variance !== null && phaseStatus.variance < 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {formatCurrency(phaseStatus.variance !== null ? phaseStatus.variance : 0)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {phaseStatus.variance !== null && phaseStatus.variance < 0 ? '+' : ''}
                    {formatPercentage(phaseStatus.variance !== null ? (phaseStatus.variance / phaseStatus.budget) * 100 : null, 'N/A')}
                  </p>
                </>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Estimated Costs</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {formatCurrency(financialSummary.estimatedTotal)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Materials</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(phase.budgetAllocation?.materials || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Spent: {formatCurrency(phase.actualSpending?.materials || 0)}
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full"
                style={{
                  width: `${(() => {
                    const matPercent = safePercentage(
                      phase.actualSpending?.materials || 0,
                      phase.budgetAllocation?.materials || 0
                    );
                    return matPercent !== null ? Math.min(100, matPercent) : 0;
                  })()}%`
                }}
              />
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Labour</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(phase.budgetAllocation?.labour || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Spent: {formatCurrency(phase.actualSpending?.labour || 0)}
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-green-600 h-1.5 rounded-full"
                style={{
                  width: `${(() => {
                    const labPercent = safePercentage(
                      phase.actualSpending?.labour || 0,
                      phase.budgetAllocation?.labour || 0
                    );
                    return labPercent !== null ? Math.min(100, labPercent) : 0;
                  })()}%`
                }}
              />
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Equipment</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(phase.budgetAllocation?.equipment || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Spent: {formatCurrency(phase.actualSpending?.equipment || 0)}
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-purple-600 h-1.5 rounded-full"
                style={{
                  width: `${phase.budgetAllocation?.equipment > 0
                    ? Math.min(100, ((phase.actualSpending?.equipment || 0) / phase.budgetAllocation.equipment) * 100)
                    : 0}%`
                }}
              />
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Subcontractors</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(phase.budgetAllocation?.subcontractors || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Spent: {formatCurrency(phase.actualSpending?.subcontractors || 0)}
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-orange-600 h-1.5 rounded-full"
                style={{
                  width: `${phase.budgetAllocation?.subcontractors > 0
                    ? Math.min(100, ((phase.actualSpending?.subcontractors || 0) / phase.budgetAllocation.subcontractors) * 100)
                    : 0}%`
                }}
              />
            </div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Professional Services</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(phase.professionalServices?.totalFees || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Activities: {phase.professionalServices?.activitiesCount || 0}
            </p>
          </div>
          {/* Contingency removed - tracked at project level, not phase level */}
        </div>
      </div>

      {/* Budget Alerts */}
      {!phaseStatus.isOptional && phaseStatus.utilization !== null && phaseStatus.utilization > 80 && (
        <div className={`rounded-lg p-4 border-2 ${
          phaseStatus.status === 'over_budget'
            ? 'bg-red-50 border-red-300'
            : 'bg-yellow-50 border-yellow-300'
        }`}>
          <div className="flex items-start">
            <svg className={`w-5 h-5 mr-2 mt-0.5 ${
              phaseStatus.status === 'over_budget' ? 'text-red-600' : 'text-yellow-600'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className={`font-medium ${
                phaseStatus.status === 'over_budget' ? 'text-red-900' : 'text-yellow-900'
              }`}>
                {phaseStatus.status === 'over_budget' ? 'Over Budget' : 'Approaching Budget Limit'}
              </p>
              <p className={`text-sm mt-1 ${
                phaseStatus.status === 'over_budget' ? 'text-red-700' : 'text-yellow-700'
              }`}>
                {phaseStatus.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Link to Detailed Financial View */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Detailed Financial Analysis</p>
            <p className="text-xs text-gray-600 mt-1">View comprehensive financial reports and charts</p>
          </div>
          <Link
            href={`/phases/${phase._id}/financial`}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Details →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default FinancialsTab;


