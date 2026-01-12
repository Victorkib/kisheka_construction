/**
 * Labour Financial Helpers
 * 
 * CRITICAL: Financial integrity functions for labour system
 * Handles budget validation, atomic updates, and recalculation
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';
import {
  generateLabourBudgetAlerts,
  sendLabourBudgetAlertsToUsers,
} from './labour-budget-alerts';

/**
 * Validate if labour cost fits within phase labour budget
 * @param {string} phaseId - Phase ID
 * @param {number} labourCost - Labour cost to validate
 * @param {string} [excludeBatchId] - Optional: Batch ID to exclude from calculation (for updates)
 * @returns {Promise<Object>} { isValid: boolean, available: number, required: number, shortfall: number, message: string }
 */
export async function validatePhaseLabourBudget(phaseId, labourCost, excludeBatchId = null) {
  const db = await getDatabase();

  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return {
      isValid: false,
      available: 0,
      required: labourCost || 0,
      shortfall: labourCost || 0,
      message: 'Invalid phase ID',
    };
  }

  if (!labourCost || labourCost <= 0) {
    // No cost provided - allow but warn
    return {
      isValid: true,
      available: 0,
      required: 0,
      shortfall: 0,
      message: 'No labour cost provided. Budget validation will occur when batch is approved.',
    };
  }

  // Get phase with budget allocation
  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null,
  });

  if (!phase) {
    return {
      isValid: false,
      available: 0,
      required: labourCost,
      shortfall: labourCost,
      message: 'Phase not found',
    };
  }

  // Get labour budget allocation for this phase
  const labourBudget = phase.budgetAllocation?.labour || 0;

  // Calculate current labour spending (actual + committed)
  const actualLabourSpending = phase.actualSpending?.labour || 0;

  // Calculate committed labour costs (from approved batches not yet paid)
  const committedBatches = await db.collection('labour_batches').find({
    phaseId: new ObjectId(phaseId),
    status: { $in: ['approved'] },
    deletedAt: null,
    ...(excludeBatchId ? { _id: { $ne: new ObjectId(excludeBatchId) } } : {}),
  }).toArray();

  let committedLabourCost = 0;
  for (const batch of committedBatches) {
    // Recalculate batch cost from entries to ensure accuracy
    if (batch.labourEntryIds && batch.labourEntryIds.length > 0) {
      const entries = await db.collection('labour_entries').find({
        _id: { $in: batch.labourEntryIds.map(id => new ObjectId(id)) },
        deletedAt: null,
      }).toArray();

      const batchCost = entries.reduce((sum, entry) => sum + (entry.totalCost || 0), 0);
      committedLabourCost += batchCost;
    } else {
      // Fallback to batch totalCost if entries not yet linked
      committedLabourCost += batch.totalCost || 0;
    }
  }

  // Calculate available budget
  const totalSpent = actualLabourSpending + committedLabourCost;
  const available = Math.max(0, labourBudget - totalSpent);
  const required = labourCost;
  const shortfall = Math.max(0, required - available);

  // Allow 5% tolerance for rounding
  const tolerance = labourBudget * 0.05;
  const isValid = shortfall <= tolerance;

  return {
    isValid,
    available,
    required,
    shortfall,
    message: isValid
      ? `Labour cost is within budget. Available: ${available.toLocaleString()} KES`
      : `Insufficient phase labour budget. Available: ${available.toLocaleString()} KES, Required: ${required.toLocaleString()} KES, Shortfall: ${shortfall.toLocaleString()} KES`,
    budget: labourBudget,
    currentSpending: actualLabourSpending,
    committed: committedLabourCost,
    totalSpent,
  };
}

/**
 * Validate if labour cost fits within project budget
 * @param {string} projectId - Project ID
 * @param {number} labourCost - Labour cost to validate
 * @returns {Promise<Object>} { isValid: boolean, available: number, required: number, shortfall: number, message: string }
 */
