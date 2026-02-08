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
import { recalculatePhaseSpending } from '@/lib/phase-helpers';
import { recalculateFloorSpending } from '@/lib/material-helpers';

/**
 * POST /api/materials/[id]/approve
 * Approves a material submission
 * Creates approval record and updates material status
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

    // Check if material is already approved
    // Materials created from purchase orders are automatically approved, so this is a no-op
    if (existingMaterial.status === 'approved' || existingMaterial.status === 'received') {
      return successResponse(
        {
          material: existingMaterial,
          alreadyApproved: true,
        },
        'Material is already approved',
        200
      );
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

    // Validate phase budget if material is linked to a phase
    if (existingMaterial.phaseId && ObjectId.isValid(existingMaterial.phaseId)) {
      const db = await getDatabase();
      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(existingMaterial.phaseId),
        deletedAt: null
      });

      if (phase) {
        const materialAmount = existingMaterial.totalCost || 0;
        const phaseBudget = phase.budgetAllocation?.total || 0;
        const phaseActual = phase.actualSpending?.total || 0;
        const phaseCommitted = phase.financialStates?.committed || 0;
        const phaseAvailable = Math.max(0, phaseBudget - phaseActual - phaseCommitted);

        if (materialAmount > phaseAvailable) {
          // Allow PM/OWNER to override with warning
          const userRole = userProfile?.role?.toLowerCase();
          const isOwnerOrPM = ['owner', 'pm', 'project_manager'].includes(userRole);

          if (!isOwnerOrPM) {
            return errorResponse(
              `Cannot approve material: Exceeds phase budget. Phase budget: ${phaseBudget.toLocaleString()}, Available: ${phaseAvailable.toLocaleString()}, Required: ${materialAmount.toLocaleString()}`,
              400
            );
          }
          // For PM/OWNER, continue but this will be logged in audit
        }
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

    // Recalculate phase spending if material is linked to a phase
    if (existingMaterial.phaseId && ObjectId.isValid(existingMaterial.phaseId)) {
      try {
        await recalculatePhaseSpending(existingMaterial.phaseId.toString());
      } catch (phaseError) {
        console.error('Error recalculating phase spending after material approval:', phaseError);
        // Don't fail the request, just log the error
      }
    }

    // Recalculate floor spending if material is linked to a floor
    if (existingMaterial.floor && ObjectId.isValid(existingMaterial.floor)) {
      try {
        await recalculateFloorSpending(existingMaterial.floor.toString());
      } catch (floorError) {
        console.error('Error recalculating floor spending after material approval:', floorError);
        // Don't fail the request, just log the error
      }
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

