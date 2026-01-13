/**
 * LoadingSelect Component
 * Select dropdown with integrated loading state
 * 
 * @component
 * @param {boolean} isLoading - Whether select is in loading state
 * @param {string} loadingText - Text to show in option when loading
 * @param {ReactNode} children - Select options
 * @param {object} props - All other select props
 */

'use client';

import { LoadingSpinner } from './loading-spinner';

export function LoadingSelect({ 
  isLoading = false, 
  loading = false, // Support both isLoading and loading props
  loadingText = 'Loading...',
  children, 
  disabled,
  className = '',
  ...props 
}) {
  // Use loading prop if provided, otherwise use isLoading
  const isActuallyLoading = loading || isLoading;
  const isDisabled = disabled || isActuallyLoading;

  // Remove loading and isLoading from props to avoid passing them to select element
  const { loading: _, isLoading: __, loadingText: ___, ...selectProps } = props;

  return (
    <div className="relative">
      <select
        {...selectProps}
        disabled={isDisabled}
        className={`${className} ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''} transition pr-8`}
      >
        {isActuallyLoading ? (
          <option value="" disabled>
            {loadingText}
          </option>
        ) : (
          children
        )}
      </select>
      {isActuallyLoading && (
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <LoadingSpinner size="sm" color="gray-600" />
        </div>
      )}
    </div>
  );
}
