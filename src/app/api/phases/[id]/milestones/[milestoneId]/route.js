/**
 * Single Milestone API Route
 * GET: Get single milestone
 * PATCH: Update milestone (status, sign-off, etc.)
 * DELETE: Delete milestone
 * 
 * GET /api/phases/[id]/milestones/[milestoneId]
 * PATCH /api/phases/[id]/milestones/[milestoneId]
 * DELETE /api/phases/[id]/milestones/[milestoneId]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateMilestone, calculateMilestoneStatus, updateMilestoneStatuses } from '@/lib/milestone-helpers';

/**
 * GET /api/phases/[id]/milestones/[milestoneId]
 * Returns a single milestone
 * Auth: All authenticated users
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id, milestoneId } = await params;
    
    if (!ObjectId.isValid(id) || !ObjectId.isValid(milestoneId)) {
      return errorResponse('Invalid phase ID or milestone ID', 400);
    }

    const db = await getDatabase();
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    const milestone = (phase.milestones || []).find(
      m => m.milestoneId?.toString() === milestoneId
    );

    if (!milestone) {
      return errorResponse('Milestone not found', 404);
    }

    // Update status
    milestone.status = calculateMilestoneStatus(milestone);

    return successResponse(milestone, 'Milestone retrieved successfully');
  } catch (error) {
    console.error('Get milestone error:', error);
    return errorResponse('Failed to retrieve milestone', 500);
  }
}

/**
 * PATCH /api/phases/[id]/milestones/[milestoneId]
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

    // Check permission
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const hasEditPermission = await hasPermission(user.id, 'edit_phase');
    if (!hasEditPermission) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can update milestones.', 403);
    }

    const { id, milestoneId } = await params;
    
    if (!ObjectId.isValid(id) || !ObjectId.isValid(milestoneId)) {
      return errorResponse('Invalid phase ID or milestone ID', 400);
    }

    const body = await request.json();
    const {
      name,
      description,
      targetDate,
      actualDate,
      completionCriteria,
      signOffRequired,
      signOffBy,
      signOffDate,
      signOffNotes
    } = body;

    const db = await getDatabase();

    // Get phase
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    const milestones = phase.milestones || [];
    const milestoneIndex = milestones.findIndex(
      m => m.milestoneId?.toString() === milestoneId
    );

    if (milestoneIndex === -1) {
      return errorResponse('Milestone not found', 404);
    }

    const existingMilestone = milestones[milestoneIndex];

    // Update milestone
    const updatedMilestone = {
      ...existingMilestone,
      name: name !== undefined ? name.trim() : existingMilestone.name,
      description: description !== undefined ? description.trim() : existingMilestone.description,
      targetDate: targetDate !== undefined ? (targetDate ? new Date(targetDate) : null) : existingMilestone.targetDate,
      actualDate: actualDate !== undefined ? (actualDate ? new Date(actualDate) : null) : existingMilestone.actualDate,
      completionCriteria: completionCriteria !== undefined ? (Array.isArray(completionCriteria) ? completionCriteria : existingMilestone.completionCriteria) : existingMilestone.completionCriteria,
      signOffRequired: signOffRequired !== undefined ? signOffRequired === true : existingMilestone.signOffRequired,
      signOffBy: signOffBy !== undefined ? (signOffBy && ObjectId.isValid(signOffBy) ? new ObjectId(signOffBy) : null) : existingMilestone.signOffBy,
      signOffDate: signOffDate !== undefined ? (signOffDate ? new Date(signOffDate) : null) : existingMilestone.signOffDate,
      signOffNotes: signOffNotes !== undefined ? signOffNotes.trim() : existingMilestone.signOffNotes,
      updatedAt: new Date()
    };

    // Recalculate status
    updatedMilestone.status = calculateMilestoneStatus(updatedMilestone);

    // Update milestones array
    milestones[milestoneIndex] = updatedMilestone;

    // Update phase
    const result = await db.collection('phases').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          milestones: milestones,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return errorResponse('Phase not found', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'MILESTONE',
      entityId: milestoneId,
      projectId: phase.projectId.toString(),
      changes: { old: existingMilestone, new: updatedMilestone },
    });

    return successResponse(updatedMilestone, 'Milestone updated successfully');
  } catch (error) {
    console.error('Update milestone error:', error);
    return errorResponse('Failed to update milestone', 500);
  }
}

/**
 * DELETE /api/phases/[id]/milestones/[milestoneId]
 * Deletes a milestone
 * Auth: OWNER only
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can delete
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    if (userRole !== 'owner') {
      return errorResponse('Insufficient permissions. Only OWNER can delete milestones.', 403);
    }

    const { id, milestoneId } = await params;
    
    if (!ObjectId.isValid(id) || !ObjectId.isValid(milestoneId)) {
      return errorResponse('Invalid phase ID or milestone ID', 400);
    }

    const db = await getDatabase();

    // Get phase
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    const milestones = phase.milestones || [];
    const milestoneIndex = milestones.findIndex(
      m => m.milestoneId?.toString() === milestoneId
    );

    if (milestoneIndex === -1) {
      return errorResponse('Milestone not found', 404);
    }

    const deletedMilestone = milestones[milestoneIndex];

    // Remove milestone from array
    milestones.splice(milestoneIndex, 1);

    // Update phase
    const result = await db.collection('phases').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          milestones: milestones,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return errorResponse('Phase not found', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'MILESTONE',
      entityId: milestoneId,
      projectId: phase.projectId.toString(),
      changes: { deleted: deletedMilestone },
    });

    return successResponse(null, 'Milestone deleted successfully');
  } catch (error) {
    console.error('Delete milestone error:', error);
    return errorResponse('Failed to delete milestone', 500);
  }
}


