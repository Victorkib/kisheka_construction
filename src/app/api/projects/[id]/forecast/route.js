/**
 * Forecasting API Route
 * GET: Get spending forecasts for a project
 * 
 * GET /api/projects/[id]/forecast
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { forecastProjectSpending } from '@/lib/forecasting-helpers';

/**
 * GET /api/projects/[id]/forecast
 * Returns spending forecasts for all cost categories
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

    // Get forecasts
    const forecast = await forecastProjectSpending(id);

    return successResponse(forecast);
  } catch (error) {
    console.error('Get forecast error:', error);
    return errorResponse('Failed to generate forecast', 500);
  }
}
