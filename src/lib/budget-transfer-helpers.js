/**
 * Budget Transfer Helpers
 * Functions for managing budget transfers between cost categories
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import {
  getPreConstructionBudget,
  getPreConstructionSpending,
  calculateDCCSpending,
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
 * Get available budget for a cost category
 * @param {string} projectId - Project ID
 * @param {string} category - Cost category ('dcc', 'preconstruction', 'indirect', 'contingency')
 * @returns {Promise<Object>} { budgeted: number, spent: number, remaining: number, allocated: number }
 */
export async function getCategoryBudget(projectId, category) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    deletedAt: null,
  });

  if (!project || !project.budget) {
    return {
      budgeted: 0,
      spent: 0,
      remaining: 0,
      allocated: 0,
    };
  }

  const budget = project.budget;

  switch (category) {
    case 'dcc': {
      let dccBudget = 0;
      if (isEnhancedBudget(budget)) {
        dccBudget = budget.directConstructionCosts || 0;
      } else {
        const totalBudget = getBudgetTotal(budget);
        const estimatedPreConstruction = totalBudget * 0.05;
        const estimatedIndirect = totalBudget * 0.05;
        const estimatedContingency = budget.contingency || (totalBudget * 0.05);
        dccBudget = Math.max(0, totalBudget - estimatedPreConstruction - estimatedIndirect - estimatedContingency);
      }
      
      // Get allocated to phases
      const allocatedToPhases = await calculateTotalPhaseBudgets(projectId);
      
      // Use comprehensive DCC spending calculation
      const dccSpending = await calculateDCCSpending(projectId);
      
      return {
        budgeted: dccBudget,
        spent: dccSpending.total,
        remaining: Math.max(0, dccBudget - dccSpending.total),
        allocated: allocatedToPhases,
        breakdown: dccSpending.breakdown,
      };
    }

    case 'preconstruction': {
      const budgeted = await getPreConstructionBudget(projectId);
      const spending = await getPreConstructionSpending(projectId);
      return {
        budgeted,
        spent: spending.total || 0,
        remaining: Math.max(0, budgeted - (spending.total || 0)),
        allocated: 0, // Preconstruction not allocated to phases
      };
    }

    case 'indirect': {
      const budgeted = await getIndirectCostsBudget(projectId);
      const spent = await calculateIndirectCostsSpending(projectId);
      return {
        budgeted,
        spent,
        remaining: Math.max(0, budgeted - spent),
        allocated: 0, // Indirect costs not allocated to phases
      };
    }

    case 'contingency': {
      const budgeted = await getContingencyReserveBudget(projectId);
      const used = await calculateContingencyUsage(projectId);
      return {
        budgeted,
        spent: used,
        remaining: Math.max(0, budgeted - used),
        allocated: 0, // Contingency not allocated
      };
    }

    default:
      return {
        budgeted: 0,
        spent: 0,
        remaining: 0,
        allocated: 0,
      };
  }
}

/**
 * Validate budget transfer
 * @param {string} projectId - Project ID
 * @param {string} fromCategory - Source category ('dcc', 'preconstruction', 'indirect', 'contingency')
 * @param {string} toCategory - Target category ('dcc', 'preconstruction', 'indirect', 'contingency')
 * @param {number} amount - Transfer amount
 * @returns {Promise<Object>} { isValid: boolean, fromAvailable: number, message: string }
 */
