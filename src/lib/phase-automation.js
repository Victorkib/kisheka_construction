/**
 * Phase Automation Helper Functions
 * Utilities for phase automation and auto-advancement
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Check if phase can auto-advance
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Object>} { canAdvance: boolean, reason: string }
 */
export async function canPhaseAutoAdvance(phaseId) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return { canAdvance: false, reason: 'Invalid phase ID' };
  }

  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null
  });

  if (!phase) {
    return { canAdvance: false, reason: 'Phase not found' };
  }

  // Check if auto-advance is enabled (if settings exist)
  if (phase.settings && phase.settings.autoAdvanceOnCompletion === false) {
    return { canAdvance: false, reason: 'Auto-advance not enabled for this phase' };
  }

  // Check completion percentage
  if (phase.completionPercentage < 100) {
    return { canAdvance: false, reason: `Phase is only ${phase.completionPercentage}% complete` };
  }

  // Check all work items completed
  const incompleteWorkItems = await db.collection('work_items').countDocuments({
    phaseId: new ObjectId(phaseId),
    deletedAt: null,
    status: { $ne: 'completed' }
  });

  if (incompleteWorkItems > 0) {
    return { canAdvance: false, reason: `${incompleteWorkItems} work item(s) not completed` };
  }

  // Check all required quality checkpoints passed
  const requiredCheckpoints = (phase.qualityCheckpoints || []).filter(
    cp => cp.required === true && cp.status !== 'passed' && cp.status !== 'waived'
  );

  if (requiredCheckpoints.length > 0) {
    return { canAdvance: false, reason: `${requiredCheckpoints.length} required quality checkpoint(s) not passed` };
  }

  // Check all milestones completed (if milestones exist)
  const incompleteMilestones = (phase.milestones || []).filter(m => m.status !== 'completed');
  if (incompleteMilestones.length > 0) {
    return { canAdvance: false, reason: `${incompleteMilestones.length} milestone(s) not completed` };
  }

  return { canAdvance: true, reason: 'All completion criteria met' };
}

/**
 * Auto-advance phase to completed status
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Object>} Updated phase
 */
export async function autoAdvancePhase(phaseId) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    throw new Error('Invalid phase ID');
  }

  const canAdvance = await canPhaseAutoAdvance(phaseId);
  if (!canAdvance.canAdvance) {
    throw new Error(`Cannot auto-advance: ${canAdvance.reason}`);
  }

  const result = await db.collection('phases').findOneAndUpdate(
    { _id: new ObjectId(phaseId) },
    {
      $set: {
        status: 'completed',
        actualEndDate: new Date(),
        completionPercentage: 100,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );

  if (!result.value) {
    throw new Error('Failed to update phase');
  }

  // Note: Notification creation would go here if notification system exists
  // await createNotifications({
  //   type: 'PHASE_COMPLETED',
  //   projectId: result.value.projectId.toString(),
  //   phaseId: phaseId,
  //   message: `Phase ${result.value.phaseName} has been automatically marked as completed`
  // });

  return result.value;
}

/**
 * Check if phase should trigger budget alerts
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Object>} Alert information
 */
export async function checkPhaseBudgetStatus(phaseId) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return { hasAlert: false };
  }

  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null
  });

  if (!phase) {
    return { hasAlert: false };
  }

  const budgetTotal = phase.budgetAllocation?.total || 0;
  const actualTotal = phase.actualSpending?.total || phase.financialStates?.actual || 0;
  const committedTotal = phase.financialStates?.committed || 0;
  const totalObligated = actualTotal + committedTotal;

  const utilizationPercentage = budgetTotal > 0 
    ? (totalObligated / budgetTotal) * 100 
    : 0;

  const alerts = [];

  // Alert if over budget
  if (totalObligated > budgetTotal) {
    alerts.push({
      type: 'over_budget',
      severity: 'high',
      message: `Phase is over budget by ${(totalObligated - budgetTotal).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}`,
      amount: totalObligated - budgetTotal
    });
  }
  // Alert if approaching budget (80% threshold)
  else if (utilizationPercentage >= 80 && utilizationPercentage < 100) {
    alerts.push({
      type: 'budget_warning',
      severity: 'medium',
      message: `Phase has used ${utilizationPercentage.toFixed(1)}% of budget`,
      percentage: utilizationPercentage
    });
  }

  return {
    hasAlert: alerts.length > 0,
    alerts,
    budgetTotal,
    actualTotal,
    committedTotal,
    totalObligated,
    utilizationPercentage
  };
}

export default {
  canPhaseAutoAdvance,
  autoAdvancePhase,
  checkPhaseBudgetStatus
};


