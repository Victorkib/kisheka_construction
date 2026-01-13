/**
 * Budget Adjustment Helpers
 * Functions for managing budget adjustments (increases/decreases) to cost categories
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import {
  getPreConstructionBudget,
  getPreConstructionSpending,
} from '@/lib/financial-helpers';
import {
  getIndirectCostsBudget,
  calculateIndirectCostsSpending,
} from '@/lib/indirect-costs-helpers';
import {
  getContingencyReserveBudget,
  calculateContingencyUsage,
} from '@/lib/contingency-helpers';
import {
  isEnhancedBudget,
  getBudgetTotal,
} from '@/lib/schemas/budget-schema';
import { calculateTotalPhaseBudgets } from '@/lib/phase-helpers';

/**
 * Get current budget for a cost category
 * @param {string} projectId - Project ID
 * @param {string} category - Cost category ('dcc', 'preconstruction', 'indirect', 'contingency')
 * @returns {Promise<number>} Current budget amount
 */
export async function getCategoryCurrentBudget(projectId, category) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    deletedAt: null,
  });

  if (!project || !project.budget) {
    return 0;
  }

  const budget = project.budget;

  if (isEnhancedBudget(budget)) {
    switch (category) {
      case 'dcc':
        return budget.directConstructionCosts || 0;
      case 'preconstruction':
        return budget.preConstructionCosts || 0;
      case 'indirect':
        return budget.indirectCosts || 0;
      case 'contingency':
        return budget.contingencyReserve || (budget.contingency?.total || 0);
      default:
        return 0;
    }
  } else {
    // Legacy budget - estimate based on total
    const totalBudget = getBudgetTotal(budget);
    switch (category) {
      case 'dcc':
        // Estimate DCC as 85% of total (assuming 5% preconstruction, 5% indirect, 5% contingency)
        return totalBudget * 0.85;
      case 'preconstruction':
        return totalBudget * 0.05;
      case 'indirect':
        return totalBudget * 0.05;
      case 'contingency':
        return budget.contingency || (totalBudget * 0.05);
      default:
        return 0;
    }
  }
}

/**
 * Validate budget adjustment
 * @param {string} projectId - Project ID
 * @param {string} category - Cost category to adjust
 * @param {number} adjustmentAmount - Adjustment amount (positive for increase, negative for decrease)
 * @param {string} adjustmentType - 'increase' | 'decrease'
 * @returns {Promise<Object>} { isValid: boolean, currentBudget: number, newBudget: number, message: string }
 */
export async function validateBudgetAdjustment(projectId, category, adjustmentAmount, adjustmentType) {
  if (!projectId || !ObjectId.isValid(projectId)) {
    return {
      isValid: false,
      currentBudget: 0,
      newBudget: 0,
      message: 'Invalid project ID',
    };
  }

  if (!adjustmentAmount || adjustmentAmount <= 0) {
    return {
      isValid: false,
      currentBudget: 0,
      newBudget: 0,
      message: 'Adjustment amount must be greater than 0',
    };
  }

  const validCategories = ['dcc', 'preconstruction', 'indirect', 'contingency'];
  if (!validCategories.includes(category)) {
    return {
      isValid: false,
      currentBudget: 0,
      newBudget: 0,
      message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
    };
  }

  const validTypes = ['increase', 'decrease'];
  if (!validTypes.includes(adjustmentType)) {
    return {
      isValid: false,
      currentBudget: 0,
      newBudget: 0,
      message: `Invalid adjustment type. Must be one of: ${validTypes.join(', ')}`,
    };
  }

  // Get current budget
  const currentBudget = await getCategoryCurrentBudget(projectId, category);

  // Calculate new budget
  let newBudget;
  if (adjustmentType === 'increase') {
    newBudget = currentBudget + adjustmentAmount;
  } else {
    newBudget = currentBudget - adjustmentAmount;
    
    // For decreases, check if adjustment would make budget negative
    if (newBudget < 0) {
      return {
        isValid: false,
        currentBudget,
        newBudget: 0,
        message: `Cannot decrease budget below 0. Current budget: ${currentBudget.toLocaleString()} KES, Adjustment: ${adjustmentAmount.toLocaleString()} KES, Result would be: ${newBudget.toLocaleString()} KES.`,
      };
    }

    // For decreases, check if there's enough unallocated budget
    // Get spending to ensure we don't go below committed/actual spending
    let currentSpending = 0;
    if (category === 'dcc') {
      const allocatedToPhases = await calculateTotalPhaseBudgets(projectId);
      currentSpending = allocatedToPhases;
    } else if (category === 'preconstruction') {
      const spending = await getPreConstructionSpending(projectId);
      currentSpending = spending.total || 0;
    } else if (category === 'indirect') {
      currentSpending = await calculateIndirectCostsSpending(projectId);
    } else if (category === 'contingency') {
      currentSpending = await calculateContingencyUsage(projectId);
    }

    if (newBudget < currentSpending) {
      return {
        isValid: false,
        currentBudget,
        newBudget,
        message: `Cannot decrease budget below current spending. Current budget: ${currentBudget.toLocaleString()} KES, Current spending: ${currentSpending.toLocaleString()} KES, Adjustment: ${adjustmentAmount.toLocaleString()} KES, New budget would be: ${newBudget.toLocaleString()} KES (below spending).`,
      };
    }
  }

  return {
    isValid: true,
    currentBudget,
    newBudget,
    message: 'Budget adjustment validation passed',
  };
}

