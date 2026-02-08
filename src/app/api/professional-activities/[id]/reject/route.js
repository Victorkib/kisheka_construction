/**
 * Professional Activity Reject API Route
 * POST /api/professional-activities/[id]/reject
 * Rejects a professional activity
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
 * POST /api/professional-activities/[id]/reject
 * Reject a professional activity
 * Auth: PM, OWNER
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canReject = await hasPermission(user.id, 'approve_professional_activity'); // Same permission as approve
    if (!canReject) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can reject professional activities.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid activity ID', 400);
    }

    const body = await request.json();
    const { rejectionReason } = body || {};

    if (!rejectionReason || rejectionReason.trim().length < 1) {
      return errorResponse('Rejection reason is required', 400);
    }

    const db = await getDatabase();

    // Get existing activity
    const activity = await db.collection('professional_activities').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!activity) {
      return errorResponse('Professional activity not found', 404);
    }

    // Check if status allows rejection
    const rejectableStatuses = ['draft', 'pending_approval'];
    if (!rejectableStatuses.includes(activity.status)) {
      return errorResponse(`Cannot reject activity with status: ${activity.status}. Activity must be in 'draft' or 'pending_approval' status.`, 400);
    }

    // Update activity status
    const updateData = {
      status: 'rejected',
      approvedBy: new ObjectId(userProfile._id), // Store rejector info
      approvedAt: new Date(),
      approvalNotes: rejectionReason.trim(),
      updatedAt: new Date(),
    };

    // Update approval chain
    const approvalEntry = {
      approverId: new ObjectId(userProfile._id),
      approverName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      status: 'rejected',
      notes: rejectionReason.trim(),
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
      title: 'Professional Activity Rejected',
      message: `Your ${activity.activityType} activity (${activity.activityCode}) has been rejected. Reason: ${rejectionReason.trim()}`,
      projectId: activity.projectId.toString(),
      relatedModel: 'PROFESSIONAL_ACTIVITY',
      relatedId: id,
      createdBy: userProfile._id.toString(),
    });

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'REJECTED',
      entityType: 'PROFESSIONAL_ACTIVITY',
      entityId: id,
      projectId: activity.projectId.toString(),
      changes: {
        before: activity,
        after: updatedActivity,
        rejectionReason: rejectionReason.trim(),
      },
    });

    return successResponse({
      activity: updatedActivity,
    }, 'Professional activity rejected successfully');
  } catch (error) {
    console.error('Reject professional activity error:', error);
    return errorResponse('Failed to reject professional activity', 500);
  }
}





