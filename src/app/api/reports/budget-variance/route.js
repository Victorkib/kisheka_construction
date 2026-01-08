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

/**
 * GET /api/reports/budget-variance
 * Returns budget vs actual comparison with variance calculations
 * Query params: projectId (required)
 */
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

    // Calculate total actual (materials + expenses + initial expenses)
    // Note: Materials budget is separate, expenses and initial expenses typically come from contingency
    const totalActual = materialsActualCost + actualExpensesCost + actualInitialExpensesCost;

    // Calculate variance
    const materialsVariance = materialsBudget - materialsActualCost;
    const materialsVariancePercentage = materialsBudget > 0 
      ? ((materialsVariance / materialsBudget) * 100).toFixed(2)
      : 0;
    
    // NEW: Calculate committed and estimated variances
    const materialsCommittedVariance = materialsBudget - materialsCommitted;
    const materialsCommittedVariancePercentage = materialsBudget > 0
      ? ((materialsCommittedVariance / materialsBudget) * 100).toFixed(2)
      : 0;
    
    const materialsEstimatedVariance = materialsBudget - materialsEstimated;
    const materialsEstimatedVariancePercentage = materialsBudget > 0
      ? ((materialsEstimatedVariance / materialsBudget) * 100).toFixed(2)
      : 0;

    // Labour variance (labour tracking not yet implemented, so actual is 0)
    const labourActual = 0; // TODO: Will be implemented in Phase 3
    const labourVariance = budget.labour - labourActual;
    const labourVariancePercentage = budget.labour > 0
      ? ((labourVariance / budget.labour) * 100).toFixed(2)
      : 0;

    // Contingency variance (expenses + initial expenses typically come from contingency)
    const contingencyUsed = actualExpensesCost + actualInitialExpensesCost;
    const contingencyVariance = budget.contingency - contingencyUsed;
    const contingencyVariancePercentage = budget.contingency > 0
      ? ((contingencyVariance / budget.contingency) * 100).toFixed(2)
      : 0;

    // Total variance
    const totalVariance = budget.total - totalActual;
    const totalVariancePercentage = budget.total > 0
      ? ((totalVariance / budget.total) * 100).toFixed(2)
      : 0;

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
        ? ((floorVariance / floorBudget) * 100).toFixed(2)
        : 0;

      return {
        floorId: floor._id?.toString() || null,
        floorNumber: floor.floorNumber || null,
        floorName: floor.floorName || `Floor ${floor.floorNumber || 'Unknown'}`,
        budget: floorBudget,
        actual: floorActual,
        variance: floorVariance,
        variancePercentage: parseFloat(floorVariancePercentage),
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
        
        const phaseVariance = phaseBudget - phaseActual;
        const phaseVariancePercentage = phaseBudget > 0
          ? ((phaseVariance / phaseBudget) * 100).toFixed(2)
          : 0;

        const phaseCommittedVariance = phaseBudget - phaseCommitted;
        const phaseCommittedVariancePercentage = phaseBudget > 0
          ? ((phaseCommittedVariance / phaseBudget) * 100).toFixed(2)
          : 0;

        const phaseEstimatedVariance = phaseBudget - phaseEstimated;
        const phaseEstimatedVariancePercentage = phaseBudget > 0
          ? ((phaseEstimatedVariance / phaseBudget) * 100).toFixed(2)
          : 0;

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
          variance: phaseVariance,
          variancePercentage: parseFloat(phaseVariancePercentage),
          committedVariance: phaseCommittedVariance,
          committedVariancePercentage: parseFloat(phaseCommittedVariancePercentage),
          estimatedVariance: phaseEstimatedVariance,
          estimatedVariancePercentage: parseFloat(phaseEstimatedVariancePercentage),
          remaining: Math.max(0, phaseBudget - phaseActual - phaseCommitted),
          statusIndicator: (() => {
            if (phaseActual > phaseBudget) return 'over_budget';
            if (phaseCommitted > phaseBudget) return 'committed_over_budget';
            if (phaseEstimated > phaseBudget) return 'estimated_over_budget';
            if (phaseActual > phaseBudget * 0.9) return 'approaching_budget';
            return 'within_budget';
          })(),
        };
      })
    );

    // Get financing data
    const projectTotals = await calculateProjectTotals(projectId);
    const totalInvested = projectTotals.totalInvested || 0;
    const totalLoans = projectTotals.totalLoans || 0;
    const totalEquity = projectTotals.totalEquity || 0;
    const capitalBalance = totalInvested - totalActual;

    // Get spending limit (capital, not budget)
    const spendingLimit = totalInvested; // Capital is the actual limit

    // Determine warnings
    const warnings = [];
    if (budget.total > totalInvested && totalInvested > 0) {
      warnings.push({
        type: 'budget_exceeds_capital',
        severity: 'warning',
        message: `Budget (${budget.total.toLocaleString()}) exceeds available capital (${totalInvested.toLocaleString()}) by ${(budget.total - totalInvested).toLocaleString()}. Actual spending limit is based on capital, not budget.`,
      });
    }
    if (capitalBalance < totalInvested * 0.1 && capitalBalance > 0) {
      warnings.push({
        type: 'low_capital',
        severity: 'warning',
        message: `Low capital balance: ${capitalBalance.toLocaleString()} remaining (${((capitalBalance / totalInvested) * 100).toFixed(1)}%)`,
      });
    }
    if (capitalBalance < 0) {
      warnings.push({
        type: 'overspent',
        severity: 'error',
        message: `Overspent by ${Math.abs(capitalBalance).toLocaleString()}`,
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
        totalPercentage: parseFloat(totalVariancePercentage),
        materials: {
          actual: {
            amount: materialsVariance,
            percentage: parseFloat(materialsVariancePercentage),
          },
          committed: {
            amount: materialsCommittedVariance,
            percentage: parseFloat(materialsCommittedVariancePercentage),
          },
          estimated: {
            amount: materialsEstimatedVariance,
            percentage: parseFloat(materialsEstimatedVariancePercentage),
          },
        },
        labour: labourVariance,
        labourPercentage: parseFloat(labourVariancePercentage),
        contingency: contingencyVariance,
        contingencyPercentage: parseFloat(contingencyVariancePercentage),
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
        // Determine overall status based on variance
        overall: totalVariance >= 0 ? 'on_budget' : totalVariancePercentage < -10 ? 'over_budget' : 'at_risk',
        materials: materialsVariance >= 0 ? 'on_budget' : materialsVariancePercentage < -10 ? 'over_budget' : 'at_risk',
        labour: labourVariance >= 0 ? 'on_budget' : labourVariancePercentage < -10 ? 'over_budget' : 'at_risk',
        contingency: contingencyVariance >= 0 ? 'on_budget' : contingencyVariancePercentage < -10 ? 'over_budget' : 'at_risk',
      },
      financing: {
        totalInvested,
        totalLoans,
        totalEquity,
        totalUsed: totalActual,
        capitalBalance,
        spendingLimit, // Capital is the actual limit
        capitalUtilization: totalInvested > 0 ? ((totalActual / totalInvested) * 100).toFixed(2) : 0,
      },
      warnings,
    });
  } catch (error) {
    console.error('Get budget variance error:', error);
    return errorResponse('Failed to retrieve budget variance report', 500);
  }
}

