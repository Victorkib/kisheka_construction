/**
 * Professional Activity Approve API Route
 * POST /api/professional-activities/[id]/approve
 * Approves a professional activity
 * Auth: PM, OWNER
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotification } from '@/lib/notifications';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/professional-activities/[id]/approve
 * Approve a professional activity
 * Auth: PM, OWNER
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canApprove = await hasPermission(user.id, 'approve_professional_activity');
    if (!canApprove) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can approve professional activities.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid activity ID', 400);
    }

    const body = await request.json();
    const { approvalNotes } = body || {};

    const db = await getDatabase();

    // Get existing activity
    const activity = await db.collection('professional_activities').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!activity) {
      return errorResponse('Professional activity not found', 404);
    }

    // Check if status allows approval
    const approvableStatuses = ['draft', 'pending_approval'];
    if (!approvableStatuses.includes(activity.status)) {
      return errorResponse(`Cannot approve activity with status: ${activity.status}. Activity must be in 'draft' or 'pending_approval' status.`, 400);
    }

    // Update activity status
    const updateData = {
      status: 'approved',
      approvedBy: new ObjectId(userProfile._id),
      approvedAt: new Date(),
      updatedAt: new Date(),
      ...(approvalNotes && { approvalNotes: approvalNotes.trim() }),
    };

    // Update approval chain
    const approvalEntry = {
      approverId: new ObjectId(userProfile._id),
      approverName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      status: 'approved',
      notes: approvalNotes?.trim() || null,
      approvedAt: new Date(),
    };

    updateData.approvalChain = [...(activity.approvalChain || []), approvalEntry];

    await db.collection('professional_activities').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Get updated activity
    const updatedActivity = await db.collection('professional_activities').findOne({
      _id: new ObjectId(id),
    });

    // Create notification for creator
    await createNotification({
      userId: activity.createdBy.toString(),
      type: 'approval_status',
      title: 'Professional Activity Approved',
      message: `Your ${activity.activityType} activity (${activity.activityCode}) has been approved.`,
      projectId: activity.projectId.toString(),
      relatedModel: 'PROFESSIONAL_ACTIVITY',
      relatedId: id,
      createdBy: userProfile._id.toString(),
    });

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'APPROVED',
      entityType: 'PROFESSIONAL_ACTIVITY',
      entityId: id,
      projectId: activity.projectId.toString(),
      changes: {
        before: activity,
        after: updatedActivity,
      },
    });

    return successResponse({
      activity: updatedActivity,
    }, 'Professional activity approved successfully');
  } catch (error) {
    console.error('Approve professional activity error:', error);
    return errorResponse('Failed to approve professional activity', 500);
  }
}





