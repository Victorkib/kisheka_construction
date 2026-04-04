/**
 * Cookie Configuration for Supabase Auth
 * 
 * This is the SINGLE SOURCE OF TRUTH for cookie options across the application.
 * All cookie setting operations should use these helpers to ensure consistency.
 * 
 * CRITICAL FOR PRODUCTION (Netlify):
 * - OAuth redirects require SameSite: 'lax' cookies to survive cross-site navigation
 * - Production requires Secure: true (HTTPS)
 * - HttpOnly prevents XSS attacks on session cookies
 */

/**
 * Default cookie options for Supabase session cookies
 * These are applied when setting cookies in the callback route
 * and should match what Supabase's @supabase/ssr expects
 */
export const DEFAULT_COOKIE_OPTIONS = {
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

/**
 * Merges Supabase's cookie options with our defaults
 * Preserves Supabase's original options while ensuring critical settings are correct
 * 
 * @param {Object} supabaseOptions - Cookie options from Supabase
 * @returns {Object} Merged cookie options
 */
export function mergeCookieOptions(supabaseOptions = {}) {
  return {
    // Start with Supabase's options
    ...supabaseOptions,
    // Override critical options only if not explicitly set by Supabase
    sameSite: supabaseOptions?.sameSite || DEFAULT_COOKIE_OPTIONS.sameSite,
    secure: supabaseOptions?.secure !== undefined
      ? supabaseOptions.secure
      : DEFAULT_COOKIE_OPTIONS.secure,
    httpOnly: supabaseOptions?.httpOnly !== undefined
      ? supabaseOptions.httpOnly
      : DEFAULT_COOKIE_OPTIONS.httpOnly,
    path: supabaseOptions?.path || DEFAULT_COOKIE_OPTIONS.path,
    maxAge: supabaseOptions?.maxAge || DEFAULT_COOKIE_OPTIONS.maxAge,
    // Only include domain if explicitly provided (don't set in development)
    ...(supabaseOptions?.domain ? { domain: supabaseOptions.domain } : {}),
  };
}

/**
 * Sets a cookie on a NextResponse object with proper options
 * 
 * @param {import('next/server').NextResponse} response - The NextResponse object
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {Object} options - Additional cookie options (merged with defaults)
 */
export function setCookieOnResponse(response, name, value, options = {}) {
  try {
    const cookieOptions = mergeCookieOptions(options);
    response.cookies.set(name, value, cookieOptions);
  } catch (error) {
    console.warn('[Cookie] Failed to set cookie:', name, error.message);
  }
}

/**
 * Sets multiple cookies on a NextResponse object
 * 
 * @param {import('next/server').NextResponse} response - The NextResponse object
 * @param {Array<{name: string, value: string, options?: Object}>} cookiesArray - Array of cookie configs
 */
export function setCookiesOnResponse(response, cookiesArray = []) {
  cookiesArray.forEach(({ name, value, options }) => {
    setCookieOnResponse(response, name, value, options);
  });
}
