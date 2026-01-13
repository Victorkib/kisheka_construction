/**
 * Indirect Costs Budget API Route
 * GET: Get indirect costs budget and spending summary
 * 
 * GET /api/projects/[id]/indirect-costs
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getIndirectCostsSummary } from '@/lib/indirect-costs-helpers';

/**
 * GET /api/projects/[id]/indirect-costs
 * Returns indirect costs budget and spending summary
 * Auth: All authenticated users with project access
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const db = await getDatabase();

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Get indirect costs summary
    const summary = await getIndirectCostsSummary(id);

    // Calculate usage percentage
    const usagePercentage = summary.budgeted > 0 
      ? (summary.spent / summary.budgeted) * 100 
      : 0;

    // Determine status
    let status = 'healthy';
    if (usagePercentage >= 100) {
      status = 'exceeded';
    } else if (usagePercentage >= 90) {
      status = 'critical';
    } else if (usagePercentage >= 80) {
      status = 'warning';
    }

    return successResponse({
      ...summary,
      usagePercentage: Math.min(100, usagePercentage),
      status,
      project: {
        _id: project._id.toString(),
        projectCode: project.projectCode,
        projectName: project.projectName,
      },
    });
  } catch (error) {
    console.error('Get indirect costs summary error:', error);
    return errorResponse('Failed to retrieve indirect costs summary', 500);
  }
}
