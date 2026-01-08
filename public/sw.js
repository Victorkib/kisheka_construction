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
const urlsToCache = [
  '/',
  '/icon-192x192.png',
  '/badge-72x72.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching resources');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[Service Worker] Cache error:', error);
      })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control of all pages
});

// Push notification received
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  
  let notificationData = {
    title: 'Doshaki Construction',
    message: 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: {},
    actions: []
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
        timestamp: data.timestamp || Date.now()
      };
    } catch (error) {
      console.error('[Service Worker] Error parsing push data:', error);
      notificationData.message = event.data.text() || notificationData.message;
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
      timestamp: notificationData.timestamp
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.notification.tag);
  
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  // Handle action buttons
  if (action === 'accept' && data.purchaseOrderId && data.token) {
    // Accept action - send confirmation to API
    event.waitUntil(
      fetch(`/api/purchase-orders/${data.purchaseOrderId}/confirm-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'accept',
          token: data.token,
          subscriptionEndpoint: data.subscriptionEndpoint
        })
      })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          // Show success notification
          return self.registration.showNotification('Order Confirmed', {
            body: 'Purchase order has been accepted successfully',
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            tag: `confirm-${data.purchaseOrderId}`,
            data: { url: `/purchase-orders/${data.purchaseOrderId}` }
          });
        } else {
          // Show error notification
          return self.registration.showNotification('Confirmation Failed', {
            body: result.error || 'Failed to confirm order. Please try again.',
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            tag: `error-${data.purchaseOrderId}`
          });
        }
      })
      .catch((error) => {
        console.error('[Service Worker] Error confirming order:', error);
        return self.registration.showNotification('Error', {
          body: 'Failed to confirm order. Please try again later.',
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png'
        });
      })
    );
  } else if (action === 'reject' && data.purchaseOrderId && data.token) {
    // Reject action - open response form
    event.waitUntil(
      clients.openWindow(`/purchase-orders/respond/${data.token}?action=reject`)
    );
  } else if (action === 'view' && data.url) {
    // View action - open URL
    event.waitUntil(
      clients.openWindow(data.url)
    );
  } else if (data.url) {
    // Default click - open URL if available
    event.waitUntil(
      clients.openWindow(data.url)
    );
  } else if (data.purchaseOrderId && data.token) {
    // Fallback - open response page
    event.waitUntil(
      clients.openWindow(`/purchase-orders/respond/${data.token}`)
    );
  } else {
    // No specific action - open app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Background sync (for offline actions)
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-push-subscription') {
    event.waitUntil(
      // Sync push subscription when back online
      syncPushSubscription()
    );
  }
});

async function syncPushSubscription() {
  // This would sync any pending push subscription updates
  // Implementation depends on your specific needs
  console.log('[Service Worker] Syncing push subscription');
}

// Message handler (for communication from pages)
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

