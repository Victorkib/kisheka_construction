/**
 * PrerequisiteBlock Component
 * Beautiful blocking UI shown when prerequisites are not met
 * Prevents users from accessing forms when required data is missing
 */

'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';

export function PrerequisiteBlock({
  title = 'Cannot Proceed',
  description,
  missingItems = [],
  prerequisites = {},
  actions = [],
  onRetry,
}) {
  const incompletePrerequisites = Object.entries(prerequisites).filter(
    ([_, item]) => !item.completed
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-orange-50 shadow-lg">
        <div className="p-8">
          {/* Header with Icon */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-red-900 mb-2">{title}</h2>
              {description && (
                <p className="text-red-800 leading-relaxed">{description}</p>
              )}
            </div>
          </div>

          {/* Missing Prerequisites List */}
          {incompletePrerequisites.length > 0 && (
            <div className="mb-6 bg-white rounded-lg p-5 border border-red-200 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Missing Prerequisites
              </h3>
              <ul className="space-y-3">
                {incompletePrerequisites.map(([key, item]) => (
                  <li
                    key={key}
                    className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <svg
                        className="w-5 h-5 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900">
                        {item.message}
                      </p>
                      {item.actionUrl && (
                        <Link
                          href={item.actionUrl}
                          className="mt-2 inline-flex items-center text-sm font-medium text-red-700 hover:text-red-900 transition-colors group"
                        >
                          {item.actionLabel || 'Fix this'}
                          <svg
                            className="ml-1 w-4 h-4 transform group-hover:translate-x-1 transition-transform"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          {actions.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-red-900 mb-3">
                Quick Actions:
              </p>
              <div className="flex flex-wrap gap-3">
                {actions.map((action, index) => (
                  <Link
                    key={index}
                    href={action.href}
                    className="inline-flex items-center px-5 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    {action.icon && (
                      <span className="mr-2">{action.icon}</span>
                    )}
                    {action.label}
                    <svg
                      className="ml-2 w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Retry Button */}
          {onRetry && (
            <div className="pt-4 border-t border-red-200">
              <button
                onClick={onRetry}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Check Again
              </button>
            </div>
          )}

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-red-200">
            <p className="text-xs text-red-700/80">
              <strong>Tip:</strong> Complete the missing prerequisites above to
              proceed. All required data must be set up before you can create
              new entries.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
