/**
 * Professional Services Reports API Route
 * GET: Get professional services activity and financial reports
 * 
 * GET /api/reports/professional-services
 * Auth: OWNER, PM, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { calculateProjectProfessionalServicesStats, getProjectProfessionalServicesBreakdown } from '@/lib/professional-services-helpers';

/**
 * GET /api/reports/professional-services
 * Returns professional services activity and financial summary
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
    const type = searchParams.get('type') || 'all'; // 'architect', 'engineer', or 'all'

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

    // Get professional activities
    const activitiesQuery = { ...baseQuery };
    if (Object.keys(dateFilter).length > 0) {
      activitiesQuery.activityDate = dateFilter;
    }

    const activities = await db.collection('professional_activities').find(activitiesQuery).toArray();

    // Filter activities by assignment type if needed
    const assignmentIds = assignments.map(a => a._id.toString());
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

    // Get professional fees
    const feesQuery = { ...baseQuery };
    if (Object.keys(dateFilter).length > 0) {
      feesQuery.createdAt = dateFilter;
    }

    const fees = await db.collection('professional_fees').find(feesQuery).toArray();

    // Filter fees by assignment type if needed
    let filteredFees = fees.filter(f =>
      assignmentIds.includes(f.professionalServiceId?.toString())
    );

    if (type !== 'all') {
      const typeAssignments = assignments.filter(a => a.type === type);
      const typeAssignmentIds = typeAssignments.map(a => a._id.toString());
      filteredFees = filteredFees.filter(f =>
        typeAssignmentIds.includes(f.professionalServiceId?.toString())
      );
    }

    // Calculate statistics
    const totalAssignments = assignments.length;
    const architectsCount = assignments.filter(a => a.type === 'architect').length;
    const engineersCount = assignments.filter(a => a.type === 'engineer').length;

    const totalActivities = filteredActivities.length;
    const siteVisits = filteredActivities.filter(a => a.activityType === 'site_visit').length;
    const inspections = filteredActivities.filter(a => a.activityType === 'inspection').length;
    const designRevisions = filteredActivities.filter(a => a.activityType === 'design_revision').length;
    const qualityChecks = filteredActivities.filter(a => a.activityType === 'quality_check').length;

    // Calculate fees
    const activeFees = filteredFees.filter((fee) => !['REJECTED', 'ARCHIVED'].includes(fee.status));
    const totalFees = activeFees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
    const paidFees = activeFees
      .filter(fee => fee.status === 'PAID')
      .reduce((sum, fee) => sum + (fee.amount || 0), 0);
    const pendingFees = activeFees
      .filter(fee => fee.status === 'PENDING' || fee.status === 'APPROVED')
      .reduce((sum, fee) => sum + (fee.amount || 0), 0);

    // Calculate fees by type
    const architectFees = activeFees
      .filter(fee => {
        const assignment = assignments.find(a => a._id.toString() === fee.professionalServiceId?.toString());
        return assignment?.type === 'architect';
      })
      .reduce((sum, fee) => sum + (fee.amount || 0), 0);

    const engineerFees = activeFees
      .filter(fee => {
        const assignment = assignments.find(a => a._id.toString() === fee.professionalServiceId?.toString());
        return assignment?.type === 'engineer';
      })
      .reduce((sum, fee) => sum + (fee.amount || 0), 0);

    // Activity breakdown by month
    const activitiesByMonth = {};
    filteredActivities.forEach(activity => {
      const month = new Date(activity.activityDate).toISOString().slice(0, 7); // YYYY-MM
      if (!activitiesByMonth[month]) {
        activitiesByMonth[month] = {
          month,
          count: 0,
          siteVisits: 0,
          inspections: 0,
          designRevisions: 0,
        };
      }
      activitiesByMonth[month].count++;
      if (activity.activityType === 'site_visit') activitiesByMonth[month].siteVisits++;
      if (activity.activityType === 'inspection') activitiesByMonth[month].inspections++;
      if (activity.activityType === 'design_revision') activitiesByMonth[month].designRevisions++;
    });

    // Fees breakdown by month
    const feesByMonth = {};
    activeFees.forEach(fee => {
      const month = new Date(fee.createdAt || fee.invoiceDate || new Date()).toISOString().slice(0, 7);
      if (!feesByMonth[month]) {
        feesByMonth[month] = {
          month,
          total: 0,
          paid: 0,
          pending: 0,
        };
      }
      feesByMonth[month].total += fee.amount || 0;
      if (fee.status === 'PAID') {
        feesByMonth[month].paid += fee.amount || 0;
      } else {
        feesByMonth[month].pending += fee.amount || 0;
      }
    });

    // Get breakdown by assignment
    const breakdown = await Promise.all(
      assignments.map(async (assignment) => {
        const assignmentActivities = filteredActivities.filter(
          a => a.professionalServiceId?.toString() === assignment._id.toString()
        );
        const assignmentFees = activeFees.filter(
          f => f.professionalServiceId?.toString() === assignment._id.toString()
        );

        const library = await db.collection('professional_services_library').findOne({
          _id: assignment.libraryId,
        });

        return {
          assignmentId: assignment._id.toString(),
          professionalCode: assignment.professionalCode,
          type: assignment.type,
          library: library ? {
            name: library.name,
            companyName: library.companyName,
          } : null,
          activitiesCount: assignmentActivities.length,
          totalFees: assignmentFees.reduce((sum, f) => sum + (f.amount || 0), 0),
          paidFees: assignmentFees
            .filter(f => f.status === 'PAID')
            .reduce((sum, f) => sum + (f.amount || 0), 0),
          status: assignment.status,
        };
      })
    );

    return successResponse({
      summary: {
        totalAssignments,
        architectsCount,
        engineersCount,
        totalActivities,
        siteVisits,
        inspections,
        designRevisions,
        qualityChecks,
        totalFees,
        paidFees,
        pendingFees,
        architectFees,
        engineerFees,
      },
      activitiesByMonth: Object.values(activitiesByMonth).sort((a, b) => a.month.localeCompare(b.month)),
      feesByMonth: Object.values(feesByMonth).sort((a, b) => a.month.localeCompare(b.month)),
      breakdown,
      filters: {
        projectId: projectId || null,
        startDate: startDate || null,
        endDate: endDate || null,
        type,
      },
    }, 'Professional services report generated successfully');
  } catch (error) {
    console.error('Professional services report error:', error);
    return errorResponse('Failed to generate professional services report', 500);
  }
}





