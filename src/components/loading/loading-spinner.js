/**
 * LoadingSpinner Component
 * Reusable spinner component for loading states
 * 
 * @component
 * @param {string} size - Size of spinner: 'sm' | 'md' | 'lg' | 'xl'
 * @param {string} color - Tailwind color class (default: 'blue-600')
 * @param {string} className - Additional CSS classes
 * @param {string} text - Optional text to display below spinner
 */

'use client';

export function LoadingSpinner({ 
  size = 'md', 
  color = 'blue-600', 
  className = '', 
  text = null 
}) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  const borderSizeClasses = {
    sm: 'border',
    md: 'border-2',
    lg: 'border-b-2',
    xl: 'border-b-2',
  };

  // Map color to actual Tailwind classes
  const colorClasses = {
    'blue-600': 'border-blue-600',
    'green-600': 'border-green-600',
    'red-600': 'border-red-600',
    'yellow-600': 'border-yellow-600',
    'purple-600': 'border-purple-600',
    'gray-600': 'border-gray-600',
  };

  const borderColorClass = colorClasses[color] || 'border-blue-600';

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className={`${sizeClasses[size]} ${borderSizeClasses[size]} ${borderColorClass} rounded-full animate-spin`}
        style={{
          borderTopColor: 'transparent',
        }}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
      {text && (
        <p className={`mt-2 text-sm text-gray-600 ${size === 'sm' ? 'text-xs' : ''}`}>
          {text}
        </p>
      )}
    </div>
  );
}

