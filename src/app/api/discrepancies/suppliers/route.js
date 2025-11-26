/**
 * Supplier Performance API Route
 * GET: Get supplier performance metrics based on discrepancies
 * 
 * GET /api/discrepancies/suppliers
 * Auth: PM, OWNER, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/role-helpers';
import { getSupplierPerformance } from '@/lib/discrepancy-detection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/discrepancies/suppliers
 * Returns supplier performance metrics
 * Query params: projectId (optional - if not provided, checks all projects)
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
        'Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can view supplier performance.',
        403
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');

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

    const supplierStats = await getSupplierPerformance(
      projectId && ObjectId.isValid(projectId) ? projectId : null,
      options
    );

    return successResponse({
      suppliers: supplierStats,
      count: supplierStats.length,
    });
  } catch (error) {
    console.error('Get supplier performance error:', error);
    return errorResponse('Failed to retrieve supplier performance', 500);
  }
}

