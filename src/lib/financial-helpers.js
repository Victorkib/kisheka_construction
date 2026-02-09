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
  LABOUR_APPROVED_STATUSES,
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
 * Calculate comprehensive DCC spending
 * Aggregates all direct construction costs from multiple sources
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} DCC spending breakdown
 */
export async function calculateDCCSpending(projectId) {
  const db = await getDatabase();
  
  // 1. Get phase spending (already aggregated)
  const phases = await db.collection('phases').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).toArray();
  
  const phaseSpending = phases.reduce((sum, phase) => {
    return sum + (phase.actualSpending?.total || 0);
  }, 0);
  
  // 2. Get materials spending (approved, phase-linked, not indirect)
  const materials = await db.collection('materials').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    status: { $in: MATERIAL_APPROVED_STATUSES },
    phaseId: { $ne: null }, // Only phase-linked materials
  }).toArray();
  
  const materialsSpending = materials.reduce((sum, material) => {
    return sum + (material.totalCost || 0);
  }, 0);
  
  // 3. Get labour entries spending (direct labour, not indirect, phase-linked)
  const labourEntries = await db.collection('labour_entries').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    isIndirectLabour: { $ne: true },
    phaseId: { $ne: null }, // Only phase-linked labour
    status: { $in: LABOUR_APPROVED_STATUSES },
  }).toArray();
  
  const labourSpending = labourEntries.reduce((sum, entry) => {
    return sum + (entry.totalCost || 0);
  }, 0);
  
  // 4. Get equipment spending (phase-specific, not site-wide)
  const equipment = await db.collection('equipment').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    equipmentScope: { $ne: 'site_wide' },
    phaseId: { $ne: null }, // Only phase-linked equipment
  }).toArray();
  
  const equipmentSpending = equipment.reduce((sum, eq) => {
    return sum + (eq.totalCost || 0);
  }, 0);
  
  // 5. Get expenses spending (not indirect costs, DCC-related)
  const expenses = await db.collection('expenses').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    isIndirectCost: { $ne: true },
    status: { $in: EXPENSE_APPROVED_STATUSES },
  }).toArray();
  
  const expensesSpending = expenses.reduce((sum, expense) => {
    return sum + (expense.amount || 0);
  }, 0);
  
  // 6. Get work items spending (actual costs)
  const workItems = await db.collection('work_items').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    phaseId: { $ne: null }, // Only phase-linked work items
  }).toArray();
  
  const workItemsSpending = workItems.reduce((sum, item) => {
    return sum + (item.actualCost || 0);
  }, 0);
  
  // Total DCC spending
  // Phase spending is the primary source as it's already aggregated and includes
  // materials, labour, equipment, and work items within phases
  // We also include expenses that are DCC-related (not indirect costs, not in phases)
  // Direct calculation is used for verification and to catch any discrepancies
  
  // Note: Phase spending already includes materials, labour, equipment, and work items
  // So we use phase spending as the base, and add any DCC expenses that might not be in phases
  // For now, we'll use phase spending as the primary source since it's the most accurate
  const directCalculation = materialsSpending + labourSpending + equipmentSpending + workItemsSpending;
  
  // Use phase spending as primary (it's the source of truth)
  // Add expenses that are DCC-related but might not be reflected in phase spending yet
  // In most cases, phase spending should be sufficient
  const totalDCCSpending = phaseSpending;
  
  return {
    total: totalDCCSpending,
    breakdown: {
      phaseSpending, // Primary source (includes materials, labour, equipment, work items within phases)
      expenses: expensesSpending, // DCC-related expenses (for reference, may already be in phase spending)
      // Detailed breakdown for reference and verification
      materials: materialsSpending,
      labour: labourSpending,
      equipment: equipmentSpending,
      workItems: workItemsSpending,
    },
    // Verification: phase spending should roughly match direct calculation
    // Allow 10% variance for timing differences and expenses not yet in phase spending
    verified: phaseSpending > 0 && Math.abs(phaseSpending - directCalculation) / phaseSpending < 0.10,
    // Note about data: phase spending is the source of truth
    note: 'Phase spending is the primary source and includes all materials, labour, equipment, and work items within phases.',
  };
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
 * Get pre-construction budget for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Pre-construction budget
 */
export async function getPreConstructionBudget(projectId) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId)
  });
  
  if (!project || !project.budget) {
    return 0;
  }
  
  const budget = project.budget;
  
  if (isEnhancedBudget(budget)) {
    return budget.preConstructionCosts || 0;
  } else {
    // Legacy: Estimate 5% of total
    const totalBudget = getBudgetTotal(budget);
    return totalBudget * 0.05;
  }
}

