/**
 * Get Current User API Route
 * Returns the authenticated user's profile from MongoDB
 * GET /api/auth/me
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth-helpers';
import { successResponse, errorResponse } from '@/lib/api-response';

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
    const userProfile = await getUserProfile(user.id);

    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Return user data (exclude sensitive fields if needed)
    const { _id, ...profileData } = userProfile;

    return successResponse({
      id: user.id,
      email: user.email,
      ...profileData,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse('Internal server error', 500);
  }
}

