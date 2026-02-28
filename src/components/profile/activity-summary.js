/**
 * Activity Summary Component
 * Displays user activity statistics and recent activity
 */

'use client';

import { useState, useEffect } from 'react';

export function ActivitySummary({ user }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.metadata) {
      setStats({
        loginCount: user.metadata.loginCount || 0,
        lastActivityAt: user.metadata.lastActivityAt,
      });
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [user]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now - date) / 1000);

      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600)
        return `${Math.floor(diffInSeconds / 60)} minutes ago`;
      if (diffInSeconds < 86400)
        return `${Math.floor(diffInSeconds / 3600)} hours ago`;
      if (diffInSeconds < 604800)
        return `${Math.floor(diffInSeconds / 86400)} days ago`;
      return formatDate(dateString);
    } catch {
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-6 mb-6 border ds-border-subtle">
        <h2 className="text-xl font-semibold ds-text-primary mb-4">
          Activity Summary
        </h2>
        <div className="animate-pulse space-y-4">
          <div className="h-4 ds-bg-surface-muted rounded w-3/4"></div>
          <div className="h-4 ds-bg-surface-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-bg-surface rounded-lg shadow p-6 mb-6 border ds-border-subtle">
      <h2 className="text-xl font-semibold ds-text-primary mb-4">
        Activity Summary
      </h2>

      <div className="space-y-4">
        {/* Login Count */}
        <div className="flex items-center justify-between py-3 border-b ds-border-subtle">
          <div>
            <p className="text-sm font-medium ds-text-secondary">Total Logins</p>
            <p className="text-xs ds-text-muted mt-1">
              Number of times you've logged in
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold ds-text-primary">
              {stats?.loginCount || 0}
            </p>
          </div>
        </div>

        {/* Last Login */}
        <div className="flex items-center justify-between py-3 border-b ds-border-subtle">
          <div>
            <p className="text-sm font-medium ds-text-secondary">Last Login</p>
            <p className="text-xs ds-text-muted mt-1">
              {user?.lastLogin
                ? formatTimeAgo(user.lastLogin)
                : 'Never logged in'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm ds-text-primary">
              {user?.lastLogin ? formatDate(user.lastLogin) : 'N/A'}
            </p>
          </div>
        </div>

        {/* Last Activity */}
        {stats?.lastActivityAt && (
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium ds-text-secondary">Last Activity</p>
              <p className="text-xs ds-text-muted mt-1">
                {formatTimeAgo(stats.lastActivityAt)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm ds-text-primary">
                {formatDate(stats.lastActivityAt)}
              </p>
            </div>
          </div>
        )}

        {/* Account Age */}
        {user?.createdAt && (
          <div className="pt-3 border-t ds-border-subtle">
            <p className="text-sm font-medium ds-text-secondary mb-2">
              Account Age
            </p>
            <p className="text-sm ds-text-secondary">
              Member since {formatDate(user.createdAt)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}





