export async function validateBudgetTransfer(projectId, fromCategory, toCategory, amount) {
  if (!projectId || !ObjectId.isValid(projectId)) {
    return {
      isValid: false,
      fromAvailable: 0,
      message: 'Invalid project ID',
    };
  }

  if (fromCategory === toCategory) {
    return {
      isValid: false,
      fromAvailable: 0,
      message: 'Cannot transfer budget to the same category',
    };
  }

  if (!amount || amount <= 0) {
    return {
      isValid: false,
      fromAvailable: 0,
      message: 'Transfer amount must be greater than 0',
    };
  }

  const validCategories = ['dcc', 'preconstruction', 'indirect', 'contingency'];
  if (!validCategories.includes(fromCategory) || !validCategories.includes(toCategory)) {
    return {
      isValid: false,
      fromAvailable: 0,
      message: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
    };
  }

  // Get available budget from source category
  const fromBudget = await getCategoryBudget(projectId, fromCategory);
  const fromAvailable = fromBudget.remaining;

  // Check if transfer amount exceeds available budget
  if (amount > fromAvailable) {
    return {
      isValid: false,
      fromAvailable,
      message: `Insufficient budget in ${fromCategory}. Available: ${fromAvailable.toLocaleString()} KES, Requested: ${amount.toLocaleString()} KES, Shortfall: ${(amount - fromAvailable).toLocaleString()} KES.`,
    };
  }

  // Special validation: Cannot transfer from contingency if it's already used
  if (fromCategory === 'contingency' && fromBudget.spent > 0) {
    return {
      isValid: false,
      fromAvailable,
      message: 'Cannot transfer from contingency reserve that has already been used. Contingency can only be transferred before any draws are made.',
    };
  }

  // Special validation: Cannot transfer to contingency (contingency is reserve, not transferable to)
  if (toCategory === 'contingency') {
    return {
      isValid: false,
      fromAvailable,
      message: 'Cannot transfer budget to contingency reserve. Contingency is a reserve fund, not a transfer destination.',
    };
  }

  return {
    isValid: true,
    fromAvailable,
    message: 'Budget transfer validation passed',
  };
}

/**
 * Create a budget transfer request
 * @param {Object} transferData - Transfer data
 * @param {string} projectId - Project ID
 * @param {string} requestedBy - User ID who requested the transfer
 * @returns {Promise<Object>} Created transfer record
 */
