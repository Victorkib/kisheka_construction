/**
 * Category API Route (by ID)
 * DELETE: Delete a category (if not in use)
 * 
 * DELETE /api/categories/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { hasPermission } from '@/lib/role-helpers';
import { successResponse, errorResponse } from '@/lib/api-response';
import { ObjectId } from 'mongodb';

/**
 * DELETE /api/categories/[id]
 * Deletes a category (if not in use)
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
    const hasDeletePermission = await hasPermission(user.id, 'delete_category');
    if (!hasDeletePermission) {
      return errorResponse('Insufficient permissions. Only OWNER can delete categories.', 403);
    }

    const { id } = await params;
    
    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid category ID', 400);
    }

    const db = await getDatabase();

    // Check if category exists
    const category = await db.collection('categories').findOne({
      _id: new ObjectId(id),
    });

    if (!category) {
      return errorResponse('Category not found', 404);
    }

    // Check if category is used by materials
    const materialCount = await db.collection('materials').countDocuments({
      categoryId: new ObjectId(id),
      deletedAt: null,
    });

    if (materialCount > 0) {
      return errorResponse(
        `Cannot delete category. It is used by ${materialCount} material(s). Please reassign materials first.`,
        400
      );
    }

    // Delete category
    await db.collection('categories').deleteOne({
      _id: new ObjectId(id),
    });

    return successResponse(null, 'Category deleted successfully', 200);
  } catch (error) {
    console.error('Delete category error:', error);
    return errorResponse('Failed to delete category', 500);
  }
}

