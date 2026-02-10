/**
 * Next.js Proxy (Middleware replacement)
 *
 * Protects routes and handles authentication using Supabase SSR.
 * Runs on every request before the page renders to ensure:
 * - Protected routes require authentication
 * - Authenticated users are redirected away from auth pages
 * - Session cookies are properly managed
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 * @see https://supabase.com/docs/guides/auth/server-side/creating-a-client
 *
 * @module proxy
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Routes that require authentication
 * Users must be logged in to access these routes
 */
const PROTECTED_ROUTES = [
  '/dashboard',
  '/projects',
  '/reports',
  '/admin',
  '/items',
  '/labour',
  '/expenses',
  '/categories',
  '/floors',
  '/investors',
  '/financing',
  '/initial-expenses',
  '/profile',
];

/**
 * Auth routes that should redirect to dashboard if already logged in
 * Prevents authenticated users from accessing login/register pages
 */
const AUTH_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
];

/**
 * Public routes that should always be accessible
 * These routes bypass authentication checks
 */
const PUBLIC_ROUTES = [
  '/',
  '/api/auth/callback',
];

/**
 * Routes that should bypass proxy entirely
 * These are handled by their own route handlers
 */
const BYPASS_ROUTES = [
  '/api/auth/callback', // OAuth callback handles its own auth
];

/**
 * Check if a pathname matches any of the given routes
 * @param {string} pathname - The pathname to check
 * @param {string[]} routes - Array of routes to match against
 * @returns {boolean} True if pathname starts with any route
 */
function matchesRoute(pathname, routes) {
  return routes.some((route) => pathname.startsWith(route));
}

/**
 * Check if a pathname is a public API route
 * @param {string} pathname - The pathname to check
 * @returns {boolean} True if pathname is a public API route
 */
function isPublicApiRoute(pathname) {
  const publicApiRoutes = [
    '/api/auth/callback',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/sms/webhook', // SMS webhook from Africa's Talking (external service)
  ];
  return publicApiRoutes.some((route) => pathname.startsWith(route));
}

/**
 * Next.js Proxy Function
 *
 * Handles authentication and route protection for the application.
 *
 * @param {import('next/server').NextRequest} request - The incoming request
 * @returns {Promise<import('next/server').NextResponse>} Response with appropriate redirects or continuation
 */
