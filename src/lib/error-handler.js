/**
 * Global Error Handler
 * Captures unhandled errors and promise rejections
 */

'use client';

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
  } catch (e) {
    console.error('Failed to store error data:', e);
  }
}

/**
 * Intercept fetch errors
 */
export function interceptFetchErrors() {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch;
  
  window.fetch = async function(...args) {
    try {
      const response = await originalFetch.apply(this, args);
      
      // Check for API errors
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
