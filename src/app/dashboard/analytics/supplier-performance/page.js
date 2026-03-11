/**
 * Supplier Performance Analytics Dashboard
 * Displays supplier performance metrics for bulk orders
 * 
 * Route: /dashboard/analytics/supplier-performance
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';

function SupplierPerformancePageContent() {
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    projectId: searchParams.get('projectId') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    supplierId: searchParams.get('supplierId') || '',
  });
  const [projects, setProjects] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    fetchProjects();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [filters]);

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

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers?status=active&limit=100', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setSuppliers(data.data.suppliers || []);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.supplierId && { supplierId: filters.supplierId }),
      });

      const response = await fetch(`/api/analytics/supplier-performance?${queryParams}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch analytics');
      }

      setAnalytics(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch analytics error:', err);
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

  const formatTime = (hours) => {
    if (!hours) return 'N/A';
    if (hours < 24) {
      return `${hours.toFixed(1)} hours`;
    }
    return `${(hours / 24).toFixed(1)} days`;
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
          <LoadingTable rows={5} columns={6} />
        </div>
      </AppLayout>
    );
  }

  if (error || !analytics) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-400/60 text-red-800 px-4 py-3 rounded-lg">
            {error || 'Failed to load analytics'}
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
          <h1 className="text-3xl font-bold ds-text-primary">Supplier Performance Analytics</h1>
          <p className="ds-text-secondary mt-2">Performance metrics for suppliers on bulk orders</p>
        </div>

        {/* Filters */}
        <div className="ds-bg-surface rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <label className="block text-sm font-semibold ds-text-secondary mb-1">Supplier</label>
              <select
                value={filters.supplierId}
                onChange={(e) => setFilters((prev) => ({ ...prev, supplierId: e.target.value }))}
                className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier._id} value={supplier._id}>
                    {supplier.name || supplier.contactPerson}
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
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="ds-bg-surface rounded-lg shadow p-6">
            <p className="text-sm ds-text-secondary mb-1">Total Suppliers</p>
            <p className="text-3xl font-bold ds-text-primary">{analytics.summary.totalSuppliers}</p>
          </div>
          <div className="ds-bg-surface rounded-lg shadow p-6">
            <p className="text-sm ds-text-secondary mb-1">Total Orders</p>
            <p className="text-3xl font-bold ds-text-primary">{analytics.summary.totalOrders}</p>
          </div>
          <div className="ds-bg-surface rounded-lg shadow p-6">
            <p className="text-sm ds-text-secondary mb-1">Total Cost</p>
            <p className="text-3xl font-bold ds-text-primary">{formatCurrency(analytics.summary.totalCost)}</p>
          </div>
          <div className="ds-bg-surface rounded-lg shadow p-6">
            <p className="text-sm ds-text-secondary mb-1">Acceptance Rate</p>
            <p className="text-3xl font-bold ds-text-primary">{analytics.summary.overallAcceptanceRate}%</p>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="ds-bg-surface rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold ds-text-primary mb-4">Overall Performance Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm ds-text-secondary mb-1">Average Response Time</p>
              <p className="text-2xl font-bold text-blue-900">
                {analytics.summary.overallAverageResponseTime
                  ? formatTime(analytics.summary.overallAverageResponseTime)
                  : 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm ds-text-secondary mb-1">Average Fulfillment Time</p>
              <p className="text-2xl font-bold text-green-900">
                {analytics.summary.overallAverageFulfillmentTime
                  ? `${analytics.summary.overallAverageFulfillmentTime.toFixed(1)} days`
                  : 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm ds-text-secondary mb-1">Accepted Orders</p>
              <p className="text-2xl font-bold text-purple-900">{analytics.summary.totalAccepted}</p>
            </div>
          </div>
        </div>

        {/* Supplier Performance Table */}
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold ds-text-primary mb-4">Supplier Performance Details</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ds-border-subtle">
              <thead className="ds-bg-surface-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Materials
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Total Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Acceptance Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Avg Response Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Avg Fulfillment Time
                  </th>
                </tr>
              </thead>
              <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                {analytics.suppliers.map((supplier, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium ds-text-primary">{supplier.supplierName}</div>
                      {supplier.supplierEmail && (
                        <div className="text-xs ds-text-muted">{supplier.supplierEmail}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                      {supplier.orderCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                      {supplier.totalMaterials}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                      {formatCurrency(supplier.totalCost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          supplier.acceptanceRate >= 80
                            ? 'bg-green-100 text-green-800'
                            : supplier.acceptanceRate >= 60
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {supplier.acceptanceRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                      {supplier.averageResponseTime ? formatTime(supplier.averageResponseTime) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                      {supplier.averageFulfillmentTime
                        ? `${supplier.averageFulfillmentTime.toFixed(1)} days`
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function SupplierPerformancePage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LoadingTable rows={5} columns={6} />
          </div>
        </AppLayout>
      }
    >
      <SupplierPerformancePageContent />
    </Suspense>
  );
}

