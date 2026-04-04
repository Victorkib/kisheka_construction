/**
 * OAuth Sync API Route
 * Syncs OAuth-authenticated users to MongoDB
 * POST /api/auth/sync
 *
 * CRITICAL: This route uses the unified determineUserRole() function
 * to ensure consistent role assignment with server-side sync.
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { errorResponse, successResponse } from '@/lib/api-response';
import { determineUserRole } from '@/lib/auth-helpers';

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { supabaseId, email, firstName, lastName } = await request.json();

    if (!supabaseId || !email) {
      return errorResponse('Supabase ID and email required', 400);
    }

    const db = await getDatabase();

    // Check if user exists in MongoDB
    let userProfile = await db.collection('users').findOne({
      supabaseId: supabaseId,
    });

    // If user doesn't exist, create them with unified role determination
    if (!userProfile) {
      // CRITICAL: Use the same role determination logic as server-side sync
      const determinedRole = await determineUserRole(email, db);

      console.log('[OAuth Sync API] Creating new user with determined role:', {
        email,
        role: determinedRole,
        roleSource: 'determineUserRole()'
      });

      const newUser = {
        supabaseId,
        email: email.toLowerCase().trim(),
        firstName: firstName || '',
        lastName: lastName || '',
        role: determinedRole, // Use unified role determination
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection('users').insertOne(newUser);
      userProfile = { _id: result.insertedId, ...newUser };

      console.log('[OAuth Sync API] User created successfully:', {
        userId: supabaseId,
        role: determinedRole
      });
    } else {
      // Update existing user's name and timestamp, but preserve their role
      await db.collection('users').updateOne(
        { supabaseId },
        {
          $set: {
            firstName: firstName || userProfile.firstName || '',
            lastName: lastName || userProfile.lastName || '',
            updatedAt: new Date(),
          },
        },
      );

      // Refresh the profile to get updated data
      userProfile = await db.collection('users').findOne({
        supabaseId: supabaseId,
      });

      console.log('[OAuth Sync API] Existing user updated:', {
        userId: supabaseId,
        role: userProfile.role
      });
    }

    return successResponse(
      {
        userId: supabaseId,
        _id: userProfile._id?.toString(),
        role: userProfile.role,
      },
      'User synced successfully',
      200,
    );
  } catch (error) {
    console.error('[OAuth Sync API] Error:', error);
    return errorResponse('Internal server error', 500);
  }
}