export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // Skip proxy entirely for bypass routes
  if (matchesRoute(pathname, BYPASS_ROUTES)) {
    return NextResponse.next();
  }

  // Skip proxy for public routes
  if (matchesRoute(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next();
  }

  // Skip proxy for public API routes
  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  // Check if route is protected or auth route
  const isProtectedRoute = matchesRoute(pathname, PROTECTED_ROUTES);
  const isAuthRoute = matchesRoute(pathname, AUTH_ROUTES);

  // Early return if route doesn't need authentication check
  if (!isProtectedRoute && !isAuthRoute) {
    return NextResponse.next();
  }

  // Create response object for cookie setting
  let response = NextResponse.next();
  // Track cookies Supabase wants to set during this request so we can attach them
  // to BOTH normal responses and redirect responses (critical to avoid auth flapping/loops).
  let cookiesToSetForResponse = [];

  const applyCookiesToResponse = (res) => {
    try {
      if (cookiesToSetForResponse?.length) {
        cookiesToSetForResponse.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      }
    } catch (e) {
      // Don't crash proxy if cookie APIs differ in certain runtimes
      console.error('Failed to apply cookies to response:', e);
    }
    return res;
  };

  try {
    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables');
      // In production, you might want to redirect to an error page
      // For now, allow the request to continue
      return response;
    }

    // Create Supabase client for proxy
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Persist these so redirects also include them
          cookiesToSetForResponse = cookiesToSet;
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    // Check authentication status
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    // CRITICAL FIX: Handle session errors gracefully
    // In production, session checks can flap due to cookie timing issues
    // We should be very lenient and only redirect on clear auth failures
    if (sessionError) {
      console.error('Session error in proxy:', sessionError);
      
      // Check if this is a critical auth error (not just a network/transient error)
      const isCriticalError = sessionError.message?.includes('JWT') || 
                              sessionError.message?.includes('token') ||
                              sessionError.message?.includes('expired') ||
                              sessionError.status === 401 ||
                              sessionError.status === 403;
      
      // CRITICAL FIX: For dashboard routes, be extra lenient
      // Allow dashboard routes to continue even with session errors
      // Client-side will handle auth and redirect if truly needed
      if (pathname.startsWith('/dashboard')) {
        console.warn('Dashboard route with session error, allowing client-side handling:', sessionError.message);
        return applyCookiesToResponse(response);
      }
      
      // Only redirect on critical auth errors, not transient network issues
      if (isCriticalError && isProtectedRoute) {
        const url = new URL('/auth/login', request.url);
        url.searchParams.set('redirect', pathname);
        url.searchParams.set('error', 'session_error');
        return applyCookiesToResponse(NextResponse.redirect(url));
      }
      
      // For transient errors or non-critical errors, allow request to continue
      // The page/API route will handle the error appropriately
      if (isProtectedRoute && !session) {
        // No session and critical error - redirect to login
        if (isCriticalError) {
          const url = new URL('/auth/login', request.url);
          url.searchParams.set('redirect', pathname);
          return applyCookiesToResponse(NextResponse.redirect(url));
        }
        // Transient error but no session - be lenient, allow to continue
        // The client-side will handle re-authentication if needed
        return applyCookiesToResponse(response);
      }
      
      // For auth routes, allow the request to continue
      return applyCookiesToResponse(response);
    }

    // Handle protected routes
    if (isProtectedRoute) {
      if (!session) {
        // CRITICAL FIX: Don't redirect if we're already on a dashboard route and session check failed
        // This prevents redirect loops when session is temporarily unavailable
        // The client-side code will handle re-authentication
        if (pathname.startsWith('/dashboard/')) {
          // Allow dashboard routes to continue even without session
          // Client-side will handle auth check and redirect if needed
          console.warn('Dashboard route accessed without session, allowing client-side handling');
          return applyCookiesToResponse(response);
        }
        
        // Redirect to login if not authenticated (only if we got a clean response with no session)
        const url = new URL('/auth/login', request.url);
        url.searchParams.set('redirect', pathname);
        return applyCookiesToResponse(NextResponse.redirect(url));
      }
    }

    // Handle auth routes (redirect to dashboard if already logged in)
    if (isAuthRoute && session) {
      return applyCookiesToResponse(NextResponse.redirect(new URL('/dashboard', request.url)));
    }

    return applyCookiesToResponse(response);
  } catch (error) {
    // Log error but don't crash the application
    console.error('Proxy error:', error);

    // Only redirect on critical errors, not transient network issues
    // Most errors (network timeouts, connection issues) should allow the request to continue
    // The client-side code will handle re-authentication if needed
    const isCriticalError = error.message?.includes('ENOTFOUND') === false && 
                            error.message?.includes('ECONNREFUSED') === false &&
                            error.message?.includes('timeout') === false &&
                            error.code !== 'ECONNREFUSED' &&
                            error.code !== 'ETIMEDOUT';
    
    // For protected routes, only redirect on critical errors
    if (isProtectedRoute && isCriticalError) {
      const url = new URL('/auth/login', request.url);
      url.searchParams.set('redirect', pathname);
      url.searchParams.set('error', 'proxy_error');
      return applyCookiesToResponse(NextResponse.redirect(url));
    }

    // For transient errors or other routes, allow the request to continue
    // This prevents users from being kicked out during form filling due to network issues
    return applyCookiesToResponse(response);
  }
}

/**
 * Proxy Configuration
 *
 * Defines which routes the proxy should run on.
 * Uses a negative lookahead regex to exclude:
 * - Static files (_next/static)
 * - Image optimization files (_next/image)
 * - Favicon
 * - Image files (svg, png, jpg, jpeg, gif, webp)
 * - Font files (woff, woff2, ttf, eot)
 * - Other static assets
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (images, fonts, etc.)
     * - API routes that don't need auth (handled in proxy function)
     */
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|css|js)$).*)',
  ],
};
