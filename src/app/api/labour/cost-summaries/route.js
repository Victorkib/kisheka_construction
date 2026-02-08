/**
 * Labour Cost Summaries API Route
 * GET: Get labour cost summaries
 * 
 * GET /api/labour/cost-summaries
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { calculateLabourCostSummary, updateLabourCostSummary } from '@/lib/labour-financial-helpers';

/**
 * GET /api/labour/cost-summaries
 * Get labour cost summaries
 * Query params: projectId, phaseId, periodType, periodStart, periodEnd, recalculate
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
    const periodType = searchParams.get('periodType') || 'project_total'; // daily, weekly, monthly, project_total, phase_total
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');
    const recalculate = searchParams.get('recalculate') === 'true';

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      deletedAt: null,
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Verify phase if provided
    if (phaseId) {
      if (!ObjectId.isValid(phaseId)) {
        return errorResponse('Valid phaseId is required', 400);
      }

      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(phaseId),
        projectId: new ObjectId(projectId),
        deletedAt: null,
      });

      if (!phase) {
        return errorResponse('Phase not found or does not belong to this project', 404);
      }
    }

    // If recalculate is requested, calculate fresh summary
    if (recalculate) {
      const calculatedSummary = await updateLabourCostSummary(
        projectId,
        phaseId,
        periodType,
        periodStart ? new Date(periodStart) : null,
        periodEnd ? new Date(periodEnd) : null
      );

      return successResponse(
        {
          summary: calculatedSummary,
          recalculated: true,
        },
        'Labour cost summary recalculated successfully'
      );
    }

    // Try to get existing summary from database
    const query = {
      projectId: new ObjectId(projectId),
      periodType,
    };

    if (phaseId) {
      query.phaseId = new ObjectId(phaseId);
    } else {
      query.phaseId = null;
    }

    if (periodStart) {
      query.periodStart = new Date(periodStart);
    }

    if (periodEnd) {
      query.periodEnd = new Date(periodEnd);
    }

    let summary = await db.collection('labour_cost_summaries').findOne(query);

    // If no summary found, calculate it
    if (!summary) {
      summary = await updateLabourCostSummary(
        projectId,
        phaseId,
        periodType,
        periodStart ? new Date(periodStart) : null,
        periodEnd ? new Date(periodEnd) : null
      );
    }

    // Get project/phase budget info for context
    let budgetInfo = null;
    if (phaseId) {
      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(phaseId),
      });
      if (phase && phase.budgetAllocation?.labour) {
        const phaseBudget = phase.budgetAllocation.labour;
        budgetInfo = {
          allocated: (phaseBudget.skilled || 0) + (phaseBudget.unskilled || 0) + (phaseBudget.supervisory || 0) + (phaseBudget.specialized || 0),
          used: summary.costs.total.cost,
          remaining: ((phaseBudget.skilled || 0) + (phaseBudget.unskilled || 0) + (phaseBudget.supervisory || 0) + (phaseBudget.specialized || 0)) - summary.costs.total.cost,
          utilization: ((phaseBudget.skilled || 0) + (phaseBudget.unskilled || 0) + (phaseBudget.supervisory || 0) + (phaseBudget.specialized || 0)) > 0
            ? (summary.costs.total.cost / ((phaseBudget.skilled || 0) + (phaseBudget.unskilled || 0) + (phaseBudget.supervisory || 0) + (phaseBudget.specialized || 0))) * 100
            : 0,
        };
      }
    } else {
      if (project && project.budgetAllocation?.labour) {
        const projectBudget = project.budgetAllocation.labour;
        budgetInfo = {
          allocated: (projectBudget.skilled || 0) + (projectBudget.unskilled || 0) + (projectBudget.supervisory || 0) + (projectBudget.specialized || 0),
          used: summary.costs.total.cost,
          remaining: ((projectBudget.skilled || 0) + (projectBudget.unskilled || 0) + (projectBudget.supervisory || 0) + (projectBudget.specialized || 0)) - summary.costs.total.cost,
          utilization: ((projectBudget.skilled || 0) + (projectBudget.unskilled || 0) + (projectBudget.supervisory || 0) + (projectBudget.specialized || 0)) > 0
            ? (summary.costs.total.cost / ((projectBudget.skilled || 0) + (projectBudget.unskilled || 0) + (projectBudget.supervisory || 0) + (projectBudget.specialized || 0))) * 100
            : 0,
        };
      }
    }

    return successResponse(
      {
        project: {
          projectId: project._id.toString(),
          projectName: project.projectName,
          projectCode: project.projectCode,
        },
        phase: phaseId
          ? {
              phaseId,
              phaseName: (await db.collection('phases').findOne({ _id: new ObjectId(phaseId) }))?.phaseName || null,
            }
          : null,
        period: {
          type: periodType,
          start: periodStart || null,
          end: periodEnd || null,
        },
        summary: {
          ...summary,
          _id: summary._id?.toString(),
          projectId: summary.projectId?.toString(),
          phaseId: summary.phaseId?.toString() || null,
        },
        budgetInfo,
      },
      'Labour cost summary retrieved successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/cost-summaries error:', error);
    return errorResponse('Failed to retrieve labour cost summary', 500);
  }
}

