/**
 * Activation Helpers
 * 
 * Functions to handle late activation of budgets and capital.
 * Tracks when budgets/capital are first set and captures baseline spending.
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { getCurrentTotalUsed, calculateCommittedCost } from './financial-helpers';
import { calculateDCCSpending, getPreConstructionSpending } from './financial-helpers';
import { calculateIndirectCostsSpending } from './indirect-costs-helpers';

/**
 * Check if project budget activation is needed
 * @param {Object} project - Project object
 * @param {Object} newBudget - New budget being set
 * @returns {boolean} True if activation is needed (budget going from 0 → non-zero)
 */
export function needsBudgetActivation(project, newBudget) {
  // Check if project already has activation data
  if (project.budgetActivation?.activatedAt) {
    return false; // Already activated
  }

  // Check if new budget is non-zero
  const newBudgetTotal = newBudget?.total || 0;
  if (newBudgetTotal <= 0) {
    return false; // No activation needed for zero budget
  }

  // Check if current budget is zero
  const currentBudgetTotal = project.budget?.total || 0;
  if (currentBudgetTotal > 0) {
    return false; // Budget already set
  }

  // Activation needed: going from 0 → non-zero
  return true;
}

/**
 * Check if phase budget activation is needed
 * @param {Object} phase - Phase object
 * @param {number} newBudgetTotal - New budget total being set
 * @returns {boolean} True if activation is needed
 */
export function needsPhaseBudgetActivation(phase, newBudgetTotal) {
  // Check if phase already has activation data
  if (phase.budgetActivation?.activatedAt) {
    return false; // Already activated
  }

  // Check if new budget is non-zero
  if (!newBudgetTotal || newBudgetTotal <= 0) {
    return false; // No activation needed for zero budget
  }

  // Check if current budget is zero
  const currentBudgetTotal = phase.budgetAllocation?.total || 0;
  if (currentBudgetTotal > 0) {
    return false; // Budget already set
  }

  // Activation needed: going from 0 → non-zero
  return true;
}

/**
 * Check if capital activation is needed
 * @param {Object} projectFinances - Project finances object
 * @param {number} newTotalInvested - New total invested amount
 * @returns {boolean} True if activation is needed
 */
export function needsCapitalActivation(projectFinances, newTotalInvested) {
  // Check if capital already has activation data
  if (projectFinances?.capitalActivation?.activatedAt) {
    return false; // Already activated
  }

  // Check if new capital is non-zero
  if (!newTotalInvested || newTotalInvested <= 0) {
    return false; // No activation needed for zero capital
  }

  // Check if current capital is zero
  const currentTotalInvested = projectFinances?.totalInvested || 0;
  if (currentTotalInvested > 0) {
    return false; // Capital already set
  }

  // Activation needed: going from 0 → non-zero
  return true;
}

/**
 * Capture project budget activation baseline
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Activation data with baseline snapshots
 */
export async function captureProjectBudgetActivation(projectId) {
  const db = await getDatabase();

  // Get current spending
  const totalUsed = await getCurrentTotalUsed(projectId);
  const dccSpending = await calculateDCCSpending(projectId);
  const preConstructionSpending = await getPreConstructionSpending(projectId);
  const indirectSpending = await calculateIndirectCostsSpending(projectId);

  const activationData = {
    activatedAt: new Date(),
    preBudgetSpending: {
      total: totalUsed || 0,
      dcc: dccSpending?.total || 0,
      preConstruction: preConstructionSpending?.total || 0,
      indirect: indirectSpending || 0, // calculateIndirectCostsSpending returns a number, not an object
    },
  };

  // Update project with activation data
  await db.collection('projects').updateOne(
    { _id: new ObjectId(projectId) },
    {
      $set: {
        budgetActivation: activationData,
        updatedAt: new Date(),
      },
    }
  );

  return activationData;
}

/**
 * Capture phase budget activation baseline
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Object>} Activation data with baseline snapshots
 */
export async function capturePhaseBudgetActivation(phaseId) {
  const db = await getDatabase();

  // Get phase
  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null,
  });

  if (!phase) {
    throw new Error('Phase not found');
  }

  // Capture current spending
  const actualSpending = phase.actualSpending || {};
  const activationData = {
    activatedAt: new Date(),
    preBudgetSpending: {
      total: actualSpending.total || 0,
      materials: actualSpending.materials || 0,
      labour: actualSpending.labour || 0,
      equipment: actualSpending.equipment || 0,
      subcontractors: actualSpending.subcontractors || 0,
    },
  };

  // Update phase with activation data
  await db.collection('phases').updateOne(
    { _id: new ObjectId(phaseId) },
    {
      $set: {
        budgetActivation: activationData,
        updatedAt: new Date(),
      },
    }
  );

  return activationData;
}

