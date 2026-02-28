/**
 * ProjectHealthStrip Component
 * Compact health status widget for project overview
 * Displays multiple status indicators in a condensed format
 * 
 * @param {Object} props
 * @param {Array} props.statuses - Array of {label, status} objects
 * @param {string} props.summary - Summary text (optional)
 * @param {string} props.link - Link to detailed health dashboard (optional)
 * @param {string} props.projectId - Project ID for link generation (optional)
 */

'use client';

import Link from 'next/link';

export function ProjectHealthStrip({ statuses = [], summary, link, projectId }) {
  const getStatusColor = (status) => {
    const colors = {
      ok: 'bg-green-100 text-green-800 border-green-400/60',
      healthy: 'bg-green-100 text-green-800 border-green-400/60',
      on_budget: 'bg-green-100 text-green-800 border-green-400/60',
      sufficient: 'bg-green-100 text-green-800 border-green-400/60',
      on_track: 'bg-green-100 text-green-800 border-green-400/60',
      at_risk: 'bg-yellow-100 text-yellow-800 border-yellow-400/60',
      low: 'bg-yellow-100 text-yellow-800 border-yellow-400/60',
      delayed: 'bg-yellow-100 text-yellow-800 border-yellow-400/60',
      critical: 'bg-red-100 text-red-800 border-red-400/60',
      over_budget: 'bg-red-100 text-red-800 border-red-400/60',
      insufficient: 'bg-red-100 text-red-800 border-red-400/60',
      negative: 'bg-red-100 text-red-800 border-red-400/60',
    };
    return colors[status] || 'ds-bg-surface-muted ds-text-primary ds-border-subtle';
  };

  const getStatusLabel = (status) => {
    const labels = {
      ok: 'OK',
      healthy: 'Healthy',
      on_budget: 'On Budget',
      sufficient: 'Sufficient',
      on_track: 'On Track',
      at_risk: 'At Risk',
      low: 'Low',
      delayed: 'Delayed',
      critical: 'Critical',
      over_budget: 'Over Budget',
      insufficient: 'Insufficient',
      negative: 'Negative',
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status) => {
    if (status === 'ok' || status === 'healthy' || status === 'on_budget' || status === 'sufficient' || status === 'on_track') {
      return '✓';
    }
    if (status === 'at_risk' || status === 'low' || status === 'delayed') {
      return '⚠';
    }
    if (status === 'critical' || status === 'over_budget' || status === 'insufficient' || status === 'negative') {
      return '✗';
    }
    return '';
  };

  if (statuses.length === 0 && !summary) {
    return null;
  }

  return (
    <div className="ds-bg-surface rounded-lg shadow-sm p-4 border ds-border-subtle">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Status Chips */}
        {statuses.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium ds-text-secondary">Status:</span>
            {statuses.map((statusItem, index) => (
              <span
                key={index}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(statusItem.status)}`}
                title={`${statusItem.label}: ${getStatusLabel(statusItem.status)}`}
              >
                <span>{getStatusIcon(statusItem.status)}</span>
                <span>{statusItem.label}: {getStatusLabel(statusItem.status)}</span>
              </span>
            ))}
          </div>
        )}
        
        {/* Summary Text */}
        {summary && (
          <p className="text-sm ds-text-secondary flex-1">
            {summary}
          </p>
        )}
        
        {/* Link to Detailed Dashboard */}
        {link && (
          <Link
            href={link.includes('[id]') ? link.replace('[id]', projectId || '') : link}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap flex items-center gap-1"
          >
            View Detailed Health Dashboard
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}

export default ProjectHealthStrip;
