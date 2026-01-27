/**
 * Indirect Costs Helpers
 * Functions for tracking and managing indirect costs spending
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { INITIAL_EXPENSE_APPROVED_STATUSES, LABOUR_APPROVED_STATUSES } from '@/lib/status-constants';
import { isEnhancedBudget, getBudgetTotal } from '@/lib/schemas/budget-schema';

/**
 * Calculate total indirect costs spending for a project
 * Includes both indirect cost expenses AND indirect labour entries
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Total indirect costs spent
 */
export async function calculateIndirectCostsSpending(projectId) {
  const db = await getDatabase();
  
  // Calculate expenses marked as indirect costs
  const expenseResult = await db.collection('expenses').aggregate([
    {
      $match: {
        projectId: new ObjectId(projectId),
        deletedAt: null,
        isIndirectCost: true,
        status: { $in: ['APPROVED', 'PAID'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]).toArray();
  
  const expenseTotal = expenseResult[0]?.total || 0;
  
  // Calculate labour entries marked as indirect labour
  // CRITICAL: Include labour entries in indirect costs spending
  const labourResult = await db.collection('labour_entries').aggregate([
    {
      $match: {
        projectId: new ObjectId(projectId),
        deletedAt: null,
        isIndirectLabour: true,
        indirectCostCategory: { $exists: true, $ne: null },
        status: { $in: LABOUR_APPROVED_STATUSES } // Labour entries are approved on creation
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalCost' }
      }
    }
  ]).toArray();
  
  const labourTotal = labourResult[0]?.total || 0;
  
  return expenseTotal + labourTotal;
}

/**
 * Calculate indirect costs spending by category
 * Includes both indirect cost expenses AND indirect labour entries
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Breakdown by category
 */
export async function calculateIndirectCostsByCategory(projectId) {
  const db = await getDatabase();
  
  // Get expenses by category
  const expenseResult = await db.collection('expenses').aggregate([
    {
      $match: {
        projectId: new ObjectId(projectId),
        deletedAt: null,
        isIndirectCost: true,
        status: { $in: ['APPROVED', 'PAID'] }
      }
    },
    {
      $group: {
        _id: '$indirectCostCategory',
        total: { $sum: '$amount' }
      }
    }
  ]).toArray();
  
  // Get labour entries by category
  const labourResult = await db.collection('labour_entries').aggregate([
    {
      $match: {
        projectId: new ObjectId(projectId),
        deletedAt: null,
        isIndirectLabour: true,
        indirectCostCategory: { $exists: true, $ne: null },
        status: { $in: LABOUR_APPROVED_STATUSES }
      }
    },
    {
      $group: {
        _id: '$indirectCostCategory',
        total: { $sum: '$totalCost' }
      }
    }
  ]).toArray();
  
  // Initialize all categories to 0
  const byCategory = {
    utilities: 0,
    siteOverhead: 0,
    transportation: 0,
    safetyCompliance: 0
  };
  
  // Fill in actual values from expenses
  expenseResult.forEach(item => {
    if (item._id && byCategory.hasOwnProperty(item._id)) {
      byCategory[item._id] += item.total;
    }
  });
  
  // Fill in actual values from labour entries (accumulate with expenses)
  labourResult.forEach(item => {
    if (item._id && byCategory.hasOwnProperty(item._id)) {
      byCategory[item._id] += item.total;
    }
  });
  
  return byCategory;
}

/**
 * Update indirect costs spending when expense is created/approved
 * @param {string} projectId - Project ID
 * @param {string} category - Indirect cost category (utilities, siteOverhead, transportation, safetyCompliance)
 * @param {number} amount - Expense amount
 * @param {Object} [session] - MongoDB session for transaction (optional)
 * @returns {Promise<void>}
 */
export async function updateIndirectCostsSpending(projectId, category, amount, session = null) {
  const db = await getDatabase();
  
  // Get or create project_finances record
  let projectFinances = await db.collection('project_finances').findOne(
    { projectId: new ObjectId(projectId) },
    session ? { session } : undefined
  );
  
  if (!projectFinances) {
    // Create new project_finances record
    projectFinances = {
      projectId: new ObjectId(projectId),
      indirectCosts: {
        budgeted: 0,
        spent: 0,
        remaining: 0,
        byCategory: {
          utilities: 0,
          siteOverhead: 0,
          transportation: 0,
          safetyCompliance: 0
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.collection('project_finances').insertOne(projectFinances, session ? { session } : undefined);
  }
  
  // Initialize indirectCosts if it doesn't exist
  if (!projectFinances.indirectCosts) {
    projectFinances.indirectCosts = {
      budgeted: 0,
      spent: 0,
      remaining: 0,
      byCategory: {
        utilities: 0,
        siteOverhead: 0,
        transportation: 0,
        safetyCompliance: 0
      }
    };
  }
  
  // Get budget from project
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId)
  });
  
  if (project && project.budget) {
    let indirectBudget = 0;
    if (isEnhancedBudget(project.budget)) {
      indirectBudget = project.budget.indirectCosts || 0;
    } else {
      // Legacy: Estimate 5% of total
      const totalBudget = getBudgetTotal(project.budget);
      indirectBudget = totalBudget * 0.05;
    }
    
    projectFinances.indirectCosts.budgeted = indirectBudget;
  }
  
  // Update spending
  const currentTotal = projectFinances.indirectCosts.spent || 0;
  const currentCategory = projectFinances.indirectCosts.byCategory[category] || 0;
  const newTotal = currentTotal + amount;
  const newCategory = currentCategory + amount;
  const remaining = Math.max(0, projectFinances.indirectCosts.budgeted - newTotal);
  
  const updateOptions = session ? { session } : undefined;
  
  await db.collection('project_finances').updateOne(
    { projectId: new ObjectId(projectId) },
    {
      $set: {
        'indirectCosts.spent': newTotal,
        [`indirectCosts.byCategory.${category}`]: newCategory,
        'indirectCosts.remaining': remaining,
        updatedAt: new Date()
      }
    },
    updateOptions
  );
}

/**
 * Get indirect costs remaining budget
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Remaining indirect costs budget
 */
export async function getIndirectCostsRemaining(projectId) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId)
  });
  
  if (!project || !project.budget) {
    return 0;
  }
  
  const budget = project.budget;
  let indirectBudget = 0;
  
  if (isEnhancedBudget(budget)) {
    indirectBudget = budget.indirectCosts || 0;
  } else {
    // Legacy: Estimate 5% of total
    const totalBudget = getBudgetTotal(budget);
    indirectBudget = totalBudget * 0.05;
  }
  
  const spending = await calculateIndirectCostsSpending(projectId);
  const remaining = Math.max(0, indirectBudget - spending);
  
  return remaining;
}

