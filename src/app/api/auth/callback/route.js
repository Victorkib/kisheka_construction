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
        // FIXED: Only check type parameter for email verification
        // OAuth always has provider in app_metadata, email verification doesn't
        const isEmailVerification = type === 'signup';
        
        // CRITICAL FIX: For OAuth users, ALWAYS ensure MongoDB profile exists
        // OAuth works for both registration (new users) and login (existing users)
        const isOAuthUser = !!data.user.app_metadata?.provider;
        
        if (isOAuthUser) {
          console.log('[OAuth Callback] OAuth user detected:', {
            userId: data.user.id,
            email: data.user.email,
            provider: data.user.app_metadata.provider
          });
          
          // Check if user already exists in MongoDB
          const { getUserProfile } = await import('@/lib/auth-helpers');
          let existingProfile = null;
          
          try {
            existingProfile = await getUserProfile(data.user.id);
            console.log('[OAuth Callback] MongoDB profile check:', {
              exists: !!existingProfile,
              userId: data.user.id
            });
          } catch (profileError) {
            console.error('[OAuth Callback] Error checking MongoDB profile:', profileError);
          }
          
          const isNewUser = !existingProfile;
          
          // CRITICAL: For ALL OAuth users (new or existing), ensure MongoDB sync completes
          // This ensures profile exists before redirecting to dashboard
          try {
            console.log('[OAuth Callback] Syncing user to MongoDB...', {
              isNewUser,
              userId: data.user.id,
              email: data.user.email
            });
            
            const syncedProfile = await syncUserToMongoDB(data.user, {
              isVerified: data.user.email_confirmed_at ? true : false,
            });
            
            console.log('[OAuth Callback] MongoDB sync successful:', {
              userId: data.user.id,
              mongoId: syncedProfile._id?.toString(),
              role: syncedProfile.role,
              isNewUser
            });
            
            // Verify the profile was actually created/updated
            const verifyProfile = await getUserProfile(data.user.id);
            if (!verifyProfile) {
              console.error('[OAuth Callback] CRITICAL: Profile not found after sync!');
              throw new Error('Profile not found after sync');
            }
            
            console.log('[OAuth Callback] Profile verified in MongoDB:', {
              userId: data.user.id,
              mongoId: verifyProfile._id?.toString()
            });
          } catch (syncError) {
            console.error('[OAuth Callback] CRITICAL MongoDB sync error:', {
              error: syncError.message,
              stack: syncError.stack,
              userId: data.user.id,
              email: data.user.email
            });
            
            // For OAuth, if sync fails, we still redirect but log the error
            // /api/auth/me will retry the sync
            // Don't block the user from accessing the app
          }
        } else {
          // Non-OAuth user (email/password) - sync in background
          syncUserToMongoDB(data.user, {
            isVerified: data.user.email_confirmed_at ? true : false,
          }).catch(syncError => {
            console.error('MongoDB sync error (non-fatal):', syncError);
          });
        }

        // Create redirect response
        // For OAuth flows, always redirect to dashboard (not landing page)
        // Only email verification should redirect to login page
        const redirectUrl = isEmailVerification 
          ? new URL('/auth/login?verified=true', request.url)
          : new URL(finalNext, request.url);

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
      // User has a session, redirect to dashboard
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