export async function validateProjectLabourBudget(projectId, labourCost) {
  const db = await getDatabase();

  if (!projectId || !ObjectId.isValid(projectId)) {
    return {
      isValid: false,
      available: 0,
      required: labourCost || 0,
      shortfall: labourCost || 0,
      message: 'Invalid project ID',
    };
  }

  if (!labourCost || labourCost <= 0) {
    return {
      isValid: true,
      available: 0,
      required: 0,
      shortfall: 0,
      message: 'No labour cost provided',
    };
  }

  // Get project with budget
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    deletedAt: null,
  });

  if (!project) {
    return {
      isValid: false,
      available: 0,
      required: labourCost,
      shortfall: labourCost,
      message: 'Project not found',
    };
  }

  // Get labour budget from project
  const labourBudget = project.budget?.directCosts?.labour?.total || project.budget?.labour || 0;

  // Get current project spending
  const currentSpent = project.budget?.spent || 0;

  // Calculate available budget (simplified - actual calculation should consider all cost types)
  // For now, we'll use a conservative estimate
  const available = Math.max(0, labourBudget - (currentSpent * 0.3)); // Assume 30% of spending is labour
  const required = labourCost;
  const shortfall = Math.max(0, required - available);

  // Allow 5% tolerance
  const tolerance = labourBudget * 0.05;
  const isValid = shortfall <= tolerance;

  return {
    isValid,
    available,
    required,
    shortfall,
    message: isValid
      ? `Labour cost is within project budget`
      : `Insufficient project labour budget. Available: ${available.toLocaleString()} KES, Required: ${required.toLocaleString()} KES`,
    budget: labourBudget,
    currentSpent,
  };
}

/**
 * Update phase labour spending (atomic)
 * @param {string} phaseId - Phase ID
 * @param {number} labourCost - Labour cost to add/subtract
 * @param {string} operation - 'add' | 'subtract'
 * @param {Object} [session] - MongoDB session for transaction
 * @returns {Promise<Object>} Updated phase
 */
