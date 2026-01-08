/**
 * Material Request Approve API Route
 * POST /api/material-requests/[id]/approve
 * Approves a material request
 * Auth: PM, OWNER
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotification } from '@/lib/notifications';
import { validateCapitalAvailability, recalculateProjectFinances } from '@/lib/financial-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/material-requests/[id]/approve
 * Approve a material request
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
    const canApprove = await hasPermission(user.id, 'approve_material_request');
    if (!canApprove) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can approve material requests.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid request ID', 400);
    }

    const body = await request.json();
    const { approvalNotes } = body || {};

    const db = await getDatabase();

    // Get existing request
    const materialRequest = await db.collection('material_requests').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!materialRequest) {
      return errorResponse('Material request not found', 404);
    }

    // Check if status allows approval
    // Allow approval from both 'requested' and 'pending_approval' statuses
    const approvableStatuses = ['requested', 'pending_approval'];
    if (!approvableStatuses.includes(materialRequest.status)) {
      return errorResponse(`Cannot approve request with status: ${materialRequest.status}. Request must be in 'requested' or 'pending_approval' status.`, 400);
    }

    // Financial validation (warning only, don't block)
    // NOTE: Material requests are ESTIMATES and don't directly spend capital.
    // They only move to committed cost when converted to purchase orders.
    // Therefore, we warn but don't block approval - this allows planning ahead.
    let financialWarning = null;
    if (materialRequest.estimatedCost && materialRequest.estimatedCost > 0) {
      const capitalCheck = await validateCapitalAvailability(
        materialRequest.projectId.toString(),
        materialRequest.estimatedCost
      );

      if (!capitalCheck.isValid) {
        financialWarning = {
          message: `Estimated cost (${materialRequest.estimatedCost.toLocaleString()}) exceeds available capital (${capitalCheck.available.toLocaleString()}). Note: This is an estimate and won't spend capital until converted to a purchase order.`,
          available: capitalCheck.available,
          required: materialRequest.estimatedCost,
          shortfall: materialRequest.estimatedCost - capitalCheck.available,
          type: 'estimate_warning' // Indicates this is informational, not blocking
        };
        // Don't block approval - it's just an estimate
      }
    }

    // Update request status
    const updateData = {
      status: 'approved',
      approvedBy: new ObjectId(userProfile._id),
      approvedByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      approvalDate: new Date(),
      updatedAt: new Date(),
      ...(approvalNotes && { approvalNotes: approvalNotes.trim() }),
    };

    await db.collection('material_requests').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Get updated request
    const updatedRequest = await db.collection('material_requests').findOne({
      _id: new ObjectId(id),
    });

    // Trigger financial recalculation (for estimated cost tracking)
    if (materialRequest.estimatedCost && materialRequest.estimatedCost > 0) {
      await recalculateProjectFinances(materialRequest.projectId.toString());
    }

    // Create notification for requester
    await createNotification({
      userId: materialRequest.requestedBy.toString(),
      type: 'approval_status',
      title: 'Material Request Approved',
      message: `Your request for ${materialRequest.quantityNeeded} ${materialRequest.unit} of ${materialRequest.materialName} has been approved${financialWarning ? ' (with financial warning)' : ''}.`,
      projectId: materialRequest.projectId.toString(),
      relatedModel: 'MATERIAL_REQUEST',
      relatedId: id,
      createdBy: userProfile._id.toString(),
    });

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'APPROVED',
      entityType: 'MATERIAL_REQUEST',
      entityId: id,
      projectId: materialRequest.projectId.toString(),
      changes: {
        before: materialRequest,
        after: updatedRequest,
        financialWarning,
      },
    });

    return successResponse({
      request: updatedRequest,
      financialWarning, // Include warning in response
    }, 'Material request approved successfully');
  } catch (error) {
    console.error('Approve material request error:', error);
    return errorResponse('Failed to approve material request', 500);
  }
}