/**
 * Get pre-construction budget remaining
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Remaining pre-construction budget
 */
export async function getPreConstructionRemaining(projectId) {
  const preConstructionBudget = await getPreConstructionBudget(projectId);
  const spending = await getPreConstructionSpending(projectId);
  const remaining = Math.max(0, preConstructionBudget - spending.total);
  return remaining;
}

/**
 * Get complete pre-construction budget summary (budget, spent, remaining, by category)
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Complete pre-construction summary
 */
export async function getPreConstructionSummary(projectId) {
  const budget = await getPreConstructionBudget(projectId);
  const spending = await getPreConstructionSpending(projectId);
  const remaining = Math.max(0, budget - spending.total);
  
  return {
    budgeted: budget,
    spent: spending.total || 0,
    remaining,
    byCategory: spending.byCategory || {
      landAcquisition: 0,
      legalRegulatory: 0,
      permitsApprovals: 0,
      sitePreparation: 0
    }
  };
}

/**
 * Validate if pre-construction expense fits within budget
 * @param {string} projectId - Project ID
 * @param {number} amount - Expense amount to validate
 * @param {string} [category] - Optional: sub-category for category-level validation
 * @returns {Promise<Object>} { isValid: boolean, available: number, required: number, shortfall: number, message: string }
 */
