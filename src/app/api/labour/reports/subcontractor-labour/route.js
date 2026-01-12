/**
 * Subcontractor Labour Report API Route
 * GET: Get subcontractor labour report
 * 
 * GET /api/labour/reports/subcontractor-labour
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  getDirectLabourSummary,
  getSubcontractorLabourSummary,
  getCombinedLabourSummary,
  getSubcontractorLabourEntries,
} from '@/lib/subcontractor-labour-helpers';
import { ObjectId } from 'mongodb';

/**
 * GET /api/labour/reports/subcontractor-labour
 * Get subcontractor labour report
 * Query params: projectId, phaseId, subcontractorId, dateFrom, dateTo, breakdown (direct|subcontractor|combined)
 * Auth: All authenticated users
 */
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
    const subcontractorId = searchParams.get('subcontractorId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const breakdown = searchParams.get('breakdown') || 'combined'; // direct, subcontractor, combined

    let result;

    if (breakdown === 'direct') {
      // Direct labour only
      const directLabour = await getDirectLabourSummary(projectId, phaseId, dateFrom, dateTo);
      result = {
        breakdown: 'direct',
        direct: {
          totalHours: directLabour.totalHours,
          totalCost: directLabour.totalCost,
          regularHours: directLabour.regularHours,
          overtimeHours: directLabour.overtimeHours,
          regularCost: directLabour.regularCost,
          overtimeCost: directLabour.overtimeCost,
          entryCount: directLabour.entryCount,
          uniqueWorkers: directLabour.uniqueWorkers?.length || 0,
        },
        subcontractor: null,
        total: null,
      };
    } else if (breakdown === 'subcontractor') {
      // Subcontractor labour only
      const subcontractorLabour = await getSubcontractorLabourSummary(
        projectId,
        phaseId,
        subcontractorId,
        dateFrom,
        dateTo
      );
      result = {
        breakdown: 'subcontractor',
        direct: null,
        subcontractor: {
          totalHours: subcontractorLabour.summary.totalHours,
          totalCost: subcontractorLabour.summary.totalCost,
          regularHours: subcontractorLabour.summary.regularHours,
          overtimeHours: subcontractorLabour.summary.overtimeHours,
          regularCost: subcontractorLabour.summary.regularCost,
          overtimeCost: subcontractorLabour.summary.overtimeCost,
          entryCount: subcontractorLabour.summary.entryCount,
          uniqueWorkers: subcontractorLabour.summary.uniqueWorkers?.length || 0,
          uniqueSubcontractors: subcontractorLabour.summary.uniqueSubcontractors?.length || 0,
          bySubcontractor: subcontractorLabour.bySubcontractor,
        },
        total: null,
      };
    } else {
      // Combined breakdown
      const combined = await getCombinedLabourSummary(projectId, phaseId, dateFrom, dateTo);
      result = {
        breakdown: 'combined',
        ...combined,
      };
    }

    return successResponse(
      {
        period: {
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        },
        filters: {
          projectId: projectId || null,
          phaseId: phaseId || null,
          subcontractorId: subcontractorId || null,
        },
        ...result,
      },
      'Subcontractor labour report generated successfully'
    );
  } catch (error) {
    console.error('GET /api/labour/reports/subcontractor-labour error:', error);
    return errorResponse('Failed to generate subcontractor labour report', 500);
  }
}

