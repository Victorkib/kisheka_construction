/**
 * Indirect Costs Helpers
 * Functions for tracking and managing indirect costs spending
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { INITIAL_EXPENSE_APPROVED_STATUSES } from '@/lib/status-constants';
import { isEnhancedBudget, getBudgetTotal } from '@/lib/schemas/budget-schema';

/**
 * Calculate total indirect costs spending for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Total indirect costs spent
 */
export async function calculateIndirectCostsSpending(projectId) {
  const db = await getDatabase();
  
  const result = await db.collection('expenses').aggregate([
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
  
  return result[0]?.total || 0;
}

/**
 * Calculate indirect costs spending by category
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Breakdown by category
 */
export async function calculateIndirectCostsByCategory(projectId) {
  const db = await getDatabase();
  
  const result = await db.collection('expenses').aggregate([
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
  
  // Initialize all categories to 0
  const byCategory = {
    utilities: 0,
    siteOverhead: 0,
    transportation: 0,
    safetyCompliance: 0
  };
  
  // Fill in actual values
  result.forEach(item => {
    if (item._id && byCategory.hasOwnProperty(item._id)) {
      byCategory[item._id] = item.total;
    }
  });
  
  return byCategory;
}

/**
 * Update indirect costs spending when expense is created/approved
 * @param {string} projectId - Project ID
 * @param {string} category - Indirect cost category (utilities, siteOverhead, transportation, safetyCompliance)
 * @param {number} amount - Expense amount
 * @returns {Promise<void>}
 */
export async function updateIndirectCostsSpending(projectId, category, amount) {
  const db = await getDatabase();
  
  // Get or create project_finances record
  let projectFinances = await db.collection('project_finances').findOne({
    projectId: new ObjectId(projectId)
  });
  
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
    await db.collection('project_finances').insertOne(projectFinances);
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
  
  await db.collection('project_finances').updateOne(
    { projectId: new ObjectId(projectId) },
    {
      $set: {
        'indirectCosts.spent': newTotal,
        [`indirectCosts.byCategory.${category}`]: newCategory,
        'indirectCosts.remaining': remaining,
        updatedAt: new Date()
      }
    }
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
  
  const expenses = await db.collection('expenses').find({
    projectId: new ObjectId(projectId),
    phaseId: new ObjectId(phaseId),
    deletedAt: null,
    isIndirectCost: true,
    status: { $in: ['APPROVED', 'PAID'] }
  }).sort({ datePaid: 1 }).toArray();
  
  return expenses;
}

/**
 * Get complete indirect costs summary for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Complete indirect costs summary
 */
export async function getIndirectCostsSummary(projectId) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId)
  });
  
  if (!project || !project.budget) {
    return {
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
  
  const budget = project.budget;
  let indirectBudget = 0;
  
  if (isEnhancedBudget(budget)) {
    indirectBudget = budget.indirectCosts || 0;
  } else {
    const totalBudget = getBudgetTotal(budget);
    indirectBudget = totalBudget * 0.05;
  }
  
  const spent = await calculateIndirectCostsSpending(projectId);
  const byCategory = await calculateIndirectCostsByCategory(projectId);
  const remaining = Math.max(0, indirectBudget - spent);
  
  return {
    budgeted: indirectBudget,
    spent,
    remaining,
    byCategory
  };
}



