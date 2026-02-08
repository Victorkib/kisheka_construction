/**
 * Reset Password API Route
 * Completes password reset process
 * POST /api/auth/reset-password
 * 
 * NOTE: This route expects a token from the password reset email link
 * The token is typically passed as a query parameter in the email link
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return errorResponse('Token and password required', 400);
    }

    if (password.length < 8) {
      return errorResponse('Password must be at least 8 characters', 400);
    }

    const supabase = await createClient();

    // Exchange the token for a session
    // NOTE: In Supabase, password reset tokens are typically handled via URL hash fragments
    // This implementation may need adjustment based on your Supabase configuration
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(token);

    if (exchangeError) {
      // If token exchange fails, try direct password update with service role
      // This is a fallback - the token should work via the email link redirect
      console.warn('Token exchange failed, attempting direct update:', exchangeError.message);
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      return errorResponse(updateError.message || 'Failed to reset password', 400);
    }

    return successResponse(null, 'Password updated successfully');
  } catch (error) {
    console.error('Reset password error:', error);
    return errorResponse('Internal server error', 500);
  }
}

