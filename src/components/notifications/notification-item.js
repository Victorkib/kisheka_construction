/**
 * Notification Item Component
 * Individual notification display with actions
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function NotificationItem({ notification, onMarkRead, onMarkUnread, onDelete }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'approval_needed':
      case 'approval_required':
        return '🔔';
      case 'approval_status':
        return '✅';
      case 'budget_alert':
        return '💰';
      case 'discrepancy_alert':
        return '⚠️';
      case 'item_received':
        return '📦';
      case 'task_assigned':
        return '📋';
      case 'comment':
        return '💬';
      case 'role_changed':
        return '👤';
      case 'invitation_sent':
        return '✉️';
      default:
        return 'ℹ️';
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Just now';
    try {
      const now = new Date();
      const then = new Date(dateString);
      const diffInSeconds = Math.floor((now - then) / 1000);

      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600)
        return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400)
        return `${Math.floor(diffInSeconds / 3600)}h ago`;
      if (diffInSeconds < 604800)
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
      return then.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: then.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return 'Unknown';
    }
  };

  const handleClick = async () => {
    // Mark as read if unread
    if (!notification.isRead && onMarkRead) {
      setLoading(true);
      try {
        // Convert _id to string if needed
        const notificationId = typeof notification._id === 'object' 
          ? notification._id.toString() 
          : notification._id;
        await onMarkRead(notificationId);
      } catch (err) {
        console.error('Error marking as read:', err);
      } finally {
        setLoading(false);
      }
    }

    // Navigate to related item if available
    if (notification.relatedModel && notification.relatedId) {
      // Convert ObjectId to string if needed
      const relatedId = typeof notification.relatedId === 'object' 
        ? notification.relatedId.toString() 
        : notification.relatedId;
        
      if (notification.relatedModel === 'MATERIAL') {
        router.push(`/items/${relatedId}`);
      } else if (notification.relatedModel === 'EXPENSE') {
        router.push(`/expenses/${relatedId}`);
      } else if (notification.relatedModel === 'INITIAL_EXPENSE') {
        router.push(`/initial-expenses/${relatedId}`);
      } else if (notification.relatedModel === 'PROJECT') {
        router.push(`/projects/${relatedId}`);
      } else if (notification.relatedModel === 'MATERIAL_REQUEST') {
        // Navigate to material request detail page
        router.push(`/material-requests/${relatedId}`);
      } else if (notification.relatedModel === 'PURCHASE_ORDER') {
        // Navigate to purchase order detail page
        router.push(`/purchase-orders/${relatedId}`);
      } else if (notification.relatedModel === 'USER') {
        // User notifications might not have a detail page
        // Could navigate to profile or do nothing
      }
    }
  };

  const handleAction = async (action, e) => {
    e.stopPropagation();
    setLoading(true);

    try {
      // Convert _id to string if needed (MongoDB ObjectId serialization)
      const notificationId = typeof notification._id === 'object' 
        ? notification._id.toString() 
        : notification._id;
        
      if (action === 'read' && onMarkRead) {
        await onMarkRead(notificationId);
      } else if (action === 'unread' && onMarkUnread) {
        await onMarkUnread(notificationId);
      } else if (action === 'delete' && onDelete) {
        await onDelete(notificationId);
      }
    } catch (err) {
      console.error(`Error performing ${action}:`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`p-4 border-b ds-border-subtle last:border-b-0 hover:ds-bg-surface-muted transition-colors cursor-pointer ${
        !notification.isRead ? 'bg-blue-50' : ''
      } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className="text-2xl flex-shrink-0">
          {getNotificationIcon(notification.type)}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  !notification.isRead
                    ? 'ds-text-primary'
                    : 'ds-text-secondary'
                }`}
              >
                {notification.title}
              </p>
              <p className="text-sm ds-text-secondary mt-1 line-clamp-2">
                {notification.message}
              </p>
              <p className="text-sm ds-text-secondary mt-1">
                {formatTimeAgo(notification.createdAt)}
              </p>
            </div>

            {/* Unread indicator */}
            {!notification.isRead && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2"></span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            {!notification.isRead ? (
              <button
                onClick={(e) => handleAction('read', e)}
                disabled={loading}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:ds-text-muted"
              >
                Mark as read
              </button>
            ) : (
              <button
                onClick={(e) => handleAction('unread', e)}
                disabled={loading}
                className="text-sm ds-text-secondary hover:ds-text-primary font-medium disabled:ds-text-muted"
              >
                Mark as unread
              </button>
            )}
            <span className="ds-text-muted">•</span>
            <button
              onClick={(e) => handleAction('delete', e)}
              disabled={loading}
              className="text-sm text-red-600 hover:text-red-800 font-medium disabled:ds-text-muted"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

