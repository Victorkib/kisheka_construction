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

/**
 * GET /api/categories
 * Returns all categories
 * Auth: All authenticated users
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const db = await getDatabase();
    const categories = await db
      .collection('categories')
      .find({})
      .sort({ name: 1 })
      .toArray();

    return successResponse(categories, 'Categories retrieved successfully');
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
    const { name, description, subcategories = [], icon = '' } = body;

    if (!name || name.trim().length === 0) {
      return errorResponse('Category name is required', 400);
    }

    const db = await getDatabase();

    // Check if category already exists
    const existing = await db.collection('categories').findOne({
      name: name.trim(),
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

