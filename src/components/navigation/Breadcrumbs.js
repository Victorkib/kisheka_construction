/**
 * Breadcrumb Navigation Component
 * Displays navigation path and allows easy navigation back
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Breadcrumb item structure
 * @typedef {Object} BreadcrumbItem
 * @property {string} label - Display label
 * @property {string} href - Link URL
 * @property {boolean} [current] - Is current page
 */

/**
 * Breadcrumbs Component
 * @param {Object} props
 * @param {BreadcrumbItem[]} [props.items] - Custom breadcrumb items (optional)
 * @param {boolean} [props.showHome=true] - Show home link
 */
export function Breadcrumbs({ items, showHome = true }) {
  const pathname = usePathname();

  // If custom items provided, use them
  if (items && items.length > 0) {
    return (
      <nav className="flex items-center space-x-2 text-sm mb-4" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2">
          {showHome && (
            <>
              <li>
                <Link
                  href="/dashboard"
                  className="text-gray-500 hover:text-gray-700 transition"
                >
                  Home
                </Link>
              </li>
              <li>
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </li>
            </>
          )}
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={`${item.href}-${index}`} className="flex items-center">
                {isLast || item.current ? (
                  <span className="text-gray-900 font-medium">{item.label}</span>
                ) : (
                  <>
                    <Link
                      href={item.href}
                      className="text-gray-500 hover:text-gray-700 transition"
                    >
                      {item.label}
                    </Link>
                    <svg className="w-4 h-4 text-gray-400 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  // Auto-generate breadcrumbs from pathname
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbItems = [];

  // Add home
  if (showHome) {
    breadcrumbItems.push({
      label: 'Home',
      href: '/dashboard',
    });
  }

  // Build breadcrumbs from path segments
  let currentPath = '';
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === pathSegments.length - 1;
    
    // Format label (capitalize, replace hyphens)
    const label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    breadcrumbItems.push({
      label,
      href: currentPath,
      current: isLast,
    });
  });

  return (
    <nav className="flex items-center space-x-2 text-sm mb-4" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          return (
            <li key={`${item.href}-${index}`} className="flex items-center">
              {isLast || item.current ? (
                <span className="text-gray-900 font-medium">{item.label}</span>
              ) : (
                <>
                  <Link
                    href={item.href}
                    className="text-gray-500 hover:text-gray-700 transition"
                  >
                    {item.label}
                  </Link>
                  <svg className="w-4 h-4 text-gray-400 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Workflow Breadcrumbs Component
 * Shows workflow progression (e.g., Project → Request → Approval → Order)
 * @param {Object} props
 * @param {string[]} props.steps - Array of step labels
 * @param {number} props.currentStep - Current step index (0-based)
 * @param {Object} props.links - Map of step labels to URLs
 */
export function WorkflowBreadcrumbs({ steps, currentStep, links = {} }) {
  return (
    <nav className="flex items-center space-x-2 text-sm mb-4" aria-label="Workflow Breadcrumb">
      <ol className="flex items-center space-x-2">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isCurrent = index === currentStep;
          const isCompleted = index < currentStep;
          const stepUrl = links[step];

          return (
            <li key={index} className="flex items-center">
              {isCompleted && stepUrl ? (
                <>
                  <Link
                    href={stepUrl}
                    className="text-blue-600 hover:text-blue-800 font-medium transition"
                  >
                    {step}
                  </Link>
                  <svg className="w-4 h-4 text-gray-400 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              ) : isCurrent ? (
                <span className="text-gray-900 font-semibold">{step}</span>
              ) : (
                <>
                  <span className="text-gray-400">{step}</span>
                  {!isLast && (
                    <svg className="w-4 h-4 text-gray-400 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

