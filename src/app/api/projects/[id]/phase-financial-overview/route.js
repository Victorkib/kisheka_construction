/**
 * Project Phase Financial Overview API Route
 * GET: Get comprehensive phase-based financial overview for a project
 *
 * GET /api/projects/[id]/phase-financial-overview
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getProjectPhases, getPhaseSummary } from '@/lib/phase-helpers';
import { forecastProjectSpending } from '@/lib/forecasting-helpers';
import { getBudgetTotal } from '@/lib/schemas/budget-schema';
import { getFinancialOverview } from '@/lib/financial-helpers';

/**
 * GET /api/projects/[id]/phase-financial-overview
 * Returns comprehensive phase-based financial overview
 * Auth: All authenticated users
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const db = await getDatabase();

    // Get project
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Get phase summary
    const phaseSummary = await getPhaseSummary(id);

    // Get project financial overview
    const financialOverview = await getFinancialOverview(id);

    // Get phase forecasts
    let forecast = null;
    try {
      forecast = await forecastProjectSpending(id);
    } catch (error) {
      console.error('Error calculating forecast:', error);
      // Continue without forecast if it fails
    }

    // Get phases with detailed financials
    const phases = await getProjectPhases(id, true);

    // Calculate overall project metrics
    const projectBudgetTotal = getBudgetTotal(project.budget);
    const totalPhaseBudget = phases.reduce(
      (sum, p) => sum + (p.budgetAllocation?.total || 0),
      0,
    );
    const unallocatedBudget = projectBudgetTotal - totalPhaseBudget;

    // Risk indicators
    const riskIndicators = [];
    if (forecast && forecast.summary) {
      if (forecast.summary.overallRisk === 'high') {
        riskIndicators.push({
          type: 'high_risk',
          severity: 'high',
          message: `Project forecast shows ${(forecast.summary.totalVariancePercentage || 0).toFixed(1)}% over budget`,
          variancePercentage: forecast.summary.totalVariancePercentage,
        });
      }
    }

    phases.forEach((phase) => {
      const summary = phase.financialSummary || {};
      if (summary.variancePercentage > 15) {
        riskIndicators.push({
          type: 'phase_over_budget',
          severity: 'medium',
          message: `${phase.phaseName} is ${summary.variancePercentage.toFixed(1)}% over budget`,
          phaseId: phase._id.toString(),
          phaseName: phase.phaseName,
        });
      }
      if (summary.utilizationPercentage > 80 && phase.status !== 'completed') {
        riskIndicators.push({
          type: 'phase_high_utilization',
          severity: 'medium',
          message: `${phase.phaseName} has used ${summary.utilizationPercentage.toFixed(1)}% of budget`,
          phaseId: phase._id.toString(),
          phaseName: phase.phaseName,
        });
      }
    });

    return successResponse(
      {
        project: {
          id: project._id.toString(),
          name: project.projectName,
          code: project.projectCode,
          budget: {
            total: projectBudgetTotal,
            allocated: totalPhaseBudget,
            unallocated: unallocatedBudget,
          },
        },
        phaseSummary,
        financialOverview,
        forecast,
        phases: phases.map((p) => ({
          id: p._id.toString(),
          name: p.phaseName,
          code: p.phaseCode,
          status: p.status,
          sequence: p.sequence,
          completionPercentage: p.completionPercentage || 0,
          budget: p.budgetAllocation || {},
          actual: p.actualSpending || {},
          financialSummary: p.financialSummary || {},
          financialStates: p.financialStates || {},
        })),
        riskIndicators,
        summary: {
          totalPhases: phaseSummary.totalPhases,
          completedPhases: phaseSummary.completedPhases,
          inProgressPhases: phaseSummary.inProgressPhases,
          totalBudget: phaseSummary.totalBudget,
          totalSpent: phaseSummary.totalSpent,
          totalCommitted: phaseSummary.totalCommitted,
          totalRemaining:
            phaseSummary.totalBudget -
            phaseSummary.totalSpent -
            phaseSummary.totalCommitted,
          overallVariance: phaseSummary.totalSpent - phaseSummary.totalBudget,
          overallVariancePercentage:
            phaseSummary.totalBudget > 0
              ? (
                  ((phaseSummary.totalSpent - phaseSummary.totalBudget) /
                    phaseSummary.totalBudget) *
                  100
                ).toFixed(2)
              : 0,
        },
      },
      'Phase financial overview retrieved successfully',
    );
  } catch (error) {
    console.error('Get phase financial overview error:', error);
    return errorResponse(
      error.message || 'Failed to retrieve phase financial overview',
      500,
    );
  }
}