export async function validatePreConstructionBudget(projectId, amount, category = null) {
  if (!projectId || !ObjectId.isValid(projectId)) {
    return {
      isValid: false,
      available: 0,
      required: amount || 0,
      shortfall: amount || 0,
      message: 'Invalid project ID',
    };
  }

  if (!amount || amount <= 0) {
    return {
      isValid: true,
      available: 0,
      required: 0,
      shortfall: 0,
      message: 'No amount provided. Budget validation will occur when expense is approved.',
    };
  }

  const db = await getDatabase();
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    deletedAt: null,
  });

  if (!project) {
    return {
      isValid: false,
      available: 0,
      required: amount,
      shortfall: amount,
      message: 'Project not found',
    };
  }

  // Get pre-construction budget
  const preConstructionBudget = await getPreConstructionBudget(projectId);
  
  // OPTIONAL BUDGET: If budget is zero, allow operation and track spending
  if (preConstructionBudget <= 0) {
    return {
      isValid: true,
      available: 0,
      required: amount,
      shortfall: 0,
      message: 'No pre-construction budget set. Operation allowed - spending will be tracked. Set budget later to enable budget validation.',
      budgetNotSet: true
    };
  }

  // Get current spending
  const spending = await getPreConstructionSpending(projectId);
  const currentSpending = spending.total || 0;
  const available = Math.max(0, preConstructionBudget - currentSpending);

  // If category is provided, also check category-level budget
  if (category) {
    const categorySpending = spending.byCategory?.[category] || 0;
    // For category-level, we estimate based on typical distribution
    // This is a simplified check - in reality, categories don't have separate budgets
    // but we can warn if a category is consuming too much
    const categoryPercentage = (categorySpending / preConstructionBudget) * 100;
    if (categoryPercentage > 50) {
      // Warning if category exceeds 50% of total budget
      return {
        isValid: true,
        available,
        required: amount,
        shortfall: Math.max(0, amount - available),
        message: `Warning: ${category} category is already ${categoryPercentage.toFixed(1)}% of pre-construction budget. Proceed with caution.`,
        warning: true,
      };
    }
  }

  // Check if amount fits within available budget
  if (amount > available) {
    return {
      isValid: false,
      available,
      required: amount,
      shortfall: amount - available,
      message: `Insufficient pre-construction budget. Available: ${available.toLocaleString()} KES, Required: ${amount.toLocaleString()} KES, Shortfall: ${(amount - available).toLocaleString()} KES.`,
    };
  }

  // Check if approaching budget limit (80% threshold)
  const usagePercentage = ((currentSpending + amount) / preConstructionBudget) * 100;
  if (usagePercentage >= 80 && usagePercentage < 100) {
    return {
      isValid: true,
      available,
      required: amount,
      shortfall: 0,
      message: `Warning: Pre-construction budget usage will be ${usagePercentage.toFixed(1)}% after this expense.`,
      warning: true,
    };
  }

  return {
    isValid: true,
    available,
    required: amount,
    shortfall: 0,
    message: 'Budget validation passed',
  };
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

  // Get total from labour entries (approved/paid only)
  const labourTotal = await db
    .collection('labour_entries')
    .aggregate([
      {
        $match: {
          projectId: new ObjectId(projectId),
          deletedAt: null,
          status: { $in: LABOUR_APPROVED_STATUSES },
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

  const totalExpenses = expensesTotal[0]?.total || 0;
  const totalMaterials = materialsTotal[0]?.total || 0;
  const totalInitialExpenses = initialExpensesTotal[0]?.total || 0;
  const totalLabour = labourTotal[0]?.total || 0;

  return totalExpenses + totalMaterials + totalInitialExpenses + totalLabour;
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
 * Calculate total committed material cost from accepted purchase orders
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Total committed material cost
 */
export async function calculateMaterialsCommittedCost(projectId) {
  const db = await getDatabase();

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

  return poResult[0]?.total || 0;
}

/**
 * Calculate total estimated cost from approved material requests (not yet converted)
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Total estimated cost
 */
export async function calculateEstimatedCost(projectId) {
  const estimated = await calculateMaterialsEstimatedBreakdown(projectId);
  return estimated.totalEstimated;
}

/**
 * Calculate estimated material costs with batch/request breakdown
 * @param {string} projectId - Project ID
 * @returns {Promise<{requestEstimated: number, batchEstimated: number, totalEstimated: number}>}
 */
export async function calculateMaterialsEstimatedBreakdown(projectId) {
  const db = await getDatabase();
  const projectObjectId = new ObjectId(projectId);

  // Fetch active batches for this project
  const batches = await db.collection('material_request_batches')
    .find({
      projectId: projectObjectId,
      status: { $in: ['approved', 'partially_ordered', 'fully_ordered'] },
      deletedAt: null,
    })
    .project({ materialRequestIds: 1, totalEstimatedCost: 1 })
    .toArray();

  const batchEstimated = batches.reduce((sum, batch) => sum + (batch.totalEstimatedCost || 0), 0);
  const batchRequestIdStrings = new Set();
  for (const batch of batches) {
    const ids = Array.isArray(batch.materialRequestIds) ? batch.materialRequestIds : [];
    ids.forEach((id) => {
      if (id) {
        batchRequestIdStrings.add(id.toString());
      }
    });
  }

  const batchRequestIds = Array.from(batchRequestIdStrings)
    .filter((id) => ObjectId.isValid(id))
    .map((id) => new ObjectId(id));

  // Calculate estimated cost from approved requests not in active batches
  const requestMatch = {
    projectId: projectObjectId,
    status: 'approved',
    deletedAt: null,
    estimatedCost: { $exists: true, $ne: null, $gt: 0 },
  };

  if (batchRequestIds.length > 0) {
    requestMatch._id = { $nin: batchRequestIds };
  }

  const requestResult = await db.collection('material_requests').aggregate([
    { $match: requestMatch },
    { $group: { _id: null, total: { $sum: '$estimatedCost' } } },
  ]).toArray();

  const requestEstimated = requestResult[0]?.total || 0;
  return {
    requestEstimated,
    batchEstimated,
    totalEstimated: requestEstimated + batchEstimated,
  };
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
  
  const budget = getMaterialsBudget(project?.budget || {});
  
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
  
  // Committed from accepted purchase orders (materials only)
  const committed = await calculateMaterialsCommittedCost(projectId);
  
  // Estimated from approved requests + batch estimates (avoid double counting)
  const estimatedBreakdown = await calculateMaterialsEstimatedBreakdown(projectId);
  const totalEstimated = estimatedBreakdown.totalEstimated;
  const batchEstimated = estimatedBreakdown.batchEstimated;
  const requestEstimated = estimatedBreakdown.requestEstimated;
  
  return {
    budget,
    actual,
    committed,
    estimated: totalEstimated,
    batchEstimated,
    requestEstimated,
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

  // Calculate balances (guard against divide-by-zero and inconsistent data)
  const capitalBalance = totalInvested - totalUsed;
  const loanRatio = totalInvested > 0 ? (totalLoans / totalInvested) : 0;
  const equityRatio = totalInvested > 0 ? (totalEquity / totalInvested) : 0;
  const loanBalance = totalLoans - (totalUsed * loanRatio);
  const equityBalance = totalEquity - (totalUsed * equityRatio);

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
  const availableCapital = finances?.availableCapital ?? (totalInvested - totalUsed - committedCost);
  const materialsBreakdown = finances?.materialsBreakdown || await calculateMaterialsBreakdown(projectId);

  // Calculate balances (guard against divide-by-zero and inconsistent data)
  const capitalBalance = totalInvested - totalUsed;
  const loanRatio = totalInvested > 0 ? (totalLoans / totalInvested) : 0;
  const equityRatio = totalInvested > 0 ? (totalEquity / totalInvested) : 0;
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

  // Get labour costs for breakdown
  const labourTotal = await db
    .collection('labour_entries')
    .aggregate([
      {
        $match: {
          projectId: new ObjectId(projectId),
          deletedAt: null,
          status: { $in: LABOUR_APPROVED_STATUSES },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalCost' } } },
    ])
    .toArray();

  const breakdown = {
    expenses: expensesTotal[0]?.total || 0,
    materials: materialsTotal[0]?.total || 0,
    initialExpenses: initialExpensesTotal[0]?.total || 0,
    labour: labourTotal[0]?.total || 0,
    total: totalUsed,
  };

  // Get contingency summary for suggestions
  let contingencySummary = null;
  try {
    const { getContingencySummary } = await import('@/lib/contingency-helpers');
    contingencySummary = await getContingencySummary(projectId);
  } catch (err) {
    console.error('Error fetching contingency summary:', err);
  }

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
    const capitalRemainingPercent = totalInvested > 0 ? (availableCapital / totalInvested) * 100 : 0;
    warnings.push({
      type: 'low_capital',
      severity: 'warning',
      message: `Low available capital: ${availableCapital.toLocaleString()} remaining (${capitalRemainingPercent.toFixed(1)}%)`,
    });
  }
  if (availableCapital < 0) {
    const overspendAmount = Math.abs(availableCapital);
    warnings.push({
      type: 'overspent',
      severity: 'error',
      message: `Overspent by ${overspendAmount.toLocaleString()} (including committed costs)`,
    });
    
    // Suggest contingency usage if available
    if (contingencySummary && contingencySummary.remaining > 0) {
      const suggestedAmount = Math.min(overspendAmount, contingencySummary.remaining);
      warnings.push({
        type: 'contingency_suggestion',
        severity: 'info',
        message: `Consider using contingency reserve to cover overspend. Available: ${contingencySummary.remaining.toLocaleString()} KES. Suggested draw: ${suggestedAmount.toLocaleString()} KES.`,
        suggestedContingencyDraw: suggestedAmount,
        contingencyAvailable: contingencySummary.remaining,
      });
    }
  }
  if (committedCost > 0 && availableCapital < committedCost) {
    warnings.push({
      type: 'high_commitment',
      severity: 'warning',
      message: `High committed costs: ${committedCost.toLocaleString()} (${((committedCost / totalInvested) * 100).toFixed(1)}% of capital)`,
    });
  }

  // Check if budget is exceeded and suggest contingency
  // Note: budgetRemaining is already calculated above at line 1004
  if (budgetRemaining < 0 && contingencySummary && contingencySummary.remaining > 0) {
    const budgetOverspend = Math.abs(budgetRemaining);
    const suggestedAmount = Math.min(budgetOverspend, contingencySummary.remaining);
    warnings.push({
      type: 'budget_overrun_contingency_suggestion',
      severity: 'warning',
      message: `Budget exceeded by ${budgetOverspend.toLocaleString()} KES. Consider using contingency reserve. Available: ${contingencySummary.remaining.toLocaleString()} KES. Suggested draw: ${suggestedAmount.toLocaleString()} KES.`,
      suggestedContingencyDraw: suggestedAmount,
      contingencyAvailable: contingencySummary.remaining,
      budgetOverspend,
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
      loanBalance: totalLoans - (totalUsed * loanRatio),
      equityBalance: totalEquity - (totalUsed * equityRatio),
    },
    materialsBreakdown,
    actual: breakdown,
    spendingLimit: totalInvested, // Capital is the actual limit
    warnings,
    contingency: contingencySummary ? {
      budgeted: contingencySummary.budgeted,
      used: contingencySummary.used,
      remaining: contingencySummary.remaining,
    } : null,
    status: {
      budgetStatus: budgetRemaining >= 0 ? 'on_budget' : 'over_budget',
      capitalStatus: capitalBalance >= 0 ? 'sufficient' : 'insufficient',
      overall: capitalBalance >= 0 && budgetRemaining >= 0 ? 'healthy' : capitalBalance < 0 ? 'critical' : 'at_risk',
    },
  };
}

