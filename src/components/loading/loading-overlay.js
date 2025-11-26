/**
 * LoadingOverlay Component
 * Full-page or container overlay for loading states
 * 
 * @component
 * @param {boolean} isLoading - Whether to show the overlay
 * @param {string} message - Optional loading message
 * @param {number} progress - Optional progress percentage (0-100)
 * @param {function} onCancel - Optional cancel callback
 * @param {string} className - Additional CSS classes
 * @param {boolean} fullScreen - Whether overlay should be full screen
 */

'use client';

import { LoadingSpinner } from './loading-spinner';

export function LoadingOverlay({ 
  isLoading, 
  message = 'Loading...', 
  progress = null,
  onCancel = null,
  className = '',
  fullScreen = false 
}) {
  if (!isLoading) return null;

  const overlayClasses = fullScreen
    ? 'fixed inset-0 z-50'
    : 'absolute inset-0 z-10';

  return (
    <div
      className={`${overlayClasses} bg-white bg-opacity-90 backdrop-blur-sm flex items-center justify-center ${className}`}
      role="status"
      aria-label="Loading overlay"
    >
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full mx-4">
        <div className="flex flex-col items-center space-y-4">
          <LoadingSpinner size="lg" color="blue-600" />
          
          {message && (
            <p className="text-sm font-medium text-gray-700 text-center">
              {message}
            </p>
          )}

          {progress !== null && (
            <div className="w-full">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 text-center mt-1">
                {Math.round(progress)}%
              </p>
            </div>
          )}

          {onCancel && (
            <button
              onClick={onCancel}
              className="mt-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

