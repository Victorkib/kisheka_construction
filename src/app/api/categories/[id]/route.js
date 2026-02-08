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
import { CATEGORY_TYPES } from '@/lib/constants/category-constants';

/**
 * DELETE /api/categories/[id]
 * Deletes a category (if not in use)
 * Auth: OWNER only
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

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

    const categoryType = category.type || CATEGORY_TYPES.MATERIALS;
    const categoryObjectId = new ObjectId(id);

    const usageChecks = categoryType === CATEGORY_TYPES.WORK_ITEMS
      ? [
          { collection: 'work_items', field: 'categoryId', filter: { deletedAt: null }, label: 'work item(s)' },
          { collection: 'labour_entries', field: 'categoryId', filter: { deletedAt: null }, label: 'labour entry(ies)' },
          { collection: 'labour_batches', field: 'defaultCategoryId', filter: { deletedAt: null }, label: 'labour batch(es)' },
          { collection: 'supervisor_submissions', field: 'categoryId', filter: { deletedAt: null }, label: 'supervisor submission(s)' },
        ]
      : [
          { collection: 'materials', field: 'categoryId', filter: { deletedAt: null }, label: 'material(s)' },
          { collection: 'material_library', field: 'categoryId', filter: { deletedAt: null }, label: 'library material(s)' },
          { collection: 'material_requests', field: 'categoryId', filter: { deletedAt: null }, label: 'material request(s)' },
          { collection: 'purchase_orders', field: 'categoryId', filter: {}, label: 'purchase order(s)' },
        ];

    for (const check of usageChecks) {
      const count = await db.collection(check.collection).countDocuments({
        ...check.filter,
        [check.field]: categoryObjectId,
      });
      if (count > 0) {
        return errorResponse(
          `Cannot delete category. It is used by ${count} ${check.label}. Please reassign before deleting.`,
          400
        );
      }
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

