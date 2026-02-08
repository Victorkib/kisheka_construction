/**
 * Logout API Route
 * Signs out user from Supabase session and clears caches
 * POST /api/auth/logout
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabase = await createClient();

    // Sign out from Supabase (clears session cookies)
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
      return errorResponse('Logout failed', 500);
    }

    // Return response with cache-control headers to prevent caching
    const response = successResponse(null, 'Logged out successfully');
    
    // Add no-cache headers to prevent HTTP caching
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse('Logout failed', 500);
  }
}

