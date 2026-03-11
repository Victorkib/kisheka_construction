/**
 * Global Error Handler
 * Captures unhandled errors and promise rejections
 */

'use client';

import { notifyError } from './error-notification-manager';

/**
 * Initialize global error handlers
 */
export function initGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  // Handle JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    const errorData = {
      message: event.message || event.error?.message || 'Unknown error',
      stack: event.error?.stack || '',
      filename: event.filename || '',
      lineno: event.lineno || 0,
      colno: event.colno || 0,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      type: 'javascript_error',
    };

    storeErrorForReporting(errorData);
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    // Ignore aborted requests - these are normal (component unmount, navigation, etc.)
    if (isAbortError(event.reason)) {
      // Silently ignore aborted promise rejections
      return;
    }
    
    console.error('Unhandled promise rejection:', event.reason);
    
    const errorData = {
      message: event.reason?.message || String(event.reason) || 'Unhandled promise rejection',
      stack: event.reason?.stack || '',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      type: 'promise_rejection',
    };

    storeErrorForReporting(errorData);
  });
}

/**
 * Store error for reporting
 */
function storeErrorForReporting(errorData) {
  try {
    sessionStorage.setItem('lastError', JSON.stringify(errorData));
    
    // Use centralized notification manager (with deduplication and rate limiting)
    notifyError(errorData);
  } catch (e) {
    console.error('Failed to store error data:', e);
  }
}

/**
 * Check if error is an aborted request (not a real error)
 */
function isAbortError(error) {
  if (!error) return false;
  
  // Check error name
  if (error.name === 'AbortError') return true;
  
  // Check error message
  const message = error.message || String(error);
  if (typeof message === 'string') {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('abort') || 
        lowerMessage.includes('signal is aborted') ||
        lowerMessage.includes('the operation was aborted')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Intercept fetch errors
 * Only shows notifications for server errors (500+) that aren't handled by components
 * Ignores aborted requests (normal behavior when components unmount or navigation occurs)
 */
export function interceptFetchErrors() {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch;
  
  window.fetch = async function(...args) {
    try {
      const response = await originalFetch.apply(this, args);
      
      // Only handle server errors (500+) - client errors (400-499) are handled by components
      // This prevents duplicate notifications
      if (!response.ok && response.status >= 500) {
        const errorData = {
          message: `API Error: ${response.status} ${response.statusText}`,
          url: args[0]?.toString() || '',
          status: response.status,
          statusText: response.statusText,
          timestamp: new Date().toISOString(),
          currentUrl: window.location.href,
          userAgent: navigator.userAgent,
          type: 'api_error',
        };

        storeErrorForReporting(errorData);
      }
      
      return response;
    } catch (error) {
      // Ignore aborted requests - these are normal (component unmount, navigation, etc.)
      if (isAbortError(error)) {
        // Silently rethrow - don't show notification for aborted requests
        throw error;
      }
      
      // Network errors (not HTTP errors) - these are worth notifying
      const errorData = {
        message: `Fetch Error: ${error.message}`,
        stack: error.stack || '',
        url: args[0]?.toString() || '',
        timestamp: new Date().toISOString(),
        currentUrl: window.location.href,
        userAgent: navigator.userAgent,
        type: 'fetch_error',
      };

      storeErrorForReporting(errorData);
      throw error;
    }
  };
}
