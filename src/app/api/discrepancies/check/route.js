/**
 * Discrepancy Check API Route
 * POST: Check materials for discrepancies and create alerts
 * 
 * POST /api/discrepancies/check
 * Auth: PM, OWNER, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { checkProjectDiscrepancies, createDiscrepancyAlerts } from '@/lib/discrepancy-detection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/discrepancies/check
 * Checks materials for discrepancies and creates alerts
 * Query params: projectId (required)
 * Body: { thresholds?: { variancePercentage?, varianceAmount?, lossPercentage?, lossAmount?, wastagePercentage? } }
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request) {
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
        'Insufficient permissions. Only PM, OWNER, and ACCOUNTANT can check discrepancies.',
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

    const body = await request.json().catch(() => ({}));
    const thresholds = body.thresholds || {};

    const options = {
      thresholds,
    };
    if (startDate) {
      options.startDate = new Date(startDate);
    }
    if (endDate) {
      options.endDate = new Date(endDate);
    }
    if (category) {
      options.category = category;
    }

    // Check for discrepancies
    const discrepancies = await checkProjectDiscrepancies(projectId, options);

    // Create alerts for materials with discrepancies
    const alertCount = await createDiscrepancyAlerts(discrepancies, projectId);

    return successResponse({
      checked: true,
      discrepancyCount: discrepancies.length,
      alertCount,
      discrepancies: discrepancies.map((d) => ({
        materialId: d.materialId,
        materialName: d.materialName,
        supplierName: d.supplierName,
        severity: d.severity,
        metrics: d.metrics,
        alerts: d.alerts,
      })),
    });
  } catch (error) {
    console.error('Check discrepancies error:', error);
    return errorResponse('Failed to check discrepancies', 500);
  }
}

