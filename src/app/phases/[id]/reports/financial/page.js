/**
 * Phase Financial Report Page
 * Detailed financial report with budget vs actual, trends, and variance analysis
 * 
 * Route: /phases/[id]/reports/financial
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { useToast } from '@/components/toast';

export default function FinancialReportPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (params.id) {
      fetchReportData();
    }
  }, [params.id]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/phases/${params.id}/reports/financial`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch financial report');
      }

      setReportData(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch financial report error:', err);
      toast.showError(err.message || 'Failed to load financial report');
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
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  if (error || !reportData) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Failed to load financial report'}
          </div>
          <Link href={`/phases/${params.id}`} className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Phase
          </Link>
        </div>
      </AppLayout>
    );
  }

  const { phase, financialSummary, budgetAllocation, breakdown, trends, variance } = reportData;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/phases/${params.id}/dashboard`} className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Financial Report: {phase.phaseName}
              </h1>
              <p className="text-gray-600 mt-1">{phase.phaseCode}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Print Report
              </button>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(financialSummary.budgetTotal)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Actual Spending</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(financialSummary.actualTotal)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Committed</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(financialSummary.committedTotal)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Remaining</p>
              <p className={`text-2xl font-bold ${financialSummary.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(financialSummary.remaining)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Variance</p>
              <p className={`text-2xl font-bold ${financialSummary.variance < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {financialSummary.variance >= 0 ? '+' : ''}{formatCurrency(financialSummary.variance)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {financialSummary.variancePercentage >= 0 ? '+' : ''}{financialSummary.variancePercentage.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Utilization</p>
              <p className="text-2xl font-bold text-gray-900">{financialSummary.utilizationPercentage.toFixed(1)}%</p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    financialSummary.utilizationPercentage > 100 ? 'bg-red-600' :
                    financialSummary.utilizationPercentage > 80 ? 'bg-yellow-600' : 'bg-green-600'
                  }`}
                  style={{ width: `${Math.min(100, financialSummary.utilizationPercentage)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Budget Allocation */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget Allocation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-gray-600">Materials</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(budgetAllocation.materials || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Labour</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(budgetAllocation.labour || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Equipment</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(budgetAllocation.equipment || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Subcontractors</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(budgetAllocation.subcontractors || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Contingency</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(budgetAllocation.contingency || 0)}</p>
            </div>
          </div>
        </div>

        {/* Cost Breakdown by Category */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost Breakdown</h2>
          
          {/* Materials */}
          <div className="mb-6">
            <h3 className="text-md font-semibold text-gray-800 mb-3">Materials</h3>
            <div className="space-y-2">
              {breakdown.materials.byCategory.length > 0 ? (
                breakdown.materials.byCategory.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <p className="font-medium text-gray-900">{item.category}</p>
                      <p className="text-xs text-gray-500">{item.count} items</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(item.totalCost)}</p>
                      <p className="text-xs text-gray-500">{item.percentage}%</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No materials data</p>
              )}
            </div>
          </div>

          {/* Expenses */}
          <div className="mb-6">
            <h3 className="text-md font-semibold text-gray-800 mb-3">Expenses</h3>
            <div className="space-y-2">
              {breakdown.expenses.byCategory.length > 0 ? (
                breakdown.expenses.byCategory.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <p className="font-medium text-gray-900">{item.category}</p>
                      <p className="text-xs text-gray-500">{item.count} items</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(item.totalCost)}</p>
                      <p className="text-xs text-gray-500">{item.percentage}%</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No expenses data</p>
              )}
            </div>
          </div>

          {/* Equipment */}
          <div className="mb-6">
            <h3 className="text-md font-semibold text-gray-800 mb-3">Equipment</h3>
            <div className="space-y-2">
              {breakdown.equipment.byType.length > 0 ? (
                breakdown.equipment.byType.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <p className="font-medium text-gray-900">{item.type}</p>
                      <p className="text-xs text-gray-500">{item.count} items</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(item.totalCost)}</p>
                      <p className="text-xs text-gray-500">{item.percentage}%</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No equipment data</p>
              )}
            </div>
          </div>

          {/* Subcontractors */}
          <div className="mb-6">
            <h3 className="text-md font-semibold text-gray-800 mb-3">Subcontractors</h3>
            <div className="space-y-2">
              {breakdown.subcontractors.byType.length > 0 ? (
                breakdown.subcontractors.byType.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <p className="font-medium text-gray-900">{item.type}</p>
                      <p className="text-xs text-gray-500">{item.count} contracts</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(item.totalCost)}</p>
                      <p className="text-xs text-gray-500">{item.percentage}%</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No subcontractor data</p>
              )}
            </div>
          </div>
        </div>

        {/* Variance Analysis */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Variance Analysis</h2>
          <div className="space-y-4">
            {Object.entries(variance.byCategory).map(([category, data]) => (
              <div key={category} className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-gray-900 capitalize">{category}</h3>
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                    parseFloat(data.variancePercentage) > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {data.variancePercentage >= 0 ? '+' : ''}{data.variancePercentage}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Budgeted</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(data.budgeted)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Actual</p>
                    <p className="font-semibold text-blue-600">{formatCurrency(data.actual)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Variance</p>
                    <p className={`font-semibold ${data.variance < 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {data.variance >= 0 ? '+' : ''}{formatCurrency(data.variance)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cost Trends */}
        {trends && (trends.materials.length > 0 || trends.expenses.length > 0) && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost Trends</h2>
            <div className="space-y-4">
              {trends.materials.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-800 mb-2">Materials by Month</h3>
                  <div className="space-y-2">
                    {trends.materials.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-gray-600">{item.period}</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(item.totalCost)}</span>
                        <span className="text-xs text-gray-500">{item.count} items</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {trends.expenses.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-800 mb-2">Expenses by Month</h3>
                  <div className="space-y-2">
                    {trends.expenses.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b">
                        <span className="text-sm text-gray-600">{item.period}</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(item.totalCost)}</span>
                        <span className="text-xs text-gray-500">{item.count} items</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}


