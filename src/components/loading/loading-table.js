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
    <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
      <div className="animate-pulse">
        {showHeader && (
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <div className="flex space-x-4">
              {Array.from({ length: columns }).map((_, i) => (
                <div
                  key={i}
                  className="h-4 bg-gray-200 rounded"
                  style={{ width: `${100 / columns}%` }}
                ></div>
              ))}
            </div>
          </div>
        )}
        <div className="divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="px-6 py-4">
              <div className="flex space-x-4">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <div
                    key={colIndex}
                    className="h-4 bg-gray-200 rounded"
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

