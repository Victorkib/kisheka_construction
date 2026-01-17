/**
 * Service Worker for Push Notifications
 * Handles push notifications and offline functionality
 *
 * This service worker:
 * - Receives push notifications
 * - Handles notification clicks
 * - Caches essential resources for offline use
 * - Processes notification actions (Accept/Reject buttons)
 */

const CACHE_NAME = 'kisheka-v1';
const urlsToCache = ['/', '/icon-192x192.png', '/badge-72x72.png'];

// Install event - cache resources
self.addEventListener('install', (event) => {
  try {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache) => {
          console.log('[Service Worker] Caching resources');
          return cache.addAll(urlsToCache);
        })
        .catch((error) => {
          console.error('[Service Worker] Cache error:', error);
        })
    );
    self.skipWaiting();
  } catch (error) {
    console.error('[Service Worker] Install error:', error);
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  try {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
      caches
        .keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames
              .filter((cacheName) => cacheName !== CACHE_NAME)
              .map((cacheName) => {
                console.log('[Service Worker] Deleting old cache:', cacheName);
                return caches.delete(cacheName);
              })
          );
        })
        .then(() => self.clients.claim())
        .catch((error) => {
          console.error('[Service Worker] Activation error:', error);
        })
    );
  } catch (error) {
    console.error('[Service Worker] Activate handler error:', error);
  }
});

// Push notification received
self.addEventListener('push', (event) => {
  try {
    console.log('[Service Worker] Push notification received');

    let notificationData = {
      title: 'Doshaki Construction',
      message: 'You have a new notification',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: {},
      actions: [],
    };

    if (event.data) {
      try {
        const data = event.data.json();
        notificationData = {
          title: data.title || notificationData.title,
          message: data.message || notificationData.message,
          icon: data.icon || notificationData.icon,
          badge: data.badge || notificationData.badge,
          data: data.data || {},
          actions: data.actions || [],
          requireInteraction: true,
          tag: data.data?.purchaseOrderId || 'default',
          timestamp: data.timestamp || Date.now(),
        };
      } catch (parseError) {
        console.error('[Service Worker] Error parsing push data:', parseError);
        notificationData.message =
          event.data.text() || notificationData.message;
      }
    }

    event.waitUntil(
      self.registration.showNotification(notificationData.title, {
        body: notificationData.message,
        icon: notificationData.icon,
        badge: notificationData.badge,
        data: notificationData.data,
        actions: notificationData.actions,
        requireInteraction: notificationData.requireInteraction,
        tag: notificationData.tag,
        timestamp: notificationData.timestamp,
      })
    );
  } catch (error) {
    console.error('[Service Worker] Push handler error:', error);
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  try {
    console.log(
      '[Service Worker] Notification clicked:',
      event.notification.tag
    );

    event.notification.close();

    const action = event.action;
    const data = event.notification.data || {};

    // Helper function to open or navigate to window
    const openOrNavigate = (url) => {
      return clients
        .matchAll({ type: 'window' })
        .then((clientList) => {
          if (clientList.length > 0) {
            return clientList[0].navigate(url);
          }
          return clients.openWindow(url);
        })
        .catch(() => clients.openWindow('/'));
    };

    // Handle action buttons
    if (action === 'accept' && data.purchaseOrderId && data.token) {
      event.waitUntil(
        fetch(`/api/purchase-orders/${data.purchaseOrderId}/confirm-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'accept',
            token: data.token,
            subscriptionEndpoint: data.subscriptionEndpoint,
          }),
        })
          .then((response) => response.json())
          .then((result) => {
            if (result.success) {
              return self.registration.showNotification('Order Confirmed', {
                body: 'Purchase order has been accepted successfully',
                icon: '/icon-192x192.png',
                badge: '/badge-72x72.png',
                tag: `confirm-${data.purchaseOrderId}`,
                data: { url: `/purchase-orders/${data.purchaseOrderId}` },
              });
            } else {
              return self.registration.showNotification('Confirmation Failed', {
                body:
                  result.error || 'Failed to confirm order. Please try again.',
                icon: '/icon-192x192.png',
                badge: '/badge-72x72.png',
                tag: `error-${data.purchaseOrderId}`,
              });
            }
          })
          .catch((error) => {
            console.error('[Service Worker] Error confirming order:', error);
            return self.registration.showNotification('Error', {
              body: 'Failed to confirm order. Please try again later.',
              icon: '/icon-192x192.png',
              badge: '/badge-72x72.png',
            });
          })
      );
    } else if (action === 'reject' && data.purchaseOrderId && data.token) {
      event.waitUntil(
        openOrNavigate(`/purchase-orders/respond/${data.token}?action=reject`)
      );
    } else if (action === 'view' && data.url) {
      event.waitUntil(openOrNavigate(data.url));
    } else if (data.url) {
      event.waitUntil(openOrNavigate(data.url));
    } else if (data.purchaseOrderId && data.token) {
      event.waitUntil(openOrNavigate(`/purchase-orders/respond/${data.token}`));
    } else {
      event.waitUntil(
        clients
          .matchAll({ type: 'window' })
          .then((clientList) => {
            if (clientList.length > 0) {
              return clientList[0].focus();
            }
            return clients.openWindow('/');
          })
          .catch(() => clients.openWindow('/'))
      );
    }
  } catch (error) {
    console.error('[Service Worker] Notification click handler error:', error);
  }
});

// Background sync (for offline actions)
self.addEventListener('sync', (event) => {
  try {
    console.log('[Service Worker] Background sync:', event.tag);

    if (event.tag === 'sync-push-subscription') {
      event.waitUntil(syncPushSubscription());
    }
  } catch (error) {
    console.error('[Service Worker] Sync handler error:', error);
  }
});

// Sync push subscription when back online
async function syncPushSubscription() {
  try {
    console.log('[Service Worker] Syncing push subscription');
    // Implementation depends on your specific needs
  } catch (error) {
    console.error('[Service Worker] Sync push subscription error:', error);
  }
}

// Message handler (for communication from pages)
self.addEventListener('message', (event) => {
  try {
    console.log('[Service Worker] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  } catch (error) {
    console.error('[Service Worker] Message handler error:', error);
  }
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
  try {
    console.error(
      '[Service Worker] Unhandled promise rejection:',
      event.reason
    );
    event.preventDefault();
  } catch (error) {
    console.error('[Service Worker] Unhandled rejection handler error:', error);
  }
});
