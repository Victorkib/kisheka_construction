/**
 * Material Approval API Route
 * POST: Approve a material submission
 * 
 * POST /api/materials/[id]/approve
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
import { validateCapitalAvailability, recalculateProjectFinances } from '@/lib/financial-helpers';

/**
 * POST /api/materials/[id]/approve
 * Approves a material submission
 * Creates approval record and updates material status
 * Auth: PM, OWNER
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasApprovePermission = await hasPermission(user.id, 'approve_material');
    if (!hasApprovePermission) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can approve materials.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid material ID', 400);
    }

    const body = await request.json();
    const { notes, approvalNotes } = body;

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

    // Check if material can be approved
    const approvableStatuses = ['submitted', 'pending_approval', 'rejected'];
    if (!approvableStatuses.includes(existingMaterial.status)) {
      return errorResponse(
        `Cannot approve material with status "${existingMaterial.status}". Material must be submitted or pending approval.`,
        400
      );
    }

    // Validate capital availability before approval
    if (existingMaterial.projectId) {
      const materialAmount = existingMaterial.totalCost || 0;
      const capitalValidation = await validateCapitalAvailability(
        existingMaterial.projectId.toString(),
        materialAmount
      );

      if (!capitalValidation.isValid) {
        return errorResponse(
          `Cannot approve material: ${capitalValidation.message}. Available capital: ${capitalValidation.available.toLocaleString()}, Required: ${capitalValidation.required.toLocaleString()}`,
          400
        );
      }
    }

    // Create approval entry
    const approvalEntry = {
      approverId: new ObjectId(userProfile._id),
      approverName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      status: 'approved',
      notes: notes || approvalNotes || '',
      approvedAt: new Date(),
    };

    // Update material
    const previousStatus = existingMaterial.status;
    const result = await db.collection('materials').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $push: { approvalChain: approvalEntry },
        $set: {
          status: 'approved',
          approvedBy: new ObjectId(userProfile._id),
          approvalNotes: notes || approvalNotes || '',
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    // Create approval record in approvals collection
    await db.collection('approvals').insertOne({
      relatedId: new ObjectId(id),
      relatedModel: 'MATERIAL',
      action: 'APPROVED',
      approvedBy: new ObjectId(userProfile._id),
      reason: notes || approvalNotes || 'Material approved',
      timestamp: new Date(),
      previousStatus,
      newStatus: 'approved',
      createdAt: new Date(),
    });

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'APPROVED',
      entityType: 'MATERIAL',
      entityId: id,
      projectId: existingMaterial.projectId?.toString(),
      changes: {
        status: {
          oldValue: previousStatus,
          newValue: 'approved',
        },
        approvedBy: {
          oldValue: existingMaterial.approvedBy,
          newValue: userProfile._id.toString(),
        },
      },
    });

    // NOTE: Committed cost is NOT decreased here when material is approved.
    // Committed cost is decreased when material is created from purchase order (in createMaterialFromPurchaseOrder).
    // This prevents double-decrease of committed cost.

    // Create notification for submitter
    if (existingMaterial.submittedBy?._id) {
      await createNotification({
        userId: existingMaterial.submittedBy._id.toString(),
        type: 'approval_status',
        title: 'Material Approved',
        message: `Your material "${existingMaterial.name || existingMaterial.materialName}" has been approved by ${userProfile.firstName || userProfile.email}.`,
        projectId: existingMaterial.projectId?.toString(),
        relatedModel: 'MATERIAL',
        relatedId: id,
        createdBy: userProfile._id.toString(),
      });
    }

    // Auto-recalculate project finances after approval (includes committed cost update)
    if (existingMaterial.projectId) {
      await recalculateProjectFinances(existingMaterial.projectId.toString());
    }

    return successResponse(
      {
        material: result.value,
        approval: approvalEntry,
      },
      'Material approved successfully'
    );
  } catch (error) {
    console.error('Approve material error:', error);
    return errorResponse('Failed to approve material', 500);
  }
}

