/**
 * Auth Callback Route
 * Handles OAuth provider callbacks (Google, Discord) and email verification
 * GET /api/auth/callback
 * 
 * Note: With Supabase modern flow, this route is optional.
 * Supabase now handles session internally and redirects to origin.
 * This route handles edge cases and MongoDB syncing.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { syncUserToMongoDB } from '@/lib/auth-helpers';

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type'); // 'signup' for email verification
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  // CRITICAL FIX: Always redirect to dashboard for OAuth flows
  // Don't allow redirecting to landing page (/) or auth pages after OAuth
  // This prevents users from being stuck on landing page after successful OAuth
  let finalNext = next;
  if (next === '/' || next.startsWith('/auth/')) {
    finalNext = '/dashboard';
  }

  // If there's a code, exchange it (for email verification links and OAuth)
  if (code) {
    // CRITICAL FIX: Properly handle cookies for PKCE flow
    // The code verifier is stored in cookies by the browser client during OAuth initiation
    // We must read ALL cookies from the request to ensure code verifier is available
    const cookieStore = await cookies();
    const cookiesToSet = [];
    
    // Log available cookies in development for debugging
    if (process.env.NODE_ENV === 'development') {
      const allCookies = cookieStore.getAll();
      console.log('[Auth Callback] Available cookies:', allCookies.map(c => c.name));
    }
    
    // Create Supabase client with explicit cookie handling
    // This ensures we can read the code verifier cookie set by the browser client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSetArray) {
            // Track all cookies being set during exchangeCodeForSession
            cookiesToSetArray.forEach(({ name, value, options }) => {
              cookiesToSet.push({ name, value, options });
              try {
                cookieStore.set(name, value, options);
              } catch (error) {
                console.warn('[Auth Callback] Failed to set cookie:', name, error.message);
              }
            });
          },
        },
      }
    );

    try {
      // Exchange the code for a session
      // This requires the code verifier cookie to be available
      // The code verifier was set by the browser client during signInWithOAuth
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('[Auth Callback] Exchange error:', {
          message: error.message,
          status: error.status,
          name: error.name,
        });
        
        // Include actual error message in redirect (sanitized for URL)
        const errorMessage = error.message || 'Authentication failed';
        const sanitizedError = encodeURIComponent(errorMessage);
        
        return NextResponse.redirect(
          new URL(`/auth/login?error=${sanitizedError}`, request.url)
        );
      }

      if (data.user && data.session) {
        // FIXED: Only check type parameter for email verification
        // OAuth always has provider in app_metadata, email verification doesn't
        // The original logic was: type === 'signup' || (!data.user.app_metadata?.provider && data.user.email_confirmed_at)
        // This incorrectly identified OAuth as email verification when provider was missing
        const isEmailVerification = type === 'signup';
        
        // Sync user to MongoDB (non-blocking - doesn't delay redirect)
        // Fire and forget - sync happens in background
        syncUserToMongoDB(data.user, {
          isVerified: data.user.email_confirmed_at ? true : false,
        }).catch(syncError => {
          console.error('MongoDB sync error (non-fatal):', syncError);
          // Continue even if sync fails - user can still log in
        });

        // Create redirect response
        // For OAuth flows, always redirect to dashboard (not landing page)
        // Only email verification should redirect to login page
        const redirectUrl = isEmailVerification 
          ? new URL('/auth/login?verified=true', request.url)
          : new URL(finalNext, request.url);

        const response = NextResponse.redirect(redirectUrl);
        
        // CRITICAL FIX: Copy ALL cookies to redirect response
        // Session cookies and code verifier cookies must be included in the redirect
        // This ensures the session persists after redirect
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            // Set cookie with proper options for production
            const cookieOptions = {
              ...options,
              // Ensure SameSite is set correctly for OAuth redirects
              sameSite: options?.sameSite || 'lax',
              // Secure should be true in production (HTTPS)
              secure: process.env.NODE_ENV === 'production' ? true : (options?.secure ?? false),
              // HttpOnly for session cookies
              httpOnly: options?.httpOnly ?? true,
              // Path should be root to ensure cookies are available everywhere
              path: options?.path || '/',
            };
            response.cookies.set(name, value, cookieOptions);
          } catch (error) {
            console.warn('[Auth Callback] Failed to set cookie in response:', name, error.message);
          }
        });
        
        // Ensure no caching of this response
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        
        return response;
      } else {
        console.error('No user or session in callback data');
        return NextResponse.redirect(
          new URL(`/auth/login?error=${encodeURIComponent('Authentication failed: No session')}`, request.url)
        );
      }
    } catch (error) {
      console.error('Auth callback processing error:', error);
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent('Authentication failed')}`, request.url)
      );
    }
  }

  // If no code, check if there's an existing session
  // This handles cases where Supabase redirects without a code (modern flow)
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                cookieStore.set(name, value, options);
              } catch (error) {
                console.warn('[Auth Callback] Failed to set cookie:', name, error.message);
              }
            });
          },
        },
      }
    );
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      // User has a session, redirect to dashboard
      const response = NextResponse.redirect(new URL(finalNext, request.url));
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      return response;
    }
  } catch (error) {
    console.error('[Auth Callback] Session check error:', error);
  }

  // If no code and no session, redirect to login
  return NextResponse.redirect(new URL('/auth/login', request.url));
}

