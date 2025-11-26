/**
 * Forgot Password API Route
 * Sends password reset email via Supabase
 * POST /api/auth/forgot-password
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return errorResponse('Email required', 400);
    }

    const supabase = await createClient();

    // Send password reset email
    // NOTE: redirectTo URL must be configured in Supabase dashboard
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password`,
    });

    if (error) {
      console.error('Forgot password error:', error);
      // Don't reveal if email exists or not (security best practice)
      return errorResponse('If an account exists, a password reset email has been sent.', 400);
    }

    // Always return success to prevent email enumeration
    return successResponse(null, 'If an account exists, a password reset email has been sent.');
  } catch (error) {
    console.error('Forgot password error:', error);
    return errorResponse('Internal server error', 500);
  }
}

