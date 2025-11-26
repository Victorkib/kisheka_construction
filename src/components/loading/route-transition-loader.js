/**
 * RouteTransitionLoader Component
 * Shows loading state during route transitions
 * 
 * @component
 * @param {boolean} isLoading - Whether route is transitioning
 * @param {string} message - Optional loading message
 */

'use client';

import { LoadingSpinner } from './loading-spinner';

export function RouteTransitionLoader({ isLoading, message = 'Loading...' }) {
  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white bg-opacity-90 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-center gap-3">
          <LoadingSpinner size="sm" color="blue-600" />
          <span className="text-sm text-gray-600">{message}</span>
        </div>
      </div>
    </div>
  );
}