/**
 * Get indirect costs that occurred during a specific phase (for timeline tracking)
 * @param {string} projectId - Project ID
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Array>} Array of indirect cost expenses
 */
export async function getIndirectCostsByPhase(projectId, phaseId) {
  const db = await getDatabase();
  
  // Get indirect cost expenses for this phase
  const expenses = await db.collection('expenses').find({
    projectId: new ObjectId(projectId),
    phaseId: new ObjectId(phaseId),
    deletedAt: null,
    isIndirectCost: true,
    status: { $in: ['APPROVED', 'PAID'] }
  }).sort({ datePaid: 1 }).toArray();
  
  // Get indirect labour entries for this phase (if any - indirect labour is typically project-level)
  const labourEntries = await db.collection('labour_entries').find({
    projectId: new ObjectId(projectId),
    phaseId: new ObjectId(phaseId),
    deletedAt: null,
    isIndirectLabour: true,
    indirectCostCategory: { $exists: true, $ne: null },
    status: { $in: ['approved', 'paid', 'APPROVED', 'PAID'] }
  }).sort({ entryDate: 1 }).toArray();
  
  // Combine results
  return {
    expenses,
    labourEntries,
    all: [...expenses, ...labourEntries]
  };
}

/**
 * Get indirect costs budget for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Indirect costs budget
 */
export async function getIndirectCostsBudget(projectId) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId)
  });
  
  if (!project || !project.budget) {
    return 0;
  }
  
  const budget = project.budget;
  
  if (isEnhancedBudget(budget)) {
    return budget.indirectCosts || 0;
  } else {
    // Legacy: Estimate 5% of total
    const totalBudget = getBudgetTotal(budget);
    return totalBudget * 0.05;
  }
}