export async function createBudgetTransfer(transferData, projectId, requestedBy) {
  const db = await getDatabase();
  
  const {
    fromCategory,
    toCategory,
    amount,
    reason,
  } = transferData;

  const transfer = {
    projectId: new ObjectId(projectId),
    fromCategory,
    toCategory,
    amount: parseFloat(amount) || 0,
    reason: reason?.trim() || '',
    requestedBy: new ObjectId(requestedBy),
    approvedBy: null,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const result = await db.collection('budget_transfers').insertOne(transfer);
  return { ...transfer, _id: result.insertedId };
}

/**
 * Update budget transfer status
 * @param {string} transferId - Transfer ID
 * @param {string} status - New status (approved, rejected)
 * @param {string} approvedBy - User ID who approved/rejected
 * @param {string} [notes] - Optional approval/rejection notes
 * @returns {Promise<Object>} Updated transfer record
 */
export async function updateBudgetTransferStatus(transferId, status, approvedBy, notes = null) {
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

  const result = await db.collection('budget_transfers').findOneAndUpdate(
    { _id: new ObjectId(transferId) },
    { $set: updateData },
    { returnDocument: 'after' }
  );

  return result.value;
}

/**
 * Execute approved budget transfer (update project budget)
 * @param {string} projectId - Project ID
 * @param {Object} transfer - Transfer record
 * @returns {Promise<Object>} Updated project budget
 */
export async function executeBudgetTransfer(projectId, transfer) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    deletedAt: null,
  });

  if (!project || !project.budget) {
    throw new Error('Project or budget not found');
  }

  const budget = project.budget;
  const amount = transfer.amount;

  // Update budget based on transfer
  if (isEnhancedBudget(budget)) {
    // Enhanced budget structure
    // Calculate new values first, then update atomically
    const updates = {};
    
    // Get current values
    const currentDCC = budget.directConstructionCosts || 0;
    const currentPreConstruction = budget.preConstructionCosts || 0;
    const currentIndirect = budget.indirectCosts || 0;
    const currentContingency = budget.contingencyReserve || (budget.contingency?.total || 0);

    // Calculate new values after transfer
    let newDCC = currentDCC;
    let newPreConstruction = currentPreConstruction;
    let newIndirect = currentIndirect;
    let newContingency = currentContingency;

    // Decrease from source category
    switch (transfer.fromCategory) {
      case 'dcc':
        newDCC = Math.max(0, currentDCC - amount);
        break;
      case 'preconstruction':
        newPreConstruction = Math.max(0, currentPreConstruction - amount);
        break;
      case 'indirect':
        newIndirect = Math.max(0, currentIndirect - amount);
        break;
      case 'contingency':
        newContingency = Math.max(0, currentContingency - amount);
        break;
    }

    // Increase to target category
    switch (transfer.toCategory) {
      case 'dcc':
        newDCC = newDCC + amount;
        break;
      case 'preconstruction':
        newPreConstruction = newPreConstruction + amount;
        break;
      case 'indirect':
        newIndirect = newIndirect + amount;
        break;
    }

    // Set updates
    updates['budget.directConstructionCosts'] = newDCC;
    updates['budget.preConstructionCosts'] = newPreConstruction;
    updates['budget.indirectCosts'] = newIndirect;
    updates['budget.contingencyReserve'] = newContingency;

    // Update breakdown totals if they exist
    if (budget.preConstruction) {
      updates['budget.preConstruction.total'] = newPreConstruction;
    }
    if (budget.indirect) {
      updates['budget.indirect.total'] = newIndirect;
    }
    if (budget.contingency) {
      updates['budget.contingency.total'] = newContingency;
    }

    // Update legacy fields for backward compatibility
    if (budget.materials !== undefined) {
      // Maintain proportional relationship with DCC
      const materialsRatio = budget.directCosts?.materials?.total / (currentDCC || 1) || 0;
      updates['budget.materials'] = newDCC * materialsRatio;
    }
    if (budget.labour !== undefined) {
      const labourRatio = budget.directCosts?.labour?.total / (currentDCC || 1) || 0;
      updates['budget.labour'] = newDCC * labourRatio;
    }
    if (budget.contingency !== undefined && typeof budget.contingency === 'number') {
      updates['budget.contingency'] = newContingency;
    }

    // Update total budget (should remain the same - just reallocated)
    // Note: Total doesn't change, just internal allocation

    await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId) },
      { $set: updates }
    );
  } else {
    // Legacy budget structure - estimate adjustments
    // For legacy, we'll need to estimate the impact
    console.warn('Budget transfer on legacy budget structure - may need manual adjustment');
    // Legacy budgets don't have separate categories, so we can't transfer accurately
    throw new Error('Budget transfers require enhanced budget structure. Please upgrade project budget first.');
  }

  // Mark transfer as completed
  await db.collection('budget_transfers').updateOne(
    { _id: new ObjectId(transfer._id) },
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
 * Get budget transfer history for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Array of transfer records
 */
export async function getBudgetTransferHistory(projectId) {
  const db = await getDatabase();
  
  const transfers = await db.collection('budget_transfers').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).sort({ createdAt: -1 }).toArray();

  return transfers;
}

/**
 * Get budget transfer summary (pending, approved, rejected counts)
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Transfer summary
 */
export async function getBudgetTransferSummary(projectId) {
  const db = await getDatabase();
  
  const summary = await db.collection('budget_transfers').aggregate([
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
        totalAmount: { $sum: '$amount' },
      },
    },
  ]).toArray();

  const result = {
    pending: { count: 0, totalAmount: 0 },
    approved: { count: 0, totalAmount: 0 },
    rejected: { count: 0, totalAmount: 0 },
    completed: { count: 0, totalAmount: 0 },
  };

  summary.forEach(item => {
    if (result[item._id]) {
      result[item._id].count = item.count;
      result[item._id].totalAmount = item.totalAmount;
    }
  });

  return result;
}
