/**
 * Wastage Widget Summary API Route
 * GET: Get quick wastage summary for dashboard widgets (all projects)
 * 
 * GET /api/discrepancies/widget-summary
 * Auth: PM, OWNER, ACCOUNTANT, SUPERVISOR, INVESTOR
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { checkMaterialDiscrepancies, DEFAULT_THRESHOLDS } from '@/lib/discrepancy-detection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/discrepancies/widget-summary
 * Gets quick wastage summary across all projects for dashboard widgets
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

    // Check permission
    const hasViewPermission = await hasPermission(user.id, 'view_reports');
    if (!hasViewPermission) {
      return errorResponse('Insufficient permissions to view wastage summary', 403);
    }

    const db = await getDatabase();

    // Get projectId from query params (optional - for project-specific summary)
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const projectObjectId = projectId && ObjectId.isValid(projectId) ? new ObjectId(projectId) : null;

    // Build project filter
    const projectQuery = projectObjectId
      ? { _id: projectObjectId, status: { $in: ['planning', 'active'] } }
      : { status: { $in: ['planning', 'active'] } };

    // Get projects to check (single project if projectId provided, otherwise all active projects)
    const projects = await db.collection('projects').find(projectQuery).toArray();

    let totalCritical = 0;
    let totalHigh = 0;
    let totalMedium = 0;
    let totalLow = 0;
    let totalMaterialsWithIssues = 0;
    let totalDiscrepancyCost = 0;
    const projectSummaries = [];

    // Check each project
    for (const project of projects) {
      // Get project-specific thresholds or use defaults
      const thresholds = project.wastageThresholds || DEFAULT_THRESHOLDS;

      // Get materials for this project
      const materials = await db.collection('materials').find({
        projectId: new ObjectId(project._id),
        deletedAt: null,
        quantityDelivered: { $gt: 0 },
      }).toArray();

      let projectCritical = 0;
      let projectHigh = 0;
      let projectMedium = 0;
      let projectLow = 0;
      let projectMaterialsWithIssues = 0;
      let projectDiscrepancyCost = 0;

      for (const material of materials) {
        const discrepancy = checkMaterialDiscrepancies(material, thresholds);
        
        if (discrepancy.alerts.hasAnyAlert) {
          projectMaterialsWithIssues++;
          projectDiscrepancyCost += discrepancy.metrics.totalDiscrepancyCost;

          switch (discrepancy.severity) {
            case 'CRITICAL':
              projectCritical++;
              totalCritical++;
              break;
            case 'HIGH':
              projectHigh++;
              totalHigh++;
              break;
            case 'MEDIUM':
              projectMedium++;
              totalMedium++;
              break;
            case 'LOW':
              projectLow++;
              totalLow++;
              break;
          }
        }
      }

      if (projectMaterialsWithIssues > 0) {
        projectSummaries.push({
          projectId: project._id.toString(),
          projectName: project.projectName || project.projectCode,
          critical: projectCritical,
          high: projectHigh,
          medium: projectMedium,
          low: projectLow,
          materialsWithIssues: projectMaterialsWithIssues,
          totalDiscrepancyCost: parseFloat(projectDiscrepancyCost.toFixed(2)),
        });
      }

      totalMaterialsWithIssues += projectMaterialsWithIssues;
      totalDiscrepancyCost += projectDiscrepancyCost;
    }

    return successResponse({
      summary: {
        totalCritical,
        totalHigh,
        totalMedium,
        totalLow,
        totalMaterialsWithIssues,
        totalDiscrepancyCost: parseFloat(totalDiscrepancyCost.toFixed(2)),
      },
      projectSummaries: projectSummaries.sort((a, b) => b.totalDiscrepancyCost - a.totalDiscrepancyCost).slice(0, 5), // Top 5 projects
    });
  } catch (error) {
    console.error('Get widget summary error:', error);
    return errorResponse('Failed to retrieve wastage summary', 500);
  }
}

