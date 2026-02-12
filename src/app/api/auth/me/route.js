/**
 * Get Current User API Route
 * Returns the authenticated user's profile from MongoDB
 * GET /api/auth/me
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile, syncUserToMongoDB } from '@/lib/auth-helpers';
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
      return errorResponse('Unauthorized', 401);
    }

    // Get full user profile from MongoDB
    // CRITICAL FIX: Retry logic for OAuth users - MongoDB sync might not be complete yet
    let userProfile = await getUserProfile(user.id);
    
    // If profile not found, it might be because MongoDB sync is still in progress
    // For OAuth users, try to sync now and retry
    if (!userProfile) {
      // Check if this is an OAuth user (has provider in metadata)
      const isOAuthUser = user.app_metadata?.provider;
      
      if (isOAuthUser) {
        // Try to sync user to MongoDB (might be in progress from callback)
        try {
          await syncUserToMongoDB(user, {
            isVerified: user.email_confirmed_at ? true : false,
          });
          
          // Retry getting profile after sync
          userProfile = await getUserProfile(user.id);
          
          // If still not found after sync, wait a bit and retry once more
          if (!userProfile) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
            userProfile = await getUserProfile(user.id);
          }
        } catch (syncError) {
          console.error('Failed to sync user in /api/auth/me:', syncError);
          // Continue - will return 404 if profile still not found
        }
      }
    }

    if (!userProfile) {
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
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse('Internal server error', 500);
  }
}

