/**
 * Fetch Helpers
 * Utility functions for making API requests with proper cache control
 */

/**
 * Fetch with no-cache headers for dynamic data
 * Use this for all API calls that return user-specific or frequently changing data
 * 
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchNoCache(url, options = {}) {
  const defaultHeaders = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    cache: 'no-store',
    headers: defaultHeaders,
  });
}

/**
 * Fetch with cache for static/rarely changing data
 * Use this for data that doesn't change often (e.g., constants, templates)
 * 
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} maxAge - Maximum cache age in seconds (default: 300 = 5 minutes)
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithCache(url, options = {}, maxAge = 300) {
  return fetch(url, {
    ...options,
    next: { revalidate: maxAge },
    headers: {
      'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
      ...options.headers,
    },
  });
}
