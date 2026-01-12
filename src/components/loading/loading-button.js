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
  loading = false, // Support both isLoading and loading props
  loadingText = null,
  children, 
  disabled,
  className = '',
  ...props 
}) {
  // Use loading prop if provided, otherwise use isLoading
  const isActuallyLoading = loading || isLoading;
  const isDisabled = disabled || isActuallyLoading;

  // Remove loading and isLoading from props to avoid passing them to button element
  const { loading: _, isLoading: __, ...buttonProps } = props;

  return (
    <button
      {...buttonProps}
      disabled={isDisabled}
      className={`${className} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''} transition`}
    >
      {isActuallyLoading ? (
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

