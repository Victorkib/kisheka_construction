/**
 * Password Change API Route
 * Changes user's password
 * POST /api/profile/password
 * Auth: Authenticated users only
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/profile/password
 * Changes user's password
 * Body: { currentPassword, newPassword, confirmPassword }
 */
export async function POST(request) {
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

    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return errorResponse(
        'Current password, new password, and confirmation are required',
        400
      );
    }

    if (newPassword.length < 8) {
      return errorResponse(
        'New password must be at least 8 characters long',
        400
      );
    }

    if (newPassword !== confirmPassword) {
      return errorResponse('New password and confirmation do not match', 400);
    }

    if (currentPassword === newPassword) {
      return errorResponse(
        'New password must be different from current password',
        400
      );
    }

    // Verify current password by attempting to sign in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) {
      return errorResponse('Current password is incorrect', 401);
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      return errorResponse(
        updateError.message || 'Failed to update password',
        400
      );
    }

    // Log password change (optional - for audit trail)
    // You can add audit logging here if needed

    return successResponse(null, 'Password changed successfully');
  } catch (error) {
    console.error('Change password error:', error);
    return errorResponse('Internal server error', 500);
  }
}






















