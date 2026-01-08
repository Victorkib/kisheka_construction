/**
 * useErrorHandler Hook
 * Provides comprehensive error handling with retry mechanisms
 */

'use client';

import { useState, useCallback } from 'react';

/**
 * Custom hook for error handling with retry functionality
 * @param {Object} options - Configuration options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.retryDelay - Delay between retries in milliseconds (default: 1000)
 * @param {Function} options.onError - Callback function called when error occurs
 * @param {Function} options.onRetry - Callback function called before each retry
 * @returns {Object} Error handling utilities
 */
export function useErrorHandler(options = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onError,
    onRetry,
  } = options;

  const [error, setError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  /**
   * Executes an async function with retry logic
   * @param {Function} asyncFn - Async function to execute
   * @param {Array} args - Arguments to pass to the async function
   * @returns {Promise} Result of the async function
   */
  const executeWithRetry = useCallback(async (asyncFn, ...args) => {
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        setError(null);
        setIsRetrying(attempt > 0);
        setRetryCount(attempt);
        
        if (attempt > 0 && onRetry) {
          onRetry(attempt, maxRetries);
        }
        
        // Add delay before retry (except for first attempt)
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
        
        const result = await asyncFn(...args);
        
        // Success - reset retry count
        setRetryCount(0);
        setIsRetrying(false);
        return result;
      } catch (err) {
        lastError = err;
        
        // If this is the last attempt, set error and call onError
        if (attempt === maxRetries) {
          const errorMessage = err.message || 'An error occurred';
          setError(errorMessage);
          setIsRetrying(false);
          
          if (onError) {
            onError(err, attempt);
          }
          
          throw err;
        }
      }
    }
    
    throw lastError;
  }, [maxRetries, retryDelay, onError, onRetry]);

  /**
   * Clears the current error
   */
  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  /**
   * Manually retry the last failed operation
   * Note: This requires storing the last operation, which should be done by the component
   */
  const retry = useCallback(async (asyncFn, ...args) => {
    clearError();
    return executeWithRetry(asyncFn, ...args);
  }, [executeWithRetry, clearError]);

  return {
    error,
    isRetrying,
    retryCount,
    executeWithRetry,
    clearError,
    retry,
    setError,
  };
}

export default useErrorHandler;






