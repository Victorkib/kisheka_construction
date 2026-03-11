'use client';

import { useState, useEffect } from 'react';
import { Bell, X, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Notification Permission Request Banner
 *
 * Displays a banner asking user to enable browser notifications
 * - Shows on first visit if permission not determined
 * - Can be dismissed (stored in localStorage)
 * - Handles permission request and subscription
 * - Shows status after permission is granted/denied
 */
export function NotificationPermissionRequest() {
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Check notification permission on component mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.log('[Notifications] Browser does not support notifications');
      return;
    }

    // Fetch current user to get userId
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const data = await response.json();
        if (data.success && data.data?._id) {
          setUserId(data.data._id);
        }
      } catch (err) {
        console.error('[Notifications] Error fetching user:', err);
      }
    };

    fetchUser();

    // Check if user has dismissed the banner
    const wasDismissed =
      localStorage.getItem('notification-banner-dismissed') === 'true';
    setIsDismissed(wasDismissed);

    // Get current permission status
    const currentStatus = Notification.permission;
    setPermissionStatus(currentStatus);

    const checkSubscription = async () => {
      if (currentStatus === 'granted' && 'serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setIsSubscribed(!!subscription);
          if (!subscription && !wasDismissed) {
            setShowBanner(true);
          }
        } catch (err) {
          console.error('[Notifications] Error checking subscription:', err);
        }
      }
    };

    // Show banner only if:
    // 1. Permission is not determined (never asked before), or
    // 2. Permission granted but not subscribed
    // 3. User hasn't dismissed it
    // 4. Service Worker is available
    if (
      ((currentStatus === 'default') ||
        (currentStatus === 'granted')) &&
      !wasDismissed &&
      'serviceWorker' in navigator
    ) {
      setShowBanner(true);
      checkSubscription();
    }
  }, []);

  // Request notification permission
  const handleRequestPermission = async () => {
    try {
      setIsSubscribing(true);
      setError(null);

      // Request notification permission from browser
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);

      if (permission === 'granted') {
        // Subscribe to push notifications
        await subscribeToPushNotifications();

        // Hide banner after successful subscription
        setShowBanner(false);

        // Show success message
        console.log('[Notifications] Successfully enabled notifications');
      } else if (permission === 'denied') {
        console.log('[Notifications] User denied notification permission');
        // Keep banner visible so user can see the denied state
        setShowBanner(true);
      }
    } catch (err) {
      console.error('[Notifications] Error requesting permission:', err);
      setError('Failed to enable notifications. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

  // Subscribe browser to push notifications
  const subscribeToPushNotifications = async () => {
    try {
      setIsSubscribing(true);
      setError(null);

      if (!window.isSecureContext) {
        throw new Error(
          'Push notifications require HTTPS or localhost. Please use a secure origin.'
        );
      }

      if (!userId) {
        const response = await fetch('/api/auth/me', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const data = await response.json();
        if (data.success && data.data?._id) {
          setUserId(data.data._id);
        } else {
          throw new Error('User ID is required to enable notifications');
        }
      }

      // Get Service Worker registration
      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      const existingSubscription =
        await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('[Notifications] Already subscribed to push notifications');
        setIsSubscribed(true);
        return;
      }

      // Get VAPID public key from environment
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error(
          'VAPID public key is missing. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and restart the server.'
        );
      }

      // Convert VAPID key to Uint8Array
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      if (convertedVapidKey.length !== 65) {
        throw new Error(
          `Invalid VAPID public key length (${convertedVapidKey.length}). Regenerate keys and update env.`
        );
      }

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      console.log(
        '[Notifications] Push subscription created:',
        subscription.endpoint
      );

      // Send subscription to server with userId
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userType: 'user',
          userId: userId, // Include userId for authentication
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription');
      }

      const data = await response.json();
      console.log(
        '[Notifications] Subscription saved to server:',
        data.insertedId || data.message
      );

      // Store subscription info in localStorage
      localStorage.setItem('push-subscription-status', 'subscribed');
      localStorage.setItem('push-subscription-endpoint', subscription.endpoint);
      setIsSubscribed(true);
    } catch (err) {
      console.error('[Notifications] Error subscribing to push:', err);
      const message =
        err?.message ||
        'Push subscription failed. Check VAPID keys and secure origin.';
      setError(message);
      throw err;
    } finally {
      setIsSubscribing(false);
    }
  };

  // Dismiss banner
  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('notification-banner-dismissed', 'true');
    setIsDismissed(true);
  };

  // Allow user to reset dismissal and ask again
  const handleAskAgain = () => {
    localStorage.removeItem('notification-banner-dismissed');
    setIsDismissed(false);
    setShowBanner(true);
    setError(null);
  };

  // Don't render if banner is hidden
  if (!showBanner) {
    return null;
  }

  // Render different states based on permission status
  if (permissionStatus === 'granted' && isSubscribed) {
    return (
      <div className="ds-bg-success/10 border-b ds-border-success/40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 ds-text-success" />
            <p className="text-sm ds-text-success">
              <span className="font-semibold">Notifications enabled!</span> You
              {`'`}ll receive updates about purchase orders and approvals.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="ds-text-success hover:ds-text-success p-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (permissionStatus === 'granted' && !isSubscribed) {
    return (
      <div className="ds-bg-accent-subtle border-b ds-border-accent-subtle px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Bell className="w-5 h-5 ds-text-accent-primary flex-shrink-0" />
            <div>
              <p className="text-sm ds-text-primary">
                <span className="font-semibold">
                  Notifications are allowed but not enabled
                </span>
              </p>
              <p className="text-xs ds-text-secondary mt-1">
                Enable push notifications to receive real-time updates even when the app is inactive.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {error && (
              <div className="text-xs ds-text-danger ds-bg-danger/10 px-2 py-1 rounded">
                {error}
              </div>
            )}
            <button
              onClick={subscribeToPushNotifications}
              disabled={isSubscribing}
              className="px-4 py-1 ds-bg-accent-primary text-white text-sm font-medium rounded-lg hover:ds-bg-accent-hover disabled:ds-bg-surface-muted disabled:cursor-not-allowed transition"
            >
              {isSubscribing ? 'Enabling...' : 'Enable'}
            </button>
            <button
              onClick={handleDismiss}
              disabled={isSubscribing}
              className="ds-text-accent-primary hover:ds-text-accent-hover p-1 disabled:opacity-50"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (permissionStatus === 'denied') {
    return (
      <div className="ds-bg-warning/10 border-b ds-border-warning/40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 ds-text-warning" />
            <div>
              <p className="text-sm ds-text-warning">
                <span className="font-semibold">Notifications disabled</span>
              </p>
              <p className="text-xs ds-text-warning mt-1">
                Enable notifications in your browser settings to receive
                updates. You can{' '}
                <button
                  onClick={handleAskAgain}
                  className="underline font-semibold hover:ds-text-warning"
                >
                  try again
                </button>{' '}
                if you change your mind.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="ds-text-warning hover:ds-text-warning p-1 flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Default: permission not determined yet
  return (
    <div className="ds-bg-accent-subtle border-b ds-border-accent-subtle px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Bell className="w-5 h-5 ds-text-accent-primary flex-shrink-0" />
          <div>
            <p className="text-sm ds-text-primary">
              <span className="font-semibold">
                Stay updated with notifications
              </span>
            </p>
            <p className="text-xs ds-text-secondary mt-1">
              Get instant updates about purchase orders, approvals, and
              important actions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {error && (
            <div className="text-xs ds-text-danger ds-bg-danger/10 px-2 py-1 rounded">
              {error}
            </div>
          )}
          <button
            onClick={handleRequestPermission}
            disabled={isSubscribing}
            className="px-4 py-1 ds-bg-accent-primary text-white text-sm font-medium rounded-lg hover:ds-bg-accent-hover disabled:ds-bg-surface-muted disabled:cursor-not-allowed transition"
          >
            {isSubscribing ? 'Enabling...' : 'Enable'}
          </button>
          <button
            onClick={handleDismiss}
            disabled={isSubscribing}
            className="ds-text-accent-primary hover:ds-text-accent-hover p-1 disabled:opacity-50"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Convert VAPID public key from base64 to Uint8Array
 * Required for pushManager.subscribe()
 */
function urlBase64ToUint8Array(base64String) {
  try {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (error) {
    throw new Error('Invalid VAPID public key format (base64url expected).');
  }
}
