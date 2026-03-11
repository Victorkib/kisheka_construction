/**
 * Portfolio Overview Component
 * Displays all projects in a grid with key metrics
 */

'use client';

import Link from 'next/link';

export function PortfolioOverview({ projects, formatCurrency }) {
  if (!projects || projects.length === 0) {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-6 sm:p-8 text-center border ds-border-subtle">
        <p className="text-sm sm:text-base ds-text-muted">No projects found. Create your first project to get started.</p>
        <Link
          href="/projects/new"
          className="mt-4 inline-block px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors text-sm font-medium touch-manipulation"
        >
          Create Project
        </Link>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-emerald-500/15 text-emerald-100 border border-emerald-400/60',
      planning: 'bg-blue-500/15 text-blue-100 border border-blue-400/60',
      paused: 'bg-amber-500/15 text-amber-100 border border-amber-400/60',
      completed: 'bg-purple-500/15 text-purple-100 border border-purple-400/60',
      archived: 'bg-slate-500/15 text-slate-100 border border-slate-400/60',
    };
    return colors[status] || 'bg-slate-500/15 text-slate-100 border border-slate-400/60';
  };

  const getHealthColor = (status) => {
    const colors = {
      excellent: 'bg-green-500',
      good: 'bg-blue-500',
      fair: 'bg-yellow-500',
      poor: 'bg-red-500',
    };
    return colors[status] || 'ds-bg-surface-muted';
  };

  const getCapitalStatusColor = (status) => {
    const colors = {
      sufficient: 'bg-emerald-500/10 text-emerald-100 border border-emerald-400/60',
      low: 'bg-amber-500/10 text-amber-100 border border-amber-400/60',
      negative: 'bg-red-500/10 text-red-100 border border-red-400/60',
      insufficient: 'bg-red-500/10 text-red-100 border border-red-400/60',
    };
    return colors[status] || 'bg-slate-500/10 text-slate-100 border border-slate-400/60';
  };

  return (
    <div className="ds-bg-surface rounded-lg shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 border ds-border-subtle">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold ds-text-primary">All Projects</h2>
        <Link
          href="/projects"
          className="text-xs sm:text-sm text-blue-500 hover:text-blue-400 active:text-blue-300 font-medium transition-colors touch-manipulation"
        >
          View All →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="block ds-bg-surface rounded-lg p-4 sm:p-6 border-2 ds-border-subtle hover:border-blue-400 active:border-blue-500 hover:shadow-lg active:shadow-xl transition-all touch-manipulation"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-bold ds-text-primary mb-1 break-words">{project.name}</h3>
                <p className="text-xs sm:text-sm ds-text-secondary break-words">{project.code}</p>
              </div>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full border flex-shrink-0 ml-2 ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
            </div>

            {/* Health Indicator */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium ds-text-muted">Health Score</span>
                <span className="text-sm font-bold ds-text-primary">{project.healthScore}/100</span>
              </div>
              <div className="w-full ds-bg-surface-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${getHealthColor(project.healthStatus)}`}
                  style={{ width: `${project.healthScore}%` }}
                />
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-xs ds-text-muted mb-1">Budget</p>
                <p className="text-sm font-semibold ds-text-primary">
                  {project.budgetUtilization.toFixed(1)}%
                </p>
                <div className="w-full ds-bg-surface-muted rounded-full h-1.5 mt-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      project.budgetUtilization > 100
                        ? 'bg-red-500'
                        : project.budgetUtilization > 80
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, project.budgetUtilization)}%` }}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs ds-text-muted mb-1">Progress</p>
                <p className="text-sm font-semibold ds-text-primary">
                  {project.completionPercentage.toFixed(1)}%
                </p>
                <div className="w-full ds-bg-surface-muted rounded-full h-1.5 mt-1">
                  <div
                    className="h-1.5 rounded-full bg-blue-500"
                    style={{ width: `${project.completionPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Capital Status */}
            <div className="mb-4 p-2 ds-bg-surface-muted rounded">
              <div className="flex items-center justify-between">
                <span className="text-xs ds-text-muted">Capital</span>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getCapitalStatusColor(project.capitalStatus)}`}>
                  {project.capitalStatus}
                </span>
              </div>
              <p className="text-xs ds-text-muted mt-1">
                {formatCurrency(project.availableCapital)} available
              </p>
            </div>

            {/* Alerts */}
            {project.alerts && project.alerts.length > 0 && (
              <div className="mt-4 pt-4 border-t ds-border-subtle">
                <div className="flex flex-wrap gap-1">
                  {project.alerts.slice(0, 2).map((alert, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 text-xs rounded ${
                        alert.severity === 'critical'
                          ? 'bg-red-500/15 text-red-100 border border-red-400/60'
                          : alert.severity === 'high'
                          ? 'bg-amber-500/15 text-amber-100 border border-amber-400/60'
                          : 'bg-blue-500/15 text-blue-100 border border-blue-400/60'
                      }`}
                    >
                      {alert.type.replace('_', ' ')}
                    </span>
                  ))}
                  {project.alerts.length > 2 && (
                    <span className="px-2 py-0.5 text-xs ds-text-muted">
                      +{project.alerts.length - 2} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Pending Approvals */}
            {project.pendingApprovals > 0 && (
              <div className="mt-4 pt-4 border-t ds-border-subtle">
                <Link
                  href={`/dashboard/approvals?projectId=${project.id}`}
                  className="text-xs text-amber-300 hover:text-amber-200 font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  ⚠️ {project.pendingApprovals} pending approval{project.pendingApprovals !== 1 ? 's' : ''}
                </Link>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default PortfolioOverview;
