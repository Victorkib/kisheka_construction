/**
 * Notifications Page Client
 * Full notifications management page
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { NotificationList } from '@/components/notifications/notification-list';
import { NotificationFilters } from '@/components/notifications/notification-filters';
import { useProjectContext } from '@/contexts/ProjectContext';
import { ConfirmationModal } from '@/components/modals/confirmation-modal';

export default function NotificationsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentProjectId } = useProjectContext();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMarkAllModal, setShowMarkAllModal] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [filters, setFilters] = useState({
    projectId: undefined, // Add project filter
    isRead: undefined,
    type: undefined,
    search: undefined,
  });
  const prevFiltersStringRef = useRef(null);
  const hasInitializedRef = useRef(false);

  // Fetch notifications function
  const fetchNotifications = useCallback(
    async (filtersToUse) => {
      try {
        setLoading(true);
        setError(null);

        // Build query string
        const params = new URLSearchParams();
        // Use projectId from filters, or fall back to currentProjectId from context
        const projectId = filtersToUse.projectId !== undefined 
          ? filtersToUse.projectId 
          : currentProjectId;
        
        // Validate projectId format if provided
        if (projectId) {
          const isValidProjectId = /^[a-f\d]{24}$/i.test(projectId);
          if (isValidProjectId) {
            params.append('projectId', projectId);
          } else {
            console.warn('Invalid projectId format, skipping project filter:', projectId);
          }
        }
        
        if (filtersToUse.isRead !== undefined) {
          params.append('isRead', filtersToUse.isRead.toString());
        }
        if (filtersToUse.type && filtersToUse.type !== 'all') {
          params.append('type', filtersToUse.type);
        }
        if (filtersToUse.search && filtersToUse.search.trim()) {
          params.append('search', filtersToUse.search.trim());
        }
        params.append('limit', '500');

        const response = await fetch(`/api/notifications?${params.toString()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/login');
            return;
          } else if (response.status === 403) {
            throw new Error('Access denied to this project.');
          } else if (response.status >= 500) {
            throw new Error('Server error. Please try again later.');
          } else {
            throw new Error(`Failed to load: ${response.status} ${response.statusText}`);
          }
        }

        const data = await response.json();

        if (!data.success) {
          if (data.error === 'Unauthorized') {
            router.push('/auth/login');
            return;
          }
          throw new Error(data.error || 'Failed to load notifications');
        }

        // Validate and set data
        const notifications = Array.isArray(data.data?.notifications) 
          ? data.data.notifications 
          : [];
        const unreadCount = typeof data.data?.unreadCount === 'number' 
          ? Math.max(0, data.data.unreadCount) 
          : 0;

        setNotifications(notifications);
        setUnreadCount(unreadCount);
      } catch (err) {
        console.error('Error fetching notifications:', err);
        setError(err.message || 'Failed to load notifications');
        // Keep existing notifications on error if available (graceful degradation)
        if (notifications.length === 0) {
          setNotifications([]);
          setUnreadCount(0);
        }
      } finally {
        setLoading(false);
      }
    },
    [router, currentProjectId]
  );

  // Initialize filters from URL params and fetch on mount (only once)
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const projectIdParam = searchParams.get('projectId');
    const isReadParam = searchParams.get('isRead');
    const typeParam = searchParams.get('type');
    const searchParam = searchParams.get('search');

    const initialFilters = {
      projectId: projectIdParam || currentProjectId || undefined,
      isRead:
        isReadParam === 'true'
          ? true
          : isReadParam === 'false'
          ? false
          : undefined,
      type: typeParam || undefined,
      search: searchParam || undefined,
    };

    setFilters(initialFilters);
    prevFiltersStringRef.current = JSON.stringify(initialFilters);

    // Fetch immediately with initial filters
    fetchNotifications(initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Update filters when project context changes
  useEffect(() => {
    if (!hasInitializedRef.current) return;
    
    // Only update if currentProjectId changed and no explicit projectId in filters
    if (currentProjectId && filters.projectId !== currentProjectId) {
      setFilters((prev) => {
        // Only update if projectId wasn't explicitly set by user
        if (prev.projectId === undefined || prev.projectId === null) {
          return { ...prev, projectId: currentProjectId };
        }
        return prev;
      });
    }
  }, [currentProjectId, filters.projectId]);

  // Fetch notifications when filters change (but only if they actually changed)
  useEffect(() => {
    if (!hasInitializedRef.current) return; // Skip if not initialized yet

    const filtersString = JSON.stringify(filters);

    // Only fetch if filters actually changed
    if (prevFiltersStringRef.current === filtersString) {
      return;
    }

    prevFiltersStringRef.current = filtersString;
    fetchNotifications(filters);
  }, [filters, fetchNotifications]);

  const handleFilterChange = useCallback(
    (newFilters) => {
      setFilters((prev) => {
        const updated = { ...prev, ...newFilters };
        // Update URL immediately when user changes filters
        const newParams = new URLSearchParams();
        if (updated.projectId) {
          newParams.append('projectId', updated.projectId);
        }
        if (updated.isRead !== undefined) {
          newParams.append('isRead', updated.isRead.toString());
        }
        if (updated.type) {
          newParams.append('type', updated.type);
        }
        if (updated.search) {
          newParams.append('search', updated.search);
        }
        const newUrl = newParams.toString()
          ? `/dashboard/notifications?${newParams.toString()}`
          : '/dashboard/notifications';
        router.replace(newUrl, { scroll: false });
        return updated;
      });
    },
    [router]
  );

  const handleClearFilters = useCallback(() => {
    setFilters({
      projectId: currentProjectId || undefined, // Keep current project when clearing
      isRead: undefined,
      type: undefined,
      search: undefined,
    });
    const url = currentProjectId 
      ? `/dashboard/notifications?projectId=${currentProjectId}`
      : '/dashboard/notifications';
    router.replace(url, { scroll: false });
  }, [router, currentProjectId]);

  const handleMarkRead = async (notificationId) => {
    try {
      // Convert ObjectId to string if needed
      const id = typeof notificationId === 'object' 
        ? notificationId.toString() 
        : notificationId;
      
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (response.ok) {
        // Update local state
        setNotifications((prev) =>
          prev.map((n) => {
            const nId = typeof n._id === 'object' ? n._id.toString() : n._id;
            return nId === id
              ? { ...n, isRead: true, readAt: new Date() }
              : n;
          })
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } else {
        throw new Error('Failed to mark as read');
      }
    } catch (err) {
      console.error('Error marking as read:', err);
      throw err;
    }
  };

  const handleMarkUnread = async (notificationId) => {
    try {
      // Convert ObjectId to string if needed
      const id = typeof notificationId === 'object' 
        ? notificationId.toString() 
        : notificationId;
      
      const response = await fetch(`/api/notifications/${id}/unread`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (response.ok) {
        // Update local state
        setNotifications((prev) =>
          prev.map((n) => {
            const nId = typeof n._id === 'object' ? n._id.toString() : n._id;
            return nId === id
              ? { ...n, isRead: false, readAt: null }
              : n;
          })
        );
        setUnreadCount((prev) => prev + 1);
      } else {
        throw new Error('Failed to mark as unread');
      }
    } catch (err) {
      console.error('Error marking as unread:', err);
      throw err;
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      // Convert ObjectId to string if needed
      const id = typeof notificationId === 'object' 
        ? notificationId.toString() 
        : notificationId;
      
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (response.ok) {
        // Remove from local state
        const deleted = notifications.find((n) => {
          const nId = typeof n._id === 'object' ? n._id.toString() : n._id;
          return nId === id;
        });
        setNotifications((prev) =>
          prev.filter((n) => {
            const nId = typeof n._id === 'object' ? n._id.toString() : n._id;
            return nId !== id;
          })
        );
        if (deleted && !deleted.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        throw new Error('Failed to delete notification');
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      throw err;
    }
  };

  const handleMarkAllAsRead = () => {
    // Show confirmation modal
    setShowMarkAllModal(true);
  };

  const handleMarkAllAsReadConfirm = async () => {
    setIsMarkingAll(true);
    try {
      // Use projectId from filters or currentProjectId from context
      const projectId = filters.projectId !== undefined 
        ? filters.projectId 
        : currentProjectId;
      
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          projectId: projectId || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update all notifications to read
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
        );
        setUnreadCount(0);
        setShowMarkAllModal(false);
      } else {
        throw new Error(data.error || 'Failed to mark all as read');
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
      setError('Failed to mark all notifications as read: ' + (err.message || 'Unknown error'));
      setShowMarkAllModal(false);
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold ds-text-primary">
              Notifications
            </h1>
            <p className="ds-text-secondary mt-1">
              {unreadCount > 0
                ? `${unreadCount} unread notification${
                    unreadCount !== 1 ? 's' : ''
                  }`
                : 'All caught up!'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 ds-bg-accent-primary text-white rounded-lg hover:ds-bg-accent-hover transition font-medium"
            >
              Mark All as Read
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 ds-bg-danger/10 border ds-border-danger/40 ds-text-danger px-4 py-3 rounded text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchNotifications(filters)}
              className="ml-4 ds-text-danger underline font-medium hover:ds-text-danger"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Filters */}
        <NotificationFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />

        {/* Notifications List */}
        <NotificationList
          notifications={notifications}
          onMarkRead={handleMarkRead}
          onMarkUnread={handleMarkUnread}
          onDelete={handleDelete}
          loading={loading}
          filters={filters}
        />

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
              {filters.projectId && (
                <p className="text-sm ds-text-secondary">
                  This will mark all unread notifications for the selected project as read.
                </p>
              )}
              {!filters.projectId && currentProjectId && (
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
      </div>
    </AppLayout>
  );
}
