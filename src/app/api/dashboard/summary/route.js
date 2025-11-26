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

    // Get total projects count
    const totalProjects = await db.collection('projects').countDocuments({
      deletedAt: null,
    });

    // Get total costs (materials, expenses, initial expenses)
    const materialsTotal = await db
      .collection('materials')
      .aggregate([
        {
          $match: {
            deletedAt: null,
            status: { $in: ['approved', 'received'] },
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

    const totalMaterialsCost = materialsTotal[0]?.total || 0;
    const totalExpensesCost = expensesTotal[0]?.total || 0;
    const totalInitialExpensesCost = initialExpensesTotal[0]?.total || 0;
    const totalOverallCost = totalMaterialsCost + totalExpensesCost + totalInitialExpensesCost;

    // Get pending approvals count
    const pendingMaterials = await db.collection('materials').countDocuments({
      deletedAt: null,
      status: { $in: ['pending_approval', 'submitted'] },
    });

    const pendingExpenses = await db.collection('expenses').countDocuments({
      deletedAt: null,
      status: { $in: ['pending_approval', 'submitted'] },
    });

    const pendingInitialExpenses = await db.collection('initial_expenses').countDocuments({
      status: 'pending_approval',
    });

    const totalPendingApprovals = pendingMaterials + pendingExpenses + pendingInitialExpenses;

    // Get capital raised/used (for OWNER, INVESTOR, ACCOUNTANT, PM)
    // REAL-TIME CALCULATION from actual spending and allocations (not cached project_finances)
    let capitalRaised = 0;
    let capitalUsed = 0;
    let capitalBalance = 0;

    if (['owner', 'investor', 'accountant', 'pm', 'project_manager'].includes(userRole)) {
      // Calculate total used from actual spending (real-time)
      // This matches the logic in /api/project-finances
      capitalUsed = totalOverallCost; // Already calculated from actual spending above

      // Calculate total invested from all projects (real-time from allocations)
      const allProjects = await db
        .collection('projects')
        .find({ deletedAt: null })
        .toArray();

      let totalInvestedAllProjects = 0;
      let totalLoansAllProjects = 0;
      let totalEquityAllProjects = 0;

      for (const project of allProjects) {
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
        totalOverallCost,
        totalPendingApprovals,
        pendingBreakdown: {
          materials: pendingMaterials,
          expenses: pendingExpenses,
          initialExpenses: pendingInitialExpenses,
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

