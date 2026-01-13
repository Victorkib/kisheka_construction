/**
 * Forecasting Helpers
 * Functions for predicting future spending and budget outcomes
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
import { calculateTotalPhaseBudgets } from '@/lib/phase-helpers';

/**
 * Calculate spending velocity (rate of spending per day)
 * @param {Array} spendingHistory - Array of { date: Date, amount: number }
 * @returns {number} Daily spending rate
 */
export function calculateSpendingVelocity(spendingHistory) {
  if (!spendingHistory || spendingHistory.length < 2) {
    return 0;
  }

  // Sort by date
  const sorted = [...spendingHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  if (!first || !last || !first.date || !last.date) {
    return 0;
  }
  
  const totalAmount = sorted.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  const daysDiff = Math.max(1, Math.ceil((new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24)));
  
  return daysDiff > 0 ? totalAmount / daysDiff : 0;
}

/**
 * Forecast spending based on current velocity
 * @param {number} currentSpending - Current total spending
 * @param {number} dailyVelocity - Daily spending rate
 * @param {number} daysRemaining - Days until project completion
 * @returns {number} Forecasted total spending
 */
export function forecastSpending(currentSpending, dailyVelocity, daysRemaining) {
  return currentSpending + (dailyVelocity * daysRemaining);
}

/**
 * Get spending history for a category
 * @param {string} projectId - Project ID
 * @param {string} category - Cost category ('dcc', 'preconstruction', 'indirect', 'contingency')
 * @param {number} daysBack - Number of days to look back (default: 90)
 * @returns {Promise<Array>} Spending history array
 */
export async function getCategorySpendingHistory(projectId, category, daysBack = 90) {
  const db = await getDatabase();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const history = [];

  switch (category) {
    case 'dcc': {
      // Get phase spending over time from materials, labour, equipment
      const phases = await db.collection('phases').find({
        projectId: new ObjectId(projectId),
        deletedAt: null,
      }).toArray();

      for (const phase of phases) {
        // Materials
        const materials = await db.collection('materials').find({
          phaseId: phase._id,
          deletedAt: null,
          createdAt: { $gte: cutoffDate },
        }).toArray();

        materials.forEach(material => {
          if (material.approvedAt) {
            history.push({
              date: material.approvedAt,
              amount: material.totalCost || 0,
              type: 'material',
              phaseId: phase._id.toString(),
            });
          }
        });

        // Labour entries
        const labourEntries = await db.collection('labour_entries').find({
          phaseId: phase._id,
          deletedAt: null,
          createdAt: { $gte: cutoffDate },
          isIndirectLabour: { $ne: true },
        }).toArray();

        labourEntries.forEach(entry => {
          if (entry.status === 'approved' || entry.status === 'paid') {
            history.push({
              date: entry.entryDate || entry.createdAt,
              amount: entry.totalCost || 0,
              type: 'labour',
              phaseId: phase._id.toString(),
            });
          }
        });

        // Equipment
        const equipment = await db.collection('equipment').find({
          phaseId: phase._id,
          deletedAt: null,
          createdAt: { $gte: cutoffDate },
          equipmentScope: { $ne: 'site_wide' },
        }).toArray();

        equipment.forEach(eq => {
          history.push({
            date: eq.startDate || eq.createdAt,
            amount: eq.totalCost || 0,
            type: 'equipment',
            phaseId: phase._id.toString(),
          });
        });
      }
      break;
    }

    case 'preconstruction': {
      const initialExpenses = await db.collection('initial_expenses').find({
        projectId: new ObjectId(projectId),
        deletedAt: null,
        createdAt: { $gte: cutoffDate },
      }).toArray();

      initialExpenses.forEach(expense => {
        if (expense.status === 'approved') {
          history.push({
            date: expense.approvedAt || expense.createdAt,
            amount: expense.amount || 0,
            type: 'initial_expense',
          });
        }
      });
      break;
    }

    case 'indirect': {
      // Expenses marked as indirect
      const expenses = await db.collection('expenses').find({
        projectId: new ObjectId(projectId),
        deletedAt: null,
        isIndirectCost: true,
        createdAt: { $gte: cutoffDate },
      }).toArray();

      expenses.forEach(expense => {
        if (expense.status === 'approved') {
          history.push({
            date: expense.approvedAt || expense.createdAt,
            amount: expense.amount || 0,
            type: 'expense',
          });
        }
      });

      // Site-wide equipment
      const siteWideEquipment = await db.collection('equipment').find({
        projectId: new ObjectId(projectId),
        deletedAt: null,
        equipmentScope: 'site_wide',
        createdAt: { $gte: cutoffDate },
      }).toArray();

      siteWideEquipment.forEach(eq => {
        history.push({
          date: eq.startDate || eq.createdAt,
          amount: eq.totalCost || 0,
          type: 'equipment',
        });
      });

      // Indirect labour
      const indirectLabour = await db.collection('labour_entries').find({
        projectId: new ObjectId(projectId),
        deletedAt: null,
        isIndirectLabour: true,
        createdAt: { $gte: cutoffDate },
      }).toArray();

      indirectLabour.forEach(entry => {
        if (entry.status === 'approved' || entry.status === 'paid') {
          history.push({
            date: entry.entryDate || entry.createdAt,
            amount: entry.totalCost || 0,
            type: 'labour',
          });
        }
      });
      break;
    }

    case 'contingency': {
      const contingencyDraws = await db.collection('contingency_draws').find({
        projectId: new ObjectId(projectId),
        deletedAt: null,
        status: { $in: ['approved', 'completed'] },
        createdAt: { $gte: cutoffDate },
      }).toArray();

      contingencyDraws.forEach(draw => {
        if (draw.approvedAt) {
          history.push({
            date: draw.approvedAt,
            amount: draw.amount || 0,
            type: 'contingency_draw',
            drawType: draw.drawType,
          });
        }
      });
      break;
    }
  }

  // Sort by date
  return history.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Forecast category spending
 * @param {string} projectId - Project ID
 * @param {string} category - Cost category
 * @param {Date} projectEndDate - Project end date
 * @returns {Promise<Object>} Forecast data
 */
export async function forecastCategorySpending(projectId, category, projectEndDate) {
  const db = await getDatabase();
  
  // Get current spending
  let currentSpending = 0;
  let budgeted = 0;

  if (category === 'dcc') {
    const allocatedToPhases = await calculateTotalPhaseBudgets(projectId);
    const phases = await db.collection('phases').find({
      projectId: new ObjectId(projectId),
      deletedAt: null,
    }).toArray();
    
    currentSpending = phases.reduce((sum, phase) => {
      return sum + (phase.actualSpending?.total || 0);
    }, 0);
    
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
    });
    budgeted = project?.budget?.directConstructionCosts || 0;
  } else if (category === 'preconstruction') {
    budgeted = await getPreConstructionBudget(projectId);
    const spending = await getPreConstructionSpending(projectId);
    currentSpending = spending.total || 0;
  } else if (category === 'indirect') {
    budgeted = await getIndirectCostsBudget(projectId);
    currentSpending = await calculateIndirectCostsSpending(projectId);
  } else if (category === 'contingency') {
    budgeted = await getContingencyReserveBudget(projectId);
    currentSpending = await calculateContingencyUsage(projectId);
  }

  // Get spending history
  const history = await getCategorySpendingHistory(projectId, category, 90);
  
  // Calculate velocity
  const velocity = calculateSpendingVelocity(history);
  
  // Calculate days remaining
  const today = new Date();
  const daysRemaining = Math.max(0, Math.ceil((projectEndDate - today) / (1000 * 60 * 60 * 24)));
  
  // Forecast
  const forecastedSpending = forecastSpending(currentSpending, velocity, daysRemaining);
  
  // Calculate variance
  const variance = forecastedSpending - budgeted;
  const variancePercentage = budgeted > 0 ? (variance / budgeted) * 100 : 0;
  
  // Risk assessment
  let riskLevel = 'low';
  if (variancePercentage > 10) {
    riskLevel = 'high';
  } else if (variancePercentage > 5) {
    riskLevel = 'medium';
  }

  return {
    category,
    currentSpending,
    budgeted,
    forecastedSpending,
    variance,
    variancePercentage,
    riskLevel,
    dailyVelocity: velocity,
    daysRemaining,
    historyPoints: history.length,
  };
}

