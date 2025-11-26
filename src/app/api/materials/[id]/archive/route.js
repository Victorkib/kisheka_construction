/**
 * Archive Material API Route
 * POST /api/materials/[id]/archive
 * Archives a material (soft delete)
 * Auth: OWNER only
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only OWNER can archive materials
    const hasArchivePermission = await hasPermission(user.id, 'delete_material');
    if (!hasArchivePermission) {
      return errorResponse('Insufficient permissions. Only OWNER can archive materials.', 403);
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
      return errorResponse('Material not found or already archived', 404);
    }

    const now = new Date();

    // Archive material (soft delete)
    const result = await db.collection('materials').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          deletedAt: now,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Material not found or archive failed', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'ARCHIVED',
      entityType: 'MATERIAL',
      entityId: id,
      projectId: existingMaterial.projectId?.toString(),
      changes: {
        deletedAt: {
          oldValue: null,
          newValue: now,
        },
      },
    });

    return successResponse(
      {
        materialId: id,
        archived: true,
      },
      'Material archived successfully. Financial records have been preserved.'
    );
  } catch (error) {
    console.error('Archive material error:', error);
    return errorResponse('Failed to archive material', 500);
  }
}

