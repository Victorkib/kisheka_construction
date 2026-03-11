/**
 * Error Notification Manager
 * Centralized system for managing error notifications with deduplication and rate limiting
 * Prevents duplicate toasts and spam
 */

'use client';

// Error tracking for deduplication
const errorCache = new Map();
const errorTimestamps = new Map();

// Configuration
const DEDUPLICATION_WINDOW = 5000; // 5 seconds - same error won't show again within this window
const RATE_LIMIT_WINDOW = 10000; // 10 seconds - max errors per window
const MAX_ERRORS_PER_WINDOW = 3; // Max 3 errors per 10 seconds
const MAX_CACHE_SIZE = 100; // Max cached errors

/**
 * Generate a unique key for an error
 */
function getErrorKey(errorData) {
  const { type, message, url, status } = errorData;
  
  // Create a key based on error type, message, and URL
  // This helps identify duplicate errors
  const messageHash = message?.substring(0, 100) || '';
  const urlHash = url?.split('?')[0] || ''; // Remove query params for deduplication
  
  return `${type}:${status || ''}:${urlHash}:${messageHash}`;
}

/**
 * Check if error should be shown (deduplication and rate limiting)
 */
function shouldShowError(errorKey, errorData) {
  const now = Date.now();
  
  // Check if same error was shown recently (deduplication)
  const lastShown = errorTimestamps.get(errorKey);
  if (lastShown && (now - lastShown) < DEDUPLICATION_WINDOW) {
    console.log('[ErrorNotification] Duplicate error suppressed:', errorKey);
    return false;
  }
  
  // Rate limiting - check total errors in window
  const recentErrors = Array.from(errorTimestamps.values())
    .filter(timestamp => (now - timestamp) < RATE_LIMIT_WINDOW);
  
  if (recentErrors.length >= MAX_ERRORS_PER_WINDOW) {
    console.log('[ErrorNotification] Rate limit reached, suppressing error');
    return false;
  }
  
  // Update cache and timestamp
  errorTimestamps.set(errorKey, now);
  errorCache.set(errorKey, errorData);
  
  // Clean up old entries
  if (errorCache.size > MAX_CACHE_SIZE) {
    const oldestKey = Array.from(errorTimestamps.entries())
      .sort((a, b) => a[1] - b[1])[0]?.[0];
    if (oldestKey) {
      errorCache.delete(oldestKey);
      errorTimestamps.delete(oldestKey);
    }
  }
  
  return true;
}

/**
 * Check if error is an aborted request (not a real error)
 */
function isAbortError(errorData) {
  if (!errorData) return false;
  
  const { message, type } = errorData;
  
  // Check if it's a fetch_error with abort message
  if (type === 'fetch_error' && message) {
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
 * Check if error should be suppressed (client-handled errors)
 */
function shouldSuppressError(errorData) {
  const { type, url, status } = errorData;
  
  // Suppress aborted requests - these are normal (component unmount, navigation, etc.)
  if (isAbortError(errorData)) {
    return true; // Suppress - aborted requests are not real errors
  }
  
  // Check if error was marked as handled by component
  if (url && status && typeof window !== 'undefined') {
    const errorKey = `handled:${status}:${url}`;
    if (sessionStorage.getItem(errorKey) === 'true') {
      return true; // Suppress - component already handled this
    }
  }
  
  // Suppress 401/403 errors - these are usually handled by components
  // Only show them if they're 500+ server errors
  if (status && status < 500 && status >= 400) {
    // Check if it's an auth error that should be handled by components
    if (status === 401 || status === 403) {
      return true; // Suppress - components handle these
    }
  }
  
  // Suppress errors from certain endpoints that handle their own errors
  const suppressEndpoints = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/me',
  ];
  
  if (url) {
    try {
      const urlPath = new URL(url, window.location.origin).pathname;
      if (suppressEndpoints.some(endpoint => urlPath.includes(endpoint))) {
        // Only suppress if it's a client error (400-499), not server error (500+)
        if (status && status < 500) {
          return true;
        }
      }
    } catch (e) {
      // Invalid URL, continue
    }
  }
  
  return false;
}

/**
 * Notify about an error (with deduplication and rate limiting)
 */
export function notifyError(errorData) {
  if (typeof window === 'undefined') return;
  
  // Check if error should be suppressed
  if (shouldSuppressError(errorData)) {
    console.log('[ErrorNotification] Error suppressed (client-handled):', errorData);
    return false;
  }
  
  // Generate error key for deduplication
  const errorKey = getErrorKey(errorData);
  
  // Check if error should be shown
  if (!shouldShowError(errorKey, errorData)) {
    return false;
  }
  
  // Dispatch notification event
  window.dispatchEvent(new CustomEvent('error-notification', {
    detail: {
      errorType: errorData.type,
      errorMessage: errorData.message,
      errorData: errorData,
    },
  }));
  
  return true;
}

/**
 * Clear error cache (useful for testing or manual cleanup)
 */
export function clearErrorCache() {
  errorCache.clear();
  errorTimestamps.clear();
}

/**
 * Get error cache stats (for debugging)
 */
export function getErrorCacheStats() {
  return {
    cacheSize: errorCache.size,
    recentErrors: Array.from(errorTimestamps.values())
      .filter(timestamp => (Date.now() - timestamp) < RATE_LIMIT_WINDOW).length,
  };
}
