/**
 * Notification Filters Component
 * Filter controls for notifications
 */

'use client';

export function NotificationFilters({ filters, onFilterChange, onClearFilters }) {
  const notificationTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'approval_needed', label: 'Approval Needed' },
    { value: 'approval_status', label: 'Approval Status' },
    { value: 'budget_alert', label: 'Budget Alerts' },
    { value: 'discrepancy_alert', label: 'Discrepancy Alerts' },
    { value: 'item_received', label: 'Item Received' },
    { value: 'task_assigned', label: 'Task Assigned' },
    { value: 'comment', label: 'Comments' },
    { value: 'role_changed', label: 'Role Changed' },
    { value: 'invitation_sent', label: 'Invitations' },
  ];

  const hasActiveFilters =
    filters.isRead !== undefined ||
    filters.type !== 'all' ||
    filters.search;

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* Read Status Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={filters.isRead === undefined ? 'all' : filters.isRead ? 'read' : 'unread'}
            onChange={(e) => {
              const value = e.target.value;
              onFilterChange({
                isRead:
                  value === 'all' ? undefined : value === 'read',
              });
            }}
            className="px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>

        {/* Type Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={filters.type || 'all'}
            onChange={(e) => {
              onFilterChange({
                type: e.target.value === 'all' ? undefined : e.target.value,
              });
            }}
            className="px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {notificationTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            placeholder="Search notifications..."
            value={filters.search || ''}
            onChange={(e) => {
              onFilterChange({
                search: e.target.value || undefined,
              });
            }}
            className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
          />
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <div className="flex items-end">
            <button
              onClick={onClearFilters}
              className="px-3 py-2 text-sm text-gray-700 hover:text-gray-900 font-medium"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

