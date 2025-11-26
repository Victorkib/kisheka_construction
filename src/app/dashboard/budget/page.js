/**
 * Budget vs Actual Dashboard
 * Displays comprehensive budget variance analysis
 * 
 * Route: /dashboard/budget
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

function BudgetDashboardContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '');

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchBudgetVariance();
    } else {
      setData(null);
      setLoading(false);
    }
  }, [selectedProjectId]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();
      if (result.success) {
        setProjects(result.data || []);
        if (!selectedProjectId && result.data.length > 0) {
          setSelectedProjectId(result.data[0]._id);
        }
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
    }
  };

  const fetchBudgetVariance = async () => {
    if (!selectedProjectId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/reports/budget-variance?projectId=${selectedProjectId}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        // Error handled by state
      }
    } catch (err) {
      console.error('Fetch budget variance error:', err);
      // Error handled by state
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
      case 'on_budget':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'at_risk':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'over_budget':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'on_budget':
        return 'On Budget';
      case 'at_risk':
        return 'At Risk';
      case 'over_budget':
        return 'Over Budget';
      default:
        return 'Unknown';
    }
  };

  const getVarianceColor = (variance) => {
    if (variance >= 0) return 'text-green-600';
    if (variance < -10) return 'text-red-600';
    return 'text-yellow-600';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading budget variance data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Budget vs Actual</h1>
                <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Compare budgeted costs with actual spending</p>
              </div>
              <Link
                href="/financing"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
              >
                Financing Dashboard
              </Link>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-base text-gray-700 leading-normal">Please select a project to view budget variance.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Prepare chart data with new financial progression
  // Note: Estimated and Committed are only tracked for Materials, not for Total/Labour/Contingency
  const budgetVsActualData = [
    {
      name: 'Total',
      budget: data.budget.total,
      estimated: 0, // Total doesn't have estimated (only materials-specific)
      committed: 0, // Total doesn't have committed (only materials-specific)
      actual: data.actual.total,
    },
    {
      name: 'Materials',
      budget: data.materials?.budget || data.budget.materials,
      estimated: data.materials?.estimated || 0,
      committed: data.materials?.committed || 0,
      actual: data.materials?.actual || data.actual.materials,
    },
    {
      name: 'Labour',
      budget: data.budget.labour,
      estimated: 0,
      committed: 0,
      actual: data.actual.labour,
    },
    {
      name: 'Contingency',
      budget: data.budget.contingency,
      estimated: 0,
      committed: 0,
      actual: data.actual.contingency,
    },
  ];

  const categoryData = data.categoryBreakdown.slice(0, 10).map((cat) => ({
    name: cat.category,
    value: cat.actual,
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Budget vs Actual</h1>
                <p className="text-gray-700 mt-2">Compare budgeted costs with actual spending</p>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href="/financing"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                >
                  Financing Dashboard
                </Link>
                {selectedProjectId && (
                  <Link
                    href={`/projects/${selectedProjectId}/finances`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    Financial Overview
                  </Link>
                )}
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                >
                  <option value="">Select Project</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.projectCode} - {project.projectName}
                    </option>
                  ))}
                </select>
                {selectedProjectId && (
                  <Link
                    href={`/projects/${selectedProjectId}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    View Project
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Financing Warnings */}
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

          {/* Financing Constraints Card */}
          {data.financing && data.financing.totalInvested > 0 && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-blue-900">Financing Constraints</h2>
                <div className="flex gap-3">
                  <Link
                    href={`/projects/${selectedProjectId}/finances`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Financial Overview →
                  </Link>
                  <span className="text-blue-300">|</span>
                  <Link
                    href={`/financing${selectedProjectId ? `?projectId=${selectedProjectId}` : ''}`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Financing Dashboard →
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-blue-700 mb-1">Available Capital</p>
                  <p className="text-xl font-bold text-blue-900">{formatCurrency(data.financing.totalInvested)}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-700 mb-1">Capital Used</p>
                  <p className="text-xl font-bold text-blue-900">{formatCurrency(data.financing.totalUsed)}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-700 mb-1">Remaining Capital</p>
                  <p className="text-xl font-bold text-blue-900">{formatCurrency(data.financing.capitalBalance)}</p>
                </div>
                <div>
                  <p className="text-sm text-blue-700 mb-1">Utilization</p>
                  <p className="text-xl font-bold text-blue-900">{data.financing.capitalUtilization}%</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Important:</strong> Your actual spending limit is based on available capital ({formatCurrency(data.financing.spendingLimit)}), not budget ({formatCurrency(data.budget.total)}). 
                  {data.financing.capitalBalance < 0 && (
                    <span className="font-semibold text-red-600"> You have overspent by {formatCurrency(Math.abs(data.financing.capitalBalance))}.</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Materials Financial Progression Card */}
          {data.materials && (
            <div className="mb-6 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-purple-900">Materials Financial Progression</h2>
                <span className={`text-xs px-3 py-1 rounded-full border ${
                  data.materials.status === 'over_budget' || data.materials.status === 'committed_over_budget' || data.materials.status === 'estimated_over_budget'
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : data.materials.status === 'approaching_budget'
                    ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                    : 'bg-green-100 text-green-800 border-green-200'
                }`}>
                  {data.materials.status === 'over_budget' ? 'Over Budget' :
                   data.materials.status === 'committed_over_budget' ? 'Committed Over Budget' :
                   data.materials.status === 'estimated_over_budget' ? 'Estimated Over Budget' :
                   data.materials.status === 'approaching_budget' ? 'Approaching Budget' :
                   'Within Budget'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                <div className="bg-white rounded-lg p-4 border border-purple-100">
                  <p className="text-sm text-purple-600 mb-1 font-medium">Budget</p>
                  <p className="text-xl font-bold text-purple-900">{formatCurrency(data.materials.budget)}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-orange-100">
                  <p className="text-sm text-orange-600 mb-1 font-medium">Estimated</p>
                  <p className="text-xl font-bold text-orange-900">{formatCurrency(data.materials.estimated)}</p>
                  {data.materials.estimated > 0 && (
                    <p className="text-sm text-orange-600 mt-1">
                      {((data.materials.estimated / data.materials.budget) * 100).toFixed(1)}% of budget
                    </p>
                  )}
                </div>
                <div className="bg-white rounded-lg p-4 border border-amber-100">
                  <p className="text-sm text-amber-600 mb-1 font-medium">Committed</p>
                  <p className="text-xl font-bold text-amber-900">{formatCurrency(data.materials.committed)}</p>
                  {data.materials.committed > 0 && (
                    <p className="text-sm text-amber-600 mt-1">
                      {((data.materials.committed / data.materials.budget) * 100).toFixed(1)}% of budget
                    </p>
                  )}
                </div>
                <div className="bg-white rounded-lg p-4 border border-green-100">
                  <p className="text-sm text-green-600 mb-1 font-medium">Actual</p>
                  <p className="text-xl font-bold text-green-900">{formatCurrency(data.materials.actual)}</p>
                  {data.materials.actual > 0 && (
                    <p className="text-sm text-green-600 mt-1">
                      {((data.materials.actual / data.materials.budget) * 100).toFixed(1)}% of budget
                    </p>
                  )}
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-100">
                  <p className="text-sm text-gray-700 mb-1 font-medium">Remaining</p>
                  <p className={`text-xl font-bold ${data.materials.remaining < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatCurrency(data.materials.remaining)}
                  </p>
                </div>
              </div>
              {/* Progress Bar Showing Progression */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700 font-medium">Financial Progression</span>
                  <span className="text-sm text-gray-700 font-medium">
                    {data.materials.budget > 0 ? ((data.materials.actual / data.materials.budget) * 100).toFixed(1) : 0}% Actual
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 relative overflow-hidden">
                  {/* Budget baseline */}
                  <div className="absolute left-0 top-0 h-full w-full border-r-2 border-purple-500" style={{ width: '100%' }}></div>
                  {/* Estimated */}
                  {data.materials.estimated > 0 && data.materials.budget > 0 && (
                    <div 
                      className="absolute left-0 top-0 h-full bg-orange-300 opacity-60"
                      style={{ width: `${Math.min(100, (data.materials.estimated / data.materials.budget) * 100)}%` }}
                    ></div>
                  )}
                  {/* Committed */}
                  {data.materials.committed > 0 && data.materials.budget > 0 && (
                    <div 
                      className="absolute left-0 top-0 h-full bg-amber-400 opacity-80"
                      style={{ width: `${Math.min(100, (data.materials.committed / data.materials.budget) * 100)}%` }}
                    ></div>
                  )}
                  {/* Actual */}
                  {data.materials.actual > 0 && data.materials.budget > 0 && (
                    <div 
                      className="absolute left-0 top-0 h-full bg-green-500"
                      style={{ width: `${Math.min(100, (data.materials.actual / data.materials.budget) * 100)}%` }}
                    ></div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="text-purple-600 font-medium">Budget</span>
                  {data.materials.estimated > 0 && <span className="text-orange-600 font-medium">Estimated</span>}
                  {data.materials.committed > 0 && <span className="text-amber-600 font-medium">Committed</span>}
                  <span className="text-green-600 font-medium">Actual</span>
                </div>
              </div>
              {/* Warnings */}
              {(data.materials.committed > data.materials.budget || data.materials.estimated > data.materials.budget) && (
                <div className="mt-4 pt-4 border-t border-purple-200">
                  {data.materials.committed > data.materials.budget && (
                    <p className="text-sm text-red-700 font-semibold mb-1">
                      ⚠️ Committed costs ({formatCurrency(data.materials.committed)}) exceed budget ({formatCurrency(data.materials.budget)}) by {formatCurrency(data.materials.committed - data.materials.budget)}
                    </p>
                  )}
                  {data.materials.estimated > data.materials.budget && (
                    <p className="text-sm text-orange-700 font-semibold">
                      ⚠️ Estimated costs ({formatCurrency(data.materials.estimated)}) exceed budget ({formatCurrency(data.materials.budget)}) by {formatCurrency(data.materials.estimated - data.materials.budget)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Total Budget vs Actual */}
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-base font-semibold text-gray-700 mb-2 leading-normal">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900 mb-4">{formatCurrency(data.budget.total)}</p>
              <p className="text-base text-gray-600 mb-1 leading-normal">Actual Spending</p>
              <p className="text-xl font-semibold text-gray-900 mb-2">{formatCurrency(data.actual.total)}</p>
              <div className="flex items-center justify-between">
                <span className={`text-base font-medium leading-normal ${getVarianceColor(data.variance.totalPercentage)}`}>
                  {data.variance.total >= 0 ? '+' : ''}
                  {formatCurrency(data.variance.total)} ({data.variance.totalPercentage >= 0 ? '+' : ''}
                  {data.variance.totalPercentage}%)
                </span>
                <span className={`text-sm px-2 py-1 rounded-full border leading-normal ${getStatusColor(data.status.overall)}`}>
                  {getStatusLabel(data.status.overall)}
                </span>
              </div>
            </div>

            {/* Materials */}
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-base font-semibold text-gray-700 mb-2 leading-normal">Materials Budget</p>
              <p className="text-2xl font-bold text-gray-900 mb-2">{formatCurrency(data.materials?.budget || data.budget.materials)}</p>
              {data.materials && (
                <div className="mb-2 space-y-1">
                  {data.materials.estimated > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-orange-600">Estimated:</span>
                      <span className="text-orange-700 font-medium">{formatCurrency(data.materials.estimated)}</span>
                    </div>
                  )}
                  {data.materials.committed > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-600">Committed:</span>
                      <span className="text-amber-700 font-medium">{formatCurrency(data.materials.committed)}</span>
                    </div>
                  )}
                </div>
              )}
              <p className="text-base text-gray-600 mb-1 leading-normal">Actual</p>
              <p className="text-xl font-semibold text-gray-900 mb-2">{formatCurrency(data.materials?.actual || data.actual.materials)}</p>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${getVarianceColor(data.variance.materials?.actual?.percentage || data.variance.materialsPercentage)}`}>
                  {data.variance.materials?.actual?.amount >= 0 ? '+' : ''}
                  {formatCurrency(data.variance.materials?.actual?.amount || data.variance.materials)} ({data.variance.materials?.actual?.percentage >= 0 ? '+' : ''}
                  {data.variance.materials?.actual?.percentage || data.variance.materialsPercentage}%)
                </span>
                <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(data.status.materials)}`}>
                  {getStatusLabel(data.status.materials)}
                </span>
              </div>
            </div>

            {/* Labour */}
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-base text-gray-700 font-medium mb-2">Labour Budget</p>
              <p className="text-2xl font-bold text-gray-900 mb-4">{formatCurrency(data.budget.labour)}</p>
              <p className="text-base text-gray-700 mb-1 leading-normal">Actual</p>
              <p className="text-xl font-semibold text-gray-900 mb-2">{formatCurrency(data.actual.labour)}</p>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${getVarianceColor(data.variance.labourPercentage)}`}>
                  {data.variance.labour >= 0 ? '+' : ''}
                  {formatCurrency(data.variance.labour)} ({data.variance.labourPercentage >= 0 ? '+' : ''}
                  {data.variance.labourPercentage}%)
                </span>
                <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(data.status.labour)}`}>
                  {getStatusLabel(data.status.labour)}
                </span>
              </div>
            </div>

            {/* Contingency */}
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-base text-gray-700 font-medium mb-2">Contingency Budget</p>
              <p className="text-2xl font-bold text-gray-900 mb-4">{formatCurrency(data.budget.contingency)}</p>
              <p className="text-base text-gray-700 mb-1">Used</p>
              <p className="text-xl font-semibold text-gray-900 mb-2">{formatCurrency(data.actual.contingency)}</p>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${getVarianceColor(data.variance.contingencyPercentage)}`}>
                  {data.variance.contingency >= 0 ? '+' : ''}
                  {formatCurrency(data.variance.contingency)} ({data.variance.contingencyPercentage >= 0 ? '+' : ''}
                  {data.variance.contingencyPercentage}%)
                </span>
                <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(data.status.contingency)}`}>
                  {getStatusLabel(data.status.contingency)}
                </span>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Budget vs Actual Bar Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget vs Actual (All Categories)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={budgetVsActualData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="budget" fill="#8884d8" name="Budget" />
                  {budgetVsActualData.some(item => item.estimated > 0) && (
                    <Bar dataKey="estimated" fill="#ff9800" name="Estimated" />
                  )}
                  {budgetVsActualData.some(item => item.committed > 0) && (
                    <Bar dataKey="committed" fill="#ffc107" name="Committed" />
                  )}
                  <Bar dataKey="actual" fill="#82ca9d" name="Actual" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Materials Financial Progression Chart */}
            {data.materials && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Materials Financial Progression</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[{ name: 'Materials', ...data.materials }]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="budget" fill="#8884d8" name="Budget" />
                    <Bar dataKey="estimated" fill="#ff9800" name="Estimated" />
                    <Bar dataKey="committed" fill="#ffc107" name="Committed" />
                    <Bar dataKey="actual" fill="#82ca9d" name="Actual" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Category Breakdown Pie Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Categories by Actual Cost</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Category
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Actual Cost
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Items
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      % of Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.categoryBreakdown.map((cat, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {cat.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {formatCurrency(cat.actual)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                        {cat.count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                        {data.actual.total > 0 ? ((cat.actual / data.actual.total) * 100).toFixed(2) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Floor Breakdown Table */}
          {data.floorBreakdown.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Floor Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Floor
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Budget
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Actual
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Variance
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.floorBreakdown.map((floor, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {floor.floorName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatCurrency(floor.budget)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatCurrency(floor.actual)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${getVarianceColor(floor.variancePercentage)}`}>
                          {floor.variance >= 0 ? '+' : ''}
                          {formatCurrency(floor.variance)} ({floor.variancePercentage >= 0 ? '+' : ''}
                          {floor.variancePercentage}%)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(
                            floor.variance >= 0 ? 'on_budget' : floor.variancePercentage < -10 ? 'over_budget' : 'at_risk'
                          )}`}>
                            {getStatusLabel(
                              floor.variance >= 0 ? 'on_budget' : floor.variancePercentage < -10 ? 'over_budget' : 'at_risk'
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Monthly Trend */}
          {data.monthlyTrend.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Spending Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="actual" stroke="#82ca9d" name="Actual Spending" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
      </div>
    </AppLayout>
  );
}

export default function BudgetDashboardPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading budget dashboard...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <BudgetDashboardContent />
    </Suspense>
  );
}

