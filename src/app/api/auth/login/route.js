/**
 * Login API Route
 * Handles user authentication via Supabase and syncs to MongoDB
 * POST /api/auth/login
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { syncUserToMongoDB } from '@/lib/auth-helpers';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return errorResponse('Email and password required', 400);
    }

    const supabase = await createClient();

    // Authenticate with Supabase
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !data.user) {
      // Check if the error is due to email not being verified
      if (authError?.message?.includes('Email not confirmed') || 
          authError?.message?.includes('email not confirmed') ||
          authError?.message?.includes('Email not verified')) {
        return errorResponse(
          'Please verify your email address before signing in. Check your inbox for the verification link.',
          403
        );
      }
      
      // Check if user exists but email is not confirmed
      if (data.user && !data.user.email_confirmed_at) {
        return errorResponse(
          'Please verify your email address before signing in. Check your inbox for the verification link.',
          403
        );
      }
      
      return errorResponse('Invalid email or password', 401);
    }

    // Sync user to MongoDB (create or update profile)
    await syncUserToMongoDB(data.user, {
      lastLogin: new Date(),
    });

    return successResponse(
      {
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        message: 'Login successful',
      },
      'Logged in successfully',
      200
    );
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('Internal server error', 500);
  }
}

