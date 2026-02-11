/**
 * Action Items Component
 * Displays prioritized list of items requiring attention
 */

'use client';

import Link from 'next/link';

export function ActionItems({ items, formatCurrency }) {
  if (!items || items.length === 0) {
    return (
      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl">✅</span>
          <div>
            <h3 className="text-lg font-semibold text-green-900">All Clear!</h3>
            <p className="text-sm text-green-700">No critical action items at this time.</p>
          </div>
        </div>
      </div>
    );
  }

  const getPriorityColor = (priority) => {
    const colors = {
      critical: 'bg-red-50 border-red-300 text-red-900',
      high: 'bg-yellow-50 border-yellow-300 text-yellow-900',
      medium: 'bg-blue-50 border-blue-300 text-blue-900',
      low: 'bg-gray-50 border-gray-300 text-gray-900',
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
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Action Items</h2>
        <span className="text-sm text-gray-600">{items.length} item{items.length !== 1 ? 's' : ''} requiring attention</span>
      </div>

      <div className="space-y-4">
        {priorityOrder.map((priority) => {
          const priorityItems = groupedItems[priority] || [];
          if (priorityItems.length === 0) return null;

          return (
            <div key={priority} className={`rounded-lg border-2 p-4 ${getPriorityColor(priority)}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{getPriorityIcon(priority)}</span>
                <h3 className="font-semibold capitalize">{priority} Priority</h3>
                <span className="text-xs bg-white px-2 py-0.5 rounded-full">
                  {priorityItems.length}
                </span>
              </div>
              <div className="space-y-2">
                {priorityItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                        <p className="text-sm text-gray-700 mb-3">{item.description}</p>
                        <Link
                          href={item.link}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
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
