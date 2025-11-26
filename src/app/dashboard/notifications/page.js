/**
 * Notifications Page
 * Full notifications management page
 * Route: /dashboard/notifications
 * Auth: All authenticated users
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { NotificationList } from '@/components/notifications/notification-list';
import { NotificationFilters } from '@/components/notifications/notification-filters';

export default function NotificationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    isRead: undefined,
    type: undefined,
    search: undefined,
  });
  const prevFiltersStringRef = useRef(null);
  const hasInitializedRef = useRef(false);

  // Fetch notifications function
  const fetchNotifications = useCallback(async (filtersToUse) => {
    try {
      setLoading(true);
      setError(null);

      // Build query string
      const params = new URLSearchParams();
      if (filtersToUse.isRead !== undefined) {
        params.append('isRead', filtersToUse.isRead.toString());
      }
      if (filtersToUse.type) {
        params.append('type', filtersToUse.type);
      }
      if (filtersToUse.search) {
        params.append('search', filtersToUse.search);
      }
      params.append('limit', '500');

      const response = await fetch(`/api/notifications?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        if (data.error === 'Unauthorized' || response.status === 401) {
          router.push('/auth/login');
          return;
        }
        throw new Error(data.error || 'Failed to load notifications');
      }

      setNotifications(data.data.notifications || []);
      setUnreadCount(data.data.unreadCount || 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Initialize filters from URL params and fetch on mount (only once)
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const isReadParam = searchParams.get('isRead');
    const typeParam = searchParams.get('type');
    const searchParam = searchParams.get('search');

    const initialFilters = {
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

  const handleFilterChange = useCallback((newFilters) => {
    setFilters((prev) => {
      const updated = { ...prev, ...newFilters };
      // Update URL immediately when user changes filters
      const newParams = new URLSearchParams();
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
  }, [router]);

  const handleClearFilters = useCallback(() => {
    setFilters({
      isRead: undefined,
      type: undefined,
      search: undefined,
    });
    router.replace('/dashboard/notifications', { scroll: false });
  }, [router]);

  const handleMarkRead = async (notificationId) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      });

      if (response.ok) {
        // Update local state
        setNotifications((prev) =>
          prev.map((n) => {
            const nId = typeof n._id === 'object' ? n._id.toString() : n._id;
            return nId === notificationId ? { ...n, isRead: true, readAt: new Date() } : n;
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
      const response = await fetch(`/api/notifications/${notificationId}/unread`, {
        method: 'PATCH',
      });

      if (response.ok) {
        // Update local state
        setNotifications((prev) =>
          prev.map((n) => {
            const nId = typeof n._id === 'object' ? n._id.toString() : n._id;
            return nId === notificationId ? { ...n, isRead: false, readAt: null } : n;
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
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove from local state
        const deleted = notifications.find((n) => {
          const nId = typeof n._id === 'object' ? n._id.toString() : n._id;
          return nId === notificationId;
        });
        setNotifications((prev) => 
          prev.filter((n) => {
            const nId = typeof n._id === 'object' ? n._id.toString() : n._id;
            return nId !== notificationId;
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

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        // Update all notifications to read
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
        );
        setUnreadCount(0);
      } else {
        throw new Error('Failed to mark all as read');
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
      alert('Failed to mark all notifications as read');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Notifications
            </h1>
            <p className="text-gray-700 mt-1">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                : 'All caught up!'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Mark All as Read
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error}
            <button
              onClick={() => fetchNotifications(filters)}
              className="ml-4 text-red-800 underline font-medium"
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
        />
      </div>
    </AppLayout>
  );
}

