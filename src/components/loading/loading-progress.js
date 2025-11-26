/**
 * LoadingProgress Component
 * Progress bar for loading operations
 * 
 * @component
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} label - Optional label text
 * @param {string} color - Tailwind color class (default: 'blue-600')
 * @param {string} className - Additional CSS classes
 * @param {boolean} showPercentage - Whether to show percentage text
 */

'use client';

export function LoadingProgress({ 
  progress = 0, 
  label = null,
  color = 'blue-600',
  className = '',
  showPercentage = true 
}) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  // Map color to actual Tailwind classes
  const colorClasses = {
    'blue-600': 'bg-blue-600',
    'green-600': 'bg-green-600',
    'red-600': 'bg-red-600',
    'yellow-600': 'bg-yellow-600',
    'purple-600': 'bg-purple-600',
    'gray-600': 'bg-gray-600',
  };

  const bgColorClass = colorClasses[color] || 'bg-blue-600';

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-sm text-gray-500">{Math.round(clampedProgress)}%</span>
          )}
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`${bgColorClass} h-2 rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${clampedProgress}%` }}
          role="progressbar"
          aria-valuenow={clampedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="sr-only">{clampedProgress}% complete</span>
        </div>
      </div>
    </div>
  );
}

