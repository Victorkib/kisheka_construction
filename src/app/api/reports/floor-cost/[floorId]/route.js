/**
 * Floor Cost Report API Route
 * GET: Get cost breakdown for a specific floor
 * 
 * GET /api/reports/floor-cost/[floorId]
 * Auth: OWNER, INVESTOR, PM, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/reports/floor-cost/[floorId]
 * Returns cost breakdown by category for a specific floor
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

    // Check permission
    const hasViewPermission = await hasPermission(user.id, 'view_reports');
    if (!hasViewPermission) {
      return errorResponse('Insufficient permissions. Only OWNER, INVESTOR, PM, and ACCOUNTANT can view reports.', 403);
    }

    const { floorId } = await params;

    if (!floorId || !ObjectId.isValid(floorId)) {
      return errorResponse('Valid floor ID is required', 400);
    }

    const db = await getDatabase();

    // Get floor details
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(floorId),
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    // Get materials for this floor
    const materials = await db
      .collection('materials')
      .find({
        floor: new ObjectId(floorId),
        deletedAt: null,
        status: { $in: ['approved', 'received'] },
      })
      .toArray();

    // Group by category
    const categoryMap = {};
    let totalCost = 0;

    materials.forEach((material) => {
      const category = material.category || 'Uncategorized';
      if (!categoryMap[category]) {
        categoryMap[category] = {
          category,
          total: 0,
          count: 0,
          items: [],
        };
      }
      categoryMap[category].total += material.totalCost || 0;
      categoryMap[category].count += 1;
      categoryMap[category].items.push(material);
      totalCost += material.totalCost || 0;
    });

    const categories = Object.values(categoryMap).map((cat) => ({
      ...cat,
      percentage: totalCost > 0 ? ((cat.total / totalCost) * 100).toFixed(2) : 0,
    }));

    return successResponse({
      floorNumber: floor.floorNumber,
      floorName: floor.name || `Floor ${floor.floorNumber}`,
      floor: floor,
      categories,
      totalCost,
      itemCount: materials.length,
      percentage: floor.totalBudget > 0 ? ((totalCost / floor.totalBudget) * 100).toFixed(2) : null,
    });
  } catch (error) {
    console.error('Get floor cost error:', error);
    return errorResponse('Failed to retrieve floor cost report', 500);
  }
}

