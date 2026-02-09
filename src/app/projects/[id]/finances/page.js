/**
 * Project Financial Overview Page
 * Unified view showing budget, financing, and actual spending
 * 
 * Route: /projects/[id]/finances
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

function FinancialOverviewContent() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchFinancialOverview();
    }
  }, [projectId]);

  const fetchFinancialOverview = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectId}/financial-overview`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch financial overview');
      }

      setData(result.data);
    } catch (err) {
      console.error('Fetch financial overview error:', err);
      setError(err.message || 'Failed to load financial overview');
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'at_risk':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'healthy':
        return 'Healthy';
      case 'at_risk':
        return 'At Risk';
      case 'critical':
        return 'Critical';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading financial overview...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">No financial data available for this project.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Prepare chart data
  const comparisonData = [
    {
      name: 'Budget',
      value: data.budget.total,
      type: 'Planning',
    },
    {
      name: 'Capital',
      value: data.financing.totalInvested,
      type: 'Available',
    },
    {
      name: 'Actual',
      value: data.actual.total,
      type: 'Spent',
    },
  ];

  const breakdownData = [
    {
      name: 'Materials',
      budget: data.budget.materials,
      actual: data.actual.materials,
    },
    {
      name: 'Labour',
      budget: data.budget.labour,
      actual: data.actual.labour,
    },
    {
      name: 'Contingency',
      budget: data.budget.contingency,
      actual: data.actual.contingency,
    },
  ];

  const spendingBreakdown = [
    { name: 'Materials', value: data.actual.materials },
    { name: 'Expenses', value: data.actual.expenses },
    { name: 'Initial Expenses', value: data.actual.initialExpenses },
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <Link
                href={`/projects/${projectId}`}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-2 inline-block"
              >
                ← Back to Project
              </Link>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                Financial Overview
              </h1>
              <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">
                {data.project.projectCode} - {data.project.projectName}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/dashboard/budget?projectId=${projectId}`}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                Budget vs Actual
              </Link>
              <Link
                href={`/financing?projectId=${projectId}`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Financing Details
              </Link>
            </div>
          </div>
        </div>

        {/* Warnings */}
        {data.warnings && data.warnings.length > 0 && (
          <div className="mb-6 space-y-2">
            {data.warnings.map((warning, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  warning.severity === 'error'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                }`}
              >
                <p className="font-semibold">{warning.type.replace(/_/g, ' ').toUpperCase()}</p>
                <p className="text-sm">{warning.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Budget Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Budget (Planning)</h3>
              <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(data.status.budgetStatus)}`}>
                {getStatusLabel(data.status.budgetStatus)}
              </span>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-2">{formatCurrency(data.budget.total)}</p>
            <div className="space-y-1 text-sm text-gray-700">
              <p>Materials: {formatCurrency(data.budget.materials)}</p>
              <p>Labour: {formatCurrency(data.budget.labour)}</p>
              <p>Contingency: {formatCurrency(data.budget.contingency)}</p>
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-700">Remaining</p>
              <p className="text-xl font-semibold text-gray-900">{formatCurrency(data.budget.remaining)}</p>
            </div>
          </div>

          {/* Financing Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Financing (Reality)</h3>
              <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(data.status.capitalStatus === 'sufficient' ? 'healthy' : 'critical')}`}>
                {data.status.capitalStatus === 'sufficient' ? 'Sufficient' : 'Insufficient'}
              </span>
            </div>
            <p className="text-3xl font-bold text-blue-600 mb-2">{formatCurrency(data.financing.totalInvested)}</p>
            <div className="space-y-1 text-sm text-gray-700">
              <p>Loans: {formatCurrency(data.financing.totalLoans)}</p>
              <p>Equity: {formatCurrency(data.financing.totalEquity)}</p>
              <p>Used: {formatCurrency(data.financing.totalUsed)}</p>
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-700">Available Capital</p>
              <p className="text-xl font-semibold text-blue-600">{formatCurrency(data.financing.capitalBalance)}</p>
            </div>
          </div>

          {/* Actual Spending Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Actual Spending</h3>
              <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(data.status.overall)}`}>
                {getStatusLabel(data.status.overall)}
              </span>
            </div>
            <p className="text-3xl font-bold text-red-600 mb-2">{formatCurrency(data.actual.total)}</p>
            <div className="space-y-1 text-sm text-gray-700">
              <p>Materials: {formatCurrency(data.actual.materials)}</p>
              <p>Expenses: {formatCurrency(data.actual.expenses)}</p>
              <p>Initial: {formatCurrency(data.actual.initialExpenses)}</p>
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-700">Spending Limit</p>
              <p className="text-xl font-semibold text-gray-900">{formatCurrency(data.spendingLimit)}</p>
              <p className="text-sm text-gray-600 mt-1">(Based on capital, not budget)</p>
            </div>
          </div>
        </div>

        {/* Comparison Chart */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget vs Capital vs Actual</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" name="Amount" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Breakdown Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Budget vs Actual Breakdown */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget vs Actual by Category</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={breakdownData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="budget" fill="#8884d8" name="Budget" />
                <Bar dataKey="actual" fill="#82ca9d" name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Spending Breakdown Pie */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actual Spending Breakdown</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={spendingBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {spendingBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Key Insights */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-semibold text-blue-900 mb-2">Spending Limit</p>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(data.spendingLimit)}</p>
              <p className="text-xs text-blue-700 mt-1">
                This is based on available capital ({formatCurrency(data.financing.totalInvested)}), not budget.
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-semibold text-gray-900 mb-2">Budget Variance</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(data.budget.total - data.actual.total)}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                {data.budget.total >= data.actual.total ? 'Under budget' : 'Over budget'} by{' '}
                {Math.abs(((data.actual.total / data.budget.total) * 100 - 100) || 0).toFixed(1)}%
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm font-semibold text-green-900 mb-2">Capital Utilization</p>
              <p className="text-lg font-bold text-green-600">
                {data.financing.totalInvested > 0
                  ? ((data.financing.totalUsed / data.financing.totalInvested) * 100).toFixed(1)
                  : 0}
                %
              </p>
              <p className="text-xs text-green-700 mt-1">
                {formatCurrency(data.financing.totalUsed)} of {formatCurrency(data.financing.totalInvested)} used
              </p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm font-semibold text-yellow-900 mb-2">Remaining Capital</p>
              <p className="text-lg font-bold text-yellow-600">{formatCurrency(data.financing.capitalBalance)}</p>
              <p className="text-xs text-yellow-700 mt-1">
                {data.financing.totalInvested > 0
                  ? ((data.financing.capitalBalance / data.financing.totalInvested) * 100).toFixed(1)
                  : 0}
                % of capital remaining
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function FinancialOverviewPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading financial overview...</p>
            </div>
          </div>
        </AppLayout>
      }
    >
      <FinancialOverviewContent />
    </Suspense>
  );
}

