/**
 * Restore Material API Route
 * POST /api/materials/[id]/restore
 * Restores an archived material
 * Auth: OWNER only
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { recalculateProjectFinances } from '@/lib/financial-helpers';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can restore materials
    const hasRestorePermission = await hasPermission(user.id, 'delete_material');
    if (!hasRestorePermission) {
      return errorResponse('Insufficient permissions. Only OWNER can restore materials.', 403);
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
      deletedAt: { $ne: null },
    });

    if (!existingMaterial) {
      return errorResponse('Material not found or not archived', 404);
    }

    // Restore material
    const result = await db.collection('materials').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $unset: {
          deletedAt: '',
        },
        $set: {
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Material not found or restore failed', 404);
    }

    // Recalculate project finances if material was approved/received and had cost
    if (
      existingMaterial.projectId &&
      ObjectId.isValid(existingMaterial.projectId) &&
      ['approved', 'received'].includes(existingMaterial.status) &&
      existingMaterial.totalCost > 0
    ) {
      try {
        const projectIdStr = existingMaterial.projectId.toString();
        await recalculateProjectFinances(projectIdStr);
        console.log(`✅ Project finances recalculated after material restore for project ${projectIdStr}`);
      } catch (error) {
        console.error(`❌ Error recalculating project finances after material restore:`, error);
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'RESTORED',
      entityType: 'MATERIAL',
      entityId: id,
      projectId: existingMaterial.projectId?.toString(),
      changes: {
        deletedAt: {
          oldValue: existingMaterial.deletedAt,
          newValue: null,
        },
      },
    });

    return successResponse(
      {
        materialId: id,
        restored: true,
      },
      'Material restored successfully. Project finances have been recalculated if applicable.'
    );
  } catch (error) {
    console.error('Restore material error:', error);
    return errorResponse('Failed to restore material', 500);
  }
}

