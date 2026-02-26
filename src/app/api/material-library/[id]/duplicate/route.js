/**
 * Material Library Duplicate API Route
 * POST: Duplicate a material library entry with optional modifications
 * 
 * POST /api/material-library/[id]/duplicate
 * Auth: OWNER only
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateMaterialLibrary } from '@/lib/schemas/material-library-schema';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
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

    // Get original material
    const original = await db.collection('material_library').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!original) {
      return errorResponse('Material not found in library', 404);
    }

    // Get optional modifications from request body
    const body = await request.json().catch(() => ({}));
    const modifications = body.modifications || {};

    // Build duplicated material (reset usage tracking, keep other fields)
    const duplicatedMaterial = {
      name: modifications.name || `${original.name} (Copy)`,
      description: modifications.description !== undefined ? modifications.description : original.description,
      categoryId: modifications.categoryId !== undefined 
        ? (modifications.categoryId && ObjectId.isValid(modifications.categoryId) ? new ObjectId(modifications.categoryId) : null)
        : original.categoryId,
      category: modifications.category !== undefined ? modifications.category : original.category,
      defaultUnit: modifications.defaultUnit || original.defaultUnit,
      defaultUnitCost: modifications.defaultUnitCost !== undefined 
        ? (modifications.defaultUnitCost ? parseFloat(modifications.defaultUnitCost) : null)
        : original.defaultUnitCost,
      materialCode: modifications.materialCode !== undefined ? modifications.materialCode : original.materialCode,
      brand: modifications.brand !== undefined ? modifications.brand : original.brand,
      specifications: modifications.specifications !== undefined ? modifications.specifications : original.specifications,
      // Reset usage tracking for new material
      usageCount: 0,
      lastUsedAt: null,
      lastUsedBy: null,
      isActive: modifications.isActive !== undefined ? modifications.isActive : original.isActive,
      isCommon: modifications.isCommon !== undefined ? modifications.isCommon : false, // Default to false for copies
      createdBy: new ObjectId(userProfile._id),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Validate the duplicated material
    const validation = validateMaterialLibrary(duplicatedMaterial);
    if (!validation.isValid) {
      return errorResponse(validation.errors.join(', '), 400);
    }

    // Check if material with same name already exists (case-insensitive)
    const existing = await db.collection('material_library').findOne({
      name: { $regex: new RegExp(`^${duplicatedMaterial.name.trim()}$`, 'i') },
      deletedAt: null,
    });

    if (existing) {
      return errorResponse('Material with this name already exists in the library', 400);
    }

    // Insert duplicated material
    const result = await db.collection('material_library').insertOne(duplicatedMaterial);

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'MATERIAL_LIBRARY',
      entityId: result.insertedId.toString(),
      changes: { 
        duplicatedFrom: id,
        created: duplicatedMaterial,
      },
    });

    // Get the created material with _id
    const createdMaterial = {
      ...duplicatedMaterial,
      _id: result.insertedId,
    };

    return successResponse(
      createdMaterial,
      'Material duplicated successfully',
      201
    );
  } catch (error) {
    console.error('Duplicate material library error:', error);
    return errorResponse('Failed to duplicate material', 500);
  }
}
