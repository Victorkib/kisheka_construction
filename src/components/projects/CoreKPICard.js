/**
 * CoreKPICard Component
 * Compact KPI card for project overview
 * Displays key metrics with optional progress indicator
 * 
 * @param {Object} props
 * @param {string} props.title - KPI title
 * @param {string|number} props.primaryValue - Main value to display
 * @param {string|number} props.secondaryValue - Secondary value (optional)
 * @param {number} props.progress - Progress percentage (0-100, optional)
 * @param {string} props.progressColor - Progress bar color ('blue'|'green'|'yellow'|'red')
 * @param {string|React.ReactNode} props.icon - Icon emoji or component (optional)
 * @param {string} props.variant - Card variant ('default'|'success'|'warning'|'danger')
 */

'use client';

export function CoreKPICard({ 
  title, 
  primaryValue, 
  secondaryValue, 
  progress, 
  progressColor = 'blue',
  icon,
  variant = 'default'
}) {
  const progressColors = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    red: 'bg-red-600',
    purple: 'bg-purple-600',
  };

  const variantStyles = {
    default: 'border-gray-200',
    success: 'border-green-200 bg-green-50/30',
    warning: 'border-yellow-200 bg-yellow-50/30',
    danger: 'border-red-200 bg-red-50/30',
  };

  const getProgressColor = () => {
    if (progressColor && progressColors[progressColor]) {
      return progressColors[progressColor];
    }
    // Auto-determine color based on progress value
    if (progress !== undefined) {
      if (progress > 100) return progressColors.red;
      if (progress > 80) return progressColors.yellow;
      if (progress > 50) return progressColors.blue;
      return progressColors.green;
    }
    return progressColors.blue;
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm p-6 border ${variantStyles[variant]} h-full flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        {icon && <span className="text-xl flex-shrink-0">{icon}</span>}
      </div>
      
      {/* Primary Value */}
      <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-1 break-words">
        {primaryValue}
      </p>
      
      {/* Secondary Value */}
      {secondaryValue && (
        <p className="text-sm text-gray-600 mt-1 break-words">
          {secondaryValue}
        </p>
      )}
      
      {/* Progress Bar */}
      {progress !== undefined && progress !== null && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Progress</span>
            <span className="text-xs font-medium text-gray-700">
              {Math.min(100, Math.max(0, progress)).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
              style={{ 
                width: `${Math.min(100, Math.max(0, progress))}%`,
              }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default CoreKPICard;
