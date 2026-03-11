/**
 * Dashboard Summary API Route
 * GET: Get dashboard summary data (projects, costs, approvals, activity)
 * 
 * GET /api/dashboard/summary
 * Auth: All authenticated users (role-based data filtering)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { calculateProjectTotals } from '@/lib/investment-allocation';
import {
  getPendingApprovalStatuses,
  APPROVAL_STATUS_MAP,
} from '@/lib/status-constants';
import { validateProjectAccess } from '@/lib/middleware/project-context';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/summary
 * Returns dashboard summary with key metrics
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();
    const userRole = userProfile.role?.toLowerCase();

    // Get projectId from query params (required for multi-project system)
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const projectObjectId = projectId && ObjectId.isValid(projectId) ? new ObjectId(projectId) : null;

    // Validate project access if projectId is provided
    if (projectObjectId) {
      const accessResult = await validateProjectAccess(userProfile._id, projectId);
      if (!accessResult.hasAccess) {
        return errorResponse(accessResult.error || 'Access denied to this project', 403);
      }
    }

    // Build project filter for aggregations
    // If no projectId, return zeros for project-specific data (approvals, costs)
    const projectFilter = projectObjectId ? { projectId: projectObjectId } : {};

    // Get total projects count
    const totalProjects = await db.collection('projects').countDocuments({
      deletedAt: null,
      ...projectFilter,
    });

    // Get total costs (materials, expenses, initial expenses) - filtered by project if provided
    const materialsTotal = await db
      .collection('materials')
      .aggregate([
        {
          $match: {
            deletedAt: null,
            status: { $in: ['approved', 'received'] },
            ...projectFilter,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalCost' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const expensesTotal = await db
      .collection('expenses')
      .aggregate([
        {
          $match: {
            deletedAt: null,
            status: { $in: ['APPROVED', 'PAID'] },
            ...projectFilter,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const initialExpensesTotal = await db
      .collection('initial_expenses')
      .aggregate([
        {
          $match: {
            status: 'approved',
            ...projectFilter,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Get labour costs - filtered by project if provided
    const labourTotal = await db
      .collection('labour_entries')
      .aggregate([
        {
          $match: {
            deletedAt: null,
            status: { $in: ['approved', 'paid'] },
            ...projectFilter,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalCost' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const totalMaterialsCost = materialsTotal[0]?.total || 0;
    const totalExpensesCost = expensesTotal[0]?.total || 0;
    const totalInitialExpensesCost = initialExpensesTotal[0]?.total || 0;
    const totalLabourCost = labourTotal[0]?.total || 0;
    const totalOverallCost = totalMaterialsCost + totalExpensesCost + totalInitialExpensesCost + totalLabourCost;

    // Get pending approvals count - filtered by project if provided
    // Use standardized status values from status constants
    const materialsPendingStatuses = getPendingApprovalStatuses('materials');
    const expensesPendingStatuses = getPendingApprovalStatuses('expenses');
    const initialExpensesPendingStatuses = getPendingApprovalStatuses('initial_expenses');
    const materialRequestsPendingStatuses = getPendingApprovalStatuses('material_requests');
    const labourEntriesPendingStatuses = getPendingApprovalStatuses('labour_entries');
    const professionalFeesPendingStatuses = getPendingApprovalStatuses('professional_fees');
    const professionalActivitiesPendingStatuses = getPendingApprovalStatuses('professional_activities');
    const budgetReallocationsPendingStatuses = getPendingApprovalStatuses('budget_reallocations');

    // Query all approval types in parallel
    const [
      pendingMaterials,
      pendingExpenses,
      pendingInitialExpenses,
      pendingMaterialRequests,
      pendingLabourEntries,
      pendingProfessionalFees,
      pendingProfessionalActivities,
      pendingBudgetReallocations,
    ] = await Promise.all([
      // Materials
      projectObjectId
        ? db.collection('materials').countDocuments({
            deletedAt: null,
            status: { $in: materialsPendingStatuses },
            projectId: projectObjectId,
          })
        : Promise.resolve(0),

      // Expenses
      projectObjectId
        ? db.collection('expenses').countDocuments({
            deletedAt: null,
            status: { $in: expensesPendingStatuses },
            projectId: projectObjectId,
          })
        : Promise.resolve(0),

      // Initial Expenses
      projectObjectId
        ? db.collection('initial_expenses').countDocuments({
            status: { $in: initialExpensesPendingStatuses },
            projectId: projectObjectId,
          })
        : Promise.resolve(0),

      // Material Requests
      projectObjectId
        ? db.collection('material_requests').countDocuments({
            deletedAt: null,
            status: { $in: materialRequestsPendingStatuses },
            projectId: projectObjectId,
          })
        : Promise.resolve(0),

      // Labour Entries
      projectObjectId
        ? db.collection('labour_entries').countDocuments({
            deletedAt: null,
            status: { $in: labourEntriesPendingStatuses },
            projectId: projectObjectId,
          })
        : Promise.resolve(0),

      // Professional Fees
      projectObjectId
        ? db.collection('professional_fees').countDocuments({
            deletedAt: null,
            status: { $in: professionalFeesPendingStatuses },
            projectId: projectObjectId,
          })
        : Promise.resolve(0),

      // Professional Activities
      projectObjectId
        ? db.collection('professional_activities').countDocuments({
            deletedAt: null,
            status: { $in: professionalActivitiesPendingStatuses },
            projectId: projectObjectId,
          })
        : Promise.resolve(0),

      // Budget Reallocations
      projectObjectId
        ? db.collection('budget_reallocations').countDocuments({
            deletedAt: null,
            status: { $in: budgetReallocationsPendingStatuses },
            projectId: projectObjectId,
          })
        : Promise.resolve(0),
    ]);

    // Calculate total pending approvals
    const totalPendingApprovals =
      pendingMaterials +
      pendingExpenses +
      pendingInitialExpenses +
      pendingMaterialRequests +
      pendingLabourEntries +
      pendingProfessionalFees +
      pendingProfessionalActivities +
      pendingBudgetReallocations;

    // Get capital raised/used (for OWNER, INVESTOR, ACCOUNTANT, PM)
    // REAL-TIME CALCULATION from actual spending and allocations (not cached project_finances)
    let capitalRaised = 0;
    let capitalUsed = 0;
    let capitalBalance = 0;

    if (['owner', 'investor', 'accountant', 'pm', 'project_manager'].includes(userRole)) {
      // Calculate total used from actual spending (real-time)
      // This matches the logic in /api/project-finances
      capitalUsed = totalOverallCost; // Already calculated from actual spending above (filtered by project if provided)

      // Calculate total invested from projects (real-time from allocations)
      // If projectId provided, only calculate for that project; otherwise all projects
      const projectsToCalculate = projectObjectId
        ? await db.collection('projects').find({ _id: projectObjectId, deletedAt: null }).toArray()
        : await db.collection('projects').find({ deletedAt: null }).toArray();

      let totalInvestedAllProjects = 0;
      let totalLoansAllProjects = 0;
      let totalEquityAllProjects = 0;

      for (const project of projectsToCalculate) {
        try {
          const projectTotals = await calculateProjectTotals(project._id.toString());
          totalInvestedAllProjects += projectTotals.totalInvested || 0;
          totalLoansAllProjects += projectTotals.totalLoans || 0;
          totalEquityAllProjects += projectTotals.totalEquity || 0;
        } catch (err) {
          console.error(`Error calculating totals for project ${project._id}:`, err);
          // Continue with other projects
        }
      }

      capitalRaised = totalInvestedAllProjects;
      capitalBalance = capitalRaised - capitalUsed;
    }

    // Get recent activity (last 10 audit log entries)
    const recentActivity = await db
      .collection('audit_logs')
      .find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    // Format recent activity
    const formattedActivity = recentActivity.map((log) => ({
      id: log._id.toString(),
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId?.toString(),
      userId: log.userId?.toString(),
      timestamp: log.timestamp,
      changes: log.changes || {},
    }));

    return successResponse({
      summary: {
        totalProjects,
        totalMaterialsCost,
        totalExpensesCost,
        totalInitialExpensesCost,
        totalLabourCost,
        totalOverallCost,
        totalPendingApprovals,
        pendingBreakdown: {
          materials: pendingMaterials,
          expenses: pendingExpenses,
          initialExpenses: pendingInitialExpenses,
          materialRequests: pendingMaterialRequests,
          labourEntries: pendingLabourEntries,
          professionalFees: pendingProfessionalFees,
          professionalActivities: pendingProfessionalActivities,
          budgetReallocations: pendingBudgetReallocations,
        },
        capital: {
          raised: capitalRaised,
          used: capitalUsed,
          balance: capitalBalance,
        },
        recentActivity: formattedActivity,
      },
    });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    return errorResponse('Failed to retrieve dashboard summary', 500);
  }
}

