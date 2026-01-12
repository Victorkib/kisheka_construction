/**
 * Labour Budget Alert Helper Functions
 * Monitors labour budget thresholds and generates alerts
 */

import { getDatabase } from './mongodb/connection';
import { ObjectId } from 'mongodb';
import { createNotification } from './notifications';

/**
 * Default budget alert thresholds
 */
export const DEFAULT_BUDGET_THRESHOLDS = {
  warningPercentage: 80, // Alert when 80% of budget used
  criticalPercentage: 95, // Alert when 95% of budget used
  overBudgetPercentage: 100, // Alert when over budget
  warningAmount: 0, // Optional: Alert when within X amount of budget
};

/**
 * Check budget thresholds for a phase
 * @param {string} phaseId - Phase ID
 * @param {Object} [thresholds] - Custom thresholds (optional)
 * @returns {Promise<Object>} Budget status with alerts
 */
export async function checkPhaseLabourBudgetThresholds(phaseId, thresholds = {}) {
  const db = await getDatabase();

  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return { hasAlert: false, alerts: [] };
  }

  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null,
  });

  if (!phase) {
    return { hasAlert: false, alerts: [] };
  }

  // Get labour budget
  const labourBudget = phase.budgetAllocation?.labour || {};
  const budgetAllocated =
    (labourBudget.skilled || 0) +
    (labourBudget.unskilled || 0) +
    (labourBudget.supervisory || 0) +
    (labourBudget.specialized || 0);

  // Get actual labour spending
  const actualSpending = await db.collection('labour_entries').aggregate([
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
        totalCost: { $sum: '$totalCost' },
        totalHours: { $sum: '$totalHours' },
      },
    },
  ]).toArray();

  const actualCost = actualSpending[0]?.totalCost || 0;
  const utilizationPercentage = budgetAllocated > 0 ? (actualCost / budgetAllocated) * 100 : 0;

  // Merge with default thresholds
  const finalThresholds = { ...DEFAULT_BUDGET_THRESHOLDS, ...thresholds };

  const alerts = [];

  // Check over budget
  if (actualCost > budgetAllocated) {
    alerts.push({
      type: 'over_budget',
      severity: 'critical',
      message: `Phase labour budget exceeded by ${(actualCost - budgetAllocated).toLocaleString()} KES`,
      amount: actualCost - budgetAllocated,
      percentage: utilizationPercentage,
      phaseId: phaseId,
      phaseName: phase.phaseName,
    });
  }
  // Check critical threshold (95%)
  else if (utilizationPercentage >= finalThresholds.criticalPercentage) {
    alerts.push({
      type: 'critical_threshold',
      severity: 'high',
      message: `Phase labour budget at ${utilizationPercentage.toFixed(1)}% (${actualCost.toLocaleString()} / ${budgetAllocated.toLocaleString()} KES)`,
      amount: budgetAllocated - actualCost,
      percentage: utilizationPercentage,
      phaseId: phaseId,
      phaseName: phase.phaseName,
    });
  }
  // Check warning threshold (80%)
  else if (utilizationPercentage >= finalThresholds.warningPercentage) {
    alerts.push({
      type: 'warning_threshold',
      severity: 'medium',
      message: `Phase labour budget at ${utilizationPercentage.toFixed(1)}% (${actualCost.toLocaleString()} / ${budgetAllocated.toLocaleString()} KES)`,
      amount: budgetAllocated - actualCost,
      percentage: utilizationPercentage,
      phaseId: phaseId,
      phaseName: phase.phaseName,
    });
  }

  return {
    hasAlert: alerts.length > 0,
    alerts,
    budgetAllocated,
    actualCost,
    remaining: budgetAllocated - actualCost,
    utilizationPercentage,
    phaseId: phaseId,
    phaseName: phase.phaseName,
  };
}

/**
 * Check budget thresholds for a project (all phases)
 * @param {string} projectId - Project ID
 * @param {Object} [thresholds] - Custom thresholds (optional)
 * @returns {Promise<Object>} Budget status with alerts for all phases
 */
