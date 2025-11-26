/**
 * Page Layout Helpers
 * Utility functions and classes for consistent page layouts with sidebar
 */

/**
 * Get content wrapper classes that account for sidebar
 * @param {boolean} collapsed - Whether sidebar is collapsed
 * @returns {string} CSS classes for content wrapper
 */
export function getContentWrapperClasses(collapsed = false) {
  const sidebarMargin = collapsed ? 'lg:ml-16' : 'lg:ml-64';
  return `${sidebarMargin} transition-all duration-300`;
}

/**
 * Standard page container classes
 * Use this for pages that need to work with the sidebar
 */
export const PAGE_CONTAINER_CLASSES = 'lg:ml-64 lg:transition-all lg:duration-300 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8';

/**
 * Full-width page container (for pages that span full width)
 */
export const FULL_WIDTH_CONTAINER_CLASSES = 'lg:ml-64 lg:transition-all lg:duration-300 p-4 sm:p-6 lg:p-8';

