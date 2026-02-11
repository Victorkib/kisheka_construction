/**
 * Mobile Breadcrumb Navigation Component
 * Compact version for mobile devices with swipe support
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home, ChevronLeft } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

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
    if (currentPath.startsWith('/api')) return;
    
    const label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
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
 * Mobile Breadcrumb Navigation Component
 * Shows last 2-3 items with back button
 */
export function BreadcrumbNavMobile({ customBreadcrumbs = null }) {
  const pathname = usePathname();
  const [showAll, setShowAll] = useState(false);
  const scrollRef = useRef(null);
  
  const breadcrumbs = customBreadcrumbs || generateBreadcrumbs(pathname);
  
  if (breadcrumbs.length <= 1) return null;

  // On mobile, show last 2 items + back button
  const visibleBreadcrumbs = showAll 
    ? breadcrumbs 
    : breadcrumbs.slice(-2);
  
  const hasMore = breadcrumbs.length > 2 && !showAll;

  // Scroll to end on mount
  useEffect(() => {
    if (scrollRef.current && !showAll) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [showAll, pathname]);

  return (
    <nav 
      className="lg:hidden flex items-center gap-1 text-xs text-gray-600 mb-3 overflow-x-auto scrollbar-hide touch-pan-x"
      ref={scrollRef}
      aria-label="Breadcrumb"
    >
      {/* Back Button */}
      {breadcrumbs.length > 1 && (
        <Link
          href={breadcrumbs[breadcrumbs.length - 2]?.href || '/dashboard'}
          className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0 touch-manipulation"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="font-medium">Back</span>
        </Link>
      )}

      {/* Show All Toggle */}
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="px-2 py-1.5 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0 text-gray-500 touch-manipulation"
        >
          ...
        </button>
      )}

      {/* Breadcrumb Items */}
      {visibleBreadcrumbs.map((crumb, index) => {
        const isLast = index === visibleBreadcrumbs.length - 1;
        const Icon = crumb.icon;
        const actualIndex = showAll ? index : breadcrumbs.length - visibleBreadcrumbs.length + index;

        return (
          <div key={crumb.href || actualIndex} className="flex items-center gap-1 flex-shrink-0">
            {actualIndex > 0 && (
              <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
            )}
            {isLast ? (
              <span className="font-medium text-gray-900 flex items-center gap-1 px-2 py-1.5 rounded-md bg-gray-50">
                {Icon && <Icon className="w-3 h-3 flex-shrink-0" />}
                <span className="truncate max-w-[120px]">{crumb.label}</span>
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-gray-900 transition-colors flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
              >
                {Icon && <Icon className="w-3 h-3 flex-shrink-0" />}
                <span className="truncate max-w-[100px]">{crumb.label}</span>
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
