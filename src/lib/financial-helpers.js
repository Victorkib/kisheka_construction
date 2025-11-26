/**
 * Financial Helpers
 * 
 * Core financial validation and calculation functions
 * Handles budget vs capital logic, validation, and auto-updates
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { calculateProjectTotals } from '@/lib/investment-allocation';
import { ObjectId } from 'mongodb';
import {
  EXPENSE_APPROVED_STATUSES,
  MATERIAL_APPROVED_STATUSES,
  INITIAL_EXPENSE_APPROVED_STATUSES,
} from '@/lib/status-constants';

/**
 * Get actual spending limit for a project
 * Returns the minimum of budget and capital (capital is the real limit)
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} { spendingLimit, budget, capital, isCapitalLimited }
 */
export async function getProjectSpendingLimit(projectId) {
  const db = await getDatabase();

  // Get project budget
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
  });

  if (!project) {
    return {
      spendingLimit: 0,
      budget: 0,
      capital: 0,
      isCapitalLimited: false,
      error: 'Project not found',
    };
  }

  const budget = project.budget?.total || 0;

  // Get capital from allocations
  const projectTotals = await calculateProjectTotals(projectId);
  const capital = projectTotals.totalInvested || 0;

  // Spending limit is the capital (reality), not budget (planning)
  const spendingLimit = capital;

  return {
    spendingLimit,
    budget,
    capital,
    isCapitalLimited: capital < budget,
    budgetExcess: Math.max(0, budget - capital),
  };
}

/**
 * Get current total used for a project
 * Calculates from actual spending (materials + expenses + initial expenses)
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Total amount used
 */
