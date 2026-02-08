/**
 * Material Rejection API Route
 * POST: Reject a material submission
 * 
 * POST /api/materials/[id]/reject
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
 * POST /api/materials/[id]/reject
 * Rejects a material submission
 * Reverts status to pending and notifies submitter
 * Auth: PM, OWNER
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

    // Check permission
    const hasRejectPermission = await hasPermission(user.id, 'reject_material');
    if (!hasRejectPermission) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can reject materials.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid material ID', 400);
    }

    const body = await request.json();
    const { reason, notes } = body;

    if (!reason || reason.trim().length === 0) {
      return errorResponse('Rejection reason is required', 400);
    }

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);

    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Get existing material
    const existingMaterial = await db.collection('materials').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingMaterial) {
      return errorResponse('Material not found', 404);
    }

    // Check if material can be rejected
    const rejectableStatuses = ['submitted', 'pending_approval', 'approved'];
    if (!rejectableStatuses.includes(existingMaterial.status)) {
      return errorResponse(
        `Cannot reject material with status "${existingMaterial.status}". Material must be submitted, pending approval, or approved.`,
        400
      );
    }

    // Create rejection entry
    const rejectionEntry = {
      approverId: new ObjectId(userProfile._id),
      approverName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      status: 'rejected',
      notes: reason || notes || '',
      approvedAt: new Date(),
    };

    // Update material - revert to pending_approval so it can be resubmitted
    const previousStatus = existingMaterial.status;
    const result = await db.collection('materials').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $push: { approvalChain: rejectionEntry },
        $set: {
          status: 'pending_approval',
          approvalNotes: reason || notes || '',
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    // Create approval record in approvals collection
    await db.collection('approvals').insertOne({
      relatedId: new ObjectId(id),
      relatedModel: 'MATERIAL',
      action: 'REJECTED',
      approvedBy: new ObjectId(userProfile._id),
      reason: reason || notes || 'Material rejected',
      timestamp: new Date(),
      previousStatus,
      newStatus: 'pending_approval',
      createdAt: new Date(),
    });

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'REJECTED',
      entityType: 'MATERIAL',
      entityId: id,
      projectId: existingMaterial.projectId?.toString(),
      changes: {
        status: {
          oldValue: previousStatus,
          newValue: 'pending_approval',
        },
        rejectionReason: {
          oldValue: null,
          newValue: reason || notes,
        },
      },
    });

    // Create notification for submitter
    if (existingMaterial.submittedBy?._id) {
      await createNotification({
        userId: existingMaterial.submittedBy._id.toString(),
        type: 'approval_status',
        title: 'Material Rejected',
        message: `Your material "${existingMaterial.name || existingMaterial.materialName}" has been rejected. Reason: ${reason || notes || 'No reason provided'}`,
        projectId: existingMaterial.projectId?.toString(),
        relatedModel: 'MATERIAL',
        relatedId: id,
        createdBy: userProfile._id.toString(),
      });
    }

    return successResponse(
      {
        material: result.value,
        rejection: rejectionEntry,
      },
      'Material rejected successfully'
    );
  } catch (error) {
    console.error('Reject material error:', error);
    return errorResponse('Failed to reject material', 500);
  }
}

