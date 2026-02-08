/**
 * Trends API Route
 * GET: Get spending trend analysis for a project
 * 
 * GET /api/projects/[id]/trends
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { compareCategoryTrends } from '@/lib/trend-analysis-helpers';

/**
 * GET /api/projects/[id]/trends
 * Returns trend analysis for all cost categories
 * Auth: All authenticated users with project access
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

    // Get trend analysis
    const trends = await compareCategoryTrends(id);

    return successResponse(trends);
  } catch (error) {
    console.error('Get trends error:', error);
    return errorResponse('Failed to generate trend analysis', 500);
  }
}
