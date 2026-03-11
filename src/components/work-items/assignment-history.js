/**
 * Assignment History Component
 * Displays the history of worker assignments for a work item
 */

'use client';

import { Clock, User, UserPlus, UserMinus, RotateCcw } from 'lucide-react';

const formatDate = (date) => {
  if (!date) return 'Unknown date';
  try {
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (err) {
    return 'Invalid date';
  }
};

export function AssignmentHistory({ assignmentHistory = [] }) {
  if (!assignmentHistory || assignmentHistory.length === 0) {
    return (
      <div className="text-center py-8 ds-text-muted">
        <Clock className="w-12 h-12 mx-auto mb-3 ds-text-muted" />
        <p className="font-medium">No assignment history</p>
        <p className="text-sm mt-1">Assignment changes will appear here</p>
      </div>
    );
  }

  const getActionIcon = (action) => {
    switch (action) {
      case 'assigned':
        return <UserPlus className="w-4 h-4 text-green-600" />;
      case 'reassigned':
        return <RotateCcw className="w-4 h-4 text-blue-600" />;
      case 'unassigned':
        return <UserMinus className="w-4 h-4 text-red-600" />;
      default:
        return <User className="w-4 h-4 ds-text-secondary" />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'assigned':
        return 'bg-green-50 border-green-400/60';
      case 'reassigned':
        return 'bg-blue-50 border-blue-400/60';
      case 'unassigned':
        return 'bg-red-50 border-red-400/60';
      default:
        return 'ds-bg-surface-muted ds-border-subtle';
    }
  };

  return (
    <div className="space-y-3">
      {assignmentHistory.map((entry, index) => {
        const previousWorkers = entry.previousWorkersDetails || entry.previousWorkers || [];
        const assignedWorkers = entry.assignedWorkersDetails || entry.assignedWorkers || [];
        
        return (
          <div
            key={index}
            className={`border rounded-lg p-4 ${getActionColor(entry.action)}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                {getActionIcon(entry.action)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold ds-text-primary capitalize">
                      {entry.action?.replace('_', ' ')}
                    </span>
                    <span className="text-xs ds-text-muted">
                      {formatDate(entry.assignedAt)}
                    </span>
                  </div>
                  {entry.assignedByName && (
                    <span className="text-xs ds-text-secondary">
                      by {entry.assignedByName}
                    </span>
                  )}
                </div>

                {previousWorkers.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium ds-text-secondary mb-1">Previous Workers:</p>
                    <div className="flex flex-wrap gap-1">
                      {previousWorkers.map((worker, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 ds-bg-surface border ds-border-subtle rounded text-xs ds-text-secondary"
                        >
                          <User className="w-3 h-3" />
                          {typeof worker === 'string' ? worker : worker.workerName || 'Unknown'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {assignedWorkers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium ds-text-secondary mb-1">Assigned Workers:</p>
                    <div className="flex flex-wrap gap-1">
                      {assignedWorkers.map((worker, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 ds-bg-surface border ds-border-subtle rounded text-xs ds-text-secondary"
                        >
                          <User className="w-3 h-3" />
                          {typeof worker === 'string' ? worker : worker.workerName || 'Unknown'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {previousWorkers.length === 0 && assignedWorkers.length === 0 && (
                  <p className="text-xs ds-text-secondary italic">
                    No worker details available
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
