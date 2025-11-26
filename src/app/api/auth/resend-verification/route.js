/**
 * Resend Verification Email API Route
 * Resends email verification link to user
 * POST /api/auth/resend-verification
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

    // Resend verification email
    // Note: Supabase will only send if email confirmation is enabled
    // and the user hasn't been confirmed yet
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.toLowerCase().trim(),
      options: {
        // Redirect to our callback route which will handle the verification
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback?type=signup`,
      },
    });

    if (error) {
      console.error('Resend verification error:', error);
      
      // Don't reveal if email exists or not (security best practice)
      // But provide helpful message
      if (error.message?.includes('already confirmed') || error.message?.includes('already verified')) {
        return successResponse(
          null,
          'This email is already verified. You can log in now.',
          200
        );
      }

      // Always return success to prevent email enumeration
      return successResponse(
        null,
        'If an account exists and is unverified, a verification email has been sent.',
        200
      );
    }

    return successResponse(
      null,
      'Verification email sent. Please check your inbox.',
      200
    );
  } catch (error) {
    console.error('Resend verification error:', error);
    // Always return success to prevent email enumeration
    return successResponse(
      null,
      'If an account exists and is unverified, a verification email has been sent.',
      200
    );
  }
}

