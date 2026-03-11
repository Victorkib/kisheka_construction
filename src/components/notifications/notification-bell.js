/**
 * Notification Bell Component
 * Displays notification count and dropdown with recent notifications
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/loading';
import { useProjectContext } from '@/contexts/ProjectContext';
import { ConfirmationModal } from '@/components/modals/confirmation-modal';

export function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMarkAllModal, setShowMarkAllModal] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();
  const { currentProjectId } = useProjectContext();
  const abortControllerRef = useRef(null);
  const intervalRef = useRef(null);

  // Fetch notifications function
  const fetchNotifications = useCallback(async (signal = null) => {
    try {
      setError(null);
      
      // Validate projectId format if provided (MongoDB ObjectId is 24 hex chars)
      const isValidProjectId = !currentProjectId || /^[a-f\d]{24}$/i.test(currentProjectId);
      if (currentProjectId && !isValidProjectId) {
        console.warn('Invalid projectId format:', currentProjectId);
        setLoading(false);
        return;
      }
      
      // Build URL with projectId if available and valid
      const url = currentProjectId && isValidProjectId
        ? `/api/notifications?limit=10&projectId=${currentProjectId}`
        : '/api/notifications?limit=10';
      
      const response = await fetch(url, {
        cache: 'no-store',
        signal, // Add abort signal
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      
      // Check if request was aborted
      if (signal?.aborted) {
        return;
      }
      
      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 401) {
          throw new Error('Session expired. Please refresh the page.');
        } else if (response.status === 403) {
          throw new Error('Access denied to this project.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Validate response data structure
        const notifications = Array.isArray(data.data?.notifications) 
          ? data.data.notifications 
          : [];
        const unreadCount = typeof data.data?.unreadCount === 'number' 
          ? data.data.unreadCount 
          : 0;
        
        setNotifications(notifications);
        setUnreadCount(Math.max(0, unreadCount)); // Ensure non-negative
      } else {
        throw new Error(data.error || 'Failed to load notifications');
      }
    } catch (error) {
      // Don't set error for aborted requests
      if (error.name === 'AbortError') {
        return;
      }
      
      // Don't set error for network errors if we have cached data
      if (error.message?.includes('fetch') && notifications.length > 0) {
        console.warn('Network error, using cached notifications:', error);
        return;
      }
      
      console.error('Error fetching notifications:', error);
      setError(error.message || 'Failed to load notifications');
      
      // Use functional update to check current state
      setNotifications((prev) => {
        if (prev.length === 0) {
          setLoading(false);
        }
        return prev;
      });
    } finally {
      // Only set loading to false if request wasn't aborted
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [currentProjectId]);

  // Fetch notifications on mount and when project changes
  useEffect(() => {
    // Abort previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    fetchNotifications(abortControllerRef.current.signal);
    
    // Poll for new notifications every 30 seconds (only when dropdown is closed to save resources)
    intervalRef.current = setInterval(() => {
      if (!isOpen && abortControllerRef.current) {
        abortControllerRef.current = new AbortController();
        fetchNotifications(abortControllerRef.current.signal);
      }
    }, 30000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [currentProjectId, fetchNotifications, isOpen]);
  
  // Refresh notifications when dropdown opens
  useEffect(() => {
    if (isOpen && !loading) {
      // Refresh when opening dropdown to get latest notifications
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      fetchNotifications(abortControllerRef.current.signal);
    }
  }, [isOpen, fetchNotifications, loading]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      // Convert ObjectId to string if needed
      const id = typeof notificationId === 'object' 
        ? notificationId.toString() 
        : String(notificationId || '');
      
      // Validate ID format
      if (!id || !/^[a-f\d]{24}$/i.test(id)) {
        console.error('Invalid notification ID:', id);
        return;
      }
      
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update local state
          setNotifications((prev) =>
            prev.map((n) => {
              const nId = typeof n._id === 'object' ? n._id.toString() : String(n._id || '');
              return nId === id ? { ...n, isRead: true, readAt: new Date() } : n;
            })
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        throw new Error(`Failed to mark as read: ${response.status}`);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Don't show error to user for individual notification actions
    }
  };

  const handleMarkAllAsRead = () => {
    // Show confirmation modal
    setShowMarkAllModal(true);
  };

  const handleMarkAllAsReadConfirm = async () => {
    setIsMarkingAll(true);
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          projectId: currentProjectId || undefined,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to mark as read: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
        );
        setUnreadCount(0);
        setShowMarkAllModal(false);
      } else {
        throw new Error(data.error || 'Failed to mark all as read');
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      setError('Failed to mark all notifications as read. Please try again.');
      setShowMarkAllModal(false);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleMarkAsUnread = async (notificationId) => {
    const id = typeof notificationId === 'object' 
      ? notificationId.toString() 
      : String(notificationId || '');
    
    if (!id || !/^[a-f\d]{24}$/i.test(id)) {
      console.error('Invalid notification ID:', id);
      return;
    }

    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const response = await fetch(`/api/notifications/${id}/unread`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setNotifications((prev) =>
            prev.map((n) => {
              const nId = typeof n._id === 'object' ? n._id.toString() : String(n._id || '');
              return nId === id ? { ...n, isRead: false, readAt: null } : n;
            })
          );
          setUnreadCount((prev) => prev + 1);
        }
      } else {
        throw new Error(`Failed to mark as unread: ${response.status}`);
      }
    } catch (error) {
      console.error('Error marking notification as unread:', error);
      setError('Failed to mark notification as unread. Please try again.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDeleteNotification = (notificationId) => {
    setShowDeleteModal(notificationId);
  };

  const handleDeleteConfirm = async () => {
    if (!showDeleteModal) return;
    
    setIsDeleting(true);
    try {
      const id = typeof showDeleteModal === 'object' 
        ? showDeleteModal.toString() 
        : String(showDeleteModal || '');
      
      if (!id || !/^[a-f\d]{24}$/i.test(id)) {
        throw new Error('Invalid notification ID');
      }

      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (response.ok) {
        const deleted = notifications.find((n) => {
          const nId = typeof n._id === 'object' ? n._id.toString() : String(n._id || '');
          return nId === id;
        });
        setNotifications((prev) =>
          prev.filter((n) => {
            const nId = typeof n._id === 'object' ? n._id.toString() : String(n._id || '');
            return nId !== id;
          })
        );
        if (deleted && !deleted.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        setShowDeleteModal(null);
      } else {
        throw new Error(`Failed to delete: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      setError('Failed to delete notification. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNotificationClick = (notification, e) => {
    // Don't navigate if clicking on action buttons
    if (e?.target?.closest('.notification-actions')) {
      return;
    }

    // Mark as read
    if (!notification.isRead) {
      const notificationId = typeof notification._id === 'object' 
        ? notification._id.toString() 
        : notification._id;
      handleMarkAsRead(notificationId);
    }
    
    // Helper to build URL with project parameter
    const buildUrl = (baseUrl, hasQuery = false) => {
      if (!currentProjectId) return baseUrl;
      const separator = hasQuery ? '&' : '?';
      return `${baseUrl}${separator}projectId=${currentProjectId}`;
    };
    
    // Navigate to related item if available
    if (notification.relatedModel && notification.relatedId) {
      // Convert ObjectId to string if needed
      const relatedId = typeof notification.relatedId === 'object' 
        ? notification.relatedId.toString() 
        : notification.relatedId;
        
      if (notification.relatedModel === 'MATERIAL') {
        router.push(buildUrl(`/items/${relatedId}`));
      } else if (notification.relatedModel === 'EXPENSE') {
        router.push(buildUrl(`/expenses/${relatedId}`));
      } else if (notification.relatedModel === 'INITIAL_EXPENSE') {
        router.push(buildUrl(`/initial-expenses/${relatedId}`));
      } else if (notification.relatedModel === 'PROJECT') {
        router.push(`/projects/${relatedId}`);
      } else if (notification.relatedModel === 'MATERIAL_REQUEST') {
        // Navigate to approvals page with material requests tab
        router.push(buildUrl('/dashboard/approvals?tab=material-requests', true));
      } else if (notification.relatedModel === 'PURCHASE_ORDER') {
        // Navigate to purchase order detail page
        router.push(buildUrl(`/purchase-orders/${relatedId}`));
      } else if (notification.relatedModel === 'PROFESSIONAL_FEE') {
        router.push(buildUrl('/dashboard/approvals?tab=professional-fees', true));
      } else if (notification.relatedModel === 'PROFESSIONAL_ACTIVITY') {
        router.push(buildUrl('/dashboard/approvals?tab=professional-activities', true));
      } else if (notification.relatedModel === 'BUDGET_REALLOCATION') {
        router.push(buildUrl('/dashboard/approvals?tab=budget-reallocations', true));
      } else if (notification.relatedModel === 'LABOUR_ENTRY') {
        router.push(buildUrl('/dashboard/approvals?tab=labour-entries', true));
      } else if (notification.relatedModel === 'CONTINGENCY_DRAW') {
        router.push(buildUrl('/dashboard/approvals?tab=contingency-draws', true));
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
    
    setIsOpen(false);
  };

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
      default:
        return 'ℹ️';
    }
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const then = new Date(date);
    const diffInSeconds = Math.floor((now - then) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return then.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 ds-text-muted hover:ds-text-muted hover:ds-bg-surface-muted rounded-md transition-colors"
        aria-label="Notifications"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full ds-bg-danger ring-2 ring-ds-bg-app ds-bg-surface-muted ds-text-secondary"></span>
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 ds-bg-danger  text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center ds-bg-surface-muted ds-text-secondary">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 ds-bg-surface rounded-lg shadow-lg border ds-border-subtle z-50 max-h-96 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b ds-border-subtle flex items-center justify-between">
            <h3 className="text-sm font-semibold ds-text-primary">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs ds-text-accent-primary hover:ds-text-accent-hover font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="px-4 py-2 ds-bg-danger/10 border-b ds-border-danger/40 ds-text-danger text-xs flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => {
                  setError(null);
                  fetchNotifications();
                }}
                className="ml-2 underline font-medium hover:ds-text-danger"
              >
                Retry
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center">
                <LoadingSpinner size="sm" text="Loading..." />
              </div>
            ) : error && notifications.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm ds-text-muted mb-2">Failed to load notifications</p>
                <button
                  onClick={() => {
                    setError(null);
                    fetchNotifications();
                  }}
                  className="text-xs ds-text-accent-primary hover:ds-text-accent-hover font-medium"
                >
                  Retry
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center ds-text-muted">
                <p className="text-sm">No notifications</p>
                {currentProjectId && (
                  <p className="text-xs mt-1">for the current project</p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-ds-border-subtle">
                {notifications.map((notification) => {
                  const notificationId = typeof notification._id === 'object' 
                    ? notification._id.toString() 
                    : notification._id;
                  const isLoading = actionLoading[notificationId] || false;
                  
                  return (
                    <div
                      key={notification._id}
                      className={`px-4 py-3 hover:ds-bg-surface-muted transition-colors ${
                        !notification.isRead ? 'bg-blue-500/10 border-l-4 border-l-blue-500/40' : ''
                      } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <button
                        onClick={(e) => handleNotificationClick(notification, e)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-lg flex-shrink-0">
                            {getNotificationIcon(notification.type)}
                          </span>
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
                            <p className="text-xs ds-text-muted mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs ds-text-muted mt-1">
                              {formatTimeAgo(notification.createdAt)}
                            </p>
                          </div>
                          {!notification.isRead && (
                            <span className="flex-shrink-0 w-2 h-2 rounded-full ds-bg-accent-primary mt-2"></span>
                          )}
                        </div>
                      </button>
                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-2 notification-actions" onClick={(e) => e.stopPropagation()}>
                        {!notification.isRead ? (
                          <button
                            onClick={() => handleMarkAsRead(notificationId)}
                            disabled={isLoading}
                            className="text-xs ds-text-accent-primary hover:ds-text-accent-hover font-medium disabled:ds-text-muted"
                          >
                            Mark as read
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarkAsUnread(notificationId)}
                            disabled={isLoading}
                            className="text-xs ds-text-secondary hover:ds-text-primary font-medium disabled:ds-text-muted"
                          >
                            Mark as unread
                          </button>
                        )}
                        <span className="ds-text-muted">•</span>
                        <button
                          onClick={() => handleDeleteNotification(notificationId)}
                          disabled={isLoading}
                          className="text-xs ds-text-danger hover:ds-text-danger font-medium disabled:ds-text-muted"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t ds-border-subtle">
              <Link
                href={currentProjectId 
                  ? `/dashboard/notifications?projectId=${currentProjectId}`
                  : '/dashboard/notifications'}
                className="text-xs ds-text-accent-primary hover:ds-text-accent-hover font-medium text-center block"
                onClick={() => setIsOpen(false)}
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Mark All as Read Confirmation Modal */}
      <ConfirmationModal
        isOpen={showMarkAllModal}
        onClose={() => !isMarkingAll && setShowMarkAllModal(false)}
        onConfirm={handleMarkAllAsReadConfirm}
        title="Mark All as Read"
        message={
          <>
            <p className="mb-3">
              Are you sure you want to mark all {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''} as read?
            </p>
            {currentProjectId && (
              <p className="text-sm ds-text-secondary">
                This will mark all unread notifications for the current project as read.
              </p>
            )}
          </>
        }
        confirmText="Mark All as Read"
        cancelText="Cancel"
        variant="info"
        isLoading={isMarkingAll}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <ConfirmationModal
          isOpen={!!showDeleteModal}
          onClose={() => !isDeleting && setShowDeleteModal(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Notification"
          message={
            <>
              <p className="mb-3">
                Are you sure you want to delete this notification?
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
      )}
    </div>
  );
}

export default NotificationBell;

