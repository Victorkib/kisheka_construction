/**
 * Phase Dashboard Page
 * Comprehensive dashboard view for a phase with all statistics and quick actions
 * 
 * Route: /phases/[id]/dashboard
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingCard } from '@/components/loading';
import { useToast } from '@/components/toast';

export default function PhaseDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const [dashboardData, setDashboardData] = useState(null);
  const [floorData, setFloorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (params.id) {
      fetchDashboardData();
    }
  }, [params.id]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashboardResponse, floorsResponse] = await Promise.all([
        fetch(`/api/phases/${params.id}/dashboard`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
        fetch(`/api/phases/${params.id}/floors`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }),
      ]);

      if (!dashboardResponse.ok) {
        const errorText = await dashboardResponse.text();
        throw new Error(`HTTP ${dashboardResponse.status}: ${errorText.substring(0, 100)}`);
      }

      const contentType = dashboardResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await dashboardResponse.text();
        throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 200)}`);
      }

      const dashboardPayload = await dashboardResponse.json();
      if (!dashboardPayload.success) {
        throw new Error(dashboardPayload.error || 'Failed to fetch dashboard data');
      }

      let floorsPayload = null;
      if (floorsResponse.ok) {
        floorsPayload = await floorsResponse.json();
        if (!floorsPayload.success) {
          floorsPayload = null;
        }
      }

      setDashboardData(dashboardPayload.data);
      setFloorData(floorsPayload?.data || null);
    } catch (err) {
      setError(err.message);
      console.error('Fetch dashboard error:', err);
      toast.showError(err.message || 'Failed to load dashboard');
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

  const formatDate = (date) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'not_started': 'bg-gray-100 text-gray-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'on_hold': 'bg-yellow-100 text-yellow-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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

  if (error || !dashboardData) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Failed to load dashboard'}
          </div>
          <Link href={`/phases/${params.id}`} className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Phase
          </Link>
        </div>
      </AppLayout>
    );
  }

  const { phase, project, financialSummary, statistics, recentActivity } = dashboardData;
  const floorTotals = (floorData?.floors || []).reduce((acc, floor) => {
    const total = (floor.totals?.materials || 0)
      + (floor.totals?.materialRequests || 0)
      + (floor.totals?.purchaseOrders || 0)
      + (floor.totals?.labour || 0)
      + (floor.totals?.workItems || 0);
    const group = floor.group || 'unknown';
    acc[group] = (acc[group] || 0) + total;
    acc.all = (acc.all || 0) + total;
    return acc;
  }, { all: 0, basement: 0, superstructure: 0, unknown: 0 });
  const unassignedTotal = (floorData?.unassigned?.totals?.materials || 0)
    + (floorData?.unassigned?.totals?.materialRequests || 0)
    + (floorData?.unassigned?.totals?.purchaseOrders || 0)
    + (floorData?.unassigned?.totals?.labour || 0)
    + (floorData?.unassigned?.totals?.workItems || 0);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/phases/${params.id}`} className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Phase Details
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {phase.phaseName} Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                {phase.phaseCode} {project && `• ${project.projectName}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/phases/${params.id}/reports/financial`}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Financial Report
              </Link>
              <Link
                href={`/phases/${params.id}/reports/progress`}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Progress Report
              </Link>
              <Link
                href={`/phases/${params.id}/reports/resources`}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Resource Report
              </Link>
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Status</p>
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(phase.status)}`}>
              {phase.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
            </span>
            <p className="text-sm text-gray-600 mt-4">Progress</p>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${phase.completionPercentage || 0}%` }}
                />
              </div>
              <p className="text-lg font-bold text-gray-900 mt-1">{phase.completionPercentage || 0}%</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Budget</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(financialSummary.budgetTotal)}</p>
            <p className="text-sm text-gray-600 mt-4">Utilization</p>
            <p className="text-lg font-semibold text-blue-600">{financialSummary.utilizationPercentage.toFixed(1)}%</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Actual Spending</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(financialSummary.actualTotal)}</p>
            <p className="text-sm text-gray-600 mt-4">Committed</p>
            <p className="text-lg font-semibold text-orange-600">{formatCurrency(financialSummary.committedTotal)}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Remaining</p>
            <p className={`text-2xl font-bold ${financialSummary.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(financialSummary.remaining)}
            </p>
            <p className="text-sm text-gray-600 mt-4">Variance</p>
            <p className={`text-lg font-semibold ${financialSummary.variance < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {financialSummary.variance >= 0 ? '+' : ''}{formatCurrency(financialSummary.variance)}
            </p>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Materials</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(statistics.materials.totalCost)}</p>
              <p className="text-xs text-gray-500">{statistics.materials.count} items</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Expenses</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(statistics.expenses.totalCost)}</p>
              <p className="text-xs text-gray-500">{statistics.expenses.count} items</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Equipment</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(statistics.equipment.totalCost)}</p>
              <p className="text-xs text-gray-500">{statistics.equipment.count} items</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Subcontractors</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(statistics.subcontractors.totalCost)}</p>
              <p className="text-xs text-gray-500">{statistics.subcontractors.count} contracts</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Professional Services</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(statistics.professionalServices.totalCost)}</p>
              <p className="text-xs text-gray-500">{statistics.professionalServices.count} services</p>
            </div>
          </div>
        </div>

        {/* Floor Breakdown */}
        {floorData && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Floor Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">Basement</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(floorTotals.basement || 0)}</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">Superstructure</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(floorTotals.superstructure || 0)}</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600">Unassigned Floors</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(unassignedTotal)}</p>
                <p className="text-xs text-gray-500 mt-1">Assign floors to improve accuracy</p>
              </div>
            </div>
            <div className="mt-4">
              <Link
                href={`/phases/${params.id}?tab=floors`}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View floor breakdown →
              </Link>
            </div>
          </div>
        )}

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {/* Work Items */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Work Items</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total</span>
                <span className="font-semibold">{statistics.workItems.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Completed</span>
                <span className="font-semibold text-green-600">{statistics.workItems.byStatus.completed || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">In Progress</span>
                <span className="font-semibold text-blue-600">{statistics.workItems.byStatus.in_progress || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Not Started</span>
                <span className="font-semibold text-gray-600">{statistics.workItems.byStatus.not_started || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Blocked</span>
                <span className="font-semibold text-red-600">{statistics.workItems.byStatus.blocked || 0}</span>
              </div>
              <div className="mt-3 pt-3 border-t">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Completion</span>
                  <span className="font-semibold">{statistics.workItems.completionPercentage}%</span>
                </div>
              </div>
            </div>
            <Link
              href={`/phases/${params.id}?tab=work-items`}
              className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800"
            >
              View All Work Items →
            </Link>
          </div>

          {/* Milestones */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Milestones</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total</span>
                <span className="font-semibold">{statistics.milestones.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Completed</span>
                <span className="font-semibold text-green-600">{statistics.milestones.completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Pending</span>
                <span className="font-semibold text-blue-600">{statistics.milestones.pending}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Overdue</span>
                <span className="font-semibold text-red-600">{statistics.milestones.overdue}</span>
              </div>
              <div className="mt-3 pt-3 border-t">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Completion</span>
                  <span className="font-semibold">{statistics.milestones.completionPercentage}%</span>
                </div>
              </div>
            </div>
            <Link
              href={`/phases/${params.id}?tab=milestones`}
              className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800"
            >
              View All Milestones →
            </Link>
          </div>

          {/* Quality Checkpoints */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Checkpoints</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total</span>
                <span className="font-semibold">{statistics.qualityCheckpoints.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Passed</span>
                <span className="font-semibold text-green-600">{statistics.qualityCheckpoints.passed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Failed</span>
                <span className="font-semibold text-red-600">{statistics.qualityCheckpoints.failed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Pending</span>
                <span className="font-semibold text-blue-600">{statistics.qualityCheckpoints.pending}</span>
              </div>
              <div className="mt-3 pt-3 border-t">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Pass Rate</span>
                  <span className="font-semibold">{statistics.qualityCheckpoints.passRate}%</span>
                </div>
              </div>
            </div>
            <Link
              href={`/phases/${params.id}?tab=quality`}
              className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800"
            >
              View All Checkpoints →
            </Link>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Start Date</p>
              <p className="text-lg font-semibold text-gray-900">{formatDate(phase.startDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Planned End</p>
              <p className="text-lg font-semibold text-gray-900">{formatDate(phase.plannedEndDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Actual End</p>
              <p className="text-lg font-semibold text-gray-900">{formatDate(phase.actualEndDate) || 'Ongoing'}</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          {recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity._id} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {activity.action} {activity.entityType}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(activity.createdAt).toLocaleString('en-KE')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No recent activity</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href={`/phases/${params.id}?tab=materials`}
              className="px-4 py-3 border border-gray-300 rounded-lg text-center hover:bg-gray-50 transition-colors"
            >
              <p className="font-medium text-gray-900">Add Material</p>
            </Link>
            <Link
              href={`/phases/${params.id}?tab=expenses`}
              className="px-4 py-3 border border-gray-300 rounded-lg text-center hover:bg-gray-50 transition-colors"
            >
              <p className="font-medium text-gray-900">Add Expense</p>
            </Link>
            <Link
              href={`/work-items/new?phaseId=${params.id}`}
              className="px-4 py-3 border border-gray-300 rounded-lg text-center hover:bg-gray-50 transition-colors"
            >
              <p className="font-medium text-gray-900">Add Work Item</p>
            </Link>
            <Link
              href={`/phases/${params.id}?tab=milestones`}
              className="px-4 py-3 border border-gray-300 rounded-lg text-center hover:bg-gray-50 transition-colors"
            >
              <p className="font-medium text-gray-900">Add Milestone</p>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

