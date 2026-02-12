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
import { createClient } from '@/lib/supabase/server';
import { syncUserToMongoDB } from '@/lib/auth-helpers';

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type'); // 'signup' for email verification
  let next = requestUrl.searchParams.get('next') || '/dashboard';

  // CRITICAL FIX: Always redirect to dashboard for OAuth flows
  // Don't allow redirecting to landing page (/) or auth pages after OAuth
  // This prevents users from being stuck on landing page after successful OAuth
  if (next === '/' || next.startsWith('/auth/')) {
    next = '/dashboard';
  }

  // If there's a code, exchange it (for email verification links and OAuth)
  if (code) {
    const supabase = await createClient();

    try {
      // Exchange the code for a session
      // This automatically sets session cookies via the server client
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Auth callback error:', error);
        return NextResponse.redirect(
          new URL(`/auth/login?error=${encodeURIComponent('Authentication failed')}`, request.url)
        );
      }

      if (data.user && data.session) {
        // Determine if this is email verification or OAuth
        const isEmailVerification = type === 'signup' || 
                                     (!data.user.app_metadata?.provider && data.user.email_confirmed_at);
        
        // Sync user to MongoDB
        try {
          await syncUserToMongoDB(data.user, {
            isVerified: data.user.email_confirmed_at ? true : false,
          });
        } catch (syncError) {
          console.error('MongoDB sync error (non-fatal):', syncError);
          // Continue even if sync fails - user can still log in
        }

        // Create redirect response
        // CRITICAL FIX: For OAuth flows, always redirect to dashboard (not landing page)
        // Only email verification should redirect to login page
        const redirectUrl = isEmailVerification 
          ? new URL('/auth/login?verified=true', request.url)
          : new URL(next, request.url);

        const response = NextResponse.redirect(redirectUrl);
        
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
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      // CRITICAL FIX: Always redirect to dashboard if session exists
      // Don't redirect to landing page or auth pages
      const finalNext = (next === '/' || next.startsWith('/auth/')) ? '/dashboard' : next;
      const response = NextResponse.redirect(new URL(finalNext, request.url));
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      return response;
    }
  } catch (error) {
    console.error('Session check error:', error);
  }

  // If no code and no session, redirect to login
  return NextResponse.redirect(new URL('/auth/login', request.url));
}

