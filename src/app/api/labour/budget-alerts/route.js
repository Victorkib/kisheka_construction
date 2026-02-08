/**
 * Budget Alerts API Route
 * GET: Get active budget alerts
 * 
 * GET /api/labour/budget-alerts
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  checkPhaseLabourBudgetThresholds,
  checkProjectLabourBudgetThresholds,
  generateLabourBudgetAlerts,
} from '@/lib/labour-budget-alerts';
import { ObjectId } from 'mongodb';

/**
 * GET /api/labour/budget-alerts
 * Get active budget alerts
 * Query params: projectId, phaseId, thresholds (JSON string)
 * Auth: All authenticated users
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

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const phaseId = searchParams.get('phaseId');
    const thresholdsParam = searchParams.get('thresholds');

    let thresholds = {};
    if (thresholdsParam) {
      try {
        thresholds = JSON.parse(thresholdsParam);
      } catch (e) {
        // Invalid JSON, use defaults
      }
    }

    let result;

    if (phaseId && ObjectId.isValid(phaseId)) {
      // Check specific phase
      result = await checkPhaseLabourBudgetThresholds(phaseId, thresholds);
    } else if (projectId && ObjectId.isValid(projectId)) {
      // Check project (all phases)
      result = await checkProjectLabourBudgetThresholds(projectId, thresholds);
    } else {
      return errorResponse('Either projectId or phaseId is required', 400);
    }

    // Sort alerts by severity (critical > high > medium > low)
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    result.alerts.sort((a, b) => {
      return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
    });

    return successResponse(
      {
        hasAlert: result.hasAlert,
        alerts: result.alerts,
        summary: {
          totalAlerts: result.alerts.length,
          criticalCount: result.alerts.filter((a) => a.severity === 'critical').length,
          highCount: result.alerts.filter((a) => a.severity === 'high').length,
          mediumCount: result.alerts.filter((a) => a.severity === 'medium').length,
        },
        budget: {
          budgetAllocated: result.budgetAllocated || result.totalBudget || 0,
          actualCost: result.actualCost || result.totalActual || 0,
          remaining: result.remaining || 0,
          utilizationPercentage: result.utilizationPercentage || 0,
        },
        context: {
          projectId: result.projectId || projectId,
          projectName: result.projectName || null,
          phaseId: result.phaseId || phaseId,
          phaseName: result.phaseName || null,
        },
      },
      'Budget alerts retrieved successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/budget-alerts error:', error);
    return errorResponse('Failed to retrieve budget alerts', 500);
  }
}

