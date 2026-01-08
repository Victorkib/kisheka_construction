/**
 * Recent Projects API Route
 * POST: Add a project to user's recent projects list
 * 
 * POST /api/user/project-preferences/recent
 * Auth: Authenticated users (own data only)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/user/project-preferences/recent
 * Adds a project to user's recent projects list (max 5)
 */
export async function POST(request) {
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
    const { projectId } = body;

    if (!projectId) {
      return errorResponse('projectId is required', 400);
    }

    if (!ObjectId.isValid(projectId)) {
      return errorResponse('Invalid projectId', 400);
    }

    const db = await getDatabase();
    const userId = userProfile._id;
    const projectObjectId = new ObjectId(projectId);

    // Get current preferences
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
    }

    // Update recent projects list
    let recentProjects = preferences.recentProjects || [];

    // Remove project if it already exists in recent list
    recentProjects = recentProjects.filter(
      (id) => id.toString() !== projectId
    );

    // Add project to the beginning
    recentProjects.unshift(projectObjectId);

    // Keep only the last 5 projects
    recentProjects = recentProjects.slice(0, 5);

    // Update preferences
    await db.collection('user_project_preferences').findOneAndUpdate(
      { userId: userId },
      {
        $set: {
          recentProjects: recentProjects,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return successResponse(
      { recentProjects: recentProjects.map((id) => id.toString()) },
      'Recent projects updated successfully'
    );
  } catch (error) {
    console.error('Update recent projects error:', error);
    return errorResponse('Failed to update recent projects', 500);
  }
}







