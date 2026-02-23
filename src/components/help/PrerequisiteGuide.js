/**
 * PrerequisiteGuide
 * Enhanced guidance block for pages with data dependencies.
 * Supports blocking states and prerequisite checking.
 */

'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export default function PrerequisiteGuide({
  title,
  description,
  prerequisites = [],
  prerequisiteDetails = {},
  actions = [],
  tip,
  blocking = false,
  canProceed = true,
}) {
  // Calculate state based on prerequisites
  // If we have prerequisite details, use them to determine state more intelligently
  const prerequisiteEntries = Object.entries(prerequisiteDetails);
  const hasPrerequisiteDetails = prerequisiteEntries.length > 0;
  
  let completedCount = 0;
  let totalCount = 0;
  let missingCount = 0;
  
  if (hasPrerequisiteDetails) {
    completedCount = prerequisiteEntries.filter(([_, item]) => item.completed).length;
    totalCount = prerequisiteEntries.length;
    missingCount = totalCount - completedCount;
  }

  // Determine state:
  // - Blocked (red): All prerequisites missing (when we have details) OR explicitly blocking (when no details)
  // - Warning (yellow): Some prerequisites missing
  // - Ready (green): All prerequisites met
  const isFullyBlocked = hasPrerequisiteDetails 
    ? (missingCount === totalCount && totalCount > 0)
    : blocking; // Fallback to blocking prop if no details
  const hasWarnings = hasPrerequisiteDetails && missingCount > 0 && missingCount < totalCount;
  const isReady = canProceed && (!hasPrerequisiteDetails || missingCount === 0);

  // Determine card styling based on state
  const cardClasses = isFullyBlocked
    ? 'mb-6 border-2 border-red-200 bg-gradient-to-br from-red-50 to-orange-50'
    : isReady
    ? 'mb-6 border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50'
    : hasWarnings
    ? 'mb-6 border border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50'
    : 'mb-6 border border-blue-100 bg-blue-50/60';

  const headerColor = isFullyBlocked
    ? 'text-red-900'
    : isReady
    ? 'text-green-900'
    : hasWarnings
    ? 'text-yellow-900'
    : 'text-blue-900';

  const textColor = isFullyBlocked
    ? 'text-red-800'
    : isReady
    ? 'text-green-800'
    : hasWarnings
    ? 'text-yellow-800'
    : 'text-blue-900/80';

  // Get badge variant
  const badgeVariant = isFullyBlocked
    ? 'danger'
    : isReady
    ? 'success'
    : hasWarnings
    ? 'warning'
    : 'info';

  const badgeText = isFullyBlocked
    ? 'Blocked'
    : isReady
    ? 'Ready'
    : hasWarnings
    ? 'Warning'
    : 'Guided';

  return (
    <Card className={cardClasses}>
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h2 className={`text-base font-semibold ${headerColor}`}>{title}</h2>
          <Badge variant={badgeVariant}>{badgeText}</Badge>
        </div>
        {description && (
          <p className={`mt-2 text-sm ${textColor} leading-relaxed`}>
            {description}
          </p>
        )}

        {/* Enhanced Prerequisites Display */}
        {Object.keys(prerequisiteDetails).length > 0 ? (
          <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-3">
              Prerequisites Status
            </p>
            <ul className="space-y-2">
              {Object.entries(prerequisiteDetails).map(([key, item]) => (
                <li
                  key={key}
                  className="flex items-start gap-3 text-sm"
                >
                  {item.completed ? (
                    <>
                      <svg
                        className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
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
                      <span className="text-gray-700">{item.message}</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
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
                      <div className="flex-1">
                        <span className="text-gray-700">{item.message}</span>
                        {item.actionUrl && (
                          <Link
                            href={item.actionUrl}
                            className="ml-2 inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            {item.actionLabel || 'Fix'} →
                          </Link>
                        )}
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : prerequisites.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 mb-2">
              Prerequisites
            </p>
            <ul className="mt-2 grid gap-1 text-sm text-gray-700">
              {prerequisites.map((item, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="text-gray-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {actions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {actions.map((action, index) => {
              const isDisabled = blocking && action.required !== false;
              return (
                <Link
                  key={`${action.href}-${action.label}-${index}`}
                  href={action.href}
                  className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium shadow-sm ring-1 transition ${
                    isDisabled
                      ? 'bg-gray-100 text-gray-400 ring-gray-200 cursor-not-allowed'
                      : 'bg-white text-blue-700 ring-blue-200 hover:bg-blue-50'
                  }`}
                  onClick={(e) => isDisabled && e.preventDefault()}
                  title={isDisabled ? 'Complete prerequisites first' : ''}
                >
                  {action.label}
                </Link>
              );
            })}
          </div>
        )}

        {tip && (
          <p className={`mt-3 text-xs ${textColor} italic`}>
            💡 Tip: {tip}
          </p>
        )}
      </div>
    </Card>
  );
}
