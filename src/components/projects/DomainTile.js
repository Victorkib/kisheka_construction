/**
 * DomainTile Component
 * Navigation tile for project domains
 * Used in project detail page to link to dedicated pages
 * 
 * @param {Object} props
 * @param {string} props.icon - Icon emoji or component
 * @param {string} props.title - Domain title
 * @param {Array} props.metrics - Array of {label, value} objects
 * @param {string} props.link - Link URL (if provided, tile is clickable)
 * @param {Function} props.onClick - Click handler (alternative to link)
 * @param {React.ReactNode} props.children - Optional custom content
 */

'use client';

import Link from 'next/link';

export function DomainTile({ icon, title, metrics = [], link, onClick, children }) {
  const isClickable = link || onClick;
  
  const content = (
    <div className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 p-6 border border-gray-200 h-full flex flex-col group ${isClickable ? 'cursor-pointer' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {icon && <span className="text-2xl flex-shrink-0">{icon}</span>}
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
          {title}
        </h3>
      </div>
      
      {/* Metrics */}
      {metrics.length > 0 && (
        <div className="space-y-2 mb-4 flex-grow">
          {metrics.map((metric, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-sm text-gray-600">{metric.label}</span>
              <span className="text-sm font-medium text-gray-900 text-right">
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* Custom Content */}
      {children && <div className="mb-4 flex-grow">{children}</div>}
      
      {/* Action Link/Button - Only show if tile itself is not clickable */}
      {!isClickable && (
        <div className="mt-auto pt-4 border-t border-gray-100">
          <span className="inline-flex items-center text-sm font-medium text-gray-500">
            No action available
          </span>
        </div>
      )}
      
      {/* Clickable indicator when tile is clickable */}
      {isClickable && (
        <div className="mt-auto pt-4 border-t border-gray-100">
          <span className="inline-flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-800 transition-colors">
            View {title}
            <svg 
              className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      )}
    </div>
  );

  // If link provided, wrap in Link component
  if (link) {
    return (
      <Link href={link} className="block h-full">
        {content}
      </Link>
    );
  }

  // If onClick provided, wrap in button
  if (onClick) {
    return (
      <button onClick={onClick} className="block w-full h-full text-left">
        {content}
      </button>
    );
  }

  // Otherwise, return content as-is
  return content;
}

export default DomainTile;
