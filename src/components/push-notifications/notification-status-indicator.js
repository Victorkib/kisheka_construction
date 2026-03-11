'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, Ban, CheckCircle2, WifiOff } from 'lucide-react';

/**
 * Notification Status Indicator
 *
 * Shows the current status of browser notifications
 * - Green check if enabled and subscribed
 * - Yellow warning if permission denied
 * - Gray if browser doesn't support notifications
 *
 * Can be placed in header or settings
 * Used in:
 * - Header component
 * - Profile/Settings page
 */
export function NotificationStatusIndicator({ showLabel = true, size = 'md' }) {
  const [permission, setPermission] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check notification status on mount
  useEffect(() => {
    let isMounted = true;

    const checkNotificationStatus = async () => {
      try {
        if (typeof window === 'undefined' || !('Notification' in window)) {
          if (isMounted) {
            setPermission('unsupported');
            setIsLoading(false);
          }
          return;
        }

        // Get browser permission
        const browserPermission = Notification.permission;
        let isCurrentlySubscribed = false;

        // Check if actually subscribed to push
        if (browserPermission === 'granted' && 'serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.ready;
            const subscription =
              await registration.pushManager.getSubscription();
            isCurrentlySubscribed = !!subscription;
          } catch (err) {
            console.log(
              '[Notifications] Could not check subscription:',
              err.message
            );
            isCurrentlySubscribed = false;
          }
        }

        // Only update state if component is still mounted
        if (isMounted) {
          setPermission(browserPermission);
          setIsSubscribed(isCurrentlySubscribed);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[Notifications] Error checking status:', err);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Call the function to check status
    checkNotificationStatus();

    // Listen for storage changes (from other tabs)
    const handleStorageChange = () => {
      checkNotificationStatus();
    };

    window.addEventListener('storage', handleStorageChange);

    // Cleanup function
    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Render based on size
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const iconSize = sizeClasses[size] || sizeClasses.md;

  // Don't render anything for unsupported browsers
  if (permission === 'unsupported') {
    return null;
  }

  // Determine icon and color
  let icon = null;
  let color = 'ds-text-muted';
  let bgColor = 'ds-bg-surface-muted';
  let label = 'Notifications disabled';
  let tooltip = 'Browser notifications not enabled';

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className={`${iconSize} rounded-full ds-bg-surface-muted animate-pulse`} />
      </div>
    );
  }

  if (permission === 'granted' && isSubscribed) {
    icon = <Zap className={iconSize} />;
    color = 'ds-text-success';
    bgColor = 'ds-bg-success/10';
    label = 'Push enabled';
    tooltip = 'Push notifications active';
  } else if (permission === 'denied') {
    icon = <Ban className={iconSize} />;
    color = 'ds-text-warning';
    bgColor = 'ds-bg-warning/10';
    label = 'Push blocked';
    tooltip = 'Enable push notifications in settings';
  } else if (permission === 'granted' && !isSubscribed) {
    icon = <CheckCircle2 className={iconSize} />;
    color = 'ds-text-accent-primary';
    bgColor = 'ds-bg-accent-subtle';
    label = 'Push pending';
    tooltip = 'Initializing push notifications...';
  } else {
    icon = <WifiOff className={iconSize} />;
    color = 'ds-text-muted';
    bgColor = 'ds-bg-surface-muted';
    label = 'Push disabled';
    tooltip = 'Enable push to get alerts';
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bgColor} ${color}`}
      title={tooltip}
    >
      {icon}
      {showLabel && (
        <span className="text-xs font-medium ds-text-secondary hidden sm:inline">
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * Notification Status Card
 *
 * Larger version for settings/profile page
 * Shows detailed status with action buttons
 */
export function NotificationStatusCard({ onRefresh }) {
  const [permission, setPermission] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);

  // Define checkStatus with useCallback to avoid recreating on every render
  const checkStatus = useCallback(async () => {
    let isMounted = true;

    try {
      // Check if component is still mounted before making state updates
      if (!('Notification' in window)) {
        if (isMounted) {
          setPermission('unsupported');
          setIsLoading(false);
        }
        return;
      }

      const browserPermission = Notification.permission;
      let currentSubscription = null;
      let subscriptionData = null;

      if (browserPermission === 'granted' && 'serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          currentSubscription =
            await registration.pushManager.getSubscription();

          if (currentSubscription) {
            subscriptionData = {
              endpoint: currentSubscription.endpoint,
              expirationTime: currentSubscription.expirationTime,
            };
          }
        } catch (err) {
          console.error('[Notifications] Error checking subscription:', err);
        }
      }

      // Only update state if component is still mounted
      if (isMounted) {
        setPermission(browserPermission);
        setIsSubscribed(!!currentSubscription);
        setSubscriptionInfo(subscriptionData);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('[Notifications] Error checking status:', err);
      if (isMounted) {
        setIsLoading(false);
      }
    }

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // Call the async function from within the effect
    // This avoids calling setState synchronously in the effect body
    const performCheck = async () => {
      await checkStatus();
    };

    performCheck();
  }, [checkStatus]);

  const handleRefresh = async () => {
    await checkStatus();
    onRefresh?.();
  };

  const handleUnsubscribe = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await subscription.unsubscribe();

          // Remove from server
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: subscription.endpoint,
            }),
          });

          setIsSubscribed(false);
          localStorage.removeItem('push-subscription-status');
          localStorage.removeItem('push-subscription-endpoint');
          console.log('[Notifications] Unsubscribed from push notifications');
        }
      }
    } catch (err) {
      console.error('[Notifications] Error unsubscribing:', err);
    }
  };

  if (permission === 'unsupported') {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-6 border ds-border-subtle">
        <h3 className="text-lg font-semibold ds-text-primary mb-2">
          Browser Notifications
        </h3>
        <p className="ds-text-secondary">
          Your browser does not support push notifications.
        </p>
      </div>
    );
  }

  const getStatusColor = () => {
    if (permission === 'granted' && isSubscribed) return 'ds-text-success';
    if (permission === 'denied') return 'ds-text-warning';
    return 'ds-text-secondary';
  };

  const getStatusText = () => {
    if (permission === 'granted' && isSubscribed)
      return 'Notifications Enabled';
    if (permission === 'granted' && !isSubscribed) return 'Setting Up...';
    if (permission === 'denied') return 'Notifications Blocked';
    return 'Not Configured';
  };

  return (
    <div className="ds-bg-surface rounded-lg shadow p-6 border ds-border-subtle">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold ds-text-primary">
            Browser Notifications
          </h3>
          <p className={`text-sm font-medium mt-1 ${getStatusColor()}`}>
            {getStatusText()}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="ds-text-secondary hover:ds-text-primary disabled:opacity-50"
          title="Refresh status"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Status details */}
      <div className="space-y-3 mb-4 text-sm ds-text-secondary">
        <div className="flex items-center gap-2">
          <span>Permission:</span>
          <span className="font-mono ds-text-primary">
            {permission || 'checking...'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span>Subscribed:</span>
          <span className="font-mono ds-text-primary">
            {isLoading ? 'checking...' : isSubscribed ? 'Yes' : 'No'}
          </span>
        </div>

        {subscriptionInfo && (
          <div className="text-xs ds-bg-surface-muted p-2 rounded break-all">
            <p className="font-semibold ds-text-secondary mb-1">Endpoint:</p>
            <p className="font-mono ds-text-secondary">
              {subscriptionInfo.endpoint.substring(0, 60)}...
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {permission === 'granted' && isSubscribed && (
          <button
            onClick={handleUnsubscribe}
            className="px-4 py-2 ds-bg-danger/10 ds-text-danger hover:ds-bg-danger/20 text-sm font-medium rounded-lg transition"
          >
            Disable Notifications
          </button>
        )}

        {permission === 'denied' && (
          <p className="text-sm ds-text-warning">
            You can enable notifications by changing your browser&apos;s
            notification settings.
          </p>
        )}
      </div>
    </div>
  );
}
