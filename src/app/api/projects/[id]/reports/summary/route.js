/**
 * Cost Category Summary Report API Route
 * GET: Generate cost category summary report
 * 
 * GET /api/projects/[id]/reports/summary
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { generateCostCategorySummary } from '@/lib/report-generation-helpers';

/**
 * GET /api/projects/[id]/reports/summary
 * Returns cost category summary report
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

    // Generate summary report
    const report = await generateCostCategorySummary(id);

    return successResponse(report);
  } catch (error) {
    console.error('Generate summary report error:', error);
    return errorResponse('Failed to generate summary report', 500);
  }
}
