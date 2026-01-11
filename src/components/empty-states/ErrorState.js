/**
 * Error State Component
 * Reusable component for displaying error states with retry functionality
 */

'use client';

import { LoadingSpinner } from '@/components/loading';

/**
 * ErrorState Component
 * @param {Object} props
 * @param {string} props.title - Title of the error
 * @param {string} props.message - Error message to display
 * @param {Function} props.onRetry - Function to call when retry button is clicked
 * @param {boolean} props.isRetrying - Whether retry is in progress
 * @param {string} props.icon - Emoji or icon to display
 */
export function ErrorState({
  title = 'Error Loading Data',
  message = 'An error occurred while loading data. Please try again.',
  onRetry,
  isRetrying = false,
  icon = '⚠️',
}) {
  return (
    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8 text-center">
      <div className="max-w-2xl mx-auto">
        <div className="text-5xl mb-4">{icon}</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-lg text-gray-700 mb-6">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="inline-block bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-lg transition-colors shadow-md hover:shadow-lg disabled:shadow-none"
          >
            {isRetrying ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                Retrying...
              </span>
            ) : (
              'Retry'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default ErrorState;












