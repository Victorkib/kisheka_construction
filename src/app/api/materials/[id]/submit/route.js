/**
 * Material Submission API Route
 * POST: Submit a material for approval
 * 
 * POST /api/materials/[id]/submit
 * Auth: CLERK, PM, OWNER
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
 * POST /api/materials/[id]/submit
 * Submits a material for approval
 * Changes status from 'draft' to 'pending_approval'
 * Auth: CLERK, PM, OWNER
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
    const hasSubmitPermission = await hasPermission(user.id, 'create_material');
    if (!hasSubmitPermission) {
      return errorResponse('Insufficient permissions. Only CLERK, PM, and OWNER can submit materials.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid material ID', 400);
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

    // Check if material can be submitted
    if (existingMaterial.status !== 'draft' && existingMaterial.status !== 'rejected') {
      return errorResponse(
        `Cannot submit material with status "${existingMaterial.status}". Material must be in draft or rejected status.`,
        400
      );
    }

    // Validate that material has required fields
    if (!existingMaterial.name && !existingMaterial.materialName) {
      return errorResponse('Material name is required', 400);
    }

    if (!existingMaterial.quantityPurchased && !existingMaterial.quantity) {
      return errorResponse('Quantity is required', 400);
    }

    if (!existingMaterial.supplierName && !existingMaterial.supplier) {
      return errorResponse('Supplier name is required', 400);
    }

    // Update material status
    const previousStatus = existingMaterial.status;
    const result = await db.collection('materials').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'pending_approval',
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'SUBMITTED',
      entityType: 'MATERIAL',
      entityId: id,
      projectId: existingMaterial.projectId?.toString(),
      changes: {
        status: {
          oldValue: previousStatus,
          newValue: 'pending_approval',
        },
      },
    });

    // Create notification for PMs and Owners
    const approvers = await db
      .collection('users')
      .find({
        role: { $in: ['owner', 'pm', 'project_manager'] },
        status: 'active',
      })
      .toArray();

    for (const approver of approvers) {
      await createNotification({
        userId: approver._id.toString(),
        type: 'material_submission',
        title: 'Material Submitted for Approval',
        message: `Material "${existingMaterial.name || existingMaterial.materialName}" has been submitted for approval by ${userProfile.firstName || userProfile.email}.`,
        projectId: existingMaterial.projectId?.toString(),
        relatedModel: 'MATERIAL',
        relatedId: id,
        createdBy: userProfile._id.toString(),
      });
    }

    return successResponse(
      {
        material: result.value,
      },
      'Material submitted for approval successfully'
    );
  } catch (error) {
    console.error('Submit material error:', error);
    return errorResponse('Failed to submit material', 500);
  }
}