export async function getCurrentTotalUsed(projectId) {
  const db = await getDatabase();

  // Get total from expenses (approved only)
  const expensesTotal = await db
    .collection('expenses')
    .aggregate([
      {
        $match: {
          projectId: new ObjectId(projectId),
          deletedAt: null,
          status: { $in: EXPENSE_APPROVED_STATUSES },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ])
    .toArray();

  // Get total from materials (approved only)
  const materialsTotal = await db
    .collection('materials')
    .aggregate([
      {
        $match: {
          projectId: new ObjectId(projectId),
          deletedAt: null,
          status: { $in: MATERIAL_APPROVED_STATUSES },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalCost' },
        },
      },
    ])
    .toArray();

  // Get total from initial expenses (approved only)
  const initialExpensesTotal = await db
    .collection('initial_expenses')
    .aggregate([
      {
        $match: {
          projectId: new ObjectId(projectId),
          deletedAt: null,
          status: { $in: INITIAL_EXPENSE_APPROVED_STATUSES },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ])
    .toArray();

  const totalExpenses = expensesTotal[0]?.total || 0;
  const totalMaterials = materialsTotal[0]?.total || 0;
  const totalInitialExpenses = initialExpensesTotal[0]?.total || 0;

  return totalExpenses + totalMaterials + totalInitialExpenses;
}

/**
 * Get project finances from project_finances collection
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Project finances record
 */
export async function getProjectFinances(projectId) {
  if (!projectId || !ObjectId.isValid(projectId)) {
    throw new Error('Invalid project ID');
  }

  const db = await getDatabase();
  
  let finances = await db.collection('project_finances').findOne({
    projectId: new ObjectId(projectId),
  });
  
  // If doesn't exist, create it
  if (!finances) {
    finances = await recalculateProjectFinances(projectId);
  }
  
  return finances;
}

/**
 * Calculate total committed cost from accepted purchase orders
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Total committed cost
 */
export async function calculateCommittedCost(projectId) {
  const db = await getDatabase();
  
  const result = await db.collection('purchase_orders').aggregate([
    {
      $match: {
        projectId: new ObjectId(projectId),
        status: { $in: ['order_accepted', 'ready_for_delivery'] },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalCost' },
      },
    },
  ]).toArray();
  
  return result[0]?.total || 0;
}

/**
 * Calculate total estimated cost from approved material requests
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Total estimated cost
 */
export async function calculateEstimatedCost(projectId) {
  const db = await getDatabase();
  
  const result = await db.collection('material_requests').aggregate([
    {
      $match: {
        projectId: new ObjectId(projectId),
        status: { $in: ['approved', 'converted_to_order'] },
        deletedAt: null,
        estimatedCost: { $exists: true, $ne: null, $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$estimatedCost' },
      },
    },
  ]).toArray();
  
  return result[0]?.total || 0;
}

/**
 * Update committed cost in project_finances
 * @param {string} projectId - Project ID
 * @param {number} amount - Amount to add/subtract
 * @param {string} operation - 'add' or 'subtract'
 * @returns {Promise<number>} New committed cost
 */
export async function updateCommittedCost(projectId, amount, operation = 'add') {
  const db = await getDatabase();
  
  const finances = await getProjectFinances(projectId);
  
  const currentCommitted = finances?.committedCost || 0;
  const newCommitted = operation === 'add' 
    ? currentCommitted + amount 
    : Math.max(0, currentCommitted - amount);
  
  const totalInvested = finances?.totalInvested || 0;
  const totalUsed = finances?.totalUsed || 0;
  const availableCapital = totalInvested - totalUsed - newCommitted;
  
  await db.collection('project_finances').updateOne(
    { projectId: new ObjectId(projectId) },
    {
      $set: {
        committedCost: newCommitted,
        availableCapital: availableCapital,
        updatedAt: new Date(),
      },
    }
  );
  
  return newCommitted;
}

/**
 * Decrease committed cost when order is fulfilled
 * @param {string} projectId - Project ID
 * @param {number} amount - Amount to decrease
 * @returns {Promise<number>} New committed cost
 */
export async function decreaseCommittedCost(projectId, amount) {
  return await updateCommittedCost(projectId, amount, 'subtract');
}

/**
 * Calculate materials breakdown for project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Materials breakdown
 */
export async function calculateMaterialsBreakdown(projectId) {
  const db = await getDatabase();
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
  });
  
  const budget = project?.budget?.materials || 0;
  
  // Actual from approved materials
  // Include materials with costStatus 'actual' or 'estimated', or materials without costStatus (backward compatibility)
  const actualResult = await db.collection('materials').aggregate([
    {
      $match: {
        projectId: new ObjectId(projectId),
        status: { $in: MATERIAL_APPROVED_STATUSES },
        deletedAt: null,
        $or: [
          { costStatus: { $in: ['actual', 'estimated'] } },
          { costStatus: { $exists: false } }, // Backward compatibility
        ],
      },
    },
    { $group: { _id: null, total: { $sum: '$totalCost' } } },
  ]).toArray();
  
  const actual = actualResult[0]?.total || 0;
  
  // Committed from accepted purchase orders
  const committed = await calculateCommittedCost(projectId);
  
  // Estimated from approved requests
  const estimated = await calculateEstimatedCost(projectId);
  
  return {
    budget,
    actual,
    committed,
    estimated,
    remaining: Math.max(0, budget - actual - committed),
    variance: actual - budget,
  };
}

/**
 * Validate capital availability before approval
 * Checks if there's enough capital to cover the new spending (including committed costs)
 * @param {string} projectId - Project ID
 * @param {number} amount - Amount to be approved
 * @returns {Promise<Object>} Validation result
 */
export async function validateCapitalAvailability(projectId, amount) {
  if (!projectId || !ObjectId.isValid(projectId)) {
    return {
      isValid: false,
      available: 0,
      required: amount,
      message: 'Invalid project ID',
    };
  }

  if (!amount || amount <= 0) {
    return {
      isValid: false,
      available: 0,
      required: amount,
      message: 'Invalid amount',
    };
  }

  // Get project finances (includes committedCost)
  const finances = await getProjectFinances(projectId);
  
  const totalInvested = finances.totalInvested || 0;
  const totalUsed = finances.totalUsed || 0;
  const committedCost = finances.committedCost || 0;
  
  // Calculate available capital (including committed)
  const available = Math.max(0, totalInvested - totalUsed - committedCost);
  
  // Check if sufficient
  const isValid = available >= amount;

  return {
    isValid,
    available,
    required: amount,
    totalInvested,
    totalUsed,
    committedCost,
    remaining: available - amount,
    message: isValid
      ? `Sufficient capital. Available: ${available.toLocaleString()}`
      : `Insufficient capital. Available: ${available.toLocaleString()}, Required: ${amount.toLocaleString()}, Shortfall: ${(amount - available).toLocaleString()}`,
  };
}

/**
 * Recalculate and update project finances
 * Auto-updates project_finances collection after spending changes
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Updated project finances
 */
export async function recalculateProjectFinances(projectId) {
  if (!projectId || !ObjectId.isValid(projectId)) {
    throw new Error('Invalid project ID');
  }

  const db = await getDatabase();

  // Verify project exists
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
  });

  if (!project) {
    throw new Error('Project not found');
  }

  // Get current total used
  const totalUsed = await getCurrentTotalUsed(projectId);

  // Calculate project-specific totals from allocations
  const projectTotals = await calculateProjectTotals(projectId);
  const totalInvested = projectTotals.totalInvested || 0;
  const totalLoans = projectTotals.totalLoans || 0;
  const totalEquity = projectTotals.totalEquity || 0;

  // Calculate committed cost from accepted purchase orders
  const committedCost = await calculateCommittedCost(projectId);
  
  // Calculate estimated cost from approved material requests
  const estimatedCost = await calculateEstimatedCost(projectId);
  
  // Calculate available capital (including committed costs)
  const availableCapital = totalInvested - totalUsed - committedCost;
  
  // Calculate materials breakdown
  const materialsBreakdown = await calculateMaterialsBreakdown(projectId);

  // Calculate balances
  const capitalBalance = totalInvested - totalUsed;
  const loanBalance = totalLoans - (totalUsed * (totalLoans / totalInvested || 0));
  const equityBalance = totalEquity - (totalUsed * (totalEquity / totalInvested || 0));

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
      {
        $project: {
          hasAllocation: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$projectAllocations',
                    as: 'alloc',
                    cond: { $eq: ['$$alloc.projectId', new ObjectId(projectId)] },
                  },
                },
              },
              0,
            ],
          },
        },
      },
    ])
    .toArray();

  const investorCount = projectAllocations.length;

  // Update or create project_finances record
  const existing = await db
    .collection('project_finances')
    .findOne({ projectId: new ObjectId(projectId) });

  const updateData = {
    totalInvested,
    totalLoans,
    totalEquity,
    totalUsed,
    committedCost,
    estimatedCost,
    availableCapital,
    materialsBreakdown,
    capitalBalance,
    loanBalance,
    equityBalance,
    investorCount,
    lastUpdated: new Date(),
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .collection('project_finances')
      .updateOne(
        { projectId: new ObjectId(projectId) },
        { $set: updateData }
      );
  } else {
    updateData.projectId = new ObjectId(projectId);
    updateData.createdAt = new Date();
    await db.collection('project_finances').insertOne(updateData);
  }

  // Return updated record
  const updated = await db
    .collection('project_finances')
    .findOne({ projectId: new ObjectId(projectId) });

  return updated || updateData;
}

