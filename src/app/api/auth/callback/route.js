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
    // CRITICAL FIX: Track cookies set during exchangeCodeForSession
    // In production, cookies must be explicitly copied to redirect response
    const cookieStore = await cookies();
    const cookiesToSet = [];
    
    // Create Supabase client with custom cookie handler that tracks cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookies) {
            // Track all cookies being set
            cookies.forEach(({ name, value, options }) => {
              cookiesToSet.push({ name, value, options });
              try {
                cookieStore.set(name, value, options);
              } catch (error) {
                console.warn('Failed to set cookie:', error.message);
              }
            });
          },
        },
      }
    );

    try {
      // Exchange the code for a session
      // This will trigger setAll callback which tracks cookies
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Auth callback error:', error);
        return NextResponse.redirect(
          new URL(
            `/auth/login?error=${encodeURIComponent(`Authentication failed: ${error.message || 'Unknown error'}`)}`,
            request.url,
          )
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
            // CRITICAL: Retry verification up to 3 times with delays
            // This handles race conditions where MongoDB write hasn't propagated yet
            let verifyProfile = null;
            let verifyAttempts = 0;
            const maxVerifyAttempts = 3;
            
            while (!verifyProfile && verifyAttempts < maxVerifyAttempts) {
              await new Promise(resolve => setTimeout(resolve, verifyAttempts * 200)); // 0ms, 200ms, 400ms
              verifyProfile = await getUserProfile(data.user.id);
              verifyAttempts++;
              
              if (!verifyProfile && verifyAttempts < maxVerifyAttempts) {
                console.log(`[OAuth Callback] Profile not found, retrying verification (attempt ${verifyAttempts}/${maxVerifyAttempts})...`);
              }
            }
            
            if (!verifyProfile) {
              console.error('[OAuth Callback] CRITICAL: Profile not found after sync and verification retries!');
              throw new Error('Profile not found after sync - MongoDB sync may have failed');
            }
            
            console.log('[OAuth Callback] Profile verified in MongoDB:', {
              userId: data.user.id,
              mongoId: verifyProfile._id?.toString(),
              verificationAttempts: verifyAttempts
            });
          } catch (syncError) {
            console.error('[OAuth Callback] CRITICAL MongoDB sync error:', {
              error: syncError.message,
              stack: syncError.stack,
              userId: data.user.id,
              email: data.user.email
            });
            
            // CRITICAL FIX: If MongoDB sync fails, don't redirect to dashboard
            // Redirect to login with error message so user can retry
            // This prevents redirect loops where user has Supabase session but no MongoDB profile
            return NextResponse.redirect(
              new URL(
                `/auth/login?error=${encodeURIComponent('Account setup failed. Please try signing in again.')}`,
                request.url
              )
            );
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
        
        // CRITICAL FIX: Copy all session cookies to redirect response
        // In production, cookies set during exchangeCodeForSession must be explicitly included
        // This ensures cookies are sent with the redirect response
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            // Ensure production cookie settings
            httpOnly: options?.httpOnly ?? true,
            secure: options?.secure ?? (process.env.NODE_ENV === 'production'),
            sameSite: options?.sameSite ?? 'lax',
            path: options?.path ?? '/',
          });
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
          setAll(cookies) {
            cookies.forEach(({ name, value, options }) => {
              try {
                cookieStore.set(name, value, options);
              } catch (error) {
                console.warn('Failed to set cookie:', error.message);
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
    console.error('Session check error:', error);
  }

  // If no code and no session, redirect to login
  return NextResponse.redirect(new URL('/auth/login', request.url));
}
