/**
 * Floor Progress API Route
 * GET: Get floor progress (photos, completion percentage)
 * POST: Add floor photo
 * PATCH: Update completion percentage or milestone notes
 * 
 * GET /api/floors/[id]/progress
 * POST /api/floors/[id]/progress
 * PATCH /api/floors/[id]/progress
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/floors/[id]/progress
 * Returns floor progress data (photos, completion percentage, milestone notes)
 * Auth: All authenticated users
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid floor ID', 400);
    }

    const db = await getDatabase();
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(id),
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    // Return progress data (default to empty if not exists)
    const progress = floor.progress || {
      photos: [],
      completionPercentage: 0,
      milestoneNotes: '',
    };

    return successResponse(progress, 'Floor progress retrieved successfully');
  } catch (error) {
    console.error('Get floor progress error:', error);
    return errorResponse('Failed to retrieve floor progress', 500);
  }
}

/**
 * POST /api/floors/[id]/progress
 * Adds a floor photo
 * Auth: All authenticated users (CLERK, PM, OWNER can add)
 */
export async function POST(request, { params }) {
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

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid floor ID', 400);
    }

    const body = await request.json();
    const { photo } = body;

    if (!photo || !photo.url) {
      return errorResponse('Photo URL is required', 400);
    }

    const db = await getDatabase();

    // Verify floor exists
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(id),
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    // Initialize progress if it doesn't exist
    if (!floor.progress) {
      await db.collection('floors').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            progress: {
              photos: [],
              completionPercentage: 0,
              milestoneNotes: '',
            },
          },
        }
      );
    }

    const newPhoto = {
      url: photo.url,
      uploadedAt: new Date(),
      uploadedBy: new ObjectId(userProfile._id),
      description: photo.description || '',
    };

    // Update floor
    const result = await db.collection('floors').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $push: {
          'progress.photos': newPhoto,
        },
        $set: {
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'FLOOR_PHOTO_ADDED',
      entityType: 'FLOOR',
      entityId: id,
      changes: { photo: newPhoto },
    });

    return successResponse(result.value.progress, 'Photo added successfully');
  } catch (error) {
    console.error('Add floor photo error:', error);
    return errorResponse('Failed to add floor photo', 500);
  }
}

/**
 * PATCH /api/floors/[id]/progress
 * Updates floor completion percentage or milestone notes
 * Auth: PM, OWNER only
 */
export async function PATCH(request, { params }) {
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

    // Check permission - PM and OWNER can update floor progress
    const userRole = userProfile.role?.toLowerCase();
    const canUpdate = ['owner', 'pm', 'project_manager'].includes(userRole);
    if (!canUpdate) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can update floor progress.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid floor ID', 400);
    }

    const body = await request.json();
    const { completionPercentage, milestoneNotes } = body;

    const db = await getDatabase();

    // Verify floor exists
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(id),
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    // Initialize progress if it doesn't exist
    if (!floor.progress) {
      await db.collection('floors').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            progress: {
              photos: [],
              completionPercentage: 0,
              milestoneNotes: '',
            },
          },
        }
      );
    }

    const updateData = {
      updatedAt: new Date(),
    };
    const changes = {};

    if (completionPercentage !== undefined) {
      const percentage = Math.max(0, Math.min(100, parseFloat(completionPercentage) || 0));
      updateData.$set = {
        ...(updateData.$set || {}),
        'progress.completionPercentage': percentage,
      };
      changes.completionPercentage = {
        oldValue: floor.progress?.completionPercentage || 0,
        newValue: percentage,
      };
    }

    if (milestoneNotes !== undefined) {
      updateData.$set = {
        ...(updateData.$set || {}),
        'progress.milestoneNotes': milestoneNotes.trim(),
      };
      changes.milestoneNotes = {
        oldValue: floor.progress?.milestoneNotes || '',
        newValue: milestoneNotes.trim(),
      };
    }

    if (Object.keys(changes).length === 0) {
      return errorResponse('No valid fields to update', 400);
    }

    // Update floor
    const result = await db.collection('floors').findOneAndUpdate(
      { _id: new ObjectId(id) },
      updateData,
      { returnDocument: 'after' }
    );

    // Create audit log
    if (Object.keys(changes).length > 0) {
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'FLOOR_PROGRESS_UPDATED',
        entityType: 'FLOOR',
        entityId: id,
        changes,
      });
    }

    return successResponse(result.value.progress, 'Floor progress updated successfully');
  } catch (error) {
    console.error('Update floor progress error:', error);
    return errorResponse('Failed to update floor progress', 500);
  }
}

