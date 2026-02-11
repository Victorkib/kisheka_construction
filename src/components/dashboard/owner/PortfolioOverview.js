/**
 * Portfolio Overview Component
 * Displays all projects in a grid with key metrics
 */

'use client';

import Link from 'next/link';

export function PortfolioOverview({ projects, formatCurrency }) {
  if (!projects || projects.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">No projects found. Create your first project to get started.</p>
        <Link
          href="/projects/new"
          className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Create Project
        </Link>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800 border-green-200',
      planning: 'bg-blue-100 text-blue-800 border-blue-200',
      paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      completed: 'bg-purple-100 text-purple-800 border-purple-200',
      archived: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getHealthColor = (status) => {
    const colors = {
      excellent: 'bg-green-500',
      good: 'bg-blue-500',
      fair: 'bg-yellow-500',
      poor: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getCapitalStatusColor = (status) => {
    const colors = {
      sufficient: 'bg-green-100 text-green-800',
      low: 'bg-yellow-100 text-yellow-800',
      negative: 'bg-red-100 text-red-800',
      insufficient: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">All Projects</h2>
        <Link
          href="/projects"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          View All →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="block bg-gradient-to-br from-white to-gray-50 rounded-lg p-6 border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{project.name}</h3>
                <p className="text-sm text-gray-600">{project.code}</p>
              </div>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
            </div>

            {/* Health Indicator */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">Health Score</span>
                <span className="text-sm font-bold text-gray-900">{project.healthScore}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${getHealthColor(project.healthStatus)}`}
                  style={{ width: `${project.healthScore}%` }}
                />
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Budget</p>
                <p className="text-sm font-semibold text-gray-900">
                  {project.budgetUtilization.toFixed(1)}%
                </p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
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
                <p className="text-xs text-gray-600 mb-1">Progress</p>
                <p className="text-sm font-semibold text-gray-900">
                  {project.completionPercentage.toFixed(1)}%
                </p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div
                    className="h-1.5 rounded-full bg-blue-500"
                    style={{ width: `${project.completionPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Capital Status */}
            <div className="mb-4 p-2 bg-gray-50 rounded">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Capital</span>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getCapitalStatusColor(project.capitalStatus)}`}>
                  {project.capitalStatus}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(project.availableCapital)} available
              </p>
            </div>

            {/* Alerts */}
            {project.alerts && project.alerts.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex flex-wrap gap-1">
                  {project.alerts.slice(0, 2).map((alert, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 text-xs rounded ${
                        alert.severity === 'critical'
                          ? 'bg-red-100 text-red-800'
                          : alert.severity === 'high'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {alert.type.replace('_', ' ')}
                    </span>
                  ))}
                  {project.alerts.length > 2 && (
                    <span className="px-2 py-0.5 text-xs text-gray-600">
                      +{project.alerts.length - 2} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Pending Approvals */}
            {project.pendingApprovals > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <Link
                  href={`/dashboard/approvals?projectId=${project.id}`}
                  className="text-xs text-yellow-700 hover:text-yellow-900 font-medium"
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
