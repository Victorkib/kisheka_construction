/**
 * Next.js Middleware
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
 * @module middleware
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
 * Next.js Middleware Function
 * 
 * Handles authentication and route protection for the application.
 * 
 * @param {import('next/server').NextRequest} request - The incoming request
 * @returns {Promise<import('next/server').NextResponse>} Response with appropriate redirects or continuation
 */
export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public routes
  if (matchesRoute(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next();
  }

  // Skip middleware for public API routes
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

    // Create Supabase client for middleware
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
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

    // Handle session errors gracefully
    if (sessionError) {
      console.error('Session error in middleware:', sessionError);
      // If there's a session error on a protected route, redirect to login
      if (isProtectedRoute) {
        const url = new URL('/auth/login', request.url);
        url.searchParams.set('redirect', pathname);
        url.searchParams.set('error', 'session_error');
        return NextResponse.redirect(url);
      }
      // For auth routes, allow the request to continue
      return response;
    }

    // Handle protected routes
    if (isProtectedRoute) {
      if (!session) {
        // Redirect to login if not authenticated
        const url = new URL('/auth/login', request.url);
        url.searchParams.set('redirect', pathname);
        return NextResponse.redirect(url);
      }
    }

    // Handle auth routes (redirect to dashboard if already logged in)
    if (isAuthRoute && session) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return response;
  } catch (error) {
    // Log error but don't crash the application
    console.error('Middleware error:', error);
    
    // For protected routes, redirect to login on error
    if (isProtectedRoute) {
      const url = new URL('/auth/login', request.url);
      url.searchParams.set('redirect', pathname);
      url.searchParams.set('error', 'middleware_error');
      return NextResponse.redirect(url);
    }

    // For other routes, allow the request to continue
    return response;
  }
}

/**
 * Middleware Configuration
 * 
 * Defines which routes the middleware should run on.
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
     * - API routes that don't need auth (handled in middleware function)
     */
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|css|js)$).*)',
  ],
};

