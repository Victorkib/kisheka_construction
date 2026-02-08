/**
 * Recommendations API Route
 * GET: Get actionable recommendations for a project
 * 
 * GET /api/projects/[id]/recommendations
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getRecommendationSummary } from '@/lib/recommendation-engine';

/**
 * GET /api/projects/[id]/recommendations
 * Returns actionable recommendations for the project
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

    // Get recommendations
    const recommendations = await getRecommendationSummary(id);

    return successResponse(recommendations);
  } catch (error) {
    console.error('Get recommendations error:', error);
    return errorResponse('Failed to generate recommendations', 500);
  }
}
