/**
 * Logout API Route
 * Signs out user from Supabase session
 * POST /api/auth/logout
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function POST(request) {
  try {
    const supabase = await createClient();

    // Sign out from Supabase (clears session cookies)
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
      return errorResponse('Logout failed', 500);
    }

    return successResponse(null, 'Logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse('Logout failed', 500);
  }
}

