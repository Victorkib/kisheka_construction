/**
 * Category Details Report API Route
 * GET: Get detailed report for a specific category
 * 
 * GET /api/reports/category-details/[categoryId]
 * Auth: OWNER, INVESTOR, PM, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/reports/category-details/[categoryId]
 * Returns detailed report for a category with all items
 * Query params: projectId, startDate, endDate
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasViewPermission = await hasPermission(user.id, 'view_reports');
    if (!hasViewPermission) {
      return errorResponse('Insufficient permissions. Only OWNER, INVESTOR, PM, and ACCOUNTANT can view reports.', 403);
    }

    const { categoryId } = await params;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!categoryId) {
      return errorResponse('Category ID is required', 400);
    }

    const db = await getDatabase();

    // Get category details
    let category = null;
    if (ObjectId.isValid(categoryId)) {
      category = await db.collection('categories').findOne({
        _id: new ObjectId(categoryId),
      });
    }

    // Build query
    const query = {
      deletedAt: null,
      $or: [
        { categoryId: ObjectId.isValid(categoryId) ? new ObjectId(categoryId) : null },
        { category: categoryId },
      ],
    };

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (startDate || endDate) {
      query.datePurchased = {};
      if (startDate) query.datePurchased.$gte = new Date(startDate);
      if (endDate) query.datePurchased.$lte = new Date(endDate);
    }

    // Get items in this category
    const items = await db
      .collection('materials')
      .find(query)
      .sort({ datePurchased: -1 })
      .toArray();

    // Calculate totals
    const total = items.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    const itemCount = items.length;

    // Calculate variance (if budget exists)
    const variance = null; // Would need budget data to calculate

    return successResponse({
      categoryName: category?.name || categoryId,
      category: category,
      items,
      total,
      itemCount,
      variance,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    console.error('Get category details error:', error);
    return errorResponse('Failed to retrieve category details', 500);
  }
}

