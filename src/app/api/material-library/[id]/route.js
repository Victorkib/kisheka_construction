/**
 * Material Library API Route (by ID)
 * GET: Get single library material
 * PATCH: Update library material
 * DELETE: Soft delete library material
 * 
 * GET /api/material-library/[id]
 * PATCH /api/material-library/[id]
 * DELETE /api/material-library/[id]
 * Auth: All authenticated users (GET), OWNER only (PATCH, DELETE)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateMaterialLibrary, VALID_UNITS } from '@/lib/schemas/material-library-schema';

/**
 * GET /api/material-library/[id]
 * Get single library material by ID
 * Auth: All authenticated users
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid material library ID', 400);
    }

    const db = await getDatabase();
    const material = await db.collection('material_library').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!material) {
      return errorResponse('Material not found in library', 404);
    }

    // Populate category if categoryId exists
    if (material.categoryId) {
      const category = await db.collection('categories').findOne({
        _id: material.categoryId,
      });
      if (category) {
        material.categoryDetails = {
          _id: category._id.toString(),
          name: category.name,
          description: category.description,
        };
      }
    }

    return successResponse(material);
  } catch (error) {
    console.error('Get material library error:', error);
    return errorResponse('Failed to retrieve material', 500);
  }
}

/**
 * PATCH /api/material-library/[id]
 * Update library material
 * Auth: OWNER only
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'manage_material_library');
    if (!canManage) {
      return errorResponse('Insufficient permissions. Only OWNER can manage material library.', 403);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid material library ID', 400);
    }

    const body = await request.json();
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();

    // Get existing material
    const existing = await db.collection('material_library').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existing) {
      return errorResponse('Material not found in library', 404);
    }

    // Build update data (only allowed fields)
    const updateData = {
      updatedAt: new Date(),
    };

    const changes = {};

    if (body.name !== undefined) {
      if (!body.name || body.name.trim().length < 2) {
        return errorResponse('Material name must be at least 2 characters', 400);
      }
      if (body.name.length > 200) {
        return errorResponse('Material name must be less than 200 characters', 400);
      }
      updateData.name = body.name.trim();
      changes.name = { oldValue: existing.name, newValue: updateData.name };
    }

    if (body.description !== undefined) {
      if (body.description && body.description.length > 1000) {
        return errorResponse('Description must be less than 1000 characters', 400);
      }
      updateData.description = body.description?.trim() || '';
      changes.description = { oldValue: existing.description, newValue: updateData.description };
    }

    if (body.categoryId !== undefined) {
      if (body.categoryId && ObjectId.isValid(body.categoryId)) {
        updateData.categoryId = new ObjectId(body.categoryId);
      } else {
        updateData.categoryId = null;
      }
      changes.categoryId = { oldValue: existing.categoryId, newValue: updateData.categoryId };
    }

    if (body.category !== undefined) {
      updateData.category = body.category?.trim() || 'other';
      changes.category = { oldValue: existing.category, newValue: updateData.category };
    }

    if (body.defaultUnit !== undefined) {
      if (!VALID_UNITS.includes(body.defaultUnit)) {
        return errorResponse(`Unit must be one of: ${VALID_UNITS.join(', ')}`, 400);
      }
      updateData.defaultUnit = body.defaultUnit.trim();
      changes.defaultUnit = { oldValue: existing.defaultUnit, newValue: updateData.defaultUnit };
    }

    if (body.defaultUnitCost !== undefined) {
      const cost = body.defaultUnitCost ? parseFloat(body.defaultUnitCost) : null;
      if (cost !== null && cost < 0) {
        return errorResponse('Default unit cost must be >= 0', 400);
      }
      updateData.defaultUnitCost = cost;
      changes.defaultUnitCost = { oldValue: existing.defaultUnitCost, newValue: cost };
    }

    if (body.materialCode !== undefined) {
      if (body.materialCode && body.materialCode.length > 50) {
        return errorResponse('Material code must be less than 50 characters', 400);
      }
      updateData.materialCode = body.materialCode?.trim() || null;
      changes.materialCode = { oldValue: existing.materialCode, newValue: updateData.materialCode };
    }

    if (body.brand !== undefined) {
      if (body.brand && body.brand.length > 100) {
        return errorResponse('Brand must be less than 100 characters', 400);
      }
      updateData.brand = body.brand?.trim() || null;
      changes.brand = { oldValue: existing.brand, newValue: updateData.brand };
    }

    if (body.specifications !== undefined) {
      if (body.specifications && body.specifications.length > 500) {
        return errorResponse('Specifications must be less than 500 characters', 400);
      }
      updateData.specifications = body.specifications?.trim() || null;
      changes.specifications = { oldValue: existing.specifications, newValue: updateData.specifications };
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
      changes.isActive = { oldValue: existing.isActive, newValue: body.isActive };
    }

    if (body.isCommon !== undefined) {
      updateData.isCommon = body.isCommon;
      changes.isCommon = { oldValue: existing.isCommon, newValue: body.isCommon };
    }

    // Cannot update: usageCount, createdBy, lastUsedAt, lastUsedBy (auto-tracked)

    // Update
    const result = await db.collection('material_library').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Material not found in library', 404);
    }

    // Create audit log
    if (Object.keys(changes).length > 0) {
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'UPDATED',
        entityType: 'MATERIAL_LIBRARY',
        entityId: id,
        changes,
      });
    }

    return successResponse(result.value, 'Material library updated successfully');
  } catch (error) {
    console.error('Update material library error:', error);
    return errorResponse('Failed to update material library', 500);
  }
}

/**
 * DELETE /api/material-library/[id]
 * Soft delete library material
 * Auth: OWNER only
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canManage = await hasPermission(user.id, 'manage_material_library');
    if (!canManage) {
      return errorResponse('Insufficient permissions. Only OWNER can manage material library.', 403);
    }

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid material library ID', 400);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();

    // Check if material exists
    const existing = await db.collection('material_library').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existing) {
      return errorResponse('Material not found in library', 404);
    }

    // Check if used in active batches (optional check - can be removed if not needed)
    const usedInBatches = await db.collection('material_request_batches').countDocuments({
      status: { $in: ['draft', 'submitted', 'pending_approval', 'approved'] },
      deletedAt: null,
    });

    // Note: We still allow deletion even if used, as it's just a soft delete
    // The material can be restored if needed

    // Soft delete
    const result = await db.collection('material_library').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          deletedAt: new Date(),
          updatedAt: new Date(),
        } 
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return errorResponse('Material not found in library', 404);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'MATERIAL_LIBRARY',
      entityId: id,
      changes: { deleted: result.value },
    });

    return successResponse(null, 'Material removed from library successfully');
  } catch (error) {
    console.error('Delete material library error:', error);
    return errorResponse('Failed to remove material from library', 500);
  }
}

