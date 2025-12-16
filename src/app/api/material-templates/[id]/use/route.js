/**
 * Use Material Template API Route
 * POST: Creates a batch from template
 * 
 * POST /api/material-templates/[id]/use
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createBatch } from '@/lib/helpers/batch-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/material-templates/[id]/use
 * Creates a batch from template
 * Auth: CLERK, SUPERVISOR, PM, OWNER
 * 
 * Request Body:
 * {
 *   projectId: ObjectId (required),
 *   batchName: String (optional),
 *   defaultFloorId: ObjectId (optional),
 *   defaultCategoryId: ObjectId (optional),
 *   defaultUrgency: String (optional),
 *   defaultReason: String (optional),
 *   autoApprove: Boolean (optional, default: false)
 * }
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canUse = await hasPermission(user.id, 'use_material_template');
    if (!canUse) {
      return errorResponse(
        'Insufficient permissions. You do not have permission to use templates.',
        403
      );
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid template ID', 400);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const { projectId, batchName, defaultFloorId, defaultCategoryId, defaultUrgency, defaultReason, autoApprove } = body;

    // Validate required fields
    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    const db = await getDatabase();

    // Get template
    const template = await db.collection('material_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!template) {
      return errorResponse('Template not found', 404);
    }

    // Check if user can access (public or owner)
    const isOwner = template.createdBy.toString() === userProfile._id.toString();
    if (!template.isPublic && !isOwner) {
      return errorResponse('You do not have permission to use this template', 403);
    }

    // Determine auto-approve (OWNER only)
    const userRole = userProfile.role?.toLowerCase();
    const willAutoApprove = autoApprove && userRole === 'owner';

    // Create batch from template materials
    const batchSettings = {
      projectId: projectId,
      batchName: batchName || `${template.name} - ${new Date().toLocaleDateString()}`,
      defaultFloorId: defaultFloorId || null,
      defaultCategoryId: defaultCategoryId || null,
      defaultUrgency: defaultUrgency || template.defaultProjectSettings?.defaultUrgency || 'medium',
      defaultReason: defaultReason || template.defaultProjectSettings?.defaultReason || '',
    };

    const materials = template.materials.map((m) => ({
      name: m.name,
      quantityNeeded: m.quantityNeeded,
      unit: m.unit,
      categoryId: m.categoryId?.toString(),
      category: m.category,
      estimatedUnitCost: m.estimatedUnitCost,
      estimatedCost: m.estimatedCost,
      description: m.description,
      specifications: m.specifications,
      libraryMaterialId: m.libraryMaterialId?.toString(),
    }));

    const batch = await createBatch(materials, batchSettings, userProfile._id.toString(), willAutoApprove);

    // Update template usage
    await db.collection('material_templates').updateOne(
      { _id: new ObjectId(id) },
      {
        $inc: { usageCount: 1 },
        $set: {
          lastUsedAt: new Date(),
          lastUsedBy: new ObjectId(userProfile._id),
          updatedAt: new Date(),
        },
      }
    );

    return successResponse({
      batchId: batch._id.toString(),
      batchNumber: batch.batchNumber,
      materialRequestIds: batch.materialRequestIds.map((id) => id.toString()),
      status: batch.status,
      requiresApproval: !willAutoApprove,
      totalMaterials: batch.totalMaterials,
      totalEstimatedCost: batch.totalEstimatedCost,
    });
  } catch (error) {
    console.error('Use material template error:', error);
    return errorResponse('Failed to create batch from template', 500);
  }
}

