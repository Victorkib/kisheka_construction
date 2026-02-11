/**
 * Owner Portfolio Dashboard API Route
 * GET: Get comprehensive portfolio-wide data for owner dashboard
 * 
 * GET /api/dashboard/owner/portfolio
 * Auth: OWNER only
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { calculateProjectTotals } from '@/lib/investment-allocation';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/owner/portfolio
 * Returns comprehensive portfolio-wide data for owner dashboard
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

    const userRole = userProfile.role?.toLowerCase();
    if (userRole !== 'owner') {
      return errorResponse('Access denied. Owner role required.', 403);
    }

    const db = await getDatabase();

    // Get all active projects
    const projects = await db.collection('projects')
      .find({ deletedAt: null })
      .sort({ createdAt: -1 })
      .toArray();

    // Calculate portfolio-level metrics
    let totalCapitalRaised = 0;
    let totalCapitalUsed = 0;
    let totalBudget = 0;
    let totalActualSpent = 0;
    let totalMaterialsCost = 0;
    let totalLabourCost = 0;
    let totalExpensesCost = 0;
    let totalPendingApprovals = 0;
    let criticalIssues = 0;
    let portfolioHealthScores = [];

    // Process each project
    const projectsWithMetrics = await Promise.all(
      projects.map(async (project) => {
        const projectId = project._id.toString();

        // Calculate project totals
        let projectTotals = { totalInvested: 0, totalLoans: 0, totalEquity: 0 };
        try {
          projectTotals = await calculateProjectTotals(projectId);
        } catch (err) {
          console.error(`Error calculating totals for project ${projectId}:`, err);
        }

        // Get project costs
        const [materialsAgg, labourAgg, expensesAgg] = await Promise.all([
          db.collection('materials').aggregate([
            {
              $match: {
                projectId: project._id,
                deletedAt: null,
                status: { $in: ['approved', 'received'] },
              },
            },
            { $group: { _id: null, total: { $sum: '$totalCost' } } },
          ]).toArray(),
          db.collection('labour_entries').aggregate([
            {
              $match: {
                projectId: project._id,
                deletedAt: null,
                status: { $in: ['approved', 'paid'] },
              },
            },
            { $group: { _id: null, total: { $sum: '$totalCost' } } },
          ]).toArray(),
          db.collection('expenses').aggregate([
            {
              $match: {
                projectId: project._id,
                deletedAt: null,
                status: { $in: ['APPROVED', 'PAID'] },
              },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]).toArray(),
        ]);

        const materialsCost = materialsAgg[0]?.total || 0;
        const labourCost = labourAgg[0]?.total || 0;
        const expensesCost = expensesAgg[0]?.total || 0;
        const projectSpent = materialsCost + labourCost + expensesCost;

        // Get pending approvals
        const [pendingMaterials, pendingExpenses] = await Promise.all([
          db.collection('materials').countDocuments({
            projectId: project._id,
            deletedAt: null,
            status: { $in: ['pending_approval', 'submitted'] },
          }),
          db.collection('expenses').countDocuments({
            projectId: project._id,
            deletedAt: null,
            status: { $in: ['pending_approval', 'submitted'] },
          }),
        ]);

        const projectPending = pendingMaterials + pendingExpenses;
        totalPendingApprovals += projectPending;

        // Calculate health metrics
        const budget = project.budget || {};
        const budgetTotal = budget.total || 0;
        const budgetUtilization = budgetTotal > 0 ? (projectSpent / budgetTotal) * 100 : 0;
        const capitalUtilization = projectTotals.totalInvested > 0
          ? ((projectSpent / projectTotals.totalInvested) * 100)
          : 0;

        // Simple health score calculation
        let healthScore = 100;
        if (budgetUtilization > 100) healthScore -= 30;
        else if (budgetUtilization > 80) healthScore -= 15;
        if (capitalUtilization > 90) healthScore -= 20;
        else if (capitalUtilization > 75) healthScore -= 10;
        if (projectPending > 10) healthScore -= 10;
        healthScore = Math.max(0, healthScore);

        portfolioHealthScores.push(healthScore);

        // Determine health status
        let healthStatus = 'excellent';
        if (healthScore < 40) {
          healthStatus = 'poor';
          criticalIssues++;
        } else if (healthScore < 60) {
          healthStatus = 'fair';
        } else if (healthScore < 80) {
          healthStatus = 'good';
        }

        // Determine capital status
        const availableCapital = projectTotals.totalInvested - projectSpent;
        let capitalStatus = 'sufficient';
        if (projectTotals.totalInvested === 0) {
          capitalStatus = 'insufficient';
        } else if (availableCapital < 0) {
          capitalStatus = 'negative';
        } else if (capitalUtilization > 80) {
          capitalStatus = 'low';
        }

        // Get project phases for completion
        const phases = await db.collection('phases')
          .find({ projectId: project._id, deletedAt: null })
          .toArray();
        
        const totalCompletion = phases.length > 0
          ? phases.reduce((sum, p) => sum + (p.completionPercentage || 0), 0) / phases.length
          : 0;

        // Accumulate totals
        totalCapitalRaised += projectTotals.totalInvested || 0;
        totalCapitalUsed += projectSpent;
        totalBudget += budgetTotal;
        totalActualSpent += projectSpent;
        totalMaterialsCost += materialsCost;
        totalLabourCost += labourCost;
        totalExpensesCost += expensesCost;

        return {
          id: projectId,
          name: project.projectName,
          code: project.projectCode,
          status: project.status || 'planning',
          healthScore,
          healthStatus,
          budgetTotal,
          budgetUtilization: Math.round(budgetUtilization * 10) / 10,
          capitalStatus,
          capitalRaised: projectTotals.totalInvested || 0,
          capitalUsed: projectSpent,
          availableCapital,
          completionPercentage: Math.round(totalCompletion * 10) / 10,
          pendingApprovals: projectPending,
          alerts: [
            ...(budgetUtilization > 100 ? [{ type: 'budget_overrun', severity: 'critical' }] : []),
            ...(capitalUtilization > 90 ? [{ type: 'capital_low', severity: 'high' }] : []),
            ...(projectPending > 5 ? [{ type: 'pending_approvals', severity: 'medium' }] : []),
          ],
        };
      })
    );

    // Calculate portfolio health score (average of all projects)
    const avgHealthScore = portfolioHealthScores.length > 0
      ? Math.round(portfolioHealthScores.reduce((a, b) => a + b, 0) / portfolioHealthScores.length)
      : 100;

    // Get recent activity (last 10 items)
    const recentActivity = await db.collection('audit_logs')
      .find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    // Get action items
    const actionItems = [];
    
    // Check for critical budget overruns
    projectsWithMetrics.forEach((project) => {
      if (project.budgetUtilization > 100) {
        actionItems.push({
          priority: 'critical',
          type: 'budget_overrun',
          title: `${project.name} is over budget`,
          description: `Budget utilization: ${project.budgetUtilization}%`,
          link: `/projects/${project.id}`,
          action: 'Review Budget',
        });
      }
      if (project.capitalStatus === 'negative' || project.capitalStatus === 'insufficient') {
        actionItems.push({
          priority: 'critical',
          type: 'capital_issue',
          title: `${project.name} has capital issues`,
          description: `Capital status: ${project.capitalStatus}`,
          link: `/projects/${project.id}/finances`,
          action: 'Review Finances',
        });
      }
      if (project.pendingApprovals > 5) {
        actionItems.push({
          priority: 'high',
          type: 'pending_approvals',
          title: `${project.name} has ${project.pendingApprovals} pending approvals`,
          description: 'Review and approve pending items',
          link: `/dashboard/approvals?projectId=${project.id}`,
          action: 'View Approvals',
        });
      }
    });

    // Get wastage summary
    try {
      const wastageSummary = await db.collection('discrepancies').aggregate([
        {
          $match: {
            deletedAt: null,
            severity: { $in: ['critical', 'high'] },
          },
        },
        {
          $addFields: {
            costValue: { $ifNull: ['$discrepancyCost', 0] },
          },
        },
        {
          $group: {
            _id: null,
            totalCritical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
            totalHigh: { $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] } },
            totalCost: { $sum: '$costValue' },
          },
        },
      ]).toArray();

      if (wastageSummary && wastageSummary.length > 0 && wastageSummary[0].totalCritical > 0) {
        actionItems.push({
          priority: 'critical',
          type: 'wastage',
          title: `${wastageSummary[0].totalCritical} critical wastage issues`,
          description: `Total cost impact: ${new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(wastageSummary[0].totalCost || 0)}`,
          link: '/dashboard/analytics/wastage',
          action: 'View Wastage Analytics',
        });
      }
    } catch (err) {
      console.error('Error fetching wastage summary:', err);
      // Continue without wastage data
    }

    // Sort action items by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    actionItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Calculate monthly spending (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlySpending = await db.collection('materials').aggregate([
      {
        $match: {
          deletedAt: null,
          status: { $in: ['approved', 'received'] },
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalCost' } } },
    ]).toArray();

    const monthlySpendingAmount = monthlySpending[0]?.total || 0;

    // Get project status breakdown
    const statusBreakdown = projects.reduce((acc, p) => {
      const status = p.status || 'planning';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return successResponse({
      executiveSummary: {
        totalProjects: projects.length,
        activeProjects: statusBreakdown.active || 0,
        statusBreakdown,
        totalCapitalRaised,
        totalCapitalUsed,
        availableCapital: totalCapitalRaised - totalCapitalUsed,
        portfolioHealthScore: avgHealthScore,
        criticalIssues,
        monthlySpending: monthlySpendingAmount,
      },
      projects: projectsWithMetrics,
      financialHealth: {
        totalRaised: totalCapitalRaised,
        totalUsed: totalCapitalUsed,
        available: totalCapitalRaised - totalCapitalUsed,
        budgetTotal: totalBudget,
        actualSpent: totalActualSpent,
        costBreakdown: {
          materials: totalMaterialsCost,
          labour: totalLabourCost,
          expenses: totalExpensesCost,
        },
        budgetVariance: totalBudget > 0
          ? ((totalActualSpent - totalBudget) / totalBudget) * 100
          : 0,
      },
      actionItems: actionItems.slice(0, 10), // Limit to top 10
      recentActivity: recentActivity.map((log) => ({
        id: log._id.toString(),
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId?.toString(),
        timestamp: log.timestamp,
      })),
    });
  } catch (error) {
    console.error('Get owner portfolio dashboard error:', error);
    return errorResponse('Failed to retrieve portfolio data', 500);
  }
}
