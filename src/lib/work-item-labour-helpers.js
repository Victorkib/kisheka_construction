/**
 * Work Item Labour Helper Functions
 * Handles updating work items when labour entries are approved/rejected
 */

import { getDatabase } from './mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Recalculate work item actual hours and cost from all approved labour entries
 * @param {string} workItemId - Work item ID
 * @param {Object} [session] - MongoDB session for transaction
 * @returns {Promise<Object>} Updated work item with recalculated values
 */
export async function recalculateWorkItemLabour(workItemId, session = null) {
  const db = await getDatabase();

  if (!workItemId || !ObjectId.isValid(workItemId)) {
    throw new Error('Invalid work item ID');
  }

  // Get all approved labour entries for this work item
  const labourEntries = await db.collection('labour_entries').aggregate(
    [
      {
        $match: {
          workItemId: new ObjectId(workItemId),
          status: { $in: ['approved', 'paid'] },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$totalHours' },
          totalCost: { $sum: '$totalCost' },
          entryCount: { $sum: 1 },
        },
      },
    ],
    session ? { session } : {}
  ).toArray();

  const summary = labourEntries[0] || {
    totalHours: 0,
    totalCost: 0,
    entryCount: 0,
  };

  // Update work item
  const updateOptions = session ? { session } : {};

  const updatedWorkItem = await db.collection('work_items').findOneAndUpdate(
    { _id: new ObjectId(workItemId) },
    {
      $set: {
        actualHours: summary.totalHours,
        actualCost: summary.totalCost,
        updatedAt: new Date(),
      },
    },
    {
      ...updateOptions,
      returnDocument: 'after',
    }
  );

  if (!updatedWorkItem) {
    throw new Error('Work item not found');
  }

  return {
    workItem: updatedWorkItem,
    labourSummary: {
      totalHours: summary.totalHours,
      totalCost: summary.totalCost,
      entryCount: summary.entryCount,
    },
  };
}

/**
 * Update work item labour totals when a labour entry is approved
 * @param {string} workItemId - Work item ID
 * @param {number} hours - Hours to add
 * @param {number} cost - Cost to add
 * @param {string} operation - 'add' | 'subtract'
 * @param {Object} [session] - MongoDB session for transaction
 * @returns {Promise<Object>} Updated work item
 */
export async function updateWorkItemLabour(
  workItemId,
  hours,
  cost,
  operation = 'add',
  session = null
) {
  const db = await getDatabase();

  if (!workItemId || !ObjectId.isValid(workItemId)) {
    throw new Error('Invalid work item ID');
  }

  const hoursAmount = operation === 'add' ? hours : -hours;
  const costAmount = operation === 'add' ? cost : -cost;

  const updateOptions = session ? { session } : {};

  const updatedWorkItem = await db.collection('work_items').findOneAndUpdate(
    { _id: new ObjectId(workItemId) },
    {
      $inc: {
        actualHours: hoursAmount,
        actualCost: costAmount,
      },
      $set: {
        updatedAt: new Date(),
      },
    },
    {
      ...updateOptions,
      returnDocument: 'after',
    }
  );

  if (!updatedWorkItem) {
    throw new Error('Work item not found');
  }

  return updatedWorkItem;
}

/**
 * Calculate work item completion percentage based on labour
 * @param {Object} workItem - Work item document
 * @returns {number} Completion percentage (0-100)
 */
export function calculateWorkItemCompletionFromLabour(workItem) {
  if (!workItem) {
    return 0;
  }

  const estimatedHours = workItem.estimatedHours || 0;
  const actualHours = workItem.actualHours || 0;

  // If no estimated hours, use cost as fallback
  if (estimatedHours === 0) {
    const estimatedCost = workItem.estimatedCost || 0;
    const actualCost = workItem.actualCost || 0;

    if (estimatedCost === 0) {
      return 0;
    }

    return Math.min(100, Math.max(0, (actualCost / estimatedCost) * 100));
  }

  return Math.min(100, Math.max(0, (actualHours / estimatedHours) * 100));
}

/**
 * Update work item status based on completion
 * @param {string} workItemId - Work item ID
 * @param {Object} [session] - MongoDB session for transaction
 * @returns {Promise<Object>} Updated work item
 */
export async function updateWorkItemStatusFromCompletion(workItemId, session = null) {
  const db = await getDatabase();

  if (!workItemId || !ObjectId.isValid(workItemId)) {
    throw new Error('Invalid work item ID');
  }

  const workItem = await db.collection('work_items').findOne({
    _id: new ObjectId(workItemId),
    deletedAt: null,
  });

  if (!workItem) {
    throw new Error('Work item not found');
  }

  const completionPercentage = calculateWorkItemCompletionFromLabour(workItem);
  let newStatus = workItem.status;

  // Update status based on completion
  if (completionPercentage >= 100 && workItem.status !== 'completed') {
    newStatus = 'completed';
  } else if (completionPercentage > 0 && workItem.status === 'not_started') {
    newStatus = 'in_progress';
  }

  // Only update if status changed
  if (newStatus !== workItem.status) {
    const updateOptions = session ? { session } : {};

    const updatedWorkItem = await db.collection('work_items').findOneAndUpdate(
      { _id: new ObjectId(workItemId) },
      {
        $set: {
          status: newStatus,
          updatedAt: new Date(),
          ...(newStatus === 'completed' && !workItem.actualEndDate
            ? { actualEndDate: new Date() }
            : {}),
        },
      },
      {
        ...updateOptions,
        returnDocument: 'after',
      }
    );

    return updatedWorkItem;
  }

  return workItem;
}

export default {
  recalculateWorkItemLabour,
  updateWorkItemLabour,
  calculateWorkItemCompletionFromLabour,
  updateWorkItemStatusFromCompletion,
};

