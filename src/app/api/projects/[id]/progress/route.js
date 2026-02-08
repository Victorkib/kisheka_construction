/**
 * Project Progress API Route
 * GET: Get project progress (photos, milestones, daily updates)
 * POST: Add progress photo or daily update
 * PATCH: Update milestone
 * 
 * GET /api/projects/[id]/progress
 * POST /api/projects/[id]/progress
 * PATCH /api/projects/[id]/progress
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/projects/[id]/progress
 * Returns project progress data (photos, milestones, daily updates)
 * Auth: All authenticated users
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const db = await getDatabase();
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Return progress data (default to empty if not exists)
    const progress = project.progress || {
      photos: [],
      milestones: [],
      dailyUpdates: [],
    };

    return successResponse(progress, 'Project progress retrieved successfully');
  } catch (error) {
    console.error('Get project progress error:', error);
    return errorResponse('Failed to retrieve project progress', 500);
  }
}

/**
 * POST /api/projects/[id]/progress
 * Adds a progress photo or daily update
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
      return errorResponse('Invalid project ID', 400);
    }

    const body = await request.json();
    const { type, photo, dailyUpdate } = body;

    if (!type || !['photo', 'dailyUpdate'].includes(type)) {
      return errorResponse('Invalid type. Must be "photo" or "dailyUpdate"', 400);
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Initialize progress if it doesn't exist
    if (!project.progress) {
      await db.collection('projects').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            progress: {
              photos: [],
              milestones: [],
              dailyUpdates: [],
            },
          },
        }
      );
    }

    const updateData = {
      $set: {
        updatedAt: new Date(),
      },
    };

    if (type === 'photo') {
      // Add photo
      if (!photo || !photo.url) {
        return errorResponse('Photo URL is required', 400);
      }

      const newPhoto = {
        url: photo.url,
        uploadedAt: new Date(),
        uploadedBy: new ObjectId(userProfile._id),
        description: photo.description || '',
        floor: photo.floor && ObjectId.isValid(photo.floor) ? new ObjectId(photo.floor) : null,
      };

      updateData.$push = {
        'progress.photos': newPhoto,
      };

      // Create audit log
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'PROGRESS_PHOTO_ADDED',
        entityType: 'PROJECT',
        entityId: id,
        changes: { photo: newPhoto },
      });
    } else if (type === 'dailyUpdate') {
      // Add daily update
      if (!dailyUpdate || !dailyUpdate.notes) {
        return errorResponse('Daily update notes are required', 400);
      }

      const newUpdate = {
        date: dailyUpdate.date ? new Date(dailyUpdate.date) : new Date(),
        notes: dailyUpdate.notes.trim(),
        updatedBy: new ObjectId(userProfile._id),
      };

      updateData.$push = {
        'progress.dailyUpdates': newUpdate,
      };

      // Create audit log
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'DAILY_UPDATE_ADDED',
        entityType: 'PROJECT',
        entityId: id,
        changes: { dailyUpdate: newUpdate },
      });
    }

    // Update project
    const result = await db.collection('projects').findOneAndUpdate(
      { _id: new ObjectId(id) },
      updateData,
      { returnDocument: 'after' }
    );

    return successResponse(
      result.value.progress,
      type === 'photo' ? 'Photo added successfully' : 'Daily update added successfully'
    );
  } catch (error) {
    console.error('Add project progress error:', error);
    return errorResponse('Failed to add project progress', 500);
  }
}

/**
 * PATCH /api/projects/[id]/progress
 * Updates a milestone
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

    // Check permission - PM and OWNER can update milestones
    const userRole = userProfile.role?.toLowerCase();
    const canUpdate = ['owner', 'pm', 'project_manager'].includes(userRole);
    if (!canUpdate) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can update milestones.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const body = await request.json();
    const { milestone, action } = body;

    if (!milestone || !action) {
      return errorResponse('Milestone and action are required', 400);
    }

    if (!['add', 'update', 'delete'].includes(action)) {
      return errorResponse('Invalid action. Must be "add", "update", or "delete"', 400);
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Initialize progress if it doesn't exist
    if (!project.progress) {
      await db.collection('projects').updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            progress: {
              photos: [],
              milestones: [],
              dailyUpdates: [],
            },
          },
        }
      );
    }

    const updateData = {
      $set: {
        updatedAt: new Date(),
      },
    };

    if (action === 'add') {
      // Add new milestone
      if (!milestone.name) {
        return errorResponse('Milestone name is required', 400);
      }

      const newMilestone = {
        _id: new ObjectId(), // Add unique ID for tracking
        name: milestone.name.trim(),
        targetDate: milestone.targetDate ? new Date(milestone.targetDate) : null,
        completedDate: milestone.completedDate ? new Date(milestone.completedDate) : null,
        completionPercentage: milestone.completionPercentage || 0,
        notes: milestone.notes || '',
      };

      updateData.$push = {
        'progress.milestones': newMilestone,
      };

      // Create audit log
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'MILESTONE_ADDED',
        entityType: 'PROJECT',
        entityId: id,
        changes: { milestone: newMilestone },
      });
    } else if (action === 'update') {
      // Update existing milestone
      if (!milestone._id) {
        return errorResponse('Milestone ID is required for update', 400);
      }

      // Get current milestones
      const currentMilestones = project.progress?.milestones || [];
      let milestoneIndex = -1;
      
      // Try to find by _id (ObjectId or string)
      if (milestone._id) {
        const milestoneIdStr = milestone._id.toString();
        milestoneIndex = currentMilestones.findIndex(
          (m) => m._id && m._id.toString() === milestoneIdStr
        );
      }
      
      // If not found, try to find by name (fallback)
      if (milestoneIndex === -1 && milestone.name) {
        milestoneIndex = currentMilestones.findIndex(
          (m) => m.name === milestone.name.trim()
        );
      }

      if (milestoneIndex === -1) {
        return errorResponse('Milestone not found', 404);
      }

      // Update the milestone
      const existingMilestone = currentMilestones[milestoneIndex];
      const updatedMilestone = {
        ...existingMilestone,
        ...(milestone.name && { name: milestone.name.trim() }),
        ...(milestone.targetDate && { targetDate: new Date(milestone.targetDate) }),
        ...(milestone.completedDate !== undefined && {
          completedDate: milestone.completedDate ? new Date(milestone.completedDate) : null,
        }),
        ...(milestone.completionPercentage !== undefined && {
          completionPercentage: milestone.completionPercentage,
        }),
        ...(milestone.notes !== undefined && { notes: milestone.notes }),
      };

      updateData.$set = {
        ...updateData.$set,
        [`progress.milestones.${milestoneIndex}`]: updatedMilestone,
      };

      // Create audit log
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'MILESTONE_UPDATED',
        entityType: 'PROJECT',
        entityId: id,
        changes: {
          oldValue: existingMilestone,
          newValue: updatedMilestone,
        },
      });
    } else if (action === 'delete') {
      // Delete milestone
      if (!milestone._id) {
        return errorResponse('Milestone ID is required for delete', 400);
      }

      const currentMilestones = project.progress?.milestones || [];
      let milestoneToDelete = null;
      let milestoneIndex = -1;
      
      // Try to find by _id (ObjectId or string)
      if (milestone._id) {
        const milestoneIdStr = milestone._id.toString();
        milestoneIndex = currentMilestones.findIndex(
          (m) => m._id && m._id.toString() === milestoneIdStr
        );
      }
      
      // If not found, try to find by name (fallback)
      if (milestoneIndex === -1 && milestone.name) {
        milestoneIndex = currentMilestones.findIndex(
          (m) => m.name === milestone.name.trim()
        );
      }

      if (milestoneIndex === -1) {
        return errorResponse('Milestone not found', 404);
      }

      milestoneToDelete = currentMilestones[milestoneIndex];

      // Remove the milestone from array by filtering
      const updatedMilestones = currentMilestones.filter((_, index) => index !== milestoneIndex);
      updateData.$set = {
        ...updateData.$set,
        'progress.milestones': updatedMilestones,
      };

      // Create audit log
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'MILESTONE_DELETED',
        entityType: 'PROJECT',
        entityId: id,
        changes: { milestone: milestoneToDelete },
      });
    }

    // Update project
    const result = await db.collection('projects').findOneAndUpdate(
      { _id: new ObjectId(id) },
      updateData,
      { returnDocument: 'after' }
    );

    return successResponse(result.value.progress, 'Milestone updated successfully');
  } catch (error) {
    console.error('Update project milestone error:', error);
    return errorResponse('Failed to update milestone', 500);
  }
}

