/**
 * Budget Variance Report API Route
 * GET: Calculate budget vs actual comparison
 * 
 * GET /api/reports/budget-variance?projectId=xxx
 * Auth: OWNER, INVESTOR, PM, ACCOUNTANT
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { calculateProjectTotals } from '@/lib/investment-allocation';
import { calculateMaterialsBreakdown } from '@/lib/financial-helpers';
import { MATERIAL_APPROVED_STATUSES, EXPENSE_APPROVED_STATUSES, INITIAL_EXPENSE_APPROVED_STATUSES } from '@/lib/status-constants';
import { calculatePhaseFinancialSummary } from '@/lib/schemas/phase-schema';
import { getBudgetTotal, getMaterialsBudget, getLabourBudget, getContingencyBudget } from '@/lib/schemas/budget-schema';
import {
  getBudgetStatus,
  getCapitalStatus,
  getVariance,
  getOptionalState,
  getPhaseBudgetStatus,
  safePercentage,
} from '@/lib/financial-status-helpers';

/**
 * GET /api/reports/budget-variance
 * Returns budget vs actual comparison with variance calculations
 * Query params: projectId (required)
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
      return errorResponse('Insufficient permissions. Only OWNER, INVESTOR, PM, and ACCOUNTANT can view reports.', 403);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid project ID is required', 400);
    }

    const db = await getDatabase();

    // Get project with budget
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Use enhanced budget helpers to support both legacy and enhanced budget structures
    const projectBudget = project.budget || {
      total: 0,
      materials: 0,
      labour: 0,
      contingency: 0,
    };
    
    const budget = {
      total: getBudgetTotal(projectBudget),
      materials: getMaterialsBudget(projectBudget),
      labour: getLabourBudget(projectBudget),
      contingency: getContingencyBudget(projectBudget),
    };

    // Build queries for actual costs
    const materialsQuery = {
      projectId: new ObjectId(projectId),
      deletedAt: null,
      status: { $in: MATERIAL_APPROVED_STATUSES },
    };

    const expensesQuery = {
      projectId: new ObjectId(projectId),
      deletedAt: null,
      status: { $in: EXPENSE_APPROVED_STATUSES },
    };

    const initialExpensesQuery = {
      projectId: new ObjectId(projectId),
      status: { $in: INITIAL_EXPENSE_APPROVED_STATUSES },
    };

    // Get actual materials cost
    const materialsActual = await db
      .collection('materials')
      .aggregate([
        { $match: materialsQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalCost' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const actualMaterialsCost = materialsActual[0]?.total || 0;
    const materialsCount = materialsActual[0]?.count || 0;

    // Get actual expenses cost
    const expensesActual = await db
      .collection('expenses')
      .aggregate([
        { $match: expensesQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const actualExpensesCost = expensesActual[0]?.total || 0;
    const expensesCount = expensesActual[0]?.count || 0;

    // Get actual initial expenses cost
    const initialExpensesActual = await db
      .collection('initial_expenses')
      .aggregate([
        { $match: initialExpensesQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const actualInitialExpensesCost = initialExpensesActual[0]?.total || 0;
    const initialExpensesCount = initialExpensesActual[0]?.count || 0;

    // NEW: Get materials breakdown (includes committed and estimated costs)
    const materialsBreakdown = await calculateMaterialsBreakdown(projectId);
    
    const materialsBudget = materialsBreakdown.budget || budget.materials;
    const materialsActualCost = materialsBreakdown.actual || actualMaterialsCost;
    const materialsCommitted = materialsBreakdown.committed || 0;
    const materialsEstimated = materialsBreakdown.estimated || 0;

    // Calculate actual labour cost from approved/paid labour entries
    const labourActualResult = await db
      .collection('labour_entries')
      .aggregate([
        {
          $match: {
            projectId: new ObjectId(projectId),
            deletedAt: null,
            status: { $in: ['approved', 'paid'] },
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
    
    const labourActual = labourActualResult[0]?.total || 0;

    // Calculate total actual (materials + expenses + initial expenses + labour)
    // Note: Materials budget is separate, expenses and initial expenses typically come from contingency
    const totalActual = materialsActualCost + actualExpensesCost + actualInitialExpensesCost + labourActual;

    // Use financial status helpers for variance calculations
    const materialsVarianceObj = getVariance(materialsBudget, materialsActualCost, materialsCommitted, materialsEstimated);
    const labourVarianceObj = getVariance(budget.labour, labourActual);
    const contingencyUsed = actualExpensesCost + actualInitialExpensesCost;
    const contingencyVarianceObj = getVariance(budget.contingency, contingencyUsed);
    const totalVarianceObj = getVariance(budget.total, totalActual);

    // Helper function to safely format percentage
    const safeFormatPercentage = (value) => {
      if (value === null || value === undefined || isNaN(value)) return null;
      return parseFloat(Number(value).toFixed(2));
    };

    // Extract values (handle null for optional budgets)
    const materialsVariance = materialsVarianceObj.amount ?? (materialsBudget - materialsActualCost);
    const materialsVariancePercentage = safeFormatPercentage(materialsVarianceObj.percentage);
    const materialsCommittedVariance = materialsVarianceObj.committedAmount ?? (materialsBudget - materialsCommitted);
    const materialsCommittedVariancePercentage = safeFormatPercentage(materialsVarianceObj.committedPercentage);
    const materialsEstimatedVariance = materialsVarianceObj.estimatedAmount ?? (materialsBudget - materialsEstimated);
    const materialsEstimatedVariancePercentage = safeFormatPercentage(materialsVarianceObj.estimatedPercentage);

    const labourVariance = labourVarianceObj.amount ?? (budget.labour - labourActual);
    const labourVariancePercentage = safeFormatPercentage(labourVarianceObj.percentage);

    const contingencyVariance = contingencyVarianceObj.amount ?? (budget.contingency - contingencyUsed);
    const contingencyVariancePercentage = safeFormatPercentage(contingencyVarianceObj.percentage);

    const totalVariance = totalVarianceObj.amount ?? (budget.total - totalActual);
    const totalVariancePercentage = safeFormatPercentage(totalVarianceObj.percentage);

    // Category-wise breakdown (materials only, as expenses/initial expenses are typically contingency)
    const categoryBreakdown = await db
      .collection('materials')
      .aggregate([
        { $match: materialsQuery },
        {
          $group: {
            _id: '$category',
            budget: { $first: '$category' }, // Category doesn't have budget, we'll use 0
            actual: { $sum: '$totalCost' },
            count: { $sum: 1 },
          },
        },
        { $sort: { actual: -1 } },
      ])
      .toArray();

    const categoryBreakdownWithVariance = categoryBreakdown.map((cat) => ({
      category: cat._id || 'Uncategorized',
      budget: 0, // Categories don't have individual budgets
      actual: cat.actual || 0,
      variance: 0 - (cat.actual || 0),
      variancePercentage: 0,
      count: cat.count || 0,
    }));

    // Floor-wise breakdown
    const floorBreakdown = await db
      .collection('materials')
      .aggregate([
        { $match: materialsQuery },
        {
          $lookup: {
            from: 'floors',
            localField: 'floor',
            foreignField: '_id',
            as: 'floorData',
          },
        },
        { $unwind: { path: '$floorData', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$floor',
            floorNumber: { $first: '$floorData.floorNumber' },
            floorName: { $first: '$floorData.name' },
            budget: { $first: '$floorData.totalBudget' },
            actual: { $sum: '$totalCost' },
            count: { $sum: 1 },
          },
        },
        { $sort: { floorNumber: 1 } },
      ])
      .toArray();

    const floorBreakdownWithVariance = floorBreakdown.map((floor) => {
      const floorBudget = floor.budget || 0;
      const floorActual = floor.actual || 0;
      const floorVariance = floorBudget - floorActual;
      const floorVariancePercentage = floorBudget > 0
        ? safeFormatPercentage((floorVariance / floorBudget) * 100)
        : null;

      return {
        floorId: floor._id?.toString() || null,
        floorNumber: floor.floorNumber || null,
        floorName: floor.floorName || `Floor ${floor.floorNumber || 'Unknown'}`,
        budget: floorBudget,
        actual: floorActual,
        variance: floorVariance,
        variancePercentage: floorVariancePercentage !== null ? parseFloat(floorVariancePercentage) : null,
        count: floor.count || 0,
      };
    });

    // Time-based trend (monthly breakdown)
    const monthlyTrend = await db
      .collection('materials')
      .aggregate([
        { $match: materialsQuery },
        {
          $group: {
            _id: {
              year: { $year: '$datePurchased' },
              month: { $month: '$datePurchased' },
            },
            actual: { $sum: '$totalCost' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ])
      .toArray();

    const monthlyTrendFormatted = monthlyTrend.map((month) => ({
      year: month._id.year,
      month: month._id.month,
      label: `${month._id.year}-${String(month._id.month).padStart(2, '0')}`,
      budget: 0, // Monthly budget allocation not tracked
      actual: month.actual || 0,
      count: month.count || 0,
    }));

    // Phase-wise breakdown
    const phases = await db.collection('phases').find({
      projectId: new ObjectId(projectId),
      deletedAt: null,
    }).sort({ sequence: 1 }).toArray();

    const phaseBreakdown = await Promise.all(
      phases.map(async (phase) => {
        const phaseFinancialSummary = await calculatePhaseFinancialSummary(phase._id.toString());
        
        const phaseBudget = phase.budgetAllocation?.total || 0;
        const phaseActual = phaseFinancialSummary.actualSpending?.total || 0;
        const phaseCommitted = phaseFinancialSummary.committedCost || 0;
        const phaseEstimated = phaseFinancialSummary.estimatedCost || 0;
        
        // Use phase budget status helper
        const phaseStatus = getPhaseBudgetStatus(
          phase,
          phaseFinancialSummary.actualSpending || {},
          {
            committed: phaseCommitted,
            estimated: phaseEstimated,
          }
        );

        const phaseVarianceObj = getVariance(phaseBudget, phaseActual, phaseCommitted, phaseEstimated);

        // Helper function to safely format percentage
        const safeFormatPercentage = (value) => {
          if (value === null || value === undefined || isNaN(value)) return null;
          return parseFloat(Number(value).toFixed(2));
        };

        return {
          phaseId: phase._id.toString(),
          phaseName: phase.phaseName,
          phaseType: phase.phaseType,
          sequence: phase.sequence || 0,
          status: phase.status,
          completionPercentage: phase.completionPercentage || 0,
          budget: phaseBudget,
          actual: phaseActual,
          committed: phaseCommitted,
          estimated: phaseEstimated,
          variance: phaseVarianceObj.amount ?? (phaseBudget - phaseActual),
          variancePercentage: safeFormatPercentage(phaseVarianceObj.percentage),
          committedVariance: phaseVarianceObj.committedAmount ?? (phaseBudget - phaseCommitted),
          committedVariancePercentage: safeFormatPercentage(phaseVarianceObj.committedPercentage),
          estimatedVariance: phaseVarianceObj.estimatedAmount ?? (phaseBudget - phaseEstimated),
          estimatedVariancePercentage: safeFormatPercentage(phaseVarianceObj.estimatedPercentage),
          remaining: phaseStatus.remaining !== null && phaseStatus.remaining !== undefined ? Math.max(0, phaseStatus.remaining) : null,
          statusIndicator: phaseStatus.status === 'not_set' ? 'not_set' : phaseStatus.status === 'over_budget' ? 'over_budget' : phaseStatus.status === 'at_risk' ? 'approaching_budget' : 'within_budget',
          budgetStatus: phaseStatus, // Include full status object
        };
      })
    );

    // Get financing data
    const projectTotals = await calculateProjectTotals(projectId);
    const totalInvested = projectTotals.totalInvested || 0;
    const totalLoans = projectTotals.totalLoans || 0;
    const totalEquity = projectTotals.totalEquity || 0;
    
    // Get finances for committed cost
    const { getProjectFinances } = await import('@/lib/financial-helpers');
    const finances = await getProjectFinances(projectId);
    const committedCost = finances?.committedCost || 0;
    const availableCapital = finances?.availableCapital ?? (totalInvested - totalActual - committedCost);
    const capitalBalance = totalInvested - totalActual;

    // Get spending limit (capital, not budget)
    const spendingLimit = totalInvested; // Capital is the actual limit

    // Get budget and capital status
    const budgetStatus = getBudgetStatus(budget.total, totalActual, committedCost, materialsEstimated);
    const capitalStatus = getCapitalStatus(totalInvested, totalActual, availableCapital, committedCost);
    const optionalState = getOptionalState(project, finances);

    // Determine warnings (suppress when budget/capital is optional unless critical)
    const warnings = [];
    
    // Only warn if both budget and capital are set
    if (budget.total > 0 && totalInvested > 0 && budget.total > totalInvested) {
      warnings.push({
        type: 'budget_exceeds_capital',
        severity: 'warning',
        message: `Budget (${budget.total.toLocaleString()}) exceeds available capital (${totalInvested.toLocaleString()}) by ${(budget.total - totalInvested).toLocaleString()}. Actual spending limit is based on capital, not budget.`,
      });
    }
    
    // Only warn about low capital if capital is set
    if (totalInvested > 0 && capitalBalance < totalInvested * 0.1 && capitalBalance > 0) {
      const capitalPercent = ((capitalBalance / totalInvested) * 100);
      warnings.push({
        type: 'low_capital',
        severity: 'warning',
        message: `Low capital balance: ${capitalBalance.toLocaleString()} remaining (${!isNaN(capitalPercent) ? capitalPercent.toFixed(1) : 'N/A'}%)`,
      });
    }
    
    // Always warn about overspending (critical)
    if (capitalBalance < 0) {
      warnings.push({
        type: 'overspent',
        severity: 'error',
        message: `Overspent by ${Math.abs(capitalBalance).toLocaleString()}`,
      });
    }

    // Add informational messages about optional state
    if (optionalState.budgetNotSet) {
      warnings.push({
        type: 'budget_not_set',
        severity: 'info',
        message: 'Budget not set. All spending is being tracked. Set a budget to enable budget validation.',
        actionable: true,
        actionUrl: `/projects/${projectId}/finances`,
        actionLabel: 'Set Budget',
      });
    }

    if (optionalState.capitalNotSet) {
      warnings.push({
        type: 'capital_not_set',
        severity: 'info',
        message: 'No capital invested. Spending is being tracked. Add capital to enable capital validation.',
        actionable: true,
        actionUrl: '/financing',
        actionLabel: 'Add Capital',
      });
    }

    return successResponse({
      project: {
        _id: project._id.toString(),
        projectCode: project.projectCode,
        projectName: project.projectName,
      },
      budget: {
        total: budget.total,
        materials: budget.materials,
        labour: budget.labour,
        contingency: budget.contingency,
        isOptional: budget.total === 0, // Flag indicating if budget is optional
      },
      actual: {
        total: totalActual,
        materials: materialsActualCost,
        labour: labourActual,
        contingency: contingencyUsed,
        expenses: actualExpensesCost,
        initialExpenses: actualInitialExpensesCost,
      },
      variance: {
        total: totalVariance,
        totalPercentage: safeFormatPercentage(totalVariancePercentage),
        materials: {
          actual: {
            amount: materialsVariance,
            percentage: safeFormatPercentage(materialsVariancePercentage),
          },
          committed: {
            amount: materialsCommittedVariance,
            percentage: safeFormatPercentage(materialsCommittedVariancePercentage),
          },
          estimated: {
            amount: materialsEstimatedVariance,
            percentage: safeFormatPercentage(materialsEstimatedVariancePercentage),
          },
        },
        labour: labourVariance,
        labourPercentage: safeFormatPercentage(labourVariancePercentage),
        contingency: contingencyVariance,
        contingencyPercentage: safeFormatPercentage(contingencyVariancePercentage),
      },
      // NEW: Committed and estimated costs
      committed: {
        materials: materialsCommitted,
      },
      estimated: {
        materials: materialsEstimated,
      },
      // NEW: Materials progression status
      materials: {
        budget: materialsBudget,
        estimated: materialsEstimated,
        committed: materialsCommitted,
        actual: materialsActualCost,
        remaining: Math.max(0, materialsBudget - materialsActualCost - materialsCommitted),
        variance: {
          actual: materialsVariance,
          committed: materialsCommittedVariance,
          estimated: materialsEstimatedVariance,
        },
        status: (() => {
          if (materialsActualCost > materialsBudget) return 'over_budget';
          if (materialsCommitted > materialsBudget) return 'committed_over_budget';
          if (materialsEstimated > materialsBudget) return 'estimated_over_budget';
          if (materialsActualCost > materialsBudget * 0.9) return 'approaching_budget';
          return 'within_budget';
        })(),
      },
      counts: {
        materials: materialsCount,
        expenses: expensesCount,
        initialExpenses: initialExpensesCount,
      },
      categoryBreakdown: categoryBreakdownWithVariance,
      floorBreakdown: floorBreakdownWithVariance,
      phaseBreakdown: phaseBreakdown,
      monthlyTrend: monthlyTrendFormatted,
      status: {
        // Use status from helpers
        overall: budgetStatus.status,
        materials: getBudgetStatus(budget.materials, materialsActualCost, materialsCommitted, materialsEstimated).status,
        labour: getBudgetStatus(budget.labour, labourActual).status,
        contingency: getBudgetStatus(budget.contingency, contingencyUsed).status,
        budgetStatusDetails: budgetStatus,
        capitalStatusDetails: capitalStatus,
      },
      financing: {
        totalInvested,
        totalLoans,
        totalEquity,
        totalUsed: totalActual,
        capitalBalance,
        availableCapital,
        spendingLimit, // Capital is the actual limit
        capitalUtilization: safeFormatPercentage(capitalStatus.utilization),
      },
      optionalState,
      warnings,
    });
  } catch (error) {
    console.error('Get budget variance error:', error);
    return errorResponse('Failed to retrieve budget variance report', 500);
  }
}