/**
 * Capture capital activation baseline
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Activation data with baseline snapshots
 */
export async function captureCapitalActivation(projectId) {
  const db = await getDatabase();

  // Get current spending
  const totalUsed = await getCurrentTotalUsed(projectId);
  const committedCost = await calculateCommittedCost(projectId);

  const activationData = {
    activatedAt: new Date(),
    preCapitalUsed: totalUsed || 0,
    preCapitalCommitted: committedCost || 0,
  };

  // Update project_finances with activation data
  await db.collection('project_finances').updateOne(
    { projectId: new ObjectId(projectId) },
    {
      $set: {
        capitalActivation: activationData,
        updatedAt: new Date(),
      },
    },
    { upsert: true } // Create if doesn't exist
  );

  return activationData;
}

/**
 * Get effective spending for project budget validation
 * Returns current spending minus pre-budget baseline
 * @param {Object} project - Project object
 * @param {number} currentSpending - Current spending amount
 * @returns {number} Effective spending (for validation purposes)
 */
export function getEffectiveProjectSpending(project, currentSpending) {
  if (!project.budgetActivation?.preBudgetSpending) {
    // No activation data = all spending is "post-activation"
    return currentSpending;
  }

  const baseline = project.budgetActivation.preBudgetSpending.total || 0;
  return Math.max(0, currentSpending - baseline);
}

/**
 * Get effective spending for phase budget validation
 * Returns current spending minus pre-budget baseline
 * @param {Object} phase - Phase object
 * @param {number} currentSpending - Current spending amount
 * @param {string} category - Optional: 'materials', 'labour', 'total'
 * @returns {number} Effective spending (for validation purposes)
 */
export function getEffectivePhaseSpending(phase, currentSpending, category = 'total') {
  if (!phase.budgetActivation?.preBudgetSpending) {
    // No activation data = all spending is "post-activation"
    return currentSpending;
  }

  const baseline = phase.budgetActivation.preBudgetSpending;
  let baselineAmount = 0;

  if (category === 'materials') {
    baselineAmount = baseline.materials || 0;
  } else if (category === 'labour') {
    baselineAmount = baseline.labour || 0;
  } else {
    baselineAmount = baseline.total || 0;
  }

  return Math.max(0, currentSpending - baselineAmount);
}

/**
 * Get effective capital usage for validation
 * For capital, we show true state (no offset), but this helper provides
 * the pre-capital baseline for informational purposes
 * @param {Object} projectFinances - Project finances object
 * @returns {Object} Pre-capital baseline info
 */
export function getPreCapitalBaseline(projectFinances) {
  if (!projectFinances?.capitalActivation) {
    return {
      preCapitalUsed: 0,
      preCapitalCommitted: 0,
      hasBaseline: false,
    };
  }

  return {
    preCapitalUsed: projectFinances.capitalActivation.preCapitalUsed || 0,
    preCapitalCommitted: projectFinances.capitalActivation.preCapitalCommitted || 0,
    activatedAt: projectFinances.capitalActivation.activatedAt,
    hasBaseline: true,
  };
}

/**
 * Get pre-budget baseline info for a project
 * @param {Object} project - Project object
 * @returns {Object} Pre-budget baseline info
 */
export function getPreBudgetBaseline(project) {
  if (!project?.budgetActivation) {
    return {
      preBudgetSpending: {
        total: 0,
        dcc: 0,
        preConstruction: 0,
        indirect: 0,
      },
      hasBaseline: false,
    };
  }

  return {
    preBudgetSpending: project.budgetActivation.preBudgetSpending || {
      total: 0,
      dcc: 0,
      preConstruction: 0,
      indirect: 0,
    },
    activatedAt: project.budgetActivation.activatedAt,
    hasBaseline: true,
  };
}

/**
 * Get pre-budget baseline info for a phase
 * @param {Object} phase - Phase object
 * @returns {Object} Pre-budget baseline info
 */
export function getPrePhaseBudgetBaseline(phase) {
  if (!phase?.budgetActivation) {
    return {
      preBudgetSpending: {
        total: 0,
        materials: 0,
        labour: 0,
        equipment: 0,
        subcontractors: 0,
      },
      hasBaseline: false,
    };
  }

  return {
    preBudgetSpending: phase.budgetActivation.preBudgetSpending || {
      total: 0,
      materials: 0,
      labour: 0,
      equipment: 0,
      subcontractors: 0,
    },
    activatedAt: phase.budgetActivation.activatedAt,
    hasBaseline: true,
  };
}
