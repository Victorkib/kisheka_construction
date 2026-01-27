/**
 * OAuth Sync API Route
 * Syncs OAuth-authenticated users to MongoDB
 * POST /api/auth/sync
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncUserToMongoDB } from '@/lib/auth-helpers';
import { errorResponse, successResponse } from '@/lib/api-response';

export async function POST(request) {
  try {
    const { supabaseId, email, firstName, lastName } = await request.json();

    if (!supabaseId) {
      return errorResponse('Supabase ID required', 400);
    }

    const supabase = await createClient();

    // Verify the user is actually authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || user.id !== supabaseId) {
      return errorResponse('Unauthorized', 401);
    }

    // Sync user to MongoDB
    await syncUserToMongoDB(user, {
      firstName: firstName || '',
      lastName: lastName || '',
      isVerified: user.email_confirmed_at ? true : false,
    });

    return successResponse(
      { userId: user.id },
      'User synced successfully',
      200
    );
  } catch (error) {
    console.error('OAuth sync error:', error);
    return errorResponse('Internal server error', 500);
  }
}
