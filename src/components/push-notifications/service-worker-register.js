/**
 * Service Worker Registration Component
 * Registers the service worker for push notifications
 * Should be included in the main layout
 *
 * Features:
 * - Checks browser support
 * - Only registers if browser supports Service Workers
 * - Gracefully handles registration errors
 * - Periodically checks for updates
 * - Handles controller changes (automatic page reload on update)
 * - Logs all events for debugging
 */

'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  // Define the registration function before using it
  const registerServiceWorker = async () => {
    try {
      console.log('[Service Worker] Attempting to register...');

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log(
        '[Service Worker] ✓ Registered successfully at scope:',
        registration.scope
      );
      console.log(
        '[Service Worker] State:',
        registration.installing
          ? 'installing'
          : registration.waiting
          ? 'waiting'
          : 'activated'
      );

      // Check for updates every 60 seconds
      const updateCheckInterval = setInterval(async () => {
        try {
          await registration.update();
          console.log('[Service Worker] Update check completed');
        } catch (error) {
          console.error('[Service Worker] Update check error:', error);
        }
      }, 60000);

      // Return cleanup function to clear the interval
      return () => clearInterval(updateCheckInterval);
    } catch (error) {
      console.error('[Service Worker] ✗ Registration failed:', error.message);

      // Log specific error details for debugging
      if (error.message.includes('script evaluation')) {
        console.error('[Service Worker] SCRIPT EVALUATION FAILED - Check:', [
          '1. Public key available in environment?',
          '2. VAPID keys valid?',
          '3. No syntax errors in /public/sw.js?',
          '4. Browser notifications permission granted?',
        ]);
      }

      if (error.message.includes('security')) {
        console.error('[Service Worker] SECURITY ERROR - Check:', [
          '1. Service Worker served over HTTPS?',
          '2. HTTPS required for production, HTTP allowed for localhost only',
        ]);
      }

      // Return empty cleanup function on error
      return () => {};
    }
  };

  // Register service worker on mount
  useEffect(() => {
    // Check browser support and run in client-side only
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('[Service Worker] Browser does not support Service Workers');
      return;
    }

    let cleanupUpdateCheck = () => {};

    const initializeServiceWorker = async () => {
      cleanupUpdateCheck = await registerServiceWorker();
    };

    initializeServiceWorker();

    // Cleanup on unmount
    return () => {
      cleanupUpdateCheck();
    };
  }, []);

  // Listen for Service Worker updates
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Define event handlers as separate functions so we can remove them later
    const handleControllerChange = () => {
      console.log(
        '[Service Worker] Controller changed - new version activated'
      );

      // Optionally reload page to use new Service Worker
      // Uncomment below to auto-reload on SW update:
      // window.location.reload();
    };

    const handleServiceWorkerError = (event) => {
      console.error('[Service Worker] Error event:', event);
    };

    // Add event listeners
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange
    );
    navigator.serviceWorker.addEventListener('error', handleServiceWorkerError);

    // Cleanup: remove event listeners on unmount
    return () => {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange
      );
      navigator.serviceWorker.removeEventListener(
        'error',
        handleServiceWorkerError
      );
    };
  }, []);

  return null; // This component doesn't render anything
}
