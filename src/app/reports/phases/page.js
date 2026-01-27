/**
 * Aggregated Phase Reports Page
 * Shows cross-phase reporting and analytics
 * 
 * Route: /reports/phases
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingCard } from '@/components/loading';
import { useToast } from '@/components/toast';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import { NoProjectsEmptyState } from '@/components/empty-states';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';

function PhaseReportsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    currentProject,
    currentProjectId,
    accessibleProjects,
    loading: projectLoading,
    isEmpty,
    switchProject,
  } = useProjectContext();
  const toast = useToast();

  const [reportData, setReportData] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(
    searchParams.get('projectId') || currentProjectId || ''
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentProject && !selectedProjectId) {
      setSelectedProjectId(normalizeProjectId(currentProject._id) || currentProjectId || '');
    }
  }, [currentProject, currentProjectId, selectedProjectId]);

  const fetchReportData = useCallback(async () => {
    if (isEmpty) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (selectedProjectId) queryParams.set('projectId', selectedProjectId);

      const response = await fetch(`/api/phases?${queryParams.toString()}&includeFinancials=true`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch phase data');
      }

      const phases = data.data || [];
      
      // Calculate aggregated statistics
      const stats = {
        totalPhases: phases.length,
        byStatus: {},
        byType: {},
        totalBudget: 0,
        totalActual: 0,
        totalCommitted: 0,
        totalVariance: 0,
        averageCompletion: 0,
        onSchedule: 0,
        behindSchedule: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0
      };

      phases.forEach(phase => {
        // Status counts
        const status = phase.status || 'not_started';
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
        
        if (status === 'completed') stats.completed++;
        else if (status === 'in_progress') stats.inProgress++;
        else stats.notStarted++;

        // Type counts
        const type = phase.phaseType || 'construction';
        stats.byType[type] = (stats.byType[type] || 0) + 1;

        // Financial totals
        const financial = phase.financialSummary || {};
        stats.totalBudget += financial.budgetTotal || 0;
        stats.totalActual += financial.actualTotal || 0;
        stats.totalCommitted += financial.committedTotal || 0;
        stats.totalVariance += financial.variance || 0;

        // Completion
        stats.averageCompletion += phase.completionPercentage || 0;

        // Timeline adherence
        if (phase.plannedEndDate && phase.actualEndDate) {
          const daysDiff = (new Date(phase.actualEndDate) - new Date(phase.plannedEndDate)) / (1000 * 60 * 60 * 24);
          if (daysDiff <= 3) stats.onSchedule++;
          else stats.behindSchedule++;
        }
      });

      if (phases.length > 0) {
        stats.averageCompletion = Math.round(stats.averageCompletion / phases.length);
      }

      setReportData({
        phases,
        statistics: stats
      });
    } catch (err) {
      setError(err.message);
      console.error('Fetch report data error:', err);
      // Only show toast for actual errors, not permission errors
      if (!err.message.includes('permission')) {
        toast.showError(err.message || 'Failed to load phase reports');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, isEmpty, toast]);

  useEffect(() => {
    if (isEmpty) {
      setLoading(false);
      return;
    }
    if (!selectedProjectId) {
      if (projectLoading) return;
      setLoading(false);
      return;
    }
    fetchReportData();
  }, [fetchReportData, selectedProjectId, isEmpty, projectLoading]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (isEmpty) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <NoProjectsEmptyState />
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingCard />
        </div>
      </AppLayout>
    );
  }

  if (error || !reportData) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error || 'Failed to load phase reports'}
          </div>
        </div>
      </AppLayout>
    );
  }

  const { phases, statistics } = reportData;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Phase Reports</h1>
          <p className="text-gray-600 mt-1">Comprehensive phase analytics and reporting</p>
        </div>

        <PrerequisiteGuide
          title="Reports are best after phases are configured"
          description="Phase reports use budgets, completion status, and financial summaries."
          prerequisites={[
            'Projects and phases are created',
            'Phase budgets are set',
            'Progress is tracked',
          ]}
          actions={[
            { href: '/projects', label: 'View Projects' },
            { href: '/phases/new', label: 'Create Phase' },
            { href: '/dashboard/budget', label: 'Set Budgets' },
          ]}
          tip="Select a project to narrow reporting and reduce noise."
        />

        {/* Project Filter */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <label htmlFor="project-filter" className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Project
          </label>
          <select
            id="project-filter"
            value={selectedProjectId}
            onChange={(e) => {
              const nextProjectId = e.target.value;
              setSelectedProjectId(nextProjectId);
              const params = new URLSearchParams();
              if (nextProjectId) params.set('projectId', nextProjectId);
              router.push(`/reports/phases?${params.toString()}`, { scroll: false });
              if (nextProjectId && nextProjectId !== currentProjectId) {
                switchProject(nextProjectId).catch((err) => {
                  console.error('Error switching project:', err);
                });
              }
            }}
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Projects</option>
            {accessibleProjects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.projectName}
              </option>
            ))}
          </select>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Total Phases</p>
            <p className="text-3xl font-bold text-gray-900">{statistics.totalPhases}</p>
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Completed</span>
                <span className="font-semibold text-green-600">{statistics.completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">In Progress</span>
                <span className="font-semibold text-blue-600">{statistics.inProgress}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Not Started</span>
                <span className="font-semibold text-gray-600">{statistics.notStarted}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Total Budget</p>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(statistics.totalBudget)}</p>
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Actual</span>
                <span className="font-semibold text-blue-600">{formatCurrency(statistics.totalActual)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Committed</span>
                <span className="font-semibold text-orange-600">{formatCurrency(statistics.totalCommitted)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Variance</span>
                <span className={`font-semibold ${statistics.totalVariance < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(statistics.totalVariance)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Average Completion</p>
            <p className="text-3xl font-bold text-gray-900">{statistics.averageCompletion}%</p>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${statistics.averageCompletion}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-2">Timeline Adherence</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">On Schedule</span>
                <span className="font-semibold text-green-600">{statistics.onSchedule}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Behind Schedule</span>
                <span className="font-semibold text-red-600">{statistics.behindSchedule}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Phases by Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Phases by Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(statistics.byStatus).map(([status, count]) => (
              <div key={status} className="text-center">
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-sm text-gray-600 capitalize">{status.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Phases by Type */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Phases by Type</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(statistics.byType).map(([type, count]) => (
              <div key={type} className="text-center">
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-sm text-gray-600 capitalize">{type.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Phase List */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">All Phases</h2>
            <Link
              href="/phases"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              View All →
            </Link>
          </div>
          {phases.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No phases found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phase</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Budget</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actual</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {phases.map((phase) => {
                    const financial = phase.financialSummary || {};
                    return (
                      <tr key={phase._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/phases/${phase._id}`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800"
                          >
                            {phase.phaseCode}: {phase.phaseName}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            phase.status === 'completed' ? 'bg-green-100 text-green-800' :
                            phase.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {phase.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${phase.completionPercentage || 0}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{phase.completionPercentage || 0}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(financial.budgetTotal || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                          {formatCurrency(financial.actualTotal || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={financial.variance < 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(financial.variance || 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            href={`/phases/${phase._id}/dashboard`}
                            className="text-blue-600 hover:text-blue-800 mr-3"
                          >
                            Dashboard
                          </Link>
                          <Link
                            href={`/phases/${phase._id}/reports/financial`}
                            className="text-gray-600 hover:text-gray-800"
                          >
                            Report
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function PhaseReportsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PhaseReportsPageContent />
    </Suspense>
  );
}