/**
 * Get complete indirect costs summary for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Complete indirect costs summary
 */
export async function getIndirectCostsSummary(projectId) {
  const budget = await getIndirectCostsBudget(projectId);
  const spent = await calculateIndirectCostsSpending(projectId);
  const byCategory = await calculateIndirectCostsByCategory(projectId);
  const remaining = Math.max(0, budget - spent);
  
  return {
    budgeted: budget,
    spent,
    remaining,
    byCategory
  };
}

/**
 * Validate if indirect cost expense fits within budget
 * @param {string} projectId - Project ID
 * @param {number} amount - Expense amount to validate
 * @param {string} [category] - Optional: indirect cost category for category-level validation
 * @returns {Promise<Object>} { isValid: boolean, available: number, required: number, shortfall: number, message: string }
 */
export async function validateIndirectCostsBudget(projectId, amount, category = null) {
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

  // Get indirect costs budget
  const indirectBudget = await getIndirectCostsBudget(projectId);
  
  if (indirectBudget <= 0) {
    return {
      isValid: false,
      available: 0,
      required: amount,
      shortfall: amount,
      message: 'Indirect costs budget not set. Please set a project budget with indirect costs first.',
    };
  }

  // Get current spending
  const spending = await calculateIndirectCostsSpending(projectId);
  const available = Math.max(0, indirectBudget - spending);

  // If category is provided, also check category-level spending
  if (category) {
    const byCategory = await calculateIndirectCostsByCategory(projectId);
    const categorySpending = byCategory[category] || 0;
    // For category-level, we estimate based on typical distribution
    // This is a simplified check - categories don't have separate budgets
    // but we can warn if a category is consuming too much
    const categoryPercentage = (categorySpending / indirectBudget) * 100;
    if (categoryPercentage > 50) {
      // Warning if category exceeds 50% of total budget
      return {
        isValid: true,
        available,
        required: amount,
        shortfall: Math.max(0, amount - available),
        message: `Warning: ${category} category is already ${categoryPercentage.toFixed(1)}% of indirect costs budget. Proceed with caution.`,
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
      message: `Insufficient indirect costs budget. Available: ${available.toLocaleString()} KES, Required: ${amount.toLocaleString()} KES, Shortfall: ${(amount - available).toLocaleString()} KES.`,
    };
  }

  // Check if approaching budget limit (80% threshold)
  const usagePercentage = ((spending + amount) / indirectBudget) * 100;
  if (usagePercentage >= 80 && usagePercentage < 100) {
    return {
      isValid: true,
      available,
      required: amount,
      shortfall: 0,
      message: `Warning: Indirect costs budget usage will be ${usagePercentage.toFixed(1)}% after this expense.`,
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
 * Auto-determine if an expense category should be marked as indirect cost
 * @param {string} category - Expense category
 * @returns {Object} { isIndirect: boolean, indirectCategory: string | null }
 */
export function autoCategorizeIndirectCost(category) {
  // Map expense categories to indirect cost categories
  const categoryMapping = {
    // Utilities → utilities
    'utilities': { isIndirect: true, indirectCategory: 'utilities' },
    
    // Transport → transportation
    'transport': { isIndirect: true, indirectCategory: 'transportation' },
    
    // Safety → safetyCompliance
    'safety': { isIndirect: true, indirectCategory: 'safetyCompliance' },
    
    // Site overhead categories → siteOverhead
    'accommodation': { isIndirect: true, indirectCategory: 'siteOverhead' },
    'training': { isIndirect: true, indirectCategory: 'siteOverhead' },
    
    // Direct cost categories (not indirect)
    'equipment_rental': { isIndirect: false, indirectCategory: null },
    'excavation': { isIndirect: false, indirectCategory: null },
    'earthworks': { isIndirect: false, indirectCategory: null },
    'construction_services': { isIndirect: false, indirectCategory: null },
    'permits': { isIndirect: false, indirectCategory: null }, // Permits are preconstruction, not indirect
  };

  return categoryMapping[category] || { isIndirect: false, indirectCategory: null };
}