export async function checkProjectLabourBudgetThresholds(projectId, thresholds = {}) {
  const db = await getDatabase();

  if (!projectId || !ObjectId.isValid(projectId)) {
    return { hasAlert: false, alerts: [] };
  }

  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    deletedAt: null,
  });

  if (!project) {
    return { hasAlert: false, alerts: [] };
  }

  // Get all phases for project
  const phases = await db.collection('phases')
    .find({
      projectId: new ObjectId(projectId),
      deletedAt: null,
    })
    .toArray();

  const allAlerts = [];
  let totalBudget = 0;
  let totalActual = 0;

  // Check each phase
  for (const phase of phases) {
    const phaseStatus = await checkPhaseLabourBudgetThresholds(phase._id.toString(), thresholds);
    if (phaseStatus.hasAlert) {
      allAlerts.push(...phaseStatus.alerts);
    }
    totalBudget += phaseStatus.budgetAllocated;
    totalActual += phaseStatus.actualCost;
  }

  // Check project-level budget
  const projectLabourBudget = project.budgetAllocation?.labour || {};
  const projectBudgetAllocated =
    (projectLabourBudget.skilled || 0) +
    (projectLabourBudget.unskilled || 0) +
    (projectLabourBudget.supervisory || 0) +
    (projectLabourBudget.specialized || 0);

  const projectUtilization = projectBudgetAllocated > 0 ? (totalActual / projectBudgetAllocated) * 100 : 0;
  const finalThresholds = { ...DEFAULT_BUDGET_THRESHOLDS, ...thresholds };

  // Add project-level alerts if needed
  if (totalActual > projectBudgetAllocated) {
    allAlerts.push({
      type: 'over_budget',
      severity: 'critical',
      level: 'project',
      message: `Project labour budget exceeded by ${(totalActual - projectBudgetAllocated).toLocaleString()} KES`,
      amount: totalActual - projectBudgetAllocated,
      percentage: projectUtilization,
      projectId: projectId,
      projectName: project.projectName,
    });
  } else if (projectUtilization >= finalThresholds.criticalPercentage) {
    allAlerts.push({
      type: 'critical_threshold',
      severity: 'high',
      level: 'project',
      message: `Project labour budget at ${projectUtilization.toFixed(1)}%`,
      amount: projectBudgetAllocated - totalActual,
      percentage: projectUtilization,
      projectId: projectId,
      projectName: project.projectName,
    });
  } else if (projectUtilization >= finalThresholds.warningPercentage) {
    allAlerts.push({
      type: 'warning_threshold',
      severity: 'medium',
      level: 'project',
      message: `Project labour budget at ${projectUtilization.toFixed(1)}%`,
      amount: projectBudgetAllocated - totalActual,
      percentage: projectUtilization,
      projectId: projectId,
      projectName: project.projectName,
    });
  }

  return {
    hasAlert: allAlerts.length > 0,
    alerts: allAlerts,
    projectId: projectId,
    projectName: project.projectName,
    totalBudget: projectBudgetAllocated,
    totalActual,
    remaining: projectBudgetAllocated - totalActual,
    utilizationPercentage: projectUtilization,
    phaseCount: phases.length,
  };
}

/**
 * Generate budget alerts for a project or phase
 * @param {string} projectId - Project ID (optional if phaseId provided)
 * @param {string} [phaseId] - Phase ID (optional)
 * @param {Object} [thresholds] - Custom thresholds (optional)
 * @returns {Promise<Object>} Generated alerts
 */
export async function generateLabourBudgetAlerts(projectId, phaseId = null, thresholds = {}) {
  if (phaseId) {
    return await checkPhaseLabourBudgetThresholds(phaseId, thresholds);
  } else if (projectId) {
    return await checkProjectLabourBudgetThresholds(projectId, thresholds);
  }

  return { hasAlert: false, alerts: [] };
}

/**
 * Send budget alert notification to user
 * @param {string} userId - User ID to notify
 * @param {Object} alert - Alert object
 * @returns {Promise<Object>} Created notification
 */
export async function sendLabourBudgetAlert(userId, alert) {
  if (!userId || !alert) {
    return null;
  }

  const notification = await createNotification({
    userId,
    type: 'budget_alert',
    title: `Labour Budget Alert: ${alert.type === 'over_budget' ? 'Over Budget' : alert.severity === 'high' ? 'Critical Threshold' : 'Warning'}`,
    message: alert.message,
    priority: alert.severity === 'critical' ? 'high' : alert.severity === 'high' ? 'medium' : 'low',
    metadata: {
      alertType: alert.type,
      severity: alert.severity,
      phaseId: alert.phaseId,
      phaseName: alert.phaseName,
      projectId: alert.projectId,
      projectName: alert.projectName,
      amount: alert.amount,
      percentage: alert.percentage,
    },
    actionUrl: alert.phaseId
      ? `/phases/${alert.phaseId}`
      : alert.projectId
      ? `/projects/${alert.projectId}`
      : null,
  });

  return notification;
}

/**
 * Send budget alerts to all relevant users (owner, PM, etc.)
 * @param {string} projectId - Project ID
 * @param {Object} alerts - Array of alerts
 * @returns {Promise<number>} Number of notifications sent
 */
export async function sendLabourBudgetAlertsToUsers(projectId, alerts) {
  if (!projectId || !alerts || alerts.length === 0) {
    return 0;
  }

  const db = await getDatabase();

  // Get project to find owner
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    deletedAt: null,
  });

  if (!project) {
    return 0;
  }

  // Get users who should receive alerts (owner, PM, project manager)
  const users = await db.collection('user_profiles').find({
    role: { $in: ['owner', 'pm', 'project_manager'] },
    status: 'active',
  }).toArray();

  let notificationCount = 0;

  // Send alerts to each user
  for (const user of users) {
    for (const alert of alerts) {
      try {
        await sendLabourBudgetAlert(user._id.toString(), alert);
        notificationCount++;
      } catch (error) {
        console.error(`Failed to send alert to user ${user._id}:`, error);
      }
    }
  }

  return notificationCount;
}

export default {
  DEFAULT_BUDGET_THRESHOLDS,
  checkPhaseLabourBudgetThresholds,
  checkProjectLabourBudgetThresholds,
  generateLabourBudgetAlerts,
  sendLabourBudgetAlert,
  sendLabourBudgetAlertsToUsers,
};