/**
 * Create a budget adjustment request
 * @param {Object} adjustmentData - Adjustment data
 * @param {string} projectId - Project ID
 * @param {string} requestedBy - User ID who requested the adjustment
 * @returns {Promise<Object>} Created adjustment record
 */
export async function createBudgetAdjustment(adjustmentData, projectId, requestedBy) {
  const db = await getDatabase();
  
  const {
    category,
    adjustmentType,
    adjustmentAmount,
    reason,
  } = adjustmentData;

  const currentBudget = await getCategoryCurrentBudget(projectId, category);
  const newBudget = adjustmentType === 'increase' 
    ? currentBudget + adjustmentAmount 
    : currentBudget - adjustmentAmount;

  const adjustment = {
    projectId: new ObjectId(projectId),
    category,
    adjustmentType,
    adjustmentAmount: parseFloat(adjustmentAmount) || 0,
    currentBudget,
    newBudget,
    reason: reason?.trim() || '',
    requestedBy: new ObjectId(requestedBy),
    approvedBy: null,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const result = await db.collection('budget_adjustments').insertOne(adjustment);
  return { ...adjustment, _id: result.insertedId };
}

/**
 * Update budget adjustment status
 * @param {string} adjustmentId - Adjustment ID
 * @param {string} status - New status (approved, rejected)
 * @param {string} approvedBy - User ID who approved/rejected
 * @param {string} [notes] - Optional approval/rejection notes
 * @returns {Promise<Object>} Updated adjustment record
 */
export async function updateBudgetAdjustmentStatus(adjustmentId, status, approvedBy, notes = null) {
  const db = await getDatabase();
  
  const updateData = {
    status,
    approvedBy: new ObjectId(approvedBy),
    approvalNotes: notes?.trim() || null,
    updatedAt: new Date(),
  };

  if (status === 'approved') {
    updateData.approvedAt = new Date();
  }

  const result = await db.collection('budget_adjustments').findOneAndUpdate(
    { _id: new ObjectId(adjustmentId) },
    { $set: updateData },
    { returnDocument: 'after' }
  );

  return result.value;
}

/**
 * Execute approved budget adjustment (update project budget)
 * @param {string} projectId - Project ID
 * @param {Object} adjustment - Adjustment record
 * @returns {Promise<Object>} Updated project budget
 */
export async function executeBudgetAdjustment(projectId, adjustment) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    deletedAt: null,
  });

  if (!project || !project.budget) {
    throw new Error('Project or budget not found');
  }

  const budget = project.budget;
  const newBudgetValue = adjustment.newBudget;

  // Update budget based on adjustment
  if (isEnhancedBudget(budget)) {
    const updates = {};

    // Update the specific category
    switch (adjustment.category) {
      case 'dcc':
        updates['budget.directConstructionCosts'] = newBudgetValue;
        // Also update legacy materials/labour proportionally if they exist
        if (budget.materials !== undefined && budget.directConstructionCosts > 0) {
          const materialsRatio = budget.directCosts?.materials?.total / budget.directConstructionCosts || 0;
          updates['budget.materials'] = newBudgetValue * materialsRatio;
        }
        if (budget.labour !== undefined && budget.directConstructionCosts > 0) {
          const labourRatio = budget.directCosts?.labour?.total / budget.directConstructionCosts || 0;
          updates['budget.labour'] = newBudgetValue * labourRatio;
        }
        break;
      case 'preconstruction':
        updates['budget.preConstructionCosts'] = newBudgetValue;
        if (budget.preConstruction) {
          updates['budget.preConstruction.total'] = newBudgetValue;
        }
        break;
      case 'indirect':
        updates['budget.indirectCosts'] = newBudgetValue;
        if (budget.indirect) {
          updates['budget.indirect.total'] = newBudgetValue;
        }
        break;
      case 'contingency':
        updates['budget.contingencyReserve'] = newBudgetValue;
        if (budget.contingency) {
          updates['budget.contingency.total'] = newBudgetValue;
        }
        if (budget.contingency !== undefined && typeof budget.contingency === 'number') {
          updates['budget.contingency'] = newBudgetValue;
        }
        break;
    }

    // Update total budget (increase/decrease total by adjustment amount)
    const currentTotal = getBudgetTotal(budget);
    const adjustmentAmount = adjustment.adjustmentType === 'increase' 
      ? adjustment.adjustmentAmount 
      : -adjustment.adjustmentAmount;
    const newTotal = currentTotal + adjustmentAmount;
    
    // Update total in budget structure
    if (budget.total !== undefined) {
      updates['budget.total'] = newTotal;
    }

    await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId) },
      { $set: updates }
    );
  } else {
    // Legacy budget structure
    console.warn('Budget adjustment on legacy budget structure - may need manual adjustment');
    throw new Error('Budget adjustments require enhanced budget structure. Please upgrade project budget first.');
  }

  // Mark adjustment as completed
  await db.collection('budget_adjustments').updateOne(
    { _id: new ObjectId(adjustment._id) },
    {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );

  return await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
  });
}

