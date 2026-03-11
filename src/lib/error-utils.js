/**
 * Error Utilities
 * Helper functions for error handling in components
 */

'use client';

/**
 * Handle API error response
 * This function helps components handle errors consistently
 * and optionally suppress global error notifications
 * 
 * @param {Response} response - Fetch response object
 * @param {Object} options - Options for error handling
 * @param {boolean} options.suppressGlobalNotification - If true, prevents global error handler from showing toast
 * @param {Function} options.onError - Callback function called with error message
 * @returns {Promise<Object>} Error data object
 */
export async function handleApiError(response, options = {}) {
  const { suppressGlobalNotification = false, onError } = options;
  
  let errorMessage = 'An error occurred';
  let errorData = null;
  
  try {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } else {
      const text = await response.text();
      errorMessage = text || errorMessage;
    }
  } catch (e) {
    // If parsing fails, use status text
    errorMessage = response.statusText || errorMessage;
  }
  
  // Set custom header to suppress global notification if requested
  if (suppressGlobalNotification && typeof window !== 'undefined') {
    // Mark this error as handled by component
    const errorKey = `handled:${response.status}:${response.url}`;
    sessionStorage.setItem(errorKey, 'true');
    
    // Clear after 5 seconds
    setTimeout(() => {
      sessionStorage.removeItem(errorKey);
    }, 5000);
  }
  
  // Call custom error handler if provided
  if (onError) {
    onError(errorMessage, errorData);
  }
  
  return {
    message: errorMessage,
    status: response.status,
    data: errorData,
  };
}

/**
 * Check if error should be suppressed (already handled by component)
 */
export function isErrorHandled(status, url) {
  if (typeof window === 'undefined') return false;
  
  const errorKey = `handled:${status}:${url}`;
  return sessionStorage.getItem(errorKey) === 'true';
}
