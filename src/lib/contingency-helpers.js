/**
 * Contingency Helpers
 * Functions for tracking and managing contingency reserve usage
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { isEnhancedBudget, getBudgetTotal, getContingencyBudget } from '@/lib/schemas/budget-schema';

/**
 * Get contingency budget for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Contingency budget
 */
export async function getContingencyReserveBudget(projectId) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId)
  });
  
  if (!project || !project.budget) {
    return 0;
  }
  
  return getContingencyBudget(project.budget);
}

/**
 * Calculate total contingency usage for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Total contingency used
 */
export async function calculateContingencyUsage(projectId) {
  const db = await getDatabase();
  
  const result = await db.collection('contingency_draws').aggregate([
    {
      $match: {
        projectId: new ObjectId(projectId),
        deletedAt: null,
        status: { $in: ['approved', 'completed'] }
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
 * Calculate contingency usage by type
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Breakdown by type
 */
export async function calculateContingencyUsageByType(projectId) {
  const db = await getDatabase();
  
  const result = await db.collection('contingency_draws').aggregate([
    {
      $match: {
        projectId: new ObjectId(projectId),
        deletedAt: null,
        status: { $in: ['approved', 'completed'] }
      }
    },
    {
      $group: {
        _id: '$drawType',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]).toArray();
  
  // Initialize all types to 0
  const byType = {
    design: 0,
    construction: 0,
    owners_reserve: 0
  };
  
  // Fill in actual values
  result.forEach(item => {
    const type = item._id;
    if (type === 'design' || type === 'construction' || type === 'owners_reserve') {
      byType[type] = item.total;
    }
  });
  
  return byType;
}

/**
 * Get complete contingency summary for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Complete contingency summary
 */
export async function getContingencySummary(projectId) {
  const budget = await getContingencyReserveBudget(projectId);
  const used = await calculateContingencyUsage(projectId);
  const byType = await calculateContingencyUsageByType(projectId);
  const remaining = Math.max(0, budget - used);
  
  return {
    budgeted: budget,
    used,
    remaining,
    byType
  };
}

/**
 * Validate if contingency draw fits within budget
 * @param {string} projectId - Project ID
 * @param {number} amount - Draw amount to validate
 * @param {string} [drawType] - Optional: draw type (design, construction, owners_reserve)
 * @returns {Promise<Object>} { isValid: boolean, available: number, required: number, shortfall: number, message: string }
 */
export async function validateContingencyDraw(projectId, amount, drawType = null) {
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
      message: 'No amount provided',
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

  // Get contingency budget
  const contingencyBudget = await getContingencyReserveBudget(projectId);
  
  if (contingencyBudget <= 0) {
    return {
      isValid: false,
      available: 0,
      required: amount,
      shortfall: amount,
      message: 'Contingency reserve not set. Please set a project budget with contingency reserve first.',
    };
  }

  // Get current usage
  const used = await calculateContingencyUsage(projectId);
  const available = Math.max(0, contingencyBudget - used);

  // Check if amount fits within available budget
  if (amount > available) {
    return {
      isValid: false,
      available,
      required: amount,
      shortfall: amount - available,
      message: `Insufficient contingency reserve. Available: ${available.toLocaleString()} KES, Required: ${amount.toLocaleString()} KES, Shortfall: ${(amount - available).toLocaleString()} KES.`,
    };
  }

  // Check if approaching budget limit (80% threshold)
  const usagePercentage = ((used + amount) / contingencyBudget) * 100;
  if (usagePercentage >= 80 && usagePercentage < 100) {
    return {
      isValid: true,
      available,
      required: amount,
      shortfall: 0,
      message: `Warning: Contingency reserve usage will be ${usagePercentage.toFixed(1)}% after this draw.`,
      warning: true,
    };
  }

  return {
    isValid: true,
    available,
    required: amount,
    shortfall: 0,
    message: 'Contingency draw validation passed',
  };
}

/**
 * Create a contingency draw record
 * @param {Object} drawData - Draw data
 * @param {string} projectId - Project ID
 * @param {string} requestedBy - User ID who requested the draw
 * @returns {Promise<Object>} Created draw record
 */
export async function createContingencyDraw(drawData, projectId, requestedBy) {
  const db = await getDatabase();
  
  const {
    drawType,
    amount,
    reason,
    linkedTo,
  } = drawData;

  const draw = {
    projectId: new ObjectId(projectId),
    drawType: drawType || 'construction',
    amount: parseFloat(amount) || 0,
    reason: reason?.trim() || '',
    linkedTo: linkedTo || null,
    requestedBy: new ObjectId(requestedBy),
    approvedBy: null,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const result = await db.collection('contingency_draws').insertOne(draw);
  return { ...draw, _id: result.insertedId };
}

/**
 * Update contingency draw status
 * @param {string} drawId - Draw ID
 * @param {string} status - New status (approved, rejected, completed)
 * @param {string} approvedBy - User ID who approved/rejected
 * @param {string} [notes] - Optional approval/rejection notes
 * @returns {Promise<Object>} Updated draw record
 */
export async function updateContingencyDrawStatus(drawId, status, approvedBy, notes = null) {
  const db = await getDatabase();
  
  const updateData = {
    status,
    approvedBy: new ObjectId(approvedBy),
    approvalNotes: notes?.trim() || null,
    updatedAt: new Date(),
  };

  if (status === 'completed') {
    updateData.completedAt = new Date();
  }

  const result = await db.collection('contingency_draws').findOneAndUpdate(
    { _id: new ObjectId(drawId) },
    { $set: updateData },
    { returnDocument: 'after' }
  );

  return result.value;
}
