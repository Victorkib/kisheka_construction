/**
 * Contingency Budget API Route
 * GET: Get contingency budget and usage summary
 * 
 * GET /api/projects/[id]/contingency
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getContingencySummary } from '@/lib/contingency-helpers';

/**
 * GET /api/projects/[id]/contingency
 * Returns contingency budget and usage summary
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

    // Get contingency summary
    const summary = await getContingencySummary(id);

    // Calculate usage percentage
    const usagePercentage = summary.budgeted > 0 
      ? (summary.used / summary.budgeted) * 100 
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

    // Get pending draws count
    const pendingDraws = await db.collection('contingency_draws').countDocuments({
      projectId: new ObjectId(id),
      deletedAt: null,
      status: 'pending',
    });

    return successResponse({
      ...summary,
      usagePercentage: Math.min(100, usagePercentage),
      status,
      pendingDraws,
      project: {
        _id: project._id.toString(),
        projectCode: project.projectCode,
        projectName: project.projectName,
      },
    });
  } catch (error) {
    console.error('Get contingency summary error:', error);
    return errorResponse('Failed to retrieve contingency summary', 500);
  }
}
