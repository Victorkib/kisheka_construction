/**
 * Category Analysis API Route
 * GET: Get category-based discrepancy analysis
 * 
 * GET /api/discrepancies/categories
 * Auth: PM, OWNER, ACCOUNTANT, INVESTOR, SUPERVISOR
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/role-helpers';
import { getCategoryAnalysis } from '@/lib/discrepancy-detection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/discrepancies/categories
 * Returns category-based discrepancy analysis
 * Query params: projectId (required), startDate (optional), endDate (optional)
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

    // Check permission
    const hasViewPermission = await hasPermission(user.id, 'view_reports');
    if (!hasViewPermission) {
      return errorResponse(
        'Insufficient permissions. Only users with view_reports permission can view category analysis.',
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

    const analysis = await getCategoryAnalysis(projectId, options);

    return successResponse({
      categories: analysis,
      count: analysis.length,
    });
  } catch (error) {
    console.error('Get category analysis error:', error);
    return errorResponse('Failed to retrieve category analysis', 500);
  }
}

