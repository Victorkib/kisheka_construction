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
import {
  getBudgetTotal,
  getMaterialsBudget,
  getLabourBudget,
  getContingencyBudget,
  isEnhancedBudget,
  isLegacyBudget
} from '@/lib/schemas/budget-schema';

/**
 * Update pre-construction spending when initial expense is created/approved
 * @param {string} projectId - Project ID
 * @param {string} category - Pre-construction sub-category (landAcquisition, legalRegulatory, permitsApprovals, sitePreparation)
 * @param {number} amount - Expense amount
 * @returns {Promise<void>}
 */
export async function updatePreConstructionSpending(projectId, category, amount) {
  const db = await getDatabase();
  
  // Get or create project_finances record
  let projectFinances = await db.collection('project_finances').findOne({
    projectId: new ObjectId(projectId)
  });
  
  if (!projectFinances) {
    // Create new project_finances record
    projectFinances = {
      projectId: new ObjectId(projectId),
      preConstructionSpending: {
        total: 0,
        byCategory: {
          landAcquisition: 0,
          legalRegulatory: 0,
          permitsApprovals: 0,
          sitePreparation: 0
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.collection('project_finances').insertOne(projectFinances);
  }
  
  // Initialize preConstructionSpending if it doesn't exist
  if (!projectFinances.preConstructionSpending) {
    projectFinances.preConstructionSpending = {
      total: 0,
      byCategory: {
        landAcquisition: 0,
        legalRegulatory: 0,
        permitsApprovals: 0,
        sitePreparation: 0
      }
    };
  }
  
  // Update spending
  const currentTotal = projectFinances.preConstructionSpending.total || 0;
  const currentCategory = projectFinances.preConstructionSpending.byCategory[category] || 0;
  
  await db.collection('project_finances').updateOne(
    { projectId: new ObjectId(projectId) },
    {
      $set: {
        'preConstructionSpending.total': currentTotal + amount,
        [`preConstructionSpending.byCategory.${category}`]: currentCategory + amount,
        updatedAt: new Date()
      }
    }
  );
}

/**
 * Get pre-construction spending for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Pre-construction spending breakdown
 */
export async function getPreConstructionSpending(projectId) {
  const db = await getDatabase();
  
  const projectFinances = await db.collection('project_finances').findOne({
    projectId: new ObjectId(projectId)
  });
  
  if (!projectFinances || !projectFinances.preConstructionSpending) {
    return {
      total: 0,
      byCategory: {
        landAcquisition: 0,
        legalRegulatory: 0,
        permitsApprovals: 0,
        sitePreparation: 0
      }
    };
  }
  
  return projectFinances.preConstructionSpending;
}

/**
 * Get pre-construction budget remaining
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Remaining pre-construction budget
 */
export async function getPreConstructionRemaining(projectId) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId)
  });
  
  if (!project || !project.budget) {
    return 0;
  }
  
  const budget = project.budget;
  let preConstructionBudget = 0;
  
  if (isEnhancedBudget(budget)) {
    preConstructionBudget = budget.preConstructionCosts || 0;
  } else {
    // Legacy: Estimate 5% of total
    const totalBudget = getBudgetTotal(budget);
    preConstructionBudget = totalBudget * 0.05;
  }
  
  const spending = await getPreConstructionSpending(projectId);
  const remaining = Math.max(0, preConstructionBudget - spending.total);
  
  return remaining;
}

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

  const budget = getBudgetTotal(project.budget);

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
 * Calculate total committed cost from accepted purchase orders and professional service contracts
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Total committed cost
 */
