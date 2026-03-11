/**
 * LoadingTable Component
 * Skeleton loader for table components
 * 
 * @component
 * @param {number} rows - Number of rows to render
 * @param {number} columns - Number of columns
 * @param {boolean} showHeader - Whether to show table header
 * @param {string} className - Additional CSS classes
 */

'use client';

export function LoadingTable({ 
  rows = 5, 
  columns = 4,
  showHeader = true,
  className = '' 
}) {
  return (
    <div className={`ds-bg-surface rounded-lg shadow overflow-hidden border ds-border-subtle ${className}`}>
      <div className="animate-pulse">
        {showHeader && (
          <div className="ds-bg-surface-muted px-6 py-3 border-b ds-border-subtle">
            <div className="flex space-x-4">
              {Array.from({ length: columns }).map((_, i) => (
                <div
                  key={i}
                  className="h-4 ds-bg-surface-muted rounded"
                  style={{ width: `${100 / columns}%` }}
                ></div>
              ))}
            </div>
          </div>
        )}
        <div className="divide-y ds-border-subtle">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="px-6 py-4">
              <div className="flex space-x-4">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <div
                    key={colIndex}
                  className="h-4 ds-bg-surface-muted rounded"
                    style={{ width: `${100 / columns}%` }}
                  ></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

