/**
 * OAuth Sync API Route
 * Syncs OAuth-authenticated users to MongoDB
 * POST /api/auth/sync
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { errorResponse, successResponse } from '@/lib/api-response';

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

    // If user doesn't exist, create them
    if (!userProfile) {
      const newUser = {
        supabaseId,
        email: email.toLowerCase().trim(),
        firstName: firstName || '',
        lastName: lastName || '',
        role: 'site_clerk', // Default role for OAuth users
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection('users').insertOne(newUser);
      userProfile = { _id: result.insertedId, ...newUser };
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
        }
      );

      // Refresh the profile to get updated data
      userProfile = await db.collection('users').findOne({
        supabaseId: supabaseId,
      });
    }

    return successResponse(
      { userId: supabaseId, _id: userProfile._id?.toString(), role: userProfile.role },
      'User synced successfully',
      200
    );
  } catch (error) {
    console.error('OAuth sync error:', error);
    return errorResponse('Internal server error', 500);
  }
}
