/**
 * User Project Preferences API Route
 * GET: Get user's project preferences
 * PATCH: Update user's project preferences
 * 
 * GET/PATCH /api/user/project-preferences
 * Auth: Authenticated users (own data only)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/user/project-preferences
 * Returns user's project preferences
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();
    const userId = userProfile._id;

    // Get or create preferences
    let preferences = await db.collection('user_project_preferences').findOne({
      userId: userId,
    });

    if (!preferences) {
      // Create default preferences
      preferences = {
        userId: userId,
        lastProjectId: null,
        favoriteProjects: [],
        recentProjects: [],
        updatedAt: new Date(),
      };

      await db.collection('user_project_preferences').insertOne(preferences);
    }

    return successResponse(preferences);
  } catch (error) {
    console.error('Get project preferences error:', error);
    return errorResponse('Failed to retrieve project preferences', 500);
  }
}

/**
 * PATCH /api/user/project-preferences
 * Updates user's project preferences
 */
export async function PATCH(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const { lastProjectId, favoriteProjects } = body;

    const db = await getDatabase();
    const userId = userProfile._id;

    // Validate project IDs if provided
    if (lastProjectId && !ObjectId.isValid(lastProjectId)) {
      return errorResponse('Invalid lastProjectId', 400);
    }

    if (favoriteProjects && Array.isArray(favoriteProjects)) {
      const invalidIds = favoriteProjects.filter((id) => !ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        return errorResponse('Invalid favorite project IDs', 400);
      }
    }

    // Update preferences
    const updateData = {
      updatedAt: new Date(),
    };

    if (lastProjectId !== undefined) {
      updateData.lastProjectId = lastProjectId ? new ObjectId(lastProjectId) : null;
    }

    if (favoriteProjects !== undefined) {
      updateData.favoriteProjects = favoriteProjects.map((id) => new ObjectId(id));
    }

    const result = await db.collection('user_project_preferences').findOneAndUpdate(
      { userId: userId },
      { $set: updateData },
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    const updatedPreferences = result.value || {
      userId: userId,
      lastProjectId: updateData.lastProjectId,
      favoriteProjects: updateData.favoriteProjects || [],
      recentProjects: [],
      updatedAt: updateData.updatedAt,
    };

    return successResponse(updatedPreferences, 'Preferences updated successfully');
  } catch (error) {
    console.error('Update project preferences error:', error);
    return errorResponse('Failed to update project preferences', 500);
  }
}














