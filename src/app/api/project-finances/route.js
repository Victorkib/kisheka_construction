/**
 * Project Finances API Route
 * GET: Get project finances summary
 * Auto-calculates from investors, expenses, materials, initial expenses
 * 
 * GET /api/project-finances?projectId=xxx
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { calculateProjectTotals } from '@/lib/investment-allocation';
import {
  EXPENSE_APPROVED_STATUSES,
  MATERIAL_APPROVED_STATUSES,
  INITIAL_EXPENSE_APPROVED_STATUSES,
} from '@/lib/status-constants';
import {
  getProjectFinances,
  calculateCommittedCost,
  calculateEstimatedCost,
  calculateMaterialsBreakdown,
} from '@/lib/financial-helpers';

/**
 * GET /api/project-finances
 * Returns project finances summary
 * Auth: OWNER, INVESTOR, ACCOUNTANT, PROJECT_MANAGER
 * Query params: projectId (optional, if not provided returns all projects)
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
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const db = await getDatabase();

    // CRITICAL FIX: For investor role, filter to only show allocated projects
    let allowedProjectIds = null;
    if (userRole === 'investor') {
      // Get investor record for this user
      const investor = await db.collection('investors').findOne({
        userId: userProfile._id,
        status: 'ACTIVE',
      });

      if (!investor) {
        return errorResponse('Investor record not found', 404);
      }

      // Get list of project IDs this investor is allocated to
      if (investor.projectAllocations && investor.projectAllocations.length > 0) {
        allowedProjectIds = investor.projectAllocations
          .map((allocation) => {
            if (allocation.projectId) {
              return ObjectId.isValid(allocation.projectId)
                ? new ObjectId(allocation.projectId)
                : null;
            }
            return null;
          })
          .filter(Boolean);

        // If specific projectId requested, verify investor has access
        if (projectId && ObjectId.isValid(projectId)) {
          const requestedProjectId = new ObjectId(projectId);
          if (!allowedProjectIds.some((id) => id.equals(requestedProjectId))) {
            return errorResponse('Access denied. You do not have access to this project.', 403);
          }
        }

        // If no projectId specified, only return finances for allocated projects
        if (!projectId && allowedProjectIds.length === 0) {
          return successResponse({
            totalInvested: 0,
            totalLoans: 0,
            totalEquity: 0,
            totalUsed: 0,
            capitalBalance: 0,
            loanBalance: 0,
            equityBalance: 0,
            investorCount: 0,
            breakdown: {
              expenses: 0,
              materials: 0,
              initialExpenses: 0,
              total: 0,
            },
            investors: {
              count: 0,
              totalInvested: 0,
              totalLoans: 0,
              totalEquity: 0,
            },
          });
        }
      } else {
        // Investor has no project allocations
        return successResponse({
          totalInvested: 0,
          totalLoans: 0,
          totalEquity: 0,
          totalUsed: 0,
          capitalBalance: 0,
          loanBalance: 0,
          equityBalance: 0,
          investorCount: 0,
          breakdown: {
            expenses: 0,
            materials: 0,
            initialExpenses: 0,
            total: 0,
          },
          investors: {
            count: 0,
            totalInvested: 0,
            totalLoans: 0,
            totalEquity: 0,
          },
        });
      }
    }

    // Build query for expenses
    // Expenses use uppercase status values: 'APPROVED' or 'PAID'
    const expensesQuery = { deletedAt: null, status: { $in: EXPENSE_APPROVED_STATUSES } };
    if (projectId && ObjectId.isValid(projectId)) {
      expensesQuery.projectId = new ObjectId(projectId);
    } else if (allowedProjectIds && allowedProjectIds.length > 0) {
      // For investor without specific projectId, filter by allocated projects
      expensesQuery.projectId = { $in: allowedProjectIds };
    }

    // Get total from expenses
    const expensesTotal = await db
      .collection('expenses')
      .aggregate([
        { $match: expensesQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ])
      .toArray();

    // Get total from materials
    const materialsQuery = { deletedAt: null, status: { $in: MATERIAL_APPROVED_STATUSES } };
    if (projectId && ObjectId.isValid(projectId)) {
      materialsQuery.projectId = new ObjectId(projectId);
    } else if (allowedProjectIds && allowedProjectIds.length > 0) {
      // For investor without specific projectId, filter by allocated projects
      materialsQuery.projectId = { $in: allowedProjectIds };
    }

    const materialsTotal = await db
      .collection('materials')
      .aggregate([
        { $match: materialsQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalCost' },
          },
        },
      ])
      .toArray();

    // Get total from initial expenses
    const initialExpensesQuery = { deletedAt: null, status: { $in: INITIAL_EXPENSE_APPROVED_STATUSES } };
    if (projectId && ObjectId.isValid(projectId)) {
      initialExpensesQuery.projectId = new ObjectId(projectId);
    } else if (allowedProjectIds && allowedProjectIds.length > 0) {
      // For investor without specific projectId, filter by allocated projects
      initialExpensesQuery.projectId = { $in: allowedProjectIds };
    }

    const initialExpensesTotal = await db
      .collection('initial_expenses')
      .aggregate([
        { $match: initialExpensesQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ])
      .toArray();

    // Calculate total used
    const totalExpenses = expensesTotal[0]?.total || 0;
    const totalMaterials = materialsTotal[0]?.total || 0;
    const totalInitialExpenses = initialExpensesTotal[0]?.total || 0;
    const totalUsed = totalExpenses + totalMaterials + totalInitialExpenses;

    // Calculate project-specific totals from allocations (if projectId provided)
    let totalInvested = 0;
    let totalLoans = 0;
    let totalEquity = 0;
    let investorCount = 0;

    if (projectId && ObjectId.isValid(projectId)) {
      // Use project-specific allocations
      const projectTotals = await calculateProjectTotals(projectId);
      totalInvested = projectTotals.totalInvested;
      totalLoans = projectTotals.totalLoans;
      totalEquity = projectTotals.totalEquity;
      
      // Get investor count for this project
      const projectAllocations = await db
        .collection('investors')
        .aggregate([
          {
            $match: {
              status: 'ACTIVE',
              'projectAllocations.projectId': new ObjectId(projectId),
            },
          },
        ])
        .toArray();
      investorCount = projectAllocations.length;
    } else if (allowedProjectIds && allowedProjectIds.length > 0) {
      // For investor without specific projectId, calculate totals for all allocated projects
      let totalInvestedSum = 0;
      let totalLoansSum = 0;
      let totalEquitySum = 0;
      const investorSet = new Set();

      for (const allocatedProjectId of allowedProjectIds) {
        const projectTotals = await calculateProjectTotals(allocatedProjectId.toString());
        totalInvestedSum += projectTotals.totalInvested || 0;
        totalLoansSum += projectTotals.totalLoans || 0;
        totalEquitySum += projectTotals.totalEquity || 0;

        // Get investors for this project
        const projectAllocations = await db
          .collection('investors')
          .aggregate([
            {
              $match: {
                status: 'ACTIVE',
                'projectAllocations.projectId': allocatedProjectId,
              },
            },
          ])
          .toArray();

        projectAllocations.forEach((inv) => {
          investorSet.add(inv._id.toString());
        });
      }

      totalInvested = totalInvestedSum;
      totalLoans = totalLoansSum;
      totalEquity = totalEquitySum;
      investorCount = investorSet.size;
      
      // If no allocations, fall back to aggregate (backward compatibility)
      if (totalInvested === 0) {
        const investors = await db
          .collection('investors')
          .find({ status: 'ACTIVE' })
          .toArray();
        
        const investorTotals = investors.reduce(
          (acc, inv) => {
            acc.totalInvested += inv.totalInvested || 0;
            if (inv.investmentType === 'LOAN') {
              acc.totalLoans += inv.totalInvested || 0;
            } else if (inv.investmentType === 'EQUITY') {
              acc.totalEquity += inv.totalInvested || 0;
            } else if (inv.investmentType === 'MIXED') {
              acc.totalLoans += (inv.totalInvested || 0) * 0.5;
              acc.totalEquity += (inv.totalInvested || 0) * 0.5;
            }
            return acc;
          },
          { totalInvested: 0, totalLoans: 0, totalEquity: 0 }
        );
        totalInvested = investorTotals.totalInvested;
        totalLoans = investorTotals.totalLoans;
        totalEquity = investorTotals.totalEquity;
        investorCount = investors.length;
      }
    } else if (!allowedProjectIds) {
      // Aggregate across all projects
      const allProjectFinances = await db
        .collection('project_finances')
        .find({})
        .toArray();
      
      if (allProjectFinances.length > 0) {
        const totals = allProjectFinances.reduce(
          (acc, pf) => {
            acc.totalInvested += pf.totalInvested || 0;
            acc.totalLoans += pf.totalLoans || 0;
            acc.totalEquity += pf.totalEquity || 0;
            return acc;
          },
          { totalInvested: 0, totalLoans: 0, totalEquity: 0 }
        );
        totalInvested = totals.totalInvested;
        totalLoans = totals.totalLoans;
        totalEquity = totals.totalEquity;
      } else {
        // Fallback: calculate from all investors
        const investors = await db
          .collection('investors')
          .find({ status: 'ACTIVE' })
          .toArray();
        
        const investorTotals = investors.reduce(
          (acc, inv) => {
            acc.totalInvested += inv.totalInvested || 0;
            if (inv.investmentType === 'LOAN') {
              acc.totalLoans += inv.totalInvested || 0;
            } else if (inv.investmentType === 'EQUITY') {
              acc.totalEquity += inv.totalInvested || 0;
            } else if (inv.investmentType === 'MIXED') {
              acc.totalLoans += (inv.totalInvested || 0) * 0.5;
              acc.totalEquity += (inv.totalInvested || 0) * 0.5;
            }
            return acc;
          },
          { totalInvested: 0, totalLoans: 0, totalEquity: 0 }
        );
        totalInvested = investorTotals.totalInvested;
        totalLoans = investorTotals.totalLoans;
        totalEquity = investorTotals.totalEquity;
        investorCount = investors.length;
      }
    }

    // Calculate balances
    const capitalBalance = totalInvested - totalUsed;
    const loanBalance = totalLoans - (totalUsed * (totalLoans / totalInvested || 0));
    const equityBalance = totalEquity - (totalUsed * (totalEquity / totalInvested || 0));

    // NEW: Calculate committed and estimated costs (for specific project only)
    let committedCost = 0;
    let estimatedCost = 0;
    let availableCapital = capitalBalance;
    let materialsBreakdown = null;

    if (projectId && ObjectId.isValid(projectId)) {
      // Get project finances (includes committedCost if already calculated)
      const finances = await getProjectFinances(projectId.toString());
      
      // Calculate committed cost from accepted purchase orders
      committedCost = await calculateCommittedCost(projectId.toString());
      
      // Calculate estimated cost from approved material requests
      estimatedCost = await calculateEstimatedCost(projectId.toString());
      
      // Calculate available capital (totalInvested - totalUsed - committedCost)
      availableCapital = totalInvested - totalUsed - committedCost;
      
      // Calculate materials breakdown
      materialsBreakdown = await calculateMaterialsBreakdown(projectId.toString());
    }

    // Get or create project_finances record
    let projectFinances;
    if (projectId && ObjectId.isValid(projectId)) {
      projectFinances = await db
        .collection('project_finances')
        .findOne({ projectId: new ObjectId(projectId) });

      if (!projectFinances) {
        // Create new record
        const newRecord = {
          projectId: new ObjectId(projectId),
          totalInvested,
          totalLoans,
          totalEquity,
          totalUsed,
          capitalBalance,
          loanBalance,
          equityBalance,
          investorCount,
          lastUpdated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await db.collection('project_finances').insertOne(newRecord);
        projectFinances = newRecord;
      } else {
        // Update existing record
        await db
          .collection('project_finances')
          .updateOne(
            { projectId: new ObjectId(projectId) },
            {
              $set: {
                totalInvested,
                totalLoans,
                totalEquity,
                totalUsed,
                capitalBalance,
                loanBalance,
                equityBalance,
                investorCount,
                lastUpdated: new Date(),
                updatedAt: new Date(),
              },
            }
          );

        projectFinances = await db
          .collection('project_finances')
          .findOne({ projectId: new ObjectId(projectId) });
      }
    } else if (allowedProjectIds && allowedProjectIds.length > 0) {
      // For investor without specific projectId, return aggregated finances for allocated projects
      projectFinances = {
        totalInvested,
        totalLoans,
        totalEquity,
        totalUsed,
        capitalBalance,
        loanBalance,
        equityBalance,
        investorCount,
        lastUpdated: new Date(),
      };
    } else {
      // Return aggregate for all projects (non-investor users)
      projectFinances = {
        totalInvested,
        totalLoans,
        totalEquity,
        totalUsed,
        capitalBalance,
        loanBalance,
        equityBalance,
        investorCount,
        lastUpdated: new Date(),
      };
    }

    return successResponse({
      ...projectFinances,
      // NEW: Add committed and estimated costs
      ...(projectId && ObjectId.isValid(projectId) && {
        committedCost,
        estimatedCost,
        availableCapital,
        materialsBreakdown,
      }),
      breakdown: {
        expenses: totalExpenses,
        materials: totalMaterials,
        initialExpenses: totalInitialExpenses,
        total: totalUsed,
      },
      investors: {
        count: investorCount,
        totalInvested,
        totalLoans,
        totalEquity,
      },
    });
  } catch (error) {
    console.error('Get project finances error:', error);
    return errorResponse('Failed to retrieve project finances', 500);
  }
}

