/**
 * Notification Item Component
 * Individual notification display with actions
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectContext } from '@/contexts/ProjectContext';
import { ConfirmationModal } from '@/components/modals/confirmation-modal';

export function NotificationItem({ notification, onMarkRead, onMarkUnread, onDelete }) {
  const router = useRouter();
  const { currentProjectId, accessibleProjects } = useProjectContext();
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Get project name if notification has projectId
  const getProjectName = () => {
    if (!notification.projectId) return null;
    const projectId = typeof notification.projectId === 'object' 
      ? notification.projectId.toString() 
      : notification.projectId;
    
    const project = accessibleProjects?.find((p) => {
      const pId = typeof p._id === 'object' ? p._id.toString() : p._id;
      return pId === projectId;
    });
    
    return project?.projectName || project?.name || null;
  };
  
  const projectName = getProjectName();
  const notificationProjectId = notification.projectId 
    ? (typeof notification.projectId === 'object' 
        ? notification.projectId.toString() 
        : notification.projectId)
    : null;
  const isFromDifferentProject = notificationProjectId && notificationProjectId !== currentProjectId;

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

    // Helper to build URL with project parameter
    const buildUrl = (baseUrl, hasQuery = false) => {
      // Use notification's projectId if available, otherwise use currentProjectId
      const projectId = notificationProjectId || currentProjectId;
      if (!projectId) return baseUrl;
      const separator = hasQuery ? '&' : '?';
      return `${baseUrl}${separator}projectId=${projectId}`;
    };

    // Navigate to related item if available
    if (notification.relatedModel && notification.relatedId) {
      // Convert ObjectId to string if needed
      let relatedId = typeof notification.relatedId === 'object' 
        ? notification.relatedId.toString() 
        : String(notification.relatedId || '');
      
      // Validate ID format (MongoDB ObjectId is 24 hex chars)
      const isValidId = relatedId && /^[a-f\d]{24}$/i.test(relatedId);
      
      if (notification.relatedModel === 'MATERIAL') {
        if (isValidId) {
          router.push(buildUrl(`/items/${relatedId}`));
        } else {
          console.warn('Invalid material ID, navigating to approvals:', relatedId);
          router.push(buildUrl('/dashboard/approvals?tab=materials', true));
        }
      } else if (notification.relatedModel === 'EXPENSE') {
        if (isValidId) {
          router.push(buildUrl(`/expenses/${relatedId}`));
        } else {
          router.push(buildUrl('/dashboard/approvals?tab=expenses', true));
        }
      } else if (notification.relatedModel === 'INITIAL_EXPENSE') {
        if (isValidId) {
          router.push(buildUrl(`/initial-expenses/${relatedId}`));
        } else {
          router.push(buildUrl('/dashboard/approvals?tab=initial-expenses', true));
        }
      } else if (notification.relatedModel === 'PROJECT') {
        if (isValidId) {
          router.push(`/projects/${relatedId}`);
        }
      } else if (notification.relatedModel === 'MATERIAL_REQUEST') {
        // Navigate to approvals page with material requests tab
        router.push(buildUrl('/dashboard/approvals?tab=material-requests', true));
      } else if (notification.relatedModel === 'PURCHASE_ORDER') {
        // Navigate to purchase order detail page
        if (isValidId) {
          router.push(buildUrl(`/purchase-orders/${relatedId}`));
        } else {
          router.push(buildUrl('/purchase-orders', true));
        }
      } else if (notification.relatedModel === 'PROFESSIONAL_FEE') {
        // Navigate to approvals page with professional fees tab
        router.push(buildUrl('/dashboard/approvals?tab=professional-fees', true));
      } else if (notification.relatedModel === 'PROFESSIONAL_ACTIVITY') {
        // Navigate to approvals page with professional activities tab
        router.push(buildUrl('/dashboard/approvals?tab=professional-activities', true));
      } else if (notification.relatedModel === 'BUDGET_REALLOCATION') {
        // Navigate to approvals page with budget reallocations tab
        router.push(buildUrl('/dashboard/approvals?tab=budget-reallocations', true));
      } else if (notification.relatedModel === 'LABOUR_ENTRY') {
        // Navigate to approvals page with labour entries tab
        router.push(buildUrl('/dashboard/approvals?tab=labour-entries', true));
      } else if (notification.relatedModel === 'CONTINGENCY_DRAW') {
        // Navigate to approvals page with contingency draws tab
        router.push(buildUrl('/dashboard/approvals?tab=contingency-draws', true));
      } else if (notification.relatedModel === 'USER') {
        // User notifications might not have a detail page
        // Could navigate to profile or do nothing
      }
      
      // If it's an approval_needed notification, navigate to approvals page
      if (notification.type === 'approval_needed') {
        // Determine which tab to show based on relatedModel
        let tab = 'materials'; // default
        if (notification.relatedModel === 'MATERIAL') {
          tab = 'materials';
        } else if (notification.relatedModel === 'EXPENSE') {
          tab = 'expenses';
        } else if (notification.relatedModel === 'INITIAL_EXPENSE') {
          tab = 'initial-expenses';
        } else if (notification.relatedModel === 'MATERIAL_REQUEST') {
          tab = 'material-requests';
        } else if (notification.relatedModel === 'LABOUR_ENTRY') {
          tab = 'labour-entries';
        } else if (notification.relatedModel === 'PROFESSIONAL_FEE') {
          tab = 'professional-fees';
        } else if (notification.relatedModel === 'PROFESSIONAL_ACTIVITY') {
          tab = 'professional-activities';
        } else if (notification.relatedModel === 'BUDGET_REALLOCATION') {
          tab = 'budget-reallocations';
        } else if (notification.relatedModel === 'PURCHASE_ORDER') {
          tab = 'purchase-order-modifications';
        } else if (notification.relatedModel === 'CONTINGENCY_DRAW') {
          tab = 'contingency-draws';
        }
        router.push(buildUrl(`/dashboard/approvals?tab=${tab}`, true));
        return; // Don't navigate twice
      }
    }
  };

  const handleAction = async (action, e) => {
    e.stopPropagation();
    
    // Show confirmation modal for delete
    if (action === 'delete') {
      setShowDeleteModal(true);
      return;
    }
    
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
      }
    } catch (err) {
      console.error(`Error performing ${action}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete) return;
    
    setIsDeleting(true);
    try {
      // Convert _id to string if needed
      const notificationId = typeof notification._id === 'object' 
        ? notification._id.toString() 
        : notification._id;
      
      await onDelete(notificationId);
      setShowDeleteModal(false);
    } catch (err) {
      console.error('Error deleting notification:', err);
      // Error will be handled by parent component
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={`p-4 border-b ds-border-subtle last:border-b-0 hover:ds-bg-surface-muted transition-colors cursor-pointer ${
        !notification.isRead ? 'bg-blue-500/10 border-l-4 border-l-blue-500/40' : ''
      } ${isFromDifferentProject ? 'opacity-90 border-l-4 border-l-amber-500/40' : ''} ${
        loading ? 'opacity-50 pointer-events-none' : ''
      }`}
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
              <div className="flex items-center gap-2 flex-wrap">
                <p
                  className={`text-sm font-medium ${
                    !notification.isRead
                      ? 'ds-text-primary'
                      : 'ds-text-secondary'
                  }`}
                >
                  {notification.title}
                </p>
                {/* Project Badge */}
                {projectName && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isFromDifferentProject
                        ? 'bg-amber-500/20 text-amber-600 border border-amber-500/40'
                        : 'bg-blue-500/20 text-blue-600 border border-blue-500/40'
                    }`}
                    title={isFromDifferentProject ? 'From different project' : 'Current project'}
                  >
                    {projectName}
                  </span>
                )}
              </div>
              <p className="text-sm ds-text-secondary mt-1 line-clamp-2">
                {notification.message}
              </p>
              <p className="text-sm ds-text-secondary mt-1">
                {formatTimeAgo(notification.createdAt)}
              </p>
            </div>

            {/* Unread indicator */}
            {!notification.isRead && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full ds-bg-accent-primary mt-2"></span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            {!notification.isRead ? (
              <button
                onClick={(e) => handleAction('read', e)}
                disabled={loading}
                className="text-sm ds-text-accent-primary hover:ds-text-accent-hover font-medium disabled:ds-text-muted"
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
              className="text-sm ds-text-danger hover:ds-text-danger font-medium disabled:ds-text-muted"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Notification"
        message={
          <>
            <p className="mb-3">
              Are you sure you want to delete this notification?
            </p>
            <p className="text-sm ds-text-secondary mb-2">
              <strong>"{notification.title}"</strong>
            </p>
            <p className="text-red-600 font-medium text-sm">
              This action cannot be undone.
            </p>
          </>
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}

