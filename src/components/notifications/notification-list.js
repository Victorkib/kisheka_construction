/**
 * Notification List Component
 * Displays grouped list of notifications
 */

'use client';

import { NotificationItem } from './notification-item';
import { useProjectContext } from '@/contexts/ProjectContext';

export function NotificationList({
  notifications,
  onMarkRead,
  onMarkUnread,
  onDelete,
  loading = false,
  filters = {},
}) {
  const { currentProject } = useProjectContext();
  const groupNotificationsByDate = (notifications) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };

    notifications.forEach((notification) => {
      const notifDate = new Date(notification.createdAt);
      if (notifDate >= today) {
        groups.today.push(notification);
      } else if (notifDate >= yesterday) {
        groups.yesterday.push(notification);
      } else if (notifDate >= thisWeek) {
        groups.thisWeek.push(notification);
      } else {
        groups.older.push(notification);
      }
    });

    return groups;
  };

  const grouped = groupNotificationsByDate(notifications);

  if (loading) {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-10 w-10 ds-bg-surface-muted rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 ds-bg-surface-muted rounded w-3/4"></div>
                <div className="h-3 ds-bg-surface-muted rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (notifications.length === 0) {
    const hasFilters = filters.projectId || filters.isRead !== undefined || filters.type || filters.search;
    const projectName = currentProject?.projectName || currentProject?.name;
    
    return (
      <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
        <div className="text-6xl mb-4">🔔</div>
        <h3 className="text-lg font-semibold ds-text-primary mb-2">
          {hasFilters ? 'No notifications match your filters' : 'No notifications'}
        </h3>
        <p className="ds-text-secondary">
          {hasFilters 
            ? 'Try adjusting your filters to see more notifications.'
            : filters.projectId && projectName
              ? `You're all caught up for ${projectName}! New notifications will appear here.`
              : "You're all caught up! New notifications will appear here."}
        </p>
      </div>
    );
  }

  const renderGroup = (title, notifications) => {
    if (notifications.length === 0) return null;

    return (
      <div key={title} className="mb-6">
        <h3 className="text-sm font-semibold ds-text-secondary uppercase tracking-wide mb-2 px-4">
          {title}
        </h3>
        <div className="ds-bg-surface rounded-lg shadow divide-y divide-ds-border-subtle">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification._id}
              notification={notification}
              onMarkRead={onMarkRead}
              onMarkUnread={onMarkUnread}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderGroup('Today', grouped.today)}
      {renderGroup('Yesterday', grouped.yesterday)}
      {renderGroup('This Week', grouped.thisWeek)}
      {renderGroup('Older', grouped.older)}
    </div>
  );
}

