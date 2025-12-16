/**
 * Material Usage Patterns API Route
 * GET: Get usage patterns for materials
 * 
 * GET /api/analytics/material-usage-patterns
 * Auth: OWNER, PM, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/analytics/material-usage-patterns
 * Returns usage patterns for materials
 * Query params: projectId, startDate, endDate, limit
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasViewPermission = await hasPermission(user.id, 'view_reports');
    if (!hasViewPermission) {
      return errorResponse(
        'Insufficient permissions. Only OWNER, PM, and ACCOUNTANT can view analytics.',
        403
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const db = await getDatabase();

    // Build query for material requests
    const query = {
      deletedAt: null,
    };

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    // Date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Get material requests
    const materialRequests = await db.collection('material_requests').find(query).toArray();

    // Aggregate by material name
    const materialUsage = {};

    materialRequests.forEach((req) => {
      const matName = req.materialName || 'Unknown';
      const category = req.category || 'Uncategorized';

      if (!materialUsage[matName]) {
        materialUsage[matName] = {
          materialName: matName,
          category: category,
          requestCount: 0,
          totalQuantity: 0,
          unit: req.unit || 'piece',
          totalEstimatedCost: 0,
          months: {},
          urgencyBreakdown: {
            low: 0,
            medium: 0,
            high: 0,
            critical: 0,
          },
        };
      }

      const usage = materialUsage[matName];
      usage.requestCount += 1;
      usage.totalQuantity += req.quantityNeeded || 0;
      usage.totalEstimatedCost += req.estimatedCost || 0;

      // Track by month
      const month = new Date(req.createdAt).toISOString().slice(0, 7); // YYYY-MM
      if (!usage.months[month]) {
        usage.months[month] = 0;
      }
      usage.months[month] += req.quantityNeeded || 0;

      // Track urgency
      const urgency = req.urgency || 'medium';
      if (usage.urgencyBreakdown[urgency] !== undefined) {
        usage.urgencyBreakdown[urgency] += 1;
      }
    });

    // Convert to array and sort by request count
    const mostRequested = Object.values(materialUsage)
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, limit);

    // Category breakdown
    const categoryBreakdown = {};
    materialRequests.forEach((req) => {
      const category = req.category || 'Uncategorized';
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = {
          category,
          requestCount: 0,
          totalQuantity: 0,
          totalCost: 0,
        };
      }
      categoryBreakdown[category].requestCount += 1;
      categoryBreakdown[category].totalQuantity += req.quantityNeeded || 0;
      categoryBreakdown[category].totalCost += req.estimatedCost || 0;
    });

    const categoryBreakdownArray = Object.values(categoryBreakdown).sort(
      (a, b) => b.requestCount - a.requestCount
    );

    // Seasonal trends (by month)
    const seasonalTrends = {};
    materialRequests.forEach((req) => {
      const month = new Date(req.createdAt).toISOString().slice(0, 7);
      if (!seasonalTrends[month]) {
        seasonalTrends[month] = {
          period: month,
          requestCount: 0,
          totalQuantity: 0,
          totalCost: 0,
        };
      }
      seasonalTrends[month].requestCount += 1;
      seasonalTrends[month].totalQuantity += req.quantityNeeded || 0;
      seasonalTrends[month].totalCost += req.estimatedCost || 0;
    });

    const seasonalTrendsArray = Object.values(seasonalTrends).sort((a, b) =>
      a.period.localeCompare(b.period)
    );

    return successResponse({
      mostRequested,
      categoryBreakdown: categoryBreakdownArray,
      seasonalTrends: seasonalTrendsArray,
    });
  } catch (error) {
    console.error('Material usage patterns error:', error);
    return errorResponse('Failed to retrieve material usage patterns', 500);
  }
}