/**
 * Get financial overview for a project
 * Returns budget, financing, and actual spending together
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Complete financial overview
 */
export async function getFinancialOverview(projectId) {
  if (!projectId || !ObjectId.isValid(projectId)) {
    throw new Error('Invalid project ID');
  }

  const db = await getDatabase();

  // Get project with budget
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const budget = project.budget || {
    total: 0,
    materials: 0,
    labour: 0,
    contingency: 0,
  };

  // Get financing data
  const projectTotals = await calculateProjectTotals(projectId);
  const totalInvested = projectTotals.totalInvested || 0;
  const totalLoans = projectTotals.totalLoans || 0;
  const totalEquity = projectTotals.totalEquity || 0;

  // Get actual spending
  const totalUsed = await getCurrentTotalUsed(projectId);

  // Get committed and estimated costs
  const finances = await getProjectFinances(projectId);
  const committedCost = finances?.committedCost || 0;
  const estimatedCost = finances?.estimatedCost || 0;
  const availableCapital = finances?.availableCapital || (totalInvested - totalUsed - committedCost);
  const materialsBreakdown = finances?.materialsBreakdown || await calculateMaterialsBreakdown(projectId);

  // Calculate balances
  const capitalBalance = totalInvested - totalUsed;
  const budgetRemaining = budget.total - totalUsed;

  // Get breakdown
  const expensesTotal = await db
    .collection('expenses')
    .aggregate([
      {
        $match: {
          projectId: new ObjectId(projectId),
          deletedAt: null,
          status: { $in: EXPENSE_APPROVED_STATUSES },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    .toArray();

  const materialsTotal = await db
    .collection('materials')
    .aggregate([
      {
        $match: {
          projectId: new ObjectId(projectId),
          deletedAt: null,
          status: { $in: MATERIAL_APPROVED_STATUSES },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalCost' } } },
    ])
    .toArray();

  const initialExpensesTotal = await db
    .collection('initial_expenses')
    .aggregate([
      {
        $match: {
          projectId: new ObjectId(projectId),
          deletedAt: null,
          status: { $in: INITIAL_EXPENSE_APPROVED_STATUSES },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ])
    .toArray();

  const breakdown = {
    expenses: expensesTotal[0]?.total || 0,
    materials: materialsTotal[0]?.total || 0,
    initialExpenses: initialExpensesTotal[0]?.total || 0,
    total: totalUsed,
  };

  // Determine warnings
  const warnings = [];
  if (budget.total > totalInvested) {
    warnings.push({
      type: 'budget_exceeds_capital',
      severity: 'warning',
      message: `Budget (${budget.total.toLocaleString()}) exceeds available capital (${totalInvested.toLocaleString()}) by ${(budget.total - totalInvested).toLocaleString()}`,
    });
  }
  if (availableCapital < totalInvested * 0.1 && availableCapital > 0) {
    warnings.push({
      type: 'low_capital',
      severity: 'warning',
      message: `Low available capital: ${availableCapital.toLocaleString()} remaining (${((availableCapital / totalInvested) * 100).toFixed(1)}%)`,
    });
  }
  if (availableCapital < 0) {
    warnings.push({
      type: 'overspent',
      severity: 'error',
      message: `Overspent by ${Math.abs(availableCapital).toLocaleString()} (including committed costs)`,
    });
  }
  if (committedCost > 0 && availableCapital < committedCost) {
    warnings.push({
      type: 'high_commitment',
      severity: 'warning',
      message: `High committed costs: ${committedCost.toLocaleString()} (${((committedCost / totalInvested) * 100).toFixed(1)}% of capital)`,
    });
  }

  return {
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
      remaining: budgetRemaining,
    },
    financing: {
      totalInvested,
      totalLoans,
      totalEquity,
      totalUsed,
      committedCost,
      estimatedCost,
      availableCapital,
      capitalBalance,
      loanBalance: totalLoans - (totalUsed * (totalLoans / totalInvested || 0)),
      equityBalance: totalEquity - (totalUsed * (totalEquity / totalInvested || 0)),
    },
    materialsBreakdown,
    actual: breakdown,
    spendingLimit: totalInvested, // Capital is the actual limit
    warnings,
    status: {
      budgetStatus: budgetRemaining >= 0 ? 'on_budget' : 'over_budget',
      capitalStatus: capitalBalance >= 0 ? 'sufficient' : 'insufficient',
      overall: capitalBalance >= 0 && budgetRemaining >= 0 ? 'healthy' : capitalBalance < 0 ? 'critical' : 'at_risk',
    },
  };
}

