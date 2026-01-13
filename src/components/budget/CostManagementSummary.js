/**
 * Cost Management Summary Component
 * Quick overview cards for the main project page with links to detailed cost management
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function CostManagementSummary({ projectId }) {
  const [financialOverview, setFinancialOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      fetchFinancialOverview();
    }
  }, [projectId]);

  const fetchFinancialOverview = async () => {
    try {
      setLoading(true);
      const [overviewRes, contingencyRes, dccRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/financial-overview`),
        fetch(`/api/projects/${projectId}/contingency`).catch(() => null),
        fetch(`/api/projects/${projectId}/dcc`).catch(() => null),
      ]);
      
      const overviewResult = await overviewRes.json();
      let contingencyData = null;
      let dccData = null;
      
      if (contingencyRes) {
        const contingencyResult = await contingencyRes.json();
        if (contingencyResult.success) {
          contingencyData = contingencyResult.data;
        }
      }
      
      if (dccRes) {
        const dccResult = await dccRes.json();
        if (dccResult.success) {
          dccData = dccResult.data;
        }
      }
      
      if (overviewResult.success) {
        const data = overviewResult.data;
        if (contingencyData) {
          data.contingency = contingencyData;
        }
        if (dccData) {
          data.dcc = dccData;
        }
        setFinancialOverview(data);
      }
    } catch (err) {
      console.error('Fetch financial overview error:', err);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="bg-white rounded-lg shadow p-6 border-2 border-gray-200">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const budget = financialOverview?.budget || {};
  const status = financialOverview?.status || {};

  // Calculate summaries - use comprehensive DCC data
  const dccBudget = budget.enhanced?.directConstructionCosts || 0;
  
  // Use comprehensive DCC data if available, otherwise fallback to phase spending
  const dccData = financialOverview?.dcc;
  let dccSpent = 0;
  if (dccData && dccData.spent !== undefined) {
    dccSpent = dccData.spent;
  } else {
    // Fallback to phase spending
    const phases = financialOverview?.phases || [];
    dccSpent = phases.reduce((sum, phase) => sum + (phase.actualSpending?.total || 0), 0);
  }
  
  const dccRemaining = dccData?.remaining !== undefined ? dccData.remaining : (dccBudget - dccSpent);
  const dccUsage = dccBudget > 0 ? (dccSpent / dccBudget) * 100 : 0;

  const preconstructionBudget = budget.preConstruction?.budgeted || 0;
  const preconstructionSpent = budget.preConstruction?.spent || 0;
  const preconstructionRemaining = budget.preConstruction?.remaining || 0;
  const preconstructionUsage = preconstructionBudget > 0 ? (preconstructionSpent / preconstructionBudget) * 100 : 0;

  const indirectBudget = budget.indirectCosts?.budgeted || 0;
  const indirectSpent = budget.indirectCosts?.spent || 0;
  const indirectRemaining = budget.indirectCosts?.remaining || 0;
  const indirectUsage = indirectBudget > 0 ? (indirectSpent / indirectBudget) * 100 : 0;

  const contingencyBudget = budget.enhanced?.contingencyReserve || budget.contingency || 0;
  const contingencyUsed = financialOverview?.contingency?.used || 0;
  const contingencyRemaining = financialOverview?.contingency?.remaining || (contingencyBudget - contingencyUsed);
  const contingencyUsage = contingencyBudget > 0 ? (contingencyUsed / contingencyBudget) * 100 : 0;

  const getStatusColor = (usage) => {
    if (usage >= 100) return 'bg-red-100 text-red-800 border-red-200';
    if (usage >= 80) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getStatusText = (usage) => {
    if (usage >= 100) return 'Exceeded';
    if (usage >= 80) return 'Warning';
    return 'Healthy';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border-2 border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Cost Management</h2>
        <Link
          href={`/projects/${projectId}/costs`}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
        >
          View All Costs →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* DCC Card */}
        <Link
          href={`/projects/${projectId}/costs?tab=dcc`}
          className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">🏗️</span>
            <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusColor(dccUsage)}`}>
              {getStatusText(dccUsage)}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Direct Construction Costs</h3>
          <p className="text-sm text-gray-600 mb-2">Budget: {formatCurrency(dccBudget)}</p>
          <p className="text-sm text-gray-600 mb-2">Spent: {formatCurrency(dccSpent)}</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${
                dccUsage >= 100 ? 'bg-red-600' : dccUsage >= 80 ? 'bg-yellow-600' : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(100, dccUsage)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">{dccUsage.toFixed(1)}% used</p>
        </Link>

        {/* Preconstruction Card */}
        <Link
          href={`/projects/${projectId}/costs?tab=preconstruction`}
          className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">📋</span>
            <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusColor(preconstructionUsage)}`}>
              {getStatusText(preconstructionUsage)}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Preconstruction</h3>
          <p className="text-sm text-gray-600 mb-2">Budget: {formatCurrency(preconstructionBudget)}</p>
          <p className="text-sm text-gray-600 mb-2">Spent: {formatCurrency(preconstructionSpent)}</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${
                preconstructionUsage >= 100
                  ? 'bg-red-600'
                  : preconstructionUsage >= 80
                  ? 'bg-yellow-600'
                  : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(100, preconstructionUsage)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">{preconstructionUsage.toFixed(1)}% used</p>
        </Link>

        {/* Indirect Costs Card */}
        <Link
          href={`/projects/${projectId}/costs?tab=indirect`}
          className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">⚙️</span>
            <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusColor(indirectUsage)}`}>
              {getStatusText(indirectUsage)}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Indirect Costs</h3>
          <p className="text-sm text-gray-600 mb-2">Budget: {formatCurrency(indirectBudget)}</p>
          <p className="text-sm text-gray-600 mb-2">Spent: {formatCurrency(indirectSpent)}</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${
                indirectUsage >= 100
                  ? 'bg-red-600'
                  : indirectUsage >= 80
                  ? 'bg-yellow-600'
                  : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(100, indirectUsage)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">{indirectUsage.toFixed(1)}% used</p>
        </Link>

        {/* Contingency Card */}
        <Link
          href={`/projects/${projectId}/costs?tab=contingency`}
          className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">🛡️</span>
            <span className={`px-2 py-1 text-xs font-semibold rounded ${getStatusColor(contingencyUsage)}`}>
              {getStatusText(contingencyUsage)}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Contingency Reserve</h3>
          <p className="text-sm text-gray-600 mb-2">Budget: {formatCurrency(contingencyBudget)}</p>
          <p className="text-sm text-gray-600 mb-2">Used: {formatCurrency(contingencyUsed)}</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full ${
                contingencyUsage >= 100
                  ? 'bg-red-600'
                  : contingencyUsage >= 80
                  ? 'bg-yellow-600'
                  : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(100, contingencyUsage)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">{contingencyUsage.toFixed(1)}% used</p>
        </Link>
      </div>

      {/* Quick Links */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href={`/projects/${projectId}/costs?tab=analytics`}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            📈 View Analytics →
          </Link>
          <Link
            href={`/projects/${projectId}/costs?tab=reports`}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            📄 Generate Reports →
          </Link>
          <Link
            href={`/projects/${projectId}/costs?tab=transfers`}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            🔄 Budget Transfers →
          </Link>
        </div>
      </div>
    </div>
  );
}
