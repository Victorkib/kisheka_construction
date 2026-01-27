/**
 * Categories API Route
 * GET: List all categories
 * POST: Create new category (OWNER only)
 * 
 * GET /api/categories
 * POST /api/categories
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { successResponse, errorResponse } from '@/lib/api-response';
import { ObjectId } from 'mongodb';
import { CATEGORY_TYPES } from '@/lib/constants/category-constants';

/**
 * GET /api/categories
 * Returns all categories
 * Auth: All authenticated users
 */
const DEFAULT_CATEGORY_TYPE = CATEGORY_TYPES.MATERIALS;

const normalizeCategoryType = (type) => {
  if (!type) return null;
  const normalized = String(type).trim().toLowerCase();
  if (normalized === 'all') return 'all';
  const validTypes = Object.values(CATEGORY_TYPES);
  return validTypes.includes(normalized) ? normalized : null;
};

const getUsageSourcesByType = (type) => {
  if (type === CATEGORY_TYPES.WORK_ITEMS) {
    return [
      { collection: 'work_items', field: 'categoryId', filter: { deletedAt: null } },
      { collection: 'labour_entries', field: 'categoryId', filter: { deletedAt: null } },
      { collection: 'labour_batches', field: 'defaultCategoryId', filter: { deletedAt: null } },
      { collection: 'supervisor_submissions', field: 'categoryId', filter: { deletedAt: null } },
    ];
  }

  return [
    { collection: 'materials', field: 'categoryId', filter: { deletedAt: null } },
    { collection: 'material_library', field: 'categoryId', filter: { deletedAt: null } },
    { collection: 'material_requests', field: 'categoryId', filter: { deletedAt: null } },
    { collection: 'purchase_orders', field: 'categoryId', filter: {} },
  ];
};

const countCategoryUsage = async (db, categoryId, type) => {
  const sources = getUsageSourcesByType(type);
  const counts = await Promise.all(
    sources.map((source) =>
      db.collection(source.collection).countDocuments({
        ...source.filter,
        [source.field]: categoryId,
      })
    )
  );
  return counts.reduce((sum, value) => sum + value, 0);
};

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const requestedType = searchParams.get('type');
    const normalizedType = normalizeCategoryType(requestedType);

    if (requestedType && !normalizedType) {
      return errorResponse(
        `Invalid category type. Must be one of: ${Object.values(CATEGORY_TYPES).join(', ')}, or 'all'`,
        400
      );
    }

    const effectiveType = normalizedType === 'all' ? null : (normalizedType || DEFAULT_CATEGORY_TYPE);
    const query = effectiveType
      ? (effectiveType === CATEGORY_TYPES.MATERIALS
          ? { $or: [{ type: { $exists: false } }, { type: CATEGORY_TYPES.MATERIALS }] }
          : { type: effectiveType })
      : {};

    const db = await getDatabase();
    const categories = await db
      .collection('categories')
      .find(query)
      .sort({ name: 1 })
      .toArray();

    // Add usage count for each category (type-aware)
    const categoriesWithUsage = await Promise.all(
      categories.map(async (category) => {
        const categoryType = category.type || DEFAULT_CATEGORY_TYPE;
        const usageCount = await countCategoryUsage(db, category._id, categoryType);
        return { ...category, type: categoryType, usageCount };
      })
    );

    return successResponse(categoriesWithUsage, 'Categories retrieved successfully');
  } catch (error) {
    console.error('Get categories error:', error);
    return errorResponse('Failed to retrieve categories', 500);
  }
}

/**
 * POST /api/categories
 * Creates a new category
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
    const hasCreatePermission = await hasPermission(user.id, 'create_category');
    if (!hasCreatePermission) {
      return errorResponse('Insufficient permissions. Only OWNER can create categories.', 403);
    }

    const body = await request.json();
    const { name, description, subcategories = [], icon = '', type } = body;

    if (!name || name.trim().length === 0) {
      return errorResponse('Category name is required', 400);
    }

    const db = await getDatabase();
    const normalizedType = normalizeCategoryType(type);

    if (type && !normalizedType) {
      return errorResponse(
        `Invalid category type. Must be one of: ${Object.values(CATEGORY_TYPES).join(', ')}`,
        400
      );
    }
    const effectiveType = normalizedType || DEFAULT_CATEGORY_TYPE;

    // Check if category already exists
    const existing = await db.collection('categories').findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      type: effectiveType,
    });

    if (existing) {
      return errorResponse('Category with this name already exists', 400);
    }

    // Create category
    const category = {
      name: name.trim(),
      description: description?.trim() || '',
      subcategories: Array.isArray(subcategories) ? subcategories : [],
      icon: icon?.trim() || '',
      type: effectiveType,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('categories').insertOne(category);

    return successResponse(
      { ...category, _id: result.insertedId },
      'Category created successfully',
      201
    );
  } catch (error) {
    console.error('Create category error:', error);
    return errorResponse('Failed to create category', 500);
  }
}

