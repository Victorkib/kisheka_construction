/**
 * Contingency Draw Approval API Route
 * POST: Approve or reject a contingency draw request
 * 
 * POST /api/projects/[id]/contingency/draw/[drawId]/approve
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
import { updateContingencyDrawStatus, validateContingencyDraw } from '@/lib/contingency-helpers';

/**
 * POST /api/projects/[id]/contingency/draw/[drawId]/approve
 * Approves or rejects a contingency draw request
 * Auth: OWNER only (contingency requires owner approval)
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

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

    // Check permission - only OWNER can approve contingency draws
    const canApprove = await hasPermission(user.id, 'approve_contingency_draw');
    if (!canApprove) {
      // Fallback to role check
      const userRole = userProfile.role?.toLowerCase();
      if (userRole !== 'owner') {
        return errorResponse(
          'Insufficient permissions. Only OWNER can approve contingency draws.',
          403
        );
      }
    }

    const { id, drawId } = await params;

    if (!ObjectId.isValid(id) || !ObjectId.isValid(drawId)) {
      return errorResponse('Invalid project ID or draw ID', 400);
    }

    const body = await request.json();
    const { approved, notes } = body;

    if (typeof approved !== 'boolean') {
      return errorResponse('approved field must be a boolean', 400);
    }

    const db = await getDatabase();

    // Get existing draw
    const existingDraw = await db.collection('contingency_draws').findOne({
      _id: new ObjectId(drawId),
      projectId: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingDraw) {
      return errorResponse('Contingency draw not found', 404);
    }

    if (existingDraw.status !== 'pending') {
      return errorResponse(
        `Cannot approve/reject contingency draw with status "${existingDraw.status}". Only pending draws can be approved/rejected.`,
        400
      );
    }

    // If approving, validate budget again (in case it changed)
    if (approved) {
      const validation = await validateContingencyDraw(
        id,
        existingDraw.amount,
        existingDraw.drawType
      );

      if (!validation.isValid) {
        return errorResponse(
          `Cannot approve contingency draw: ${validation.message}`,
          400
        );
      }

      if (validation.warning) {
        console.warn(`Contingency draw warning for project ${id}:`, validation.message);
      }
    }

    // Update draw status
    const updatedDraw = await updateContingencyDrawStatus(
      drawId,
      approved ? 'approved' : 'rejected',
      userProfile._id.toString(),
      notes
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: approved ? 'APPROVED' : 'REJECTED',
      entityType: 'CONTINGENCY_DRAW',
      entityId: drawId,
      projectId: id,
      changes: {
        status: {
          oldValue: existingDraw.status,
          newValue: updatedDraw.status,
        },
        approvalNotes: notes || (approved ? 'Approved' : 'Rejected'),
      },
    });

    // Notify requester about approval/rejection
    if (existingDraw.requestedBy) {
      await createNotification({
        userId: existingDraw.requestedBy.toString(),
        type: 'contingency_draw_status',
        title: approved ? 'Contingency Draw Approved' : 'Contingency Draw Rejected',
        message: `Your contingency draw request of ${existingDraw.amount.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} has been ${approved ? 'approved' : 'rejected'} by ${userProfile.firstName || userProfile.email}.${notes ? ` Notes: ${notes}` : ''}`,
        projectId: id,
        relatedModel: 'CONTINGENCY_DRAW',
        relatedId: drawId,
        createdBy: userProfile._id.toString(),
      });
    }

    return successResponse(
      updatedDraw,
      `Contingency draw ${approved ? 'approved' : 'rejected'} successfully`
    );
  } catch (error) {
    console.error('Approve contingency draw error:', error);
    return errorResponse('Failed to approve/reject contingency draw', 500);
  }
}
