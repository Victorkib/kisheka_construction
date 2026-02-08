/**
 * Financial Report API Route
 * GET: Generate comprehensive financial report
 * 
 * GET /api/projects/[id]/reports/financial
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { generateProjectFinancialReport } from '@/lib/report-generation-helpers';

/**
 * GET /api/projects/[id]/reports/financial
 * Returns comprehensive financial report
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const includeForecast = searchParams.get('includeForecast') !== 'false';
    const includeTrends = searchParams.get('includeTrends') !== 'false';
    const includeRecommendations = searchParams.get('includeRecommendations') !== 'false';
    
    let dateRange = null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (startDate && endDate) {
      dateRange = {
        start: new Date(startDate),
        end: new Date(endDate),
      };
    }

    // Generate report
    const report = await generateProjectFinancialReport(id, {
      includeForecast,
      includeTrends,
      includeRecommendations,
      dateRange,
    });

    return successResponse(report);
  } catch (error) {
    console.error('Generate financial report error:', error);
    return errorResponse('Failed to generate financial report', 500);
  }
}
