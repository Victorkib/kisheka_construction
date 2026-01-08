/**
 * Phase Overview Tab Component
 * Displays phase overview, status, timeline, and dependencies
 */

'use client';

import Link from 'next/link';
import { PhaseDependencies } from '../PhaseDependencies';

export function OverviewTab({ phase, project, canEdit, onStatusChange, onCompletionChange, updatingStatus, updatingCompletion, formatDate, formatCurrency, getStatusColor }) {
  const financialSummary = phase.financialSummary || {
    budgetTotal: phase.budgetAllocation?.total || 0,
    actualTotal: phase.actualSpending?.total || 0,
    remaining: phase.financialStates?.remaining || 0,
    variance: 0,
    variancePercentage: 0,
    utilizationPercentage: 0
  };

  return (
    <div className="space-y-6">
      {/* Phase Status and Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Status</p>
          {canEdit ? (
            <div className="space-y-2">
              <select
                value={phase.status}
                onChange={(e) => onStatusChange(e.target.value)}
                disabled={updatingStatus}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {updatingStatus && <p className="text-xs text-gray-500">Updating...</p>}
            </div>
          ) : (
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(phase.status)}`}>
              {phase.status.replace('_', ' ').toUpperCase()}
            </span>
          )}
          <p className="text-sm text-gray-600 mt-4">Completion</p>
          {canEdit ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={phase.completionPercentage || 0}
                  onChange={(e) => {
                    const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                    onCompletionChange(value);
                  }}
                  disabled={updatingCompletion}
                  className="w-20 px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-2xl font-bold text-gray-900">%</span>
              </div>
              {updatingCompletion && <p className="text-xs text-gray-500">Updating...</p>}
            </div>
          ) : (
            <p className="text-2xl font-bold text-gray-900">{phase.completionPercentage || 0}%</p>
          )}
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  phase.completionPercentage >= 100
                    ? 'bg-green-600'
                    : phase.completionPercentage >= 75
                    ? 'bg-blue-600'
                    : phase.completionPercentage >= 50
                    ? 'bg-yellow-600'
                    : 'bg-gray-400'
                }`}
                style={{ width: `${Math.min(100, phase.completionPercentage || 0)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Phase Code</p>
          <p className="text-lg font-semibold text-gray-900">{phase.phaseCode}</p>
          <p className="text-sm text-gray-600 mt-4">Sequence</p>
          <p className="text-lg font-semibold text-gray-900">#{phase.sequence}</p>
          <p className="text-sm text-gray-600 mt-4">Type</p>
          <p className="text-sm font-semibold text-gray-900">
            {phase.phaseType?.replace('_', ' ').toUpperCase() || 'N/A'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 mb-2">Timeline</p>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500">Start:</span>{' '}
              <span className="font-medium text-gray-900">{formatDate(phase.startDate)}</span>
            </div>
            <div>
              <span className="text-gray-500">Planned End:</span>{' '}
              <span className="font-medium text-gray-900">{formatDate(phase.plannedEndDate)}</span>
            </div>
            {phase.actualEndDate && (
              <div>
                <span className="text-gray-500">Actual End:</span>{' '}
                <span className="font-medium text-green-600">{formatDate(phase.actualEndDate)}</span>
              </div>
            )}
            {phase.canStartAfter && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <span className="text-gray-500">Can Start After:</span>{' '}
                <span className="font-medium text-blue-600">{formatDate(phase.canStartAfter)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phase Description */}
      {phase.description && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{phase.description}</p>
        </div>
      )}

      {/* Phase Dependencies */}
      {phase && (
        <PhaseDependencies phase={phase} projectId={phase.projectId?.toString()} />
      )}

      {/* Dashboard Summary Card */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Phase Dashboard</h3>
            <p className="text-sm text-gray-600 mb-4">
              View comprehensive phase analytics, statistics, and insights
            </p>
          </div>
          <Link
            href={`/phases/${phase._id}/dashboard`}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Open Dashboard
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-white rounded-lg p-3">
            <p className="text-xs text-gray-600">Milestones</p>
            <p className="text-lg font-bold text-gray-900">{phase.milestones?.length || 0}</p>
          </div>
          <div className="bg-white rounded-lg p-3">
            <p className="text-xs text-gray-600">Quality Checks</p>
            <p className="text-lg font-bold text-gray-900">{phase.qualityCheckpoints?.length || 0}</p>
          </div>
          <div className="bg-white rounded-lg p-3">
            <p className="text-xs text-gray-600">Work Items</p>
            <p className="text-lg font-bold text-gray-900">{phase.workItems?.length || 0}</p>
          </div>
          <div className="bg-white rounded-lg p-3">
            <p className="text-xs text-gray-600">Completion</p>
            <p className="text-lg font-bold text-gray-900">{phase.completionPercentage || 0}%</p>
          </div>
        </div>
      </div>

      {/* Quick Financial Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Financial Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Budget Allocated</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {formatCurrency(financialSummary.budgetTotal)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Actual Spending</p>
            <p className="text-xl font-bold text-blue-600 mt-1">
              {formatCurrency(financialSummary.actualTotal)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Remaining Budget</p>
            <p className={`text-xl font-bold mt-1 ${
              financialSummary.remaining < 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {formatCurrency(financialSummary.remaining)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Utilization</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {financialSummary.utilizationPercentage.toFixed(1)}%
            </p>
          </div>
        </div>
        {/* Budget Utilization Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Budget Utilization</span>
            <span>{financialSummary.utilizationPercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
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
      </div>

      {/* Project Link */}
      {project && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <span className="font-medium">Project:</span>{' '}
            <Link
              href={`/projects/${project._id}`}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {project.projectName}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

export default OverviewTab;


