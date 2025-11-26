/**
 * Archive Badge Component
 * 
 * Visual indicator for archived items
 * Displays a badge showing the item is archived
 */

'use client';

export function ArchiveBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300 ${className}`}
      title="This item is archived"
    >
      <svg
        className="w-3 h-3 mr-1"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
        />
      </svg>
      Archived
    </span>
  );
}

