/**
 * Phase Financial Details Page
 * Displays comprehensive financial breakdown for a specific phase
 * 
 * Route: /phases/[id]/financial
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';

function PhaseFinancialPageContent() {
  const router = useRouter();
  const params = useParams();
  const phaseId = params?.id;
  
  const [financialData, setFinancialData] = useState(null);
  const [phase, setPhase] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (phaseId) {
      fetchFinancialData();
    }
  }, [phaseId]);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch financial summary
      const response = await fetch(`/api/phases/${phaseId}/financial`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const financialResult = await financialResponse.json();

      if (!financialResult.success) {
        throw new Error(financialResult.error || 'Failed to fetch financial data');
      }

      setFinancialData(financialResult.data);
      setPhase(financialResult.data.phase);

      // Fetch project for context
      if (financialResult.data.phase?.projectId) {
        const response = await fetch(`/api/projects/${financialResult.data.phase.projectId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const projectResult = await projectResponse.json();
        if (projectResult.success) {
          setProject(projectResult.data);
        }
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch financial data error:', err);
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

  const formatPercentage = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  if (error || !financialData) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Failed to load financial data'}
          </div>
          <Link href={`/phases/${phaseId}`} className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Phase
          </Link>
        </div>
      </AppLayout>
    );
  }

  const { financialSummary, spendingBreakdown, categoryBreakdown } = financialData;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/phases/${phaseId}`} className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Phase
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Phase Financial Details</h1>
          <p className="text-gray-600 mt-1">
            {phase?.phaseName} ({phase?.phaseCode})
          </p>
          {project && (
            <Link 
              href={`/projects/${project._id}`}
              className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
            >
              Project: {project.projectName}
            </Link>
          )}
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
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
            <p className="text-sm text-gray-600 mb-2">Committed</p>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(financialSummary.committedTotal || 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Estimated</p>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(financialSummary.estimatedTotal || 0)}
            </p>
          </div>
        </div>

        {/* Remaining & Variance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Remaining Budget</p>
            <p className={`text-2xl font-bold ${
              financialSummary.remaining < 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {formatCurrency(financialSummary.remaining)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Budget - Actual - Committed
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Variance</p>
            <p className={`text-2xl font-bold ${
              financialSummary.variance > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {formatCurrency(financialSummary.variance)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {formatPercentage(financialSummary.variancePercentage)} vs Budget
            </p>
          </div>
        </div>

        {/* Budget Utilization */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget Utilization</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Overall Utilization</span>
                <span>{financialSummary.utilizationPercentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    financialSummary.utilizationPercentage > 100 
                      ? 'bg-red-600' 
                      : financialSummary.utilizationPercentage > 80 
                      ? 'bg-yellow-600' 
                      : 'bg-green-600'
                  }`}
                  style={{
                    width: `${Math.min(100, financialSummary.utilizationPercentage)}%`
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Budget</p>
                <p className="font-semibold text-gray-900">{formatCurrency(financialSummary.budgetTotal)}</p>
              </div>
              <div>
                <p className="text-gray-600">Spent</p>
                <p className="font-semibold text-blue-600">{formatCurrency(financialSummary.actualTotal)}</p>
              </div>
              <div>
                <p className="text-gray-600">Committed</p>
                <p className="font-semibold text-orange-600">{formatCurrency(financialSummary.committedTotal || 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Spending Breakdown */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Spending Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Materials</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(spendingBreakdown.materials)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Expenses</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(spendingBreakdown.expenses)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Labour</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(spendingBreakdown.labour)}
              </p>
              <p className="text-xs text-gray-500">(Not yet implemented)</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Equipment</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(spendingBreakdown.equipment)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Subcontractors</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(spendingBreakdown.subcontractors)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-lg font-semibold text-blue-600">
                {formatCurrency(spendingBreakdown.total)}
              </p>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        {(categoryBreakdown?.materials?.length > 0 || categoryBreakdown?.expenses?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Materials by Category */}
            {categoryBreakdown?.materials?.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Materials by Category</h2>
                <div className="space-y-3">
                  {categoryBreakdown.materials.map((cat, index) => (
                    <div key={index} className="flex justify-between items-center pb-3 border-b border-gray-200 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{cat.category}</p>
                        <p className="text-xs text-gray-500">{cat.count} item(s)</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(cat.total)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expenses by Category */}
            {categoryBreakdown?.expenses?.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Expenses by Category</h2>
                <div className="space-y-3">
                  {categoryBreakdown.expenses.map((cat, index) => (
                    <div key={index} className="flex justify-between items-center pb-3 border-b border-gray-200 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{cat.category}</p>
                        <p className="text-xs text-gray-500">{cat.count} entry(ies)</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(cat.total)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Financial States Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial States</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Budgeted</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(phase?.financialStates?.budgeted || financialSummary.budgetTotal)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Estimated</p>
              <p className="text-lg font-semibold text-purple-600">
                {formatCurrency(phase?.financialStates?.estimated || financialSummary.estimatedTotal || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Committed</p>
              <p className="text-lg font-semibold text-orange-600">
                {formatCurrency(phase?.financialStates?.committed || financialSummary.committedTotal || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Actual</p>
              <p className="text-lg font-semibold text-blue-600">
                {formatCurrency(phase?.financialStates?.actual || financialSummary.actualTotal)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function PhaseFinancialPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    }>
      <PhaseFinancialPageContent />
    </Suspense>
  );
}



