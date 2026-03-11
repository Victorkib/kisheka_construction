/**
 * Material Insights Dashboard
 * Displays cost trends and usage patterns for materials
 * 
 * Route: /dashboard/analytics/material-insights
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';

function MaterialInsightsPageContent() {
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();

  const [costTrends, setCostTrends] = useState(null);
  const [usagePatterns, setUsagePatterns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('cost'); // 'cost' or 'usage'
  const [filters, setFilters] = useState({
    projectId: searchParams.get('projectId') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    groupBy: searchParams.get('groupBy') || 'month',
    materialName: searchParams.get('materialName') || '',
  });
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchData();
  }, [filters, activeTab]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProjects(data.data.projects || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'cost') {
        const queryParams = new URLSearchParams({
          ...(filters.projectId && { projectId: filters.projectId }),
          ...(filters.startDate && { startDate: filters.startDate }),
          ...(filters.endDate && { endDate: filters.endDate }),
          ...(filters.materialName && { materialName: filters.materialName }),
          groupBy: filters.groupBy,
        });

        const response = await fetch(`/api/analytics/material-cost-trends?${queryParams}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch cost trends');
        }

        setCostTrends(data.data);
      } else {
        const queryParams = new URLSearchParams({
          ...(filters.projectId && { projectId: filters.projectId }),
          ...(filters.startDate && { startDate: filters.startDate }),
          ...(filters.endDate && { endDate: filters.endDate }),
        });

        const response = await fetch(`/api/analytics/material-usage-patterns?${queryParams}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch usage patterns');
        }

        setUsagePatterns(data.data);
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'KES 0';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (!canAccess('view_reports')) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold ds-text-primary mb-2">Access Denied</h1>
            <p className="ds-text-secondary">You don't have permission to view analytics.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingTable rows={5} columns={4} />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-400/60 text-red-800 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold ds-text-primary">Material Insights</h1>
          <p className="ds-text-secondary mt-2">Cost trends and usage patterns for materials</p>
        </div>

        {/* Tabs */}
        <div className="border-b ds-border-subtle mb-6">
          <nav className="flex space-x-8">
            <button
              type="button"
              onClick={() => setActiveTab('cost')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'cost'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              Cost Trends
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('usage')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'usage'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent ds-text-muted hover:ds-text-secondary hover:ds-border-subtle'
              }`}
            >
              Usage Patterns
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="ds-bg-surface rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">Project</label>
              <select
                value={filters.projectId}
                onChange={(e) => setFilters((prev) => ({ ...prev, projectId: e.target.value }))}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {activeTab === 'cost' && (
              <>
                <div>
                  <label className="block text-sm font-semibold ds-text-secondary mb-1">Group By</label>
                  <select
                    value={filters.groupBy}
                    onChange={(e) => setFilters((prev) => ({ ...prev, groupBy: e.target.value }))}
                    className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold ds-text-secondary mb-1">Material Name</label>
                  <input
                    type="text"
                    value={filters.materialName}
                    onChange={(e) => setFilters((prev) => ({ ...prev, materialName: e.target.value }))}
                    placeholder="Filter by material..."
                    className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Cost Trends Tab */}
        {activeTab === 'cost' && costTrends && (
          <div className="space-y-6">
            {/* Material Averages */}
            {costTrends.materialAverages && costTrends.materialAverages.length > 0 && (
              <div className="ds-bg-surface rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold ds-text-primary mb-4">Material Cost Averages</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ds-border-subtle">
                    <thead className="ds-bg-surface-muted">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Material
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Average Unit Cost
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Min Unit Cost
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Max Unit Cost
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Data Points
                        </th>
                      </tr>
                    </thead>
                    <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                      {costTrends.materialAverages.map((material, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-primary">
                            {material.materialName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                            {formatCurrency(material.averageUnitCost)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                            {formatCurrency(material.minUnitCost)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                            {formatCurrency(material.maxUnitCost)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                            {material.dataPoints}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Trends by Period */}
            {costTrends.trends && costTrends.trends.length > 0 && (
              <div className="ds-bg-surface rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold ds-text-primary mb-4">Cost Trends Over Time</h2>
                <div className="space-y-4">
                  {costTrends.trends.map((trend, index) => (
                    <div key={index} className="border ds-border-subtle rounded-lg p-4">
                      <h3 className="font-semibold ds-text-primary mb-3">{trend.period}</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-ds-border-subtle">
                          <thead className="ds-bg-surface-muted">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium ds-text-muted">Material</th>
                              <th className="px-4 py-2 text-left text-xs font-medium ds-text-muted">Quantity</th>
                              <th className="px-4 py-2 text-left text-xs font-medium ds-text-muted">Total Cost</th>
                              <th className="px-4 py-2 text-left text-xs font-medium ds-text-muted">
                                Avg Unit Cost
                              </th>
                            </tr>
                          </thead>
                          <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                            {trend.materials.map((material, matIndex) => (
                              <tr key={matIndex}>
                                <td className="px-4 py-2 text-sm ds-text-primary">{material.materialName}</td>
                                <td className="px-4 py-2 text-sm ds-text-muted">
                                  {material.totalQuantity.toLocaleString()}
                                </td>
                                <td className="px-4 py-2 text-sm ds-text-muted">
                                  {formatCurrency(material.totalCost)}
                                </td>
                                <td className="px-4 py-2 text-sm ds-text-muted">
                                  {formatCurrency(material.averageUnitCost)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Usage Patterns Tab */}
        {activeTab === 'usage' && usagePatterns && (
          <div className="space-y-6">
            {/* Most Requested Materials */}
            {usagePatterns.mostRequested && usagePatterns.mostRequested.length > 0 && (
              <div className="ds-bg-surface rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold ds-text-primary mb-4">Most Requested Materials</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ds-border-subtle">
                    <thead className="ds-bg-surface-muted">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Material
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Request Count
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Total Quantity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Total Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                      {usagePatterns.mostRequested.map((material, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-primary">
                            {material.materialName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                            {material.category}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                            {material.requestCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                            {material.totalQuantity.toLocaleString()} {material.unit}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                            {formatCurrency(material.totalEstimatedCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Category Breakdown */}
            {usagePatterns.categoryBreakdown && usagePatterns.categoryBreakdown.length > 0 && (
              <div className="ds-bg-surface rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold ds-text-primary mb-4">Category Breakdown</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ds-border-subtle">
                    <thead className="ds-bg-surface-muted">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Request Count
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Total Quantity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Total Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                      {usagePatterns.categoryBreakdown.map((category, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-primary">
                            {category.category}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                            {category.requestCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                            {category.totalQuantity.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                            {formatCurrency(category.totalCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Seasonal Trends */}
            {usagePatterns.seasonalTrends && usagePatterns.seasonalTrends.length > 0 && (
              <div className="ds-bg-surface rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold ds-text-primary mb-4">Seasonal Trends</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-ds-border-subtle">
                    <thead className="ds-bg-surface-muted">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">Period</th>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Request Count
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Total Quantity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase">
                          Total Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                      {usagePatterns.seasonalTrends.map((trend, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-primary">
                            {trend.period}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                            {trend.requestCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                            {trend.totalQuantity.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                            {formatCurrency(trend.totalCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function MaterialInsightsPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LoadingTable rows={5} columns={4} />
          </div>
        </AppLayout>
      }
    >
      <MaterialInsightsPageContent />
    </Suspense>
  );
}

