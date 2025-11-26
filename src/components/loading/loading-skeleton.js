/**
 * LoadingSkeleton Component
 * Skeleton loader for content placeholders
 * 
 * @component
 * @param {string} type - Type of skeleton: 'card' | 'table' | 'text' | 'image' | 'custom'
 * @param {number} count - Number of skeletons to render
 * @param {string} className - Additional CSS classes
 * @param {object} props - Additional props for custom skeletons
 */

'use client';

export function LoadingSkeleton({ 
  type = 'text', 
  count = 1, 
  className = '',
  ...props 
}) {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        );

      case 'table':
        return (
          <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
            <div className="animate-pulse">
              {/* Table Header */}
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <div className="flex space-x-4">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-4 bg-gray-200 rounded w-28"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
              {/* Table Rows */}
              {Array.from({ length: props.rows || 5 }).map((_, i) => (
                <div key={i} className="px-6 py-4 border-b border-gray-200">
                  <div className="flex space-x-4">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                    <div className="h-4 bg-gray-200 rounded w-28"></div>
                    <div className="h-4 bg-gray-200 rounded w-20"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'text':
        return (
          <div className={`animate-pulse space-y-2 ${className}`}>
            {Array.from({ length: props.lines || 3 }).map((_, i) => (
              <div
                key={i}
                className={`h-4 bg-gray-200 rounded ${
                  i === props.lines - 1 ? 'w-3/4' : 'w-full'
                }`}
              ></div>
            ))}
          </div>
        );

      case 'image':
        return (
          <div
            className={`bg-gray-200 rounded animate-pulse ${className}`}
            style={{
              width: props.width || '100%',
              height: props.height || '200px',
            }}
          ></div>
        );

      case 'custom':
        return (
          <div className={`animate-pulse ${className}`}>
            {props.children}
          </div>
        );

      default:
        return (
          <div className={`h-4 bg-gray-200 rounded animate-pulse ${className}`}></div>
        );
    }
  };

  if (count === 1) {
    return renderSkeleton();
  }

  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>{renderSkeleton()}</div>
      ))}
    </div>
  );
}

