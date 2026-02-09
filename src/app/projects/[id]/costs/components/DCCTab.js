/**
 * DCC Tab
 * Direct Construction Costs management
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { HierarchicalBudgetDisplay } from '@/components/budget/HierarchicalBudgetDisplay';

export function DCCTab({ projectId }) {
  const [project, setProject] = useState(null);
  const [phases, setPhases] = useState([]);
  const [dccData, setDccData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [projectRes, phasesRes, dccRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
        fetch(`/api/phases?projectId=${projectId}&includeFinancials=true`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
        fetch(`/api/projects/${projectId}/dcc`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
      ]);

      const projectData = await projectRes.json();
      const phasesData = await phasesRes.json();
      const dccDataResult = await dccRes.json();

      if (!projectData.success) {
        throw new Error(projectData.error || 'Failed to fetch project');
      }

      if (!phasesData.success) {
        throw new Error(phasesData.error || 'Failed to fetch phases');
      }

      if (!dccDataResult.success) {
        throw new Error(dccDataResult.error || 'Failed to fetch DCC data');
      }

      setProject(projectData.data);
      setPhases(phasesData.data || []);
      setDccData(dccDataResult.data);
    } catch (err) {
      console.error('Fetch data error:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId, fetchData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
        <div className="animate-pulse">
          <div className="h-5 sm:h-6 bg-gray-200 rounded w-1/3 mb-3 sm:mb-4"></div>
          <div className="h-3 sm:h-4 bg-gray-200 rounded w-full mb-2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base">
          {error}
        </div>
      </div>
    );
  }

  // Use comprehensive DCC data from API, with fallback
  if (!dccData) {
    return (
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 sm:px-4 py-2 sm:py-3 rounded text-sm sm:text-base">
          Loading DCC data...
        </div>
      </div>
    );
  }

  const dccBudget = dccData.budgeted || 0;
  const totalDCCSpending = dccData.spent || 0;
  const totalPhaseBudgets = dccData.allocated || 0;
  const unallocatedDCC = dccData.unallocated || 0;
  const dccRemaining = dccData.remaining || 0;
  const dccUsage = dccData.usagePercentage || 0;
  const dccBreakdown = dccData.breakdown || {};
  const phaseBreakdown = dccData.phases || [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* DCC Overview */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Direct Construction Costs Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Total DCC Budget</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{formatCurrency(dccBudget)}</p>
          </div>
          <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Allocated to Phases</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{formatCurrency(totalPhaseBudgets)}</p>
          </div>
          <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Unallocated</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{formatCurrency(unallocatedDCC)}</p>
          </div>
          <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Spent</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{formatCurrency(totalDCCSpending)}</p>
          </div>
        </div>
        <div className="mt-3 sm:mt-4">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-xs sm:text-sm text-gray-600 mb-2">
            <span>Usage: {dccUsage.toFixed(1)}%</span>
            <span className="break-words">Remaining: {formatCurrency(dccRemaining)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
            <div
              className={`h-2 sm:h-3 rounded-full ${
                dccUsage >= 100
                  ? 'bg-red-600'
                  : dccUsage >= 80
                  ? 'bg-yellow-600'
                  : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(100, dccUsage)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* DCC Spending Breakdown */}
      {dccBreakdown && Object.keys(dccBreakdown).length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Spending Breakdown</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Phase Spending</p>
              <p className="text-xs sm:text-sm font-semibold text-gray-900 break-words">{formatCurrency(dccBreakdown.phaseSpending || 0)}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Materials</p>
              <p className="text-xs sm:text-sm font-semibold text-gray-900 break-words">{formatCurrency(dccBreakdown.materials || 0)}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Labour</p>
              <p className="text-xs sm:text-sm font-semibold text-gray-900 break-words">{formatCurrency(dccBreakdown.labour || 0)}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Equipment</p>
              <p className="text-xs sm:text-sm font-semibold text-gray-900 break-words">{formatCurrency(dccBreakdown.equipment || 0)}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Expenses</p>
              <p className="text-xs sm:text-sm font-semibold text-gray-900 break-words">{formatCurrency(dccBreakdown.expenses || 0)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Budget Breakdown */}
      {project?.budget && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Budget Breakdown</h3>
          <HierarchicalBudgetDisplay budget={project.budget} />
        </div>
      )}

      {/* Phase Breakdown */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 border-2 border-gray-200">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Phase Breakdown</h3>
        {phases.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-gray-500">
            <p className="text-sm sm:text-base">No phases configured yet.</p>
            <Link
              href={`/projects/${projectId}`}
              className="mt-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Configure phases →
            </Link>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {phaseBreakdown.map((phase) => (
              <div
                key={phase.phaseId}
                className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-3 gap-2">
                  <div className="flex-1">
                    <h4 className="text-sm sm:text-base font-semibold text-gray-900 break-words">
                      {phase.phaseName}
                      {phase.phaseCode && (
                        <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-gray-600">({phase.phaseCode})</span>
                      )}
                    </h4>
                  </div>
                  <Link
                    href={`/projects/${projectId}?phase=${phase.phaseId}`}
                    className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                  >
                    View Details →
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-2 sm:mb-3">
                  <div>
                    <p className="text-xs text-gray-600">Budget</p>
                    <p className="text-xs sm:text-sm font-semibold text-gray-900 break-words">{formatCurrency(phase.budget)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Spent</p>
                    <p className="text-xs sm:text-sm font-semibold text-gray-900 break-words">{formatCurrency(phase.spending)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Remaining</p>
                    <p className="text-xs sm:text-sm font-semibold text-gray-900 break-words">{formatCurrency(phase.remaining)}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      phase.usagePercentage >= 100
                        ? 'bg-red-600'
                        : phase.usagePercentage >= 80
                        ? 'bg-yellow-600'
                        : 'bg-green-600'
                    }`}
                    style={{ width: `${Math.min(100, phase.usagePercentage)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{phase.usagePercentage.toFixed(1)}% used</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
