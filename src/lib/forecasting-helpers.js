/**
 * Forecasting Helpers
 * Functions for cost forecasting and predictive analytics
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { MATERIAL_APPROVED_STATUSES, EXPENSE_APPROVED_STATUSES } from '@/lib/status-constants';

/**
 * Calculate cost forecast for a phase based on historical spending patterns
 * @param {string} phaseId - Phase ID
 * @param {Object} options - Forecasting options
 * @returns {Promise<Object>} Forecast data
 */
export async function forecastPhaseCosts(phaseId, options = {}) {
  const db = await getDatabase();
  
  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null
  });

  if (!phase) {
    throw new Error('Phase not found');
  }

  const budgetAllocation = phase.budgetAllocation?.total || 0;
  const actualSpending = phase.actualSpending?.total || 0;
  const committedCost = phase.financialStates?.committed || 0;
  const completionPercentage = phase.completionPercentage || 0;

  // Calculate spending rate (per percentage point)
  const spendingRate = completionPercentage > 0 
    ? actualSpending / completionPercentage 
    : 0;

  // Forecast completion cost based on current rate
  const forecastCompletionCost = spendingRate > 0
    ? spendingRate * 100
    : budgetAllocation;

  // Calculate variance forecast
  const forecastVariance = forecastCompletionCost - budgetAllocation;
  const forecastVariancePercentage = budgetAllocation > 0
    ? (forecastVariance / budgetAllocation) * 100
    : 0;

  // Calculate remaining forecast
  const remainingWork = 100 - completionPercentage;
  const forecastRemainingCost = spendingRate * remainingWork;

  // Risk assessment
  let riskLevel = 'low';
  let riskIndicators = [];

  if (forecastVariancePercentage > 20) {
    riskLevel = 'high';
    riskIndicators.push('Projected to exceed budget by more than 20%');
  } else if (forecastVariancePercentage > 10) {
    riskLevel = 'medium';
    riskIndicators.push('Projected to exceed budget by more than 10%');
  }

  if (actualSpending > budgetAllocation * 0.8 && completionPercentage < 50) {
    riskLevel = 'high';
    riskIndicators.push('High spending rate early in phase');
  }

  if (committedCost + actualSpending > budgetAllocation) {
    riskLevel = 'high';
    riskIndicators.push('Committed costs exceed budget allocation');
  }

  return {
    phaseId: phaseId,
    phaseName: phase.phaseName,
    budgetAllocation,
    actualSpending,
    committedCost,
    completionPercentage,
    spendingRate,
    forecastCompletionCost,
    forecastRemainingCost,
    forecastVariance,
    forecastVariancePercentage: parseFloat(forecastVariancePercentage.toFixed(2)),
    riskLevel,
    riskIndicators,
    projectedCompletionDate: null, // Can be calculated based on progress rate if needed
    confidence: completionPercentage > 20 ? 'medium' : 'low'
  };
}

/**
 * Calculate cost forecast for all phases in a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Array of phase forecasts
 */
export async function forecastProjectPhases(projectId) {
  const db = await getDatabase();
  
  const phases = await db.collection('phases').find({
    projectId: new ObjectId(projectId),
    deletedAt: null
  }).sort({ sequence: 1 }).toArray();

  const forecasts = await Promise.all(
    phases.map(phase => forecastPhaseCosts(phase._id.toString()))
  );

  return forecasts;
}

/**
 * Calculate overall project forecast
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Project forecast
 */
export async function forecastProject(projectId) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    deletedAt: null
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const phaseForecasts = await forecastProjectPhases(projectId);

  const totalBudget = phaseForecasts.reduce((sum, f) => sum + f.budgetAllocation, 0);
  const totalActual = phaseForecasts.reduce((sum, f) => sum + f.actualSpending, 0);
  const totalCommitted = phaseForecasts.reduce((sum, f) => sum + f.committedCost, 0);
  const totalForecast = phaseForecasts.reduce((sum, f) => sum + f.forecastCompletionCost, 0);

  const overallVariance = totalForecast - totalBudget;
  const overallVariancePercentage = totalBudget > 0
    ? (overallVariance / totalBudget) * 100
    : 0;

  // Count risk levels
  const highRiskPhases = phaseForecasts.filter(f => f.riskLevel === 'high').length;
  const mediumRiskPhases = phaseForecasts.filter(f => f.riskLevel === 'medium').length;

  let overallRiskLevel = 'low';
  if (highRiskPhases > 0 || overallVariancePercentage > 15) {
    overallRiskLevel = 'high';
  } else if (mediumRiskPhases > 0 || overallVariancePercentage > 5) {
    overallRiskLevel = 'medium';
  }

  return {
    projectId,
    projectName: project.projectName,
    totalBudget,
    totalActual,
    totalCommitted,
    totalForecast,
    overallVariance,
    overallVariancePercentage: parseFloat(overallVariancePercentage.toFixed(2)),
    overallRiskLevel,
    highRiskPhases,
    mediumRiskPhases,
    phaseForecasts
  };
}

/**
 * Get spending trends for a phase
 * @param {string} phaseId - Phase ID
 * @param {number} days - Number of days to analyze
 * @returns {Promise<Object>} Spending trends
 */
export async function getPhaseSpendingTrends(phaseId, days = 30) {
  const db = await getDatabase();
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get materials spending by date
  const materialsTrends = await db.collection('materials').aggregate([
    {
      $match: {
        phaseId: new ObjectId(phaseId),
        deletedAt: null,
        status: { $in: MATERIAL_APPROVED_STATUSES },
        datePurchased: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$datePurchased' }
        },
        total: { $sum: '$totalCost' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]).toArray();

  // Get expenses spending by date
  const expensesTrends = await db.collection('expenses').aggregate([
    {
      $match: {
        phaseId: new ObjectId(phaseId),
        deletedAt: null,
        status: { $in: EXPENSE_APPROVED_STATUSES },
        date: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$date' }
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]).toArray();

  return {
    materials: materialsTrends,
    expenses: expensesTrends,
    period: { startDate, endDate: new Date(), days }
  };
}

