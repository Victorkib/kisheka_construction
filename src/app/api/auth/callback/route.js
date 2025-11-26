/**
 * Auth Callback Route
 * Handles OAuth provider callbacks (Google, Discord) and email verification
 * GET /api/auth/callback
 * 
 * This route is called after:
 * 1. User authenticates with OAuth provider
 * 2. User clicks email verification link
 * 
 * It exchanges the code for a session and syncs user to MongoDB
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncUserToMongoDB } from '@/lib/auth-helpers';

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type'); // 'signup' for email verification
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  if (code) {
    const supabase = await createClient();

    try {
      // Exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Auth callback error:', error);
        return NextResponse.redirect(
          new URL(`/auth/login?error=${encodeURIComponent('Authentication failed')}`, request.url)
        );
      }

      if (data.user) {
        // Determine if this is email verification or OAuth
        const isEmailVerification = type === 'signup' || 
                                     (!data.user.app_metadata?.provider && data.user.email_confirmed_at);
        
        // Sync user to MongoDB
        await syncUserToMongoDB(data.user, {
          // OAuth users are automatically verified, email verification users are now verified
          isVerified: data.user.email_confirmed_at ? true : false,
        });

        // If this was an email verification, redirect to login with success message
        if (isEmailVerification) {
          return NextResponse.redirect(
            new URL('/auth/login?verified=true', request.url)
          );
        }

        // For OAuth, redirect to dashboard
        return NextResponse.redirect(new URL(next, request.url));
      }
    } catch (error) {
      console.error('Auth callback processing error:', error);
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent('Authentication failed')}`, request.url)
      );
    }
  }

  // If no code, redirect to login
  return NextResponse.redirect(new URL('/auth/login', request.url));
}

