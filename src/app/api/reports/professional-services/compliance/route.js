/**
 * Professional Services Compliance Report API Route
 * GET: Get compliance and quality control reports
 * 
 * GET /api/reports/professional-services/compliance
 * Auth: OWNER, PM, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/reports/professional-services/compliance
 * Returns compliance and quality control statistics
 * Query params: projectId, startDate, endDate, type (architect|engineer|all)
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
      return errorResponse('Insufficient permissions. Only OWNER, PM, and ACCOUNTANT can view reports.', 403);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type') || 'all';

    const db = await getDatabase();

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    // Build base query
    const baseQuery = {
      deletedAt: null,
    };

    if (projectId && ObjectId.isValid(projectId)) {
      baseQuery.projectId = new ObjectId(projectId);
    }

    // Get professional services assignments
    const assignmentsQuery = { ...baseQuery };
    if (type !== 'all') {
      assignmentsQuery.type = type;
    }

    const assignments = await db.collection('professional_services').find(assignmentsQuery).toArray();
    const assignmentIds = assignments.map(a => a._id.toString());

    // Get inspections and quality checks
    const activitiesQuery = {
      ...baseQuery,
      activityType: { $in: ['inspection', 'quality_check'] },
    };

    if (Object.keys(dateFilter).length > 0) {
      activitiesQuery.activityDate = dateFilter;
    }

    const activities = await db.collection('professional_activities').find(activitiesQuery).toArray();

    // Filter by assignment
    let filteredActivities = activities.filter(a =>
      assignmentIds.includes(a.professionalServiceId?.toString())
    );

    if (type !== 'all') {
      const typeAssignments = assignments.filter(a => a.type === type);
      const typeAssignmentIds = typeAssignments.map(a => a._id.toString());
      filteredActivities = filteredActivities.filter(a =>
        typeAssignmentIds.includes(a.professionalServiceId?.toString())
      );
    }

    // Calculate compliance statistics
    const totalInspections = filteredActivities.length;
    const inspections = filteredActivities.filter(a => a.activityType === 'inspection');
    const qualityChecks = filteredActivities.filter(a => a.activityType === 'quality_check');

    // Compliance status breakdown
    const complianceStatusBreakdown = {};
    filteredActivities.forEach(activity => {
      const status = activity.complianceStatus || 'not_specified';
      if (!complianceStatusBreakdown[status]) {
        complianceStatusBreakdown[status] = {
          status,
          count: 0,
          codeCompliant: 0,
          designCompliant: 0,
          qualityStandards: 0,
        };
      }
      complianceStatusBreakdown[status].count++;
      if (activity.codeCompliance) complianceStatusBreakdown[status].codeCompliant++;
      if (activity.designCompliance) complianceStatusBreakdown[status].designCompliant++;
      if (activity.qualityStandards) complianceStatusBreakdown[status].qualityStandards++;
    });

    // Issues found
    const allIssues = [];
    filteredActivities.forEach(activity => {
      if (activity.issuesFound && Array.isArray(activity.issuesFound)) {
        activity.issuesFound.forEach(issue => {
          allIssues.push({
            ...issue,
            activityId: activity._id.toString(),
            activityDate: activity.activityDate,
            activityType: activity.activityType,
            professionalServiceId: activity.professionalServiceId?.toString(),
          });
        });
      }
    });

    const issuesBySeverity = {
      critical: allIssues.filter(i => i.severity === 'critical').length,
      major: allIssues.filter(i => i.severity === 'major').length,
      minor: allIssues.filter(i => i.severity === 'minor').length,
    };

    const resolvedIssues = allIssues.filter(i => i.status === 'resolved').length;
    const pendingIssues = allIssues.filter(i => i.status === 'identified' || i.status === 'in_progress').length;

    // Material tests
    const allMaterialTests = [];
    filteredActivities.forEach(activity => {
      if (activity.materialTests && Array.isArray(activity.materialTests)) {
        activity.materialTests.forEach(test => {
          allMaterialTests.push({
            ...test,
            activityId: activity._id.toString(),
            activityDate: activity.activityDate,
            professionalServiceId: activity.professionalServiceId?.toString(),
          });
        });
      }
    });

    const materialTestsByResult = {
      pass: allMaterialTests.filter(t => t.testResult === 'pass').length,
      fail: allMaterialTests.filter(t => t.testResult === 'fail').length,
      conditional: allMaterialTests.filter(t => t.testResult === 'conditional').length,
    };

    const materialTestsByType = {};
    allMaterialTests.forEach(test => {
      const testType = test.testType || 'unknown';
      if (!materialTestsByType[testType]) {
        materialTestsByType[testType] = {
          type: testType,
          total: 0,
          pass: 0,
          fail: 0,
          conditional: 0,
        };
      }
      materialTestsByType[testType].total++;
      if (test.testResult === 'pass') materialTestsByType[testType].pass++;
      if (test.testResult === 'fail') materialTestsByType[testType].fail++;
      if (test.testResult === 'conditional') materialTestsByType[testType].conditional++;
    });

    // Areas inspected breakdown
    const areasInspected = {};
    filteredActivities.forEach(activity => {
      if (activity.areasInspected && Array.isArray(activity.areasInspected)) {
        activity.areasInspected.forEach(area => {
          if (!areasInspected[area]) {
            areasInspected[area] = {
              area,
              count: 0,
              inspections: 0,
              qualityChecks: 0,
            };
          }
          areasInspected[area].count++;
          if (activity.activityType === 'inspection') areasInspected[area].inspections++;
          if (activity.activityType === 'quality_check') areasInspected[area].qualityChecks++;
        });
      }
    });

    return successResponse({
      summary: {
        totalInspections,
        inspections: inspections.length,
        qualityChecks: qualityChecks.length,
        totalIssues: allIssues.length,
        resolvedIssues,
        pendingIssues,
        totalMaterialTests: allMaterialTests.length,
      },
      complianceStatus: Object.values(complianceStatusBreakdown),
      issuesBySeverity,
      materialTestsByResult,
      materialTestsByType: Object.values(materialTestsByType),
      areasInspected: Object.values(areasInspected),
      issues: allIssues.slice(0, 100), // Limit to first 100 issues
      materialTests: allMaterialTests.slice(0, 100), // Limit to first 100 tests
      filters: {
        projectId: projectId || null,
        startDate: startDate || null,
        endDate: endDate || null,
        type,
      },
    }, 'Compliance report generated successfully');
  } catch (error) {
    console.error('Compliance report error:', error);
    return errorResponse('Failed to generate compliance report', 500);
  }
}





