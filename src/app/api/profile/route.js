/**
 * Profile API Route
 * GET: Get current user's profile
 * PATCH: Update current user's profile
 * 
 * GET /api/profile
 * PATCH /api/profile
 * Auth: Authenticated users only
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth-helpers';
import { getDatabase } from '@/lib/mongodb/connection';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/profile
 * Returns current user's full profile
 */
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

    // Return user data (exclude sensitive fields)
    const { _id, supabaseId, ...profileData } = userProfile;

    return successResponse({
      id: user.id,
      email: user.email,
      ...profileData,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * PATCH /api/profile
 * Updates current user's profile
 * Body: { firstName?, lastName?, phone?, timezone?, language?, notificationPreferences? }
 */
export async function PATCH(request) {
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

    // Get user profile to verify it exists
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      phone,
      timezone,
      language,
      notificationPreferences,
    } = body;

    // Validate inputs
    if (firstName !== undefined) {
      if (typeof firstName !== 'string' || firstName.trim().length === 0) {
        return errorResponse('First name must be a non-empty string', 400);
      }
      if (firstName.trim().length > 100) {
        return errorResponse('First name must be less than 100 characters', 400);
      }
    }

    if (lastName !== undefined) {
      if (typeof lastName !== 'string' || lastName.trim().length === 0) {
        return errorResponse('Last name must be a non-empty string', 400);
      }
      if (lastName.trim().length > 100) {
        return errorResponse('Last name must be less than 100 characters', 400);
      }
    }

    if (phone !== undefined && phone !== null) {
      if (typeof phone !== 'string') {
        return errorResponse('Phone must be a string', 400);
      }
      // Basic phone validation (allows international formats)
      if (phone.trim().length > 20) {
        return errorResponse('Phone number must be less than 20 characters', 400);
      }
    }

    if (timezone !== undefined && timezone !== null) {
      if (typeof timezone !== 'string') {
        return errorResponse('Timezone must be a string', 400);
      }
      // Validate timezone format (basic check)
      if (timezone.trim().length === 0) {
        return errorResponse('Timezone cannot be empty', 400);
      }
    }

    if (language !== undefined && language !== null) {
      if (typeof language !== 'string') {
        return errorResponse('Language must be a string', 400);
      }
      // Validate language code (basic check: 2-5 characters)
      if (!/^[a-z]{2}(-[A-Z]{2,3})?$/.test(language)) {
        return errorResponse('Invalid language code format', 400);
      }
    }

    // Validate notification preferences structure
    if (notificationPreferences !== undefined) {
      if (typeof notificationPreferences !== 'object' || notificationPreferences === null) {
        return errorResponse('Notification preferences must be an object', 400);
      }

      const validPrefs = [
        'emailNotifications',
        'approvalAlerts',
        'budgetAlerts',
        'dailyReports',
      ];

      for (const key of Object.keys(notificationPreferences)) {
        if (!validPrefs.includes(key)) {
          return errorResponse(`Invalid notification preference: ${key}`, 400);
        }
        if (typeof notificationPreferences[key] !== 'boolean') {
          return errorResponse(`Notification preference ${key} must be a boolean`, 400);
        }
      }
    }

    // Build update object
    const updateData = {
      updatedAt: new Date(),
    };

    if (firstName !== undefined) {
      updateData.firstName = firstName.trim();
    }

    if (lastName !== undefined) {
      updateData.lastName = lastName.trim();
    }

    if (phone !== undefined) {
      updateData.phone = phone.trim() || null;
    }

    if (timezone !== undefined) {
      updateData.timezone = timezone.trim() || null;
    }

    if (language !== undefined) {
      updateData.language = language.trim() || null;
    }

    if (notificationPreferences !== undefined) {
      // Merge with existing preferences
      const existingPrefs = userProfile.notificationPreferences || {
        emailNotifications: true,
        approvalAlerts: true,
        budgetAlerts: true,
        dailyReports: false,
      };

      updateData.notificationPreferences = {
        ...existingPrefs,
        ...notificationPreferences,
      };
    }

    // Update user in MongoDB
    const db = await getDatabase();
    await db.collection('users').updateOne(
      { supabaseId: user.id },
      { $set: updateData }
    );

    // Get updated profile
    const updatedProfile = await getUserProfile(user.id);
    const { _id, supabaseId, ...profileData } = updatedProfile;

    return successResponse(
      {
        id: user.id,
        email: user.email,
        ...profileData,
      },
      'Profile updated successfully'
    );
  } catch (error) {
    console.error('Update profile error:', error);
    return errorResponse('Internal server error', 500);
  }
}





























