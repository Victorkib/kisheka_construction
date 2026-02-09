/**
 * Phase Progress Report Page
 * Detailed progress report with work items, milestones, and timeline analysis
 * 
 * Route: /phases/[id]/reports/progress
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { useToast } from '@/components/toast';

export default function ProgressReportPage() {
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

      const response = await fetch(`/api/phases/${params.id}/reports/progress`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch progress report');
      }

      setReportData(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Fetch progress report error:', err);
      toast.showError(err.message || 'Failed to load progress report');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
            {error || 'Failed to load progress report'}
          </div>
          <Link href={`/phases/${params.id}`} className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Phase
          </Link>
        </div>
      </AppLayout>
    );
  }

  const { phase, overallProgress, workItems, milestones, qualityCheckpoints, timelineAdherence } = reportData;

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
                Progress Report: {phase.phaseName}
              </h1>
              <p className="text-gray-600 mt-1">{phase.phaseCode}</p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Print Report
            </button>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Completion</p>
              <p className="text-3xl font-bold text-gray-900">{overallProgress.completionPercentage}%</p>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${overallProgress.completionPercentage}%` }}
                />
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="text-xl font-semibold text-gray-900 capitalize">
                {overallProgress.status?.replace('_', ' ')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Start Date</p>
              <p className="text-lg font-semibold text-gray-900">{formatDate(overallProgress.startDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Planned End</p>
              <p className="text-lg font-semibold text-gray-900">{formatDate(overallProgress.plannedEndDate)}</p>
            </div>
          </div>
        </div>

        {/* Timeline Adherence */}
        {timelineAdherence && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline Adherence</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className={`text-xl font-semibold ${
                  timelineAdherence.onSchedule ? 'text-green-600' :
                  timelineAdherence.aheadOfSchedule ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {timelineAdherence.onSchedule ? 'On Schedule' :
                   timelineAdherence.aheadOfSchedule ? 'Ahead of Schedule' : 'Behind Schedule'}
                </p>
              </div>
              {timelineAdherence.daysAhead > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Days Ahead</p>
                  <p className="text-xl font-semibold text-blue-600">{timelineAdherence.daysAhead}</p>
                </div>
              )}
              {timelineAdherence.daysBehind > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Days Behind</p>
                  <p className="text-xl font-semibold text-red-600">{timelineAdherence.daysBehind}</p>
                </div>
              )}
              {timelineAdherence.completionDate && (
                <div>
                  <p className="text-sm text-gray-600">Actual Completion</p>
                  <p className="text-lg font-semibold text-gray-900">{formatDate(timelineAdherence.completionDate)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Work Items Progress */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Work Items Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-md font-semibold text-gray-800 mb-3">Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Work Items</span>
                  <span className="font-semibold">{workItems.statistics.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Completed</span>
                  <span className="font-semibold text-green-600">{workItems.statistics.byStatus.completed || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">In Progress</span>
                  <span className="font-semibold text-blue-600">{workItems.statistics.byStatus.in_progress || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Not Started</span>
                  <span className="font-semibold text-gray-600">{workItems.statistics.byStatus.not_started || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Blocked</span>
                  <span className="font-semibold text-red-600">{workItems.statistics.byStatus.blocked || 0}</span>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Completion Rate</span>
                    <span className="font-semibold">{workItems.statistics.completionPercentage}%</span>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-md font-semibold text-gray-800 mb-3">Hours & Cost</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Estimated Hours</span>
                  <span className="font-semibold">{workItems.statistics.totalEstimatedHours.toFixed(1)} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Actual Hours</span>
                  <span className="font-semibold text-blue-600">{workItems.statistics.totalActualHours.toFixed(1)} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Estimated Cost</span>
                  <span className="font-semibold">KES {workItems.statistics.totalEstimatedCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Actual Cost</span>
                  <span className="font-semibold text-blue-600">KES {workItems.statistics.totalActualCost.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* By Category */}
          {workItems.byCategory && workItems.byCategory.length > 0 && (
            <div>
              <h3 className="text-md font-semibold text-gray-800 mb-3">By Category</h3>
              <div className="space-y-2">
                {workItems.byCategory.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold text-gray-900 capitalize">{item.category}</h4>
                      <span className="text-sm text-gray-600">{item.completionPercentage}%</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Total</p>
                        <p className="font-semibold">{item.total}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Completed</p>
                        <p className="font-semibold text-green-600">{item.completed}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">In Progress</p>
                        <p className="font-semibold text-blue-600">{item.inProgress}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Blocked</p>
                        <p className="font-semibold text-red-600">{item.blocked}</p>
                      </div>
                    </div>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-green-600 h-1 rounded-full"
                        style={{ width: `${item.completionPercentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Milestones Progress */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Milestones Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Total Milestones</p>
              <p className="text-2xl font-bold text-gray-900">{milestones.statistics.total}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{milestones.statistics.completed}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-blue-600">{milestones.statistics.pending}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{milestones.statistics.overdue}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Completion Rate</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${milestones.statistics.completionPercentage}%` }}
              />
            </div>
            <p className="text-sm font-semibold text-gray-900 mt-1">{milestones.statistics.completionPercentage}%</p>
          </div>
        </div>

        {/* Quality Checkpoints */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quality Checkpoints</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Total Checkpoints</p>
              <p className="text-2xl font-bold text-gray-900">{qualityCheckpoints.statistics.total}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Passed</p>
              <p className="text-2xl font-bold text-green-600">{qualityCheckpoints.statistics.passed}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600">{qualityCheckpoints.statistics.failed}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-blue-600">{qualityCheckpoints.statistics.pending}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Pass Rate</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${qualityCheckpoints.statistics.passRate}%` }}
              />
            </div>
            <p className="text-sm font-semibold text-gray-900 mt-1">{qualityCheckpoints.statistics.passRate}%</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}


