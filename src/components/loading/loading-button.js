/**
 * LoadingButton Component
 * Button with integrated loading state
 * 
 * @component
 * @param {boolean} isLoading - Whether button is in loading state
 * @param {string} loadingText - Text to show when loading
 * @param {ReactNode} children - Button content
 * @param {object} props - All other button props
 */

'use client';

import { LoadingSpinner } from './loading-spinner';

export function LoadingButton({ 
  isLoading = false, 
  loadingText = null,
  children, 
  disabled,
  className = '',
  ...props 
}) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`${className} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} transition`}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <LoadingSpinner size="sm" color="currentColor" />
          {loadingText || children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

