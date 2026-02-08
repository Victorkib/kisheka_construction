/**
 * Project Financial Overview API Route
 * GET: Get unified financial overview (budget + financing + actual)
 * 
 * GET /api/projects/[id]/financial-overview
 * Auth: OWNER, INVESTOR, PM, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getFinancialOverview } from '@/lib/financial-helpers';

/**
 * GET /api/projects/[id]/financial-overview
 * Returns unified financial overview showing budget, financing, and actual spending
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
      return errorResponse('Insufficient permissions. Only OWNER, INVESTOR, PM, and ACCOUNTANT can view financial overview.', 403);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    // Get financial overview using helper function
    const overview = await getFinancialOverview(id);

    return successResponse(overview);
  } catch (error) {
    console.error('Get financial overview error:', error);
    return errorResponse(error.message || 'Failed to retrieve financial overview', 500);
  }
}

