/**
 * Get Current User API Route
 * Returns the authenticated user's profile from MongoDB
 * GET /api/auth/me
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth-helpers';
import { successResponse, errorResponse } from '@/lib/api-response';

// Disable caching for this route - user data must always be fresh
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = await createClient();

    // Get authenticated user from Supabase
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      // CRITICAL FIX: Check if this is a session error that might be transient
      // For OAuth callbacks, session might not be immediately available
      // Return 401 but with a retry indicator
      const isTransientError = authError?.message?.includes('JWT') === false &&
                               authError?.message?.includes('expired') === false;
      
      if (isTransientError) {
        // Might be a race condition - return 401 but allow client to retry
        return errorResponse('Unauthorized - session may be initializing', 401);
      }
      
      return errorResponse('Unauthorized', 401);
    }

    // CRITICAL FIX: For OAuth users, retry MongoDB profile lookup
    // OAuth callback might have just completed and profile might not be ready yet
    const isOAuthUser = !!user.app_metadata?.provider;
    let userProfile = null;
    let profileRetryCount = 0;
    const profileMaxRetries = isOAuthUser ? 3 : 1; // More retries for OAuth users
    
    while (!userProfile && profileRetryCount < profileMaxRetries) {
      userProfile = await getUserProfile(user.id);
      
      if (!userProfile && profileRetryCount < profileMaxRetries - 1) {
        // Wait before retry: 200ms, 500ms, 1s
        const delay = [200, 500, 1000][profileRetryCount] || 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        profileRetryCount++;
        console.log(`[Auth Me] Profile not found, retrying... (attempt ${profileRetryCount}/${profileMaxRetries})`);
      } else {
        profileRetryCount++;
      }
    }

    if (!userProfile) {
      // CRITICAL FIX: For OAuth users, if profile not found after retries,
      // it might be a sync issue - return 404 but with helpful message
      if (isOAuthUser) {
        console.error('[Auth Me] OAuth user profile not found after retries:', {
          userId: user.id,
          email: user.email,
          provider: user.app_metadata.provider
        });
        return errorResponse('User profile not found - account may still be syncing. Please try again in a moment.', 404);
      }
      return errorResponse('User profile not found', 404);
    }

    // Return user data (exclude sensitive fields if needed)
    const { _id, ...profileData } = userProfile;

    const response = successResponse({
      id: user.id,
      _id: _id?.toString(),
      email: user.email,
      ...profileData,
    });

    // Add no-cache headers to prevent HTTP caching
    response.headers.set(
      'Cache-Control',
      'no-cache, no-store, must-revalidate, max-age=0',
    );
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse('Internal server error', 500);
  }
}
