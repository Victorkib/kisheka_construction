/**
 * No Data Empty State Component
 * Reusable component for displaying empty state when no data exists for a specific resource
 */

'use client';

import Link from 'next/link';

/**
 * NoDataEmptyState Component
 * @param {Object} props
 * @param {string} props.title - Title of the empty state
 * @param {string} props.message - Message to display
 * @param {string} props.icon - Emoji or icon to display
 * @param {string} props.actionLabel - Label for the action button
 * @param {string} props.actionHref - URL for the action button
 * @param {boolean} props.showAction - Whether to show action button
 */
export function NoDataEmptyState({
  title = 'No Data Available',
  message = 'There is no data to display at this time.',
  icon = '📭',
  actionLabel = 'Get Started',
  actionHref = '/',
  showAction = false,
}) {
  return (
    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200 rounded-lg p-8 text-center">
      <div className="max-w-xl mx-auto">
        <div className="text-6xl mb-4">{icon}</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-lg text-gray-700 mb-6">{message}</p>
        {showAction && actionHref && (
          <Link
            href={actionHref}
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

export default NoDataEmptyState;












