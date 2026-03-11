/**
 * Notification Filters Component
 * Filter controls for notifications
 */

'use client';

import { useProjectContext } from '@/contexts/ProjectContext';

export function NotificationFilters({ filters, onFilterChange, onClearFilters }) {
  const { currentProject, currentProjectId, accessibleProjects } = useProjectContext();
  
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
    { value: 'bulk_request_created', label: 'Bulk Request Created' },
    { value: 'bulk_request_approved', label: 'Bulk Request Approved' },
    { value: 'bulk_po_created', label: 'Bulk PO Created' },
    { value: 'template_used', label: 'Template Used' },
    { value: 'bulk_materials_created', label: 'Bulk Materials Created' },
  ];

  const hasActiveFilters =
    filters.projectId !== undefined ||
    filters.isRead !== undefined ||
    filters.type !== 'all' ||
    filters.search;

  return (
    <div className="ds-bg-surface rounded-lg shadow p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* Project Filter */}
        {accessibleProjects && accessibleProjects.length > 0 && (
          <div>
            <label className="block text-xs font-medium ds-text-secondary mb-1">
              Project
            </label>
            <select
              value={filters.projectId || 'all'}
              onChange={(e) => {
                onFilterChange({
                  projectId: e.target.value === 'all' ? undefined : e.target.value,
                });
              }}
              className="px-3 py-2 text-sm ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary min-w-[180px]"
            >
              <option value="all">All Projects</option>
              {accessibleProjects.map((project) => {
                const projectId = typeof project._id === 'object' 
                  ? project._id.toString() 
                  : project._id;
                const isCurrentProject = projectId === currentProjectId;
                return (
                  <option key={projectId} value={projectId}>
                    {project.projectName || project.name || 'Unnamed Project'}
                    {isCurrentProject ? ' (Current)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Read Status Filter */}
        <div>
          <label className="block text-xs font-medium ds-text-secondary mb-1">
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
            className="px-3 py-2 text-sm ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary"
          >
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>

        {/* Type Filter */}
        <div>
          <label className="block text-xs font-medium ds-text-secondary mb-1">
            Type
          </label>
          <select
            value={filters.type || 'all'}
            onChange={(e) => {
              onFilterChange({
                type: e.target.value === 'all' ? undefined : e.target.value,
              });
            }}
            className="px-3 py-2 text-sm ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary"
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
          <label className="block text-xs font-medium ds-text-secondary mb-1">
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
            className="w-full px-3 py-2 text-sm ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary placeholder:ds-text-muted"
          />
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <div className="flex items-end">
            <button
              onClick={onClearFilters}
              className="px-3 py-2 text-sm ds-text-secondary hover:ds-text-primary font-medium"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