export async function updatePhaseLabourSpending(phaseId, labourCost, operation = 'add', session = null) {
  const db = await getDatabase();

  if (!phaseId || !ObjectId.isValid(phaseId)) {
    throw new Error('Invalid phase ID');
  }

  const amount = operation === 'add' ? labourCost : -labourCost;

  const updateOptions = session ? { session } : {};

  const updatedPhase = await db.collection('phases').findOneAndUpdate(
    { _id: new ObjectId(phaseId) },
    {
      $inc: {
        'actualSpending.labour': amount,
        'actualSpending.total': amount,
        'financialStates.actual': amount,
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

  if (!updatedPhase) {
    throw new Error('Phase not found');
  }

  // Recalculate remaining budget
  const phase = updatedPhase;
  const labourBudget = phase.budgetAllocation?.labour || 0;
  const actualLabourSpending = phase.actualSpending?.labour || 0;
  const committedCost = phase.financialStates?.committed || 0;

  await db.collection('phases').updateOne(
    { _id: new ObjectId(phaseId) },
    {
      $set: {
        'financialStates.remaining': Math.max(0, labourBudget - actualLabourSpending - committedCost),
      },
    },
    updateOptions
  );

  // Check budget alerts after update (async, non-blocking)
  // Only check if operation is 'add' (spending increased)
  if (operation === 'add' && !session) {
    // Run asynchronously to not block the transaction
    setImmediate(async () => {
      try {
        const alertResult = await generateLabourBudgetAlerts(null, phaseId);
        if (alertResult.hasAlert && alertResult.alerts.length > 0) {
          // Get project ID from phase
          const phaseDoc = await db.collection('phases').findOne({
            _id: new ObjectId(phaseId),
          });
          if (phaseDoc?.projectId) {
            await sendLabourBudgetAlertsToUsers(
              phaseDoc.projectId.toString(),
              alertResult.alerts
            );
          }
        }
      } catch (error) {
        console.error('Error checking budget alerts after update:', error);
        // Don't throw - alerts are non-critical
      }
    });
  }

  return updatedPhase;
}

/**
 * Update project labour spending (atomic)
 * @param {string} projectId - Project ID
 * @param {number} labourCost - Labour cost to add/subtract
 * @param {string} operation - 'add' | 'subtract'
 * @param {Object} [session] - MongoDB session for transaction
 * @returns {Promise<Object>} Updated project
 */
export async function updateProjectLabourSpending(projectId, labourCost, operation = 'add', session = null) {
  const db = await getDatabase();

  if (!projectId || !ObjectId.isValid(projectId)) {
    throw new Error('Invalid project ID');
  }

  const amount = operation === 'add' ? labourCost : -labourCost;

  const updateOptions = session ? { session } : {};

  const updatedProject = await db.collection('projects').findOneAndUpdate(
    { _id: new ObjectId(projectId) },
    {
      $inc: {
        'budget.spent': amount,
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

  if (!updatedProject) {
    throw new Error('Project not found');
  }

  // Check budget alerts after update (async, non-blocking)
  // Only check if operation is 'add' (spending increased)
  if (operation === 'add' && !session) {
    // Run asynchronously to not block the transaction
    setImmediate(async () => {
      try {
        const alertResult = await generateLabourBudgetAlerts(projectId);
        if (alertResult.hasAlert && alertResult.alerts.length > 0) {
          await sendLabourBudgetAlertsToUsers(projectId, alertResult.alerts);
        }
      } catch (error) {
        console.error('Error checking budget alerts after update:', error);
        // Don't throw - alerts are non-critical
      }
    });
  }

  return updatedProject;
}

/**
 * Recalculate phase labour spending from all approved entries
 * @param {string} phaseId - Phase ID
 * @returns {Promise<number>} Total labour spending
 */
export async function recalculatePhaseLabourSpending(phaseId) {
  const db = await getDatabase();

  if (!phaseId || !ObjectId.isValid(phaseId)) {
    throw new Error('Invalid phase ID');
  }

  // Get all approved labour entries for this phase
  const labourSpending = await db.collection('labour_entries').aggregate([
    {
      $match: {
        phaseId: new ObjectId(phaseId),
        status: { $in: ['approved', 'paid'] },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalCost' },
        totalHours: { $sum: '$totalHours' },
        entryCount: { $sum: 1 },
      },
    },
  ]).toArray();

  const totalLabourSpending = labourSpending[0]?.total || 0;

  // Update phase actual spending
  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
  });

  if (phase) {
    const currentLabourSpending = phase.actualSpending?.labour || 0;
    const difference = totalLabourSpending - currentLabourSpending;

    if (Math.abs(difference) > 0.01) {
      // Only update if there's a significant difference (to avoid unnecessary updates)
      await updatePhaseLabourSpending(phaseId, difference, difference > 0 ? 'add' : 'subtract');
    }
  }

  return totalLabourSpending;
}

/**
 * Calculate labour cost summary for a project/phase
 * @param {string} projectId - Project ID
 * @param {string} [phaseId] - Optional phase ID
 * @param {Date} [periodStart] - Optional period start date
 * @param {Date} [periodEnd] - Optional period end date
 * @returns {Promise<Object>} Labour cost summary
 */
export async function calculateLabourCostSummary(projectId, phaseId = null, periodStart = null, periodEnd = null) {
  const db = await getDatabase();

  const matchCriteria = {
    projectId: new ObjectId(projectId),
    status: { $in: ['approved', 'paid'] },
    deletedAt: null,
  };

  if (phaseId) {
    matchCriteria.phaseId = new ObjectId(phaseId);
  }

  if (periodStart || periodEnd) {
    matchCriteria.entryDate = {};
    if (periodStart) {
      matchCriteria.entryDate.$gte = new Date(periodStart);
    }
    if (periodEnd) {
      matchCriteria.entryDate.$lte = new Date(periodEnd);
    }
  }

  // Aggregate by worker role
  const summary = await db.collection('labour_entries').aggregate([
    {
      $match: matchCriteria,
    },
    {
      $group: {
        _id: '$workerRole',
        totalHours: { $sum: '$totalHours' },
        totalCost: { $sum: '$totalCost' },
        entryCount: { $sum: 1 },
      },
    },
  ]).toArray();

  // Calculate totals
  const totals = summary.reduce(
    (acc, item) => ({
      hours: acc.hours + item.totalHours,
      cost: acc.cost + item.totalCost,
      entries: acc.entries + item.entryCount,
    }),
    { hours: 0, cost: 0, entries: 0 }
  );

  // Organize by role
  const byRole = {
    skilled: summary.find((s) => s._id === 'skilled') || { totalHours: 0, totalCost: 0, entryCount: 0 },
    unskilled: summary.find((s) => s._id === 'unskilled') || { totalHours: 0, totalCost: 0, entryCount: 0 },
    supervisory: summary.find((s) => s._id === 'supervisory') || { totalHours: 0, totalCost: 0, entryCount: 0 },
    professional: summary.find((s) => s._id === 'professional') || { totalHours: 0, totalCost: 0, entryCount: 0 },
  };

  return {
    total: {
      hours: totals.hours,
      cost: totals.cost,
      entries: totals.entries,
    },
    byRole: {
      skilled: {
        hours: byRole.skilled.totalHours,
        cost: byRole.skilled.totalCost,
        entries: byRole.skilled.entryCount,
      },
      unskilled: {
        hours: byRole.unskilled.totalHours,
        cost: byRole.unskilled.totalCost,
        entries: byRole.unskilled.entryCount,
      },
      supervisory: {
        hours: byRole.supervisory.totalHours,
        cost: byRole.supervisory.totalCost,
        entries: byRole.supervisory.entryCount,
      },
      professional: {
        hours: byRole.professional.totalHours,
        cost: byRole.professional.totalCost,
        entries: byRole.professional.entryCount,
      },
    },
    period: {
      start: periodStart,
      end: periodEnd,
    },
  };
}

/**
 * Update labour cost summary (create or update summary record)
 * Enhanced with direct/subcontractor separation and skill type breakdown
 * @param {string} projectId - Project ID
 * @param {string} [phaseId] - Optional phase ID
 * @param {string} periodType - 'daily' | 'weekly' | 'monthly' | 'project_total' | 'phase_total'
 * @param {Date} periodStart - Period start date
 * @param {Date} periodEnd - Period end date
 * @returns {Promise<Object>} Updated summary
 */
export async function updateLabourCostSummary(projectId, phaseId = null, periodType = 'project_total', periodStart = null, periodEnd = null) {
  const db = await getDatabase();

  const summary = await calculateLabourCostSummary(projectId, phaseId, periodStart, periodEnd);

  const matchCriteria = {
    projectId: new ObjectId(projectId),
    status: { $in: ['approved', 'paid'] },
    deletedAt: null,
  };

  if (phaseId) {
    matchCriteria.phaseId = new ObjectId(phaseId);
  }

  if (periodStart || periodEnd) {
    matchCriteria.entryDate = {};
    if (periodStart) {
      matchCriteria.entryDate.$gte = new Date(periodStart);
    }
    if (periodEnd) {
      matchCriteria.entryDate.$lte = new Date(periodEnd);
    }
  }

  // Get direct vs subcontractor breakdown
  const directSummary = await db.collection('labour_entries').aggregate([
    { $match: { ...matchCriteria, subcontractorId: null } },
    {
      $group: {
        _id: null,
        hours: { $sum: '$totalHours' },
        cost: { $sum: '$totalCost' },
        entries: { $sum: 1 },
      },
    },
  ]).toArray();

  const subcontractorSummary = await db.collection('labour_entries').aggregate([
    { $match: { ...matchCriteria, subcontractorId: { $ne: null } } },
    {
      $group: {
        _id: null,
        hours: { $sum: '$totalHours' },
        cost: { $sum: '$totalCost' },
        entries: { $sum: 1 },
        uniqueSubcontractors: { $addToSet: '$subcontractorId' },
      },
    },
  ]).toArray();

  // Get breakdown by skill type
  const bySkillType = await db.collection('labour_entries').aggregate([
    { $match: matchCriteria },
    {
      $group: {
        _id: '$skillType',
        hours: { $sum: '$totalHours' },
        cost: { $sum: '$totalCost' },
        entries: { $sum: 1 },
      },
    },
    { $sort: { cost: -1 } },
  ]).toArray();

  // Calculate unique workers (by workerName since workerId may be null)
  const uniqueWorkersResult = await db.collection('labour_entries').aggregate([
    { $match: matchCriteria },
    {
      $group: {
        _id: '$workerName',
      },
    },
  ]).toArray();

  // Calculate average workers per day
  const dailyWorkerCounts = await db.collection('labour_entries').aggregate([
    { $match: matchCriteria },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$entryDate' },
        },
        uniqueWorkers: { $addToSet: '$workerName' },
      },
    },
  ]).toArray();

  const totalDays = dailyWorkerCounts.length || 1;
  const totalWorkerDays = dailyWorkerCounts.reduce((sum, day) => sum + (day.uniqueWorkers?.length || 0), 0);
  const averageWorkersPerDay = totalWorkerDays / totalDays;

  const direct = directSummary[0] || { hours: 0, cost: 0, entries: 0 };
  const subcontractor = subcontractorSummary[0] || { hours: 0, cost: 0, entries: 0, uniqueSubcontractors: [] };

  const summaryData = {
    projectId: new ObjectId(projectId),
    phaseId: phaseId ? new ObjectId(phaseId) : null,
    floorId: null,
    categoryId: null,
    periodType,
    periodStart: periodStart || new Date(0),
    periodEnd: periodEnd || new Date(),
    costs: {
      skilled: {
        hours: summary.byRole.skilled.hours,
        cost: summary.byRole.skilled.cost,
        entries: summary.byRole.skilled.entries,
      },
      unskilled: {
        hours: summary.byRole.unskilled.hours,
        cost: summary.byRole.unskilled.cost,
        entries: summary.byRole.unskilled.entries,
      },
      supervisory: {
        hours: summary.byRole.supervisory.hours,
        cost: summary.byRole.supervisory.cost,
        entries: summary.byRole.supervisory.entries,
      },
      specialized: {
        hours: summary.byRole.professional.hours,
        cost: summary.byRole.professional.cost,
        entries: summary.byRole.professional.entries,
      },
      total: {
        hours: summary.total.hours,
        cost: summary.total.cost,
        entries: summary.total.entries,
      },
    },
    direct: {
      hours: direct.hours,
      cost: direct.cost,
      entries: direct.entries,
    },
    subcontractor: {
      hours: subcontractor.hours,
      cost: subcontractor.cost,
      entries: subcontractor.entries,
      subcontractorCount: subcontractor.uniqueSubcontractors?.length || 0,
    },
    bySkillType: bySkillType.reduce((acc, item) => {
      acc[item._id || 'unknown'] = {
        hours: item.hours,
        cost: item.cost,
        entries: item.entries,
      };
      return acc;
    }, {}),
    uniqueWorkers: uniqueWorkersResult.length,
    averageWorkersPerDay: Math.round(averageWorkersPerDay * 10) / 10,
    totalEntries: summary.total.entries,
    calculatedAt: new Date(),
    updatedAt: new Date(),
  };

  // Upsert summary
  await db.collection('labour_cost_summaries').updateOne(
    {
      projectId: new ObjectId(projectId),
      phaseId: phaseId ? new ObjectId(phaseId) : null,
      periodType,
      periodStart: periodStart || new Date(0),
      periodEnd: periodEnd || new Date(),
    },
    {
      $set: summaryData,
    },
    {
      upsert: true,
    }
  );

  return summaryData;
}

export default {
  validatePhaseLabourBudget,
  validateProjectLabourBudget,
  updatePhaseLabourSpending,
  updateProjectLabourSpending,
  recalculatePhaseLabourSpending,
  calculateLabourCostSummary,
  updateLabourCostSummary,
};

