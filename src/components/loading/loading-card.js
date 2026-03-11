/**
 * LoadingCard Component
 * Skeleton loader for card components
 * 
 * @component
 * @param {number} count - Number of cards to render
 * @param {boolean} showHeader - Whether to show header skeleton
 * @param {number} lines - Number of content lines
 * @param {string} className - Additional CSS classes
 */

'use client';

// CardSkeleton component - defined outside to avoid recreation on each render
function CardSkeleton({ showHeader = true, lines = 3, className = '' }) {
  return (
    <div className={`ds-bg-surface rounded-lg shadow p-6 border ds-border-subtle ${className}`}>
      <div className="animate-pulse space-y-4">
        {showHeader && (
          <div className="space-y-2">
            <div className="h-5 ds-bg-surface-muted rounded w-3/4"></div>
            <div className="h-4 ds-bg-surface-muted rounded w-1/2"></div>
          </div>
        )}
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className={`h-4 ds-bg-surface-muted rounded ${
                i === lines - 1 ? 'w-5/6' : 'w-full'
              }`}
            ></div>
          ))}
        </div>
        {showHeader && (
          <div className="flex space-x-2 pt-4">
            <div className="h-8 ds-bg-surface-muted rounded w-20"></div>
            <div className="h-8 ds-bg-surface-muted rounded w-20"></div>
          </div>
        )}
      </div>
    </div>
  );
}

export function LoadingCard({ 
  count = 1, 
  showHeader = true,
  lines = 3,
  className = '' 
}) {

  if (count === 1) {
    return <CardSkeleton showHeader={showHeader} lines={lines} className={className} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} showHeader={showHeader} lines={lines} className={className} />
      ))}
    </div>
  );
}

