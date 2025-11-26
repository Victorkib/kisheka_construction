/**
 * Historical Trends API Route
 * GET: Get historical trend data for wastage analytics
 * 
 * GET /api/discrepancies/trends
 * Auth: PM, OWNER, ACCOUNTANT, INVESTOR, SUPERVISOR
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/role-helpers';
import { getHistoricalTrends } from '@/lib/discrepancy-detection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/discrepancies/trends
 * Returns historical trend data for a project
 * Query params: projectId (required), startDate (optional), endDate (optional)
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
        'Insufficient permissions. Only users with view_reports permission can view historical trends.',
        403
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    const options = {};
    if (startDate) {
      options.startDate = new Date(startDate);
    }
    if (endDate) {
      options.endDate = new Date(endDate);
    }

    const trends = await getHistoricalTrends(projectId, options);

    return successResponse({
      trends,
      count: trends.length,
    });
  } catch (error) {
    console.error('Get historical trends error:', error);
    return errorResponse('Failed to retrieve historical trends', 500);
  }
}

