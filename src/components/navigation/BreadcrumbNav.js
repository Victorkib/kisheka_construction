/**
 * Breadcrumb Navigation Component
 * Provides contextual navigation for deep pages
 * Reduces need for sidebar navigation on detail pages
 * Automatically uses mobile version on small screens
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { BreadcrumbNavMobile } from './BreadcrumbNavMobile';

/**
 * Generate breadcrumb items from pathname
 */
function generateBreadcrumbs(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = [
    { label: 'Home', href: '/dashboard', icon: Home },
  ];

  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Skip API routes
    if (currentPath.startsWith('/api')) return;
    
    // Format label
    const label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Check if it's a dynamic route (UUID-like)
    const isDynamic = /^[0-9a-f]{24}$/i.test(segment) || segment.length > 20;
    
    breadcrumbs.push({
      label: isDynamic ? 'Details' : label,
      href: currentPath,
      isLast: index === segments.length - 1,
    });
  });

  return breadcrumbs;
}

/**
 * Breadcrumb Navigation Component
 * Shows mobile version on small screens, desktop version on larger screens
 */
export function BreadcrumbNav({ customBreadcrumbs = null }) {
  const pathname = usePathname();
  
  const breadcrumbs = customBreadcrumbs || generateBreadcrumbs(pathname);
  
  // Don't show breadcrumbs on dashboard or home
  if (breadcrumbs.length <= 1) return null;

  return (
    <>
      {/* Mobile Version */}
      <div className="lg:hidden">
        <BreadcrumbNavMobile customBreadcrumbs={customBreadcrumbs} />
      </div>

      {/* Desktop Version */}
      <nav 
        className="hidden lg:flex items-center gap-2 text-sm text-gray-600 mb-4" 
        aria-label="Breadcrumb"
      >
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const Icon = crumb.icon;

        return (
          <div key={crumb.href || index} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {index > 0 && (
              <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
            )}
            {isLast ? (
              <span className="font-medium text-gray-900 flex items-center gap-1 truncate max-w-[150px] sm:max-w-none">
                {Icon && <Icon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />}
                <span className="truncate">{crumb.label}</span>
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-gray-900 transition-colors flex items-center gap-1 truncate max-w-[120px] sm:max-w-none"
              >
                {Icon && <Icon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />}
                <span className="truncate">{crumb.label}</span>
              </Link>
            )}
          </div>
        );
      })}
      </nav>
    </>
  );
}
