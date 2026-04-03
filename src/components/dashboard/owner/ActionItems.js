/**
 * Action Items Component
 * Displays prioritized list of items requiring attention
 */

'use client';

import Link from 'next/link';

export function ActionItems({ items, formatCurrency }) {
  if (!items || items.length === 0) {
    return (
      <div className="ds-bg-success border-2 ds-border-success rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-2xl sm:text-3xl">✅</span>
          <div>
            <h3 className="text-base sm:text-lg font-semibold ds-text-success">All Clear!</h3>
            <p className="text-xs sm:text-sm ds-text-success-muted">No critical action items at this time.</p>
          </div>
        </div>
      </div>
    );
  }

  const getPriorityColor = (priority) => {
    const colors = {
      critical: 'ds-bg-danger ds-border-danger ds-text-danger',
      high: 'ds-bg-warning ds-border-warning ds-text-warning',
      medium: 'ds-bg-info ds-border-info ds-text-info',
      low: 'ds-bg-surface-muted ds-border-subtle ds-text-primary',
    };
    return colors[priority] || colors.medium;
  };

  const getPriorityIcon = (priority) => {
    const icons = {
      critical: '🚨',
      high: '⚠️',
      medium: 'ℹ️',
      low: '📌',
    };
    return icons[priority] || icons.medium;
  };

  // Group by priority
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.priority]) {
      acc[item.priority] = [];
    }
    acc[item.priority].push(item);
    return acc;
  }, {});

  const priorityOrder = ['critical', 'high', 'medium', 'low'];

  return (
    <div className="ds-bg-surface rounded-lg shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 border ds-border-subtle">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold ds-text-primary">Action Items</h2>
        <span className="text-xs sm:text-sm ds-text-secondary">{items.length} item{items.length !== 1 ? 's' : ''} requiring attention</span>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {priorityOrder.map((priority) => {
          const priorityItems = groupedItems[priority] || [];
          if (priorityItems.length === 0) return null;

          return (
            <div key={priority} className={`rounded-lg border-2 p-3 sm:p-4 ${getPriorityColor(priority)}`}>
              <div className="flex flex-wrap items-center gap-2 mb-2 sm:mb-3">
                <span className="text-lg sm:text-xl">{getPriorityIcon(priority)}</span>
                <h3 className="font-semibold capitalize text-sm sm:text-base">{priority} Priority</h3>
                <span className="text-xs ds-bg-surface px-2 py-0.5 rounded-full ds-text-primary">
                  {priorityItems.length}
                </span>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {priorityItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="ds-bg-surface rounded-lg p-3 sm:p-4 border ds-border-subtle hover:shadow-md active:shadow-lg transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold ds-text-primary mb-1 text-sm sm:text-base break-words">{item.title}</h4>
                        <p className="text-xs sm:text-sm ds-text-secondary mb-2 sm:mb-3 break-words">{item.description}</p>
                        <Link
                          href={item.link}
                          className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 ds-bg-accent-primary ds-text-inverse rounded-lg hover:ds-bg-accent-focus transition-colors text-xs sm:text-sm font-medium touch-manipulation"
                        >
                          {item.action}
                          <span>→</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ActionItems;