export async function calculateCommittedCost(projectId) {
  const db = await getDatabase();
  
  // Get committed cost from purchase orders
  const poResult = await db.collection('purchase_orders').aggregate([
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
  
  const poCommitted = poResult[0]?.total || 0;
  
  // Get committed cost from professional services (remaining contract commitments)
  const { calculateProfessionalServicesCommittedCost } = await import('@/lib/professional-services-helpers');
  const professionalServicesCommitted = await calculateProfessionalServicesCommittedCost(projectId);
  
  return poCommitted + professionalServicesCommitted;
}

/**
 * Calculate total estimated cost from approved material requests (not yet converted)
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Total estimated cost
 */
export async function calculateEstimatedCost(projectId) {
  const db = await getDatabase();
  
  // Calculate estimated cost from approved material requests (not yet converted)
  // Once converted to PO, it moves from estimatedCost to committedCost
  const result = await db.collection('material_requests').aggregate([
    {
      $match: {
        projectId: new ObjectId(projectId),
        status: 'approved', // Only 'approved', not 'converted_to_order'
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
 * @param {Object} [session] - MongoDB session for transactions (optional)
 * @returns {Promise<number>} New committed cost
 */
export async function updateCommittedCost(projectId, amount, operation = 'add', session = null) {
  const db = await getDatabase();
  
  const finances = await getProjectFinances(projectId);
  
  const currentCommitted = finances?.committedCost || 0;
  const newCommitted = operation === 'add' 
    ? currentCommitted + amount 
    : Math.max(0, currentCommitted - amount);
  
  const totalInvested = finances?.totalInvested || 0;
  const totalUsed = finances?.totalUsed || 0;
  const availableCapital = totalInvested - totalUsed - newCommitted;
  
  const updateOptions = session ? { session } : {};
  
  await db.collection('project_finances').updateOne(
    { projectId: new ObjectId(projectId) },
    {
      $set: {
        committedCost: newCommitted,
        availableCapital: availableCapital,
        updatedAt: new Date(),
      },
    },
    updateOptions
  );
  
  return newCommitted;
}

/**
 * Decrease committed cost when order is fulfilled
 * @param {string} projectId - Project ID
 * @param {number} amount - Amount to decrease
 * @param {Object} [session] - MongoDB session for transactions (optional)
 * @returns {Promise<number>} New committed cost
 */
export async function decreaseCommittedCost(projectId, amount, session = null) {
  return await updateCommittedCost(projectId, amount, 'subtract', session);
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
  
  // Estimated from approved requests (including bulk requests)
  const estimated = await calculateEstimatedCost(projectId);
  
  // Include bulk order estimates from batches
  const batchEstimates = await db.collection('material_request_batches').aggregate([
    {
      $match: {
        projectId: new ObjectId(projectId),
        status: { $in: ['approved', 'partially_ordered', 'fully_ordered'] },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalEstimatedCost' },
      },
    },
  ]).toArray();
  
  const batchEstimated = batchEstimates[0]?.total || 0;
  const totalEstimated = estimated + batchEstimated;
  
  return {
    budget,
    actual,
    committed,
    estimated: totalEstimated,
    batchEstimated,
    remaining: Math.max(0, budget - actual - committed),
    variance: actual - budget,
  };
}

/**
 * Validate capital removal before removing allocation
 * Checks if removing capital would cause negative available capital
 * @param {string} projectId - Project ID
 * @param {number} amountToRemove - Amount to be removed
 * @returns {Promise<Object>} Validation result
 */
export async function validateCapitalRemoval(projectId, amountToRemove) {
  if (!projectId || !ObjectId.isValid(projectId)) {
    return {
      canRemove: false,
      currentAvailable: 0,
      availableAfterRemoval: 0,
      shortfall: 0,
      message: 'Invalid project ID',
    };
  }

  if (!amountToRemove || amountToRemove <= 0) {
    return {
      canRemove: true,
      currentAvailable: 0,
      availableAfterRemoval: 0,
      shortfall: 0,
      message: 'No amount to remove',
    };
  }

  // Get current project finances
  const finances = await getProjectFinances(projectId);
  const totalInvested = finances.totalInvested || 0;
  const totalUsed = finances.totalUsed || 0;
  const committedCost = finances.committedCost || 0;
  
  // Calculate current available capital
  const currentAvailable = Math.max(0, totalInvested - totalUsed - committedCost);
  
  // Calculate available after removal
  const newTotalInvested = totalInvested - amountToRemove;
  const availableAfterRemoval = Math.max(0, newTotalInvested - totalUsed - committedCost);
  
  // Check if removal would cause negative available
  const canRemove = availableAfterRemoval >= 0;
  const shortfall = availableAfterRemoval < 0 ? Math.abs(availableAfterRemoval) : 0;

  return {
    canRemove,
    currentAvailable,
    availableAfterRemoval,
    shortfall,
    currentTotalInvested: totalInvested,
    newTotalInvested,
    totalUsed,
    committedCost,
    message: canRemove
      ? `Capital removal allowed. Available after removal: ${availableAfterRemoval.toLocaleString()}`
      : `Cannot remove capital. Would cause negative available capital. Current available: ${currentAvailable.toLocaleString()}, Removal amount: ${amountToRemove.toLocaleString()}, Shortfall: ${shortfall.toLocaleString()}`,
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
 * Calculate batch financials
 * @param {string} batchId - Batch ID
 * @returns {Promise<Object>} Batch financial breakdown
 */
export async function calculateBatchFinancials(batchId) {
  const db = await getDatabase();
  
  const batch = await db.collection('material_request_batches').findOne({
    _id: new ObjectId(batchId),
    deletedAt: null,
  });
  
  if (!batch) {
    return {
      totalEstimatedCost: 0,
      totalCommittedCost: 0,
      totalActualCost: 0,
      materialCount: 0,
    };
  }
  
  // Get committed cost from purchase orders linked to this batch
  const committedResult = await db.collection('purchase_orders').aggregate([
    {
      $match: {
        batchId: new ObjectId(batchId),
        status: { $in: ['order_accepted', 'ready_for_delivery', 'delivered'] },
        financialStatus: { $in: ['committed', 'fulfilled'] },
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
  
  const totalCommittedCost = committedResult[0]?.total || 0;
  
  // Get actual cost from materials created from this batch
  const actualResult = await db.collection('materials').aggregate([
    {
      $match: {
        materialRequestId: { $in: batch.materialRequestIds.map((id) => new ObjectId(id)) },
        status: { $in: MATERIAL_APPROVED_STATUSES },
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
  
  const totalActualCost = actualResult[0]?.total || 0;
  
  return {
    totalEstimatedCost: batch.totalEstimatedCost || 0,
    totalCommittedCost,
    totalActualCost,
    materialCount: batch.totalMaterials || 0,
    variance: totalActualCost - (batch.totalEstimatedCost || 0),
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
  // Import indirect costs helpers
  const { getIndirectCostsSummary } = await import('@/lib/indirect-costs-helpers');
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

  // Get budget (works with both legacy and enhanced structures)
  const budget = project.budget || {
    total: 0,
    materials: 0,
    labour: 0,
    contingency: 0,
  };
  
  // Ensure we have legacy fields for backward compatibility
  const budgetWithLegacy = {
    ...budget,
    total: getBudgetTotal(budget),
    materials: getMaterialsBudget(budget),
    labour: getLabourBudget(budget),
    contingency: getContingencyBudget(budget)
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
  const budgetRemaining = budgetWithLegacy.total - totalUsed;

  // Calculate unallocated DCC budget (DCC not allocated to phases)
  const { calculateTotalPhaseBudgets } = await import('@/lib/phase-helpers');
  const totalPhaseBudgets = await calculateTotalPhaseBudgets(projectId);
  let dccBudget = 0;
  if (isEnhancedBudget(budget)) {
    dccBudget = budget.directConstructionCosts || 0;
  } else {
    const projectBudgetTotal = getBudgetTotal(budget);
    const estimatedPreConstruction = projectBudgetTotal * 0.05;
    const estimatedIndirect = projectBudgetTotal * 0.05;
    const estimatedContingency = budget.contingency || (projectBudgetTotal * 0.05);
    dccBudget = Math.max(0, projectBudgetTotal - estimatedPreConstruction - estimatedIndirect - estimatedContingency);
  }
  const unallocatedDCC = Math.max(0, dccBudget - totalPhaseBudgets);
  
  // Get pre-construction and indirect costs summaries
  const preConstructionSpending = await getPreConstructionSpending(projectId);
  const indirectCostsSummary = await getIndirectCostsSummary(projectId);

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
  if (budgetWithLegacy.total > totalInvested) {
    warnings.push({
      type: 'budget_exceeds_capital',
      severity: 'warning',
      message: `Budget (${budgetWithLegacy.total.toLocaleString()}) exceeds available capital (${totalInvested.toLocaleString()}) by ${(budgetWithLegacy.total - totalInvested).toLocaleString()}`,
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
      total: budgetWithLegacy.total,
      materials: budgetWithLegacy.materials,
      labour: budgetWithLegacy.labour,
      contingency: budgetWithLegacy.contingency,
      remaining: budgetRemaining,
      allocatedToPhases: totalPhaseBudgets,
      unallocatedDCC, // NEW: Unallocated DCC (not total budget)
      preConstruction: {
        budgeted: isEnhancedBudget(budget) ? (budget.preConstructionCosts || 0) : (budgetWithLegacy.total * 0.05),
        spent: preConstructionSpending.total || 0,
        remaining: Math.max(0, (isEnhancedBudget(budget) ? (budget.preConstructionCosts || 0) : (budgetWithLegacy.total * 0.05)) - (preConstructionSpending.total || 0)),
        byCategory: preConstructionSpending.byCategory || {}
      },
      indirectCosts: indirectCostsSummary, // NEW: Indirect costs summary
      // Include enhanced structure if available
      ...(isEnhancedBudget(budget) ? {
        enhanced: {
          directConstructionCosts: budget.directConstructionCosts,
          preConstructionCosts: budget.preConstructionCosts,
          indirectCosts: budget.indirectCosts,
          contingencyReserve: budget.contingencyReserve,
          directCosts: budget.directCosts,
          phaseAllocations: budget.phaseAllocations,
          financialStates: budget.financialStates
        }
      } : {})
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