/**
 * Get budget adjustment history for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Array of adjustment records
 */
export async function getBudgetAdjustmentHistory(projectId) {
  const db = await getDatabase();
  
  const adjustments = await db.collection('budget_adjustments').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).sort({ createdAt: -1 }).toArray();

  return adjustments;
}

/**
 * Get budget adjustment summary (pending, approved, rejected counts)
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Adjustment summary
 */
export async function getBudgetAdjustmentSummary(projectId) {
  const db = await getDatabase();
  
  const summary = await db.collection('budget_adjustments').aggregate([
    {
      $match: {
        projectId: new ObjectId(projectId),
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalIncrease: {
          $sum: {
            $cond: [{ $eq: ['$adjustmentType', 'increase'] }, '$adjustmentAmount', 0]
          }
        },
        totalDecrease: {
          $sum: {
            $cond: [{ $eq: ['$adjustmentType', 'decrease'] }, '$adjustmentAmount', 0]
          }
        },
      },
    },
  ]).toArray();

  const result = {
    pending: { count: 0, totalIncrease: 0, totalDecrease: 0 },
    approved: { count: 0, totalIncrease: 0, totalDecrease: 0 },
    rejected: { count: 0, totalIncrease: 0, totalDecrease: 0 },
    completed: { count: 0, totalIncrease: 0, totalDecrease: 0 },
  };

  summary.forEach(item => {
    if (result[item._id]) {
      result[item._id].count = item.count;
      result[item._id].totalIncrease = item.totalIncrease;
      result[item._id].totalDecrease = item.totalDecrease;
    }
  });

  return result;
}
