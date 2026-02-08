/**
 * Discrepancy Summary API Route
 * GET: Get summary of discrepancies for a project
 * 
 * GET /api/discrepancies/summary
 * Auth: PM, OWNER, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/role-helpers';
import { getProjectDiscrepancySummary } from '@/lib/discrepancy-detection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/discrepancies/summary
 * Returns summary of discrepancies for a project
 * Query params: projectId (required)
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
        'Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can view discrepancy summaries.',
        403
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');

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
    if (category) {
      options.category = category;
    }

    const summary = await getProjectDiscrepancySummary(projectId, options);

    if (!summary) {
      return errorResponse('Failed to generate discrepancy summary', 500);
    }

    return successResponse(summary);
  } catch (error) {
    console.error('Get discrepancy summary error:', error);
    return errorResponse('Failed to retrieve discrepancy summary', 500);
  }
}

