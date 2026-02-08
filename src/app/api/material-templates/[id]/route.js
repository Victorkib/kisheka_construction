/**
 * Material Template Detail API Route
 * GET: Get single template
 * PATCH: Update template
 * DELETE: Delete template
 * 
 * GET /api/material-templates/[id]
 * PATCH /api/material-templates/[id]
 * DELETE /api/material-templates/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { validateMaterialTemplate, calculateTemplateTotalCost, TEMPLATE_STATUS } from '@/lib/schemas/material-template-schema';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/material-templates/[id]
 * Returns a single template by ID
 * Auth: All authenticated users (if public or owned by user)
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid template ID', 400);
    }

    const db = await getDatabase();
    const userProfile = await getUserProfile(user.id);

    const template = await db.collection('material_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!template) {
      return errorResponse('Template not found', 404);
    }

    // Check if user can access (public or owner)
    const isOwner = userProfile && template.createdBy.toString() === userProfile._id.toString();
    if (!template.isPublic && !isOwner) {
      return errorResponse('You do not have permission to view this template', 403);
    }

    return successResponse(template);
  } catch (error) {
    console.error('Get material template error:', error);
    return errorResponse('Failed to retrieve template', 500);
  }
}

/**
 * PATCH /api/material-templates/[id]
 * Updates template details
 * Auth: OWNER, PM (only for own templates)
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'manage_material_templates');
    if (!canManage) {
      return errorResponse(
        'Insufficient permissions. Only OWNER and PM can manage templates.',
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
    const db = await getDatabase();

    // Get existing template
    const existing = await db.collection('material_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existing) {
      return errorResponse('Template not found', 404);
    }

    // Check ownership (unless OWNER)
    const isOwner = userProfile.role?.toLowerCase() === 'owner';
    const isCreator = existing.createdBy.toString() === userProfile._id.toString();
    if (!isOwner && !isCreator) {
      return errorResponse('You can only edit your own templates', 403);
    }

    // Build update data
    const updateData = {
      updatedAt: new Date(),
    };
    const changes = {};

    if (body.name !== undefined) {
      if (!body.name || body.name.trim().length < 2) {
        return errorResponse('Template name must be at least 2 characters', 400);
      }
      updateData.name = body.name.trim();
      changes.name = { oldValue: existing.name, newValue: updateData.name };
    }

    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || '';
      changes.description = { oldValue: existing.description, newValue: updateData.description };
    }

    if (body.isPublic !== undefined) {
      updateData.isPublic = body.isPublic;
      changes.isPublic = { oldValue: existing.isPublic, newValue: body.isPublic };
    }

    if (body.materials !== undefined) {
      const validation = validateMaterialTemplate({
        name: existing.name,
        materials: body.materials,
      });
      if (!validation.isValid) {
        return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
      }

      updateData.materials = body.materials.map((m) => ({
        name: m.name.trim(),
        quantityNeeded: parseFloat(m.quantityNeeded),
        quantityPerUnit: m.quantityPerUnit ? parseFloat(m.quantityPerUnit) : null,
        unit: m.unit.trim(),
        categoryId: m.categoryId && ObjectId.isValid(m.categoryId) ? new ObjectId(m.categoryId) : null,
        category: m.category || '',
        estimatedUnitCost: m.estimatedUnitCost ? parseFloat(m.estimatedUnitCost) : null,
        estimatedCost: m.estimatedCost ? parseFloat(m.estimatedCost) : null,
        description: m.description?.trim() || '',
        specifications: m.specifications?.trim() || '',
        libraryMaterialId: m.libraryMaterialId && ObjectId.isValid(m.libraryMaterialId) ? new ObjectId(m.libraryMaterialId) : null,
        isScalable: m.isScalable || false,
        scalingFactor: m.scalingFactor || 'fixed',
      }));
      changes.materials = { oldValue: existing.materials, newValue: updateData.materials };
    }

    if (body.defaultProjectSettings !== undefined) {
      updateData.defaultProjectSettings = {
        defaultUrgency: body.defaultProjectSettings?.defaultUrgency || existing.defaultProjectSettings?.defaultUrgency || 'medium',
        defaultReason: body.defaultProjectSettings?.defaultReason || existing.defaultProjectSettings?.defaultReason || '',
        defaultCategoryId: body.defaultProjectSettings?.defaultCategoryId && ObjectId.isValid(body.defaultProjectSettings.defaultCategoryId)
          ? new ObjectId(body.defaultProjectSettings.defaultCategoryId)
          : (existing.defaultProjectSettings?.defaultCategoryId || null),
        defaultFloorId: body.defaultProjectSettings?.defaultFloorId && ObjectId.isValid(body.defaultProjectSettings.defaultFloorId)
          ? new ObjectId(body.defaultProjectSettings.defaultFloorId)
          : (existing.defaultProjectSettings?.defaultFloorId || null),
      };
      changes.defaultProjectSettings = {
        oldValue: existing.defaultProjectSettings,
        newValue: updateData.defaultProjectSettings,
      };
    }

    // Handle new fields
    if (body.status !== undefined) {
      updateData.status = body.status;
      changes.status = { oldValue: existing.status, newValue: body.status };
    }

    if (body.templateCategory !== undefined) {
      updateData.templateCategory = body.templateCategory || null;
      changes.templateCategory = { oldValue: existing.templateCategory, newValue: updateData.templateCategory };
    }

    if (body.templateType !== undefined) {
      updateData.templateType = body.templateType || null;
      changes.templateType = { oldValue: existing.templateType, newValue: updateData.templateType };
    }

    if (body.tags !== undefined) {
      updateData.tags = Array.isArray(body.tags) ? body.tags.filter(t => t && t.trim()).map(t => t.trim()) : [];
      changes.tags = { oldValue: existing.tags, newValue: updateData.tags };
    }

    if (body.projectPhase !== undefined) {
      updateData.projectPhase = body.projectPhase || null;
      changes.projectPhase = { oldValue: existing.projectPhase, newValue: updateData.projectPhase };
    }

    if (body.applicableFloors !== undefined) {
      updateData.applicableFloors = body.applicableFloors === 'all' 
        ? 'all' 
        : (Array.isArray(body.applicableFloors) 
          ? body.applicableFloors.map(f => parseInt(f, 10)).filter(f => !isNaN(f)) 
          : null);
      changes.applicableFloors = { oldValue: existing.applicableFloors, newValue: updateData.applicableFloors };
    }

    if (body.expiresAt !== undefined) {
      updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
      changes.expiresAt = { oldValue: existing.expiresAt, newValue: updateData.expiresAt };
    }

    // Recalculate total cost if materials changed
    if (body.materials !== undefined) {
      const totalCost = calculateTemplateTotalCost(body.materials);
      updateData.estimatedTotalCost = totalCost > 0 ? totalCost : null;
      updateData.costLastUpdated = totalCost > 0 ? new Date() : null;
    }

    // Update
    const result = await db.collection('material_templates').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Failed to update template', 500);
    }

    // Create audit log
    if (Object.keys(changes).length > 0) {
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'UPDATED',
        entityType: 'MATERIAL_TEMPLATE',
        entityId: id,
        changes,
      });
    }

    return successResponse(result.value, 'Template updated successfully');
  } catch (error) {
    console.error('Update material template error:', error);
    return errorResponse('Failed to update template', 500);
  }
}

/**
 * DELETE /api/material-templates/[id]
 * Soft deletes a template
 * Auth: OWNER, PM (only for own templates)
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'manage_material_templates');
    if (!canManage) {
      return errorResponse(
        'Insufficient permissions. Only OWNER and PM can manage templates.',
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

    const db = await getDatabase();

    // Get existing template
    const existing = await db.collection('material_templates').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existing) {
      return errorResponse('Template not found', 404);
    }

    // Check ownership (unless OWNER)
    const isOwner = userProfile.role?.toLowerCase() === 'owner';
    const isCreator = existing.createdBy.toString() === userProfile._id.toString();
    if (!isOwner && !isCreator) {
      return errorResponse('You can only delete your own templates', 403);
    }

    // Soft delete
    const result = await db.collection('material_templates').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Failed to delete template', 500);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'MATERIAL_TEMPLATE',
      entityId: id,
      changes: { deleted: result.value },
    });

    return successResponse(null, 'Template deleted successfully');
  } catch (error) {
    console.error('Delete material template error:', error);
    return errorResponse('Failed to delete template', 500);
  }
}