/**
 * Forecast all categories for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Complete forecast data
 */
export async function forecastProjectSpending(projectId) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    deletedAt: null,
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const projectEndDate = project.endDate ? new Date(project.endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Default to 1 year from now

  const categories = ['dcc', 'preconstruction', 'indirect', 'contingency'];
  const forecasts = {};

  for (const category of categories) {
    forecasts[category] = await forecastCategorySpending(projectId, category, projectEndDate);
  }

  // Calculate totals
  const totalBudgeted = Object.values(forecasts).reduce((sum, f) => sum + f.budgeted, 0);
  const totalCurrentSpending = Object.values(forecasts).reduce((sum, f) => sum + f.currentSpending, 0);
  const totalForecasted = Object.values(forecasts).reduce((sum, f) => sum + f.forecastedSpending, 0);
  const totalVariance = totalForecasted - totalBudgeted;
  const totalVariancePercentage = totalBudgeted > 0 ? (totalVariance / totalBudgeted) * 100 : 0;

  // Overall risk assessment
  let overallRisk = 'low';
  if (totalVariancePercentage > 10) {
    overallRisk = 'high';
  } else if (totalVariancePercentage > 5) {
    overallRisk = 'medium';
  }

  return {
    projectId,
    projectEndDate,
    forecasts,
    summary: {
      totalBudgeted,
      totalCurrentSpending,
      totalForecasted,
      totalVariance,
      totalVariancePercentage,
      overallRisk,
    },
    generatedAt: new Date(),
  };
}
