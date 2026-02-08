/**
 * Material Library API Route
 * GET: List all library materials with filtering and pagination
 * POST: Create new library material (OWNER only)
 * 
 * GET /api/material-library
 * POST /api/material-library
 * Auth: All authenticated users (GET), OWNER only (POST)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateMaterialLibrary, VALID_UNITS } from '@/lib/schemas/material-library-schema';

/**
 * GET /api/material-library
 * Returns library materials with filtering, sorting, and pagination
 * Query params: category, categoryId, isCommon, isActive, search, page, limit, sortBy, sortOrder
 * Auth: All authenticated users
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const categoryId = searchParams.get('categoryId');
    const isCommon = searchParams.get('isCommon');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'usageCount';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const db = await getDatabase();

    // Build query
    const query = { deletedAt: null };

    if (categoryId && ObjectId.isValid(categoryId)) {
      query.categoryId = new ObjectId(categoryId);
    } else if (category) {
      query.category = category;
    }

    if (isCommon === 'true') {
      query.isCommon = true;
    }

    if (isActive === 'true' || isActive === null) {
      query.isActive = true;
    } else if (isActive === 'false') {
      query.isActive = false;
    }

    // Text search
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const skip = (page - 1) * limit;
    const materials = await db.collection('material_library')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('material_library').countDocuments(query);

    return successResponse({
      materials,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get material library error:', error);
    return errorResponse('Failed to retrieve material library', 500);
  }
}

/**
 * POST /api/material-library
 * Creates a new library material
 * Auth: OWNER only
 */
export async function POST(request) {
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

    const { getUserProfile } = await import('@/lib/auth-helpers');
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    
    // Validate data
    const validation = validateMaterialLibrary(body);
    if (!validation.isValid) {
      return errorResponse(validation.errors.join(', '), 400);
    }

    const db = await getDatabase();

    // Check if material with same name already exists (case-insensitive)
    const existing = await db.collection('material_library').findOne({
      name: { $regex: new RegExp(`^${body.name.trim()}$`, 'i') },
      deletedAt: null,
    });

    if (existing) {
      return errorResponse('Material with this name already exists in the library', 400);
    }

    // Build library material document
    const libraryMaterial = {
      name: body.name.trim(),
      description: body.description?.trim() || '',
      categoryId: body.categoryId && ObjectId.isValid(body.categoryId) 
        ? new ObjectId(body.categoryId) 
        : null,
      category: body.category?.trim() || 'other',
      defaultUnit: body.defaultUnit.trim(),
      defaultUnitCost: body.defaultUnitCost ? parseFloat(body.defaultUnitCost) : null,
      materialCode: body.materialCode?.trim() || null,
      brand: body.brand?.trim() || null,
      specifications: body.specifications?.trim() || null,
      usageCount: 0,
      lastUsedAt: null,
      lastUsedBy: null,
      isActive: body.isActive !== undefined ? body.isActive : true,
      isCommon: body.isCommon || false,
      createdBy: new ObjectId(userProfile._id),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Insert
    const result = await db.collection('material_library').insertOne(libraryMaterial);

    // Create audit log
    const { createAuditLog } = await import('@/lib/audit-log');
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CREATED',
      entityType: 'MATERIAL_LIBRARY',
      entityId: result.insertedId.toString(),
      changes: { created: libraryMaterial },
    });

    return successResponse(
      { ...libraryMaterial, _id: result.insertedId },
      'Material added to library successfully',
      201
    );
  } catch (error) {
    console.error('Create material library error:', error);
    return errorResponse('Failed to add material to library', 500);
  }
}

