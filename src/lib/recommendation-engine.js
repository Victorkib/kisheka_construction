/**
 * Recommendation Engine
 * Analyzes project financial state and provides actionable recommendations
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
  getContingencySummary,
} from '@/lib/contingency-helpers';
import { forecastCategorySpending } from './forecasting-helpers';
import { analyzeCategoryTrends } from './trend-analysis-helpers';

/**
 * Generate recommendations for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Array of recommendation objects
 */
export async function generateRecommendations(projectId) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    deletedAt: null,
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const recommendations = [];
  const projectEndDate = project.endDate ? new Date(project.endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  // Get current budgets and spending
  const preconstructionBudget = await getPreConstructionBudget(projectId);
  const preconstructionSpending = await getPreConstructionSpending(projectId);
  const preconstructionUsed = preconstructionSpending.total || 0;
  const preconstructionRemaining = preconstructionBudget - preconstructionUsed;
  const preconstructionUsage = preconstructionBudget > 0 ? (preconstructionUsed / preconstructionBudget) * 100 : 0;

  const indirectBudget = await getIndirectCostsBudget(projectId);
  const indirectSpending = await calculateIndirectCostsSpending(projectId);
  const indirectRemaining = indirectBudget - indirectSpending;
  const indirectUsage = indirectBudget > 0 ? (indirectSpending / indirectBudget) * 100 : 0;

  const contingencySummary = await getContingencySummary(projectId);
  const contingencyUsage = contingencySummary.budgeted > 0 ? (contingencySummary.used / contingencySummary.budgeted) * 100 : 0;

  // Get DCC info
  const phases = await db.collection('phases').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).toArray();

  const totalPhaseBudgets = phases.reduce((sum, phase) => sum + (phase.budget?.total || 0), 0);
  const totalPhaseSpending = phases.reduce((sum, phase) => sum + (phase.actualSpending?.total || 0), 0);
  const dccBudget = project.budget?.directConstructionCosts || 0;
  const dccUsage = dccBudget > 0 ? (totalPhaseSpending / dccBudget) * 100 : 0;

  // Recommendation 1: Budget usage warnings
  if (preconstructionUsage >= 90) {
    recommendations.push({
      type: 'warning',
      priority: 'high',
      category: 'preconstruction',
      title: 'Preconstruction Budget Critical',
      message: `Preconstruction budget is ${preconstructionUsage.toFixed(1)}% used. Only ${preconstructionRemaining.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} remaining.`,
      action: 'Consider requesting a budget adjustment or transfer from another category.',
      actionable: true,
      actionType: 'budget_adjustment',
    });
  } else if (preconstructionUsage >= 80) {
    recommendations.push({
      type: 'warning',
      priority: 'medium',
      category: 'preconstruction',
      title: 'Preconstruction Budget Approaching Limit',
      message: `Preconstruction budget is ${preconstructionUsage.toFixed(1)}% used.`,
      action: 'Monitor spending closely and consider budget adjustments if needed.',
      actionable: true,
      actionType: 'budget_adjustment',
    });
  }

  if (indirectUsage >= 90) {
    recommendations.push({
      type: 'warning',
      priority: 'high',
      category: 'indirect',
      title: 'Indirect Costs Budget Critical',
      message: `Indirect costs budget is ${indirectUsage.toFixed(1)}% used. Only ${indirectRemaining.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} remaining.`,
      action: 'Review indirect costs and consider budget adjustment or cost reduction measures.',
      actionable: true,
      actionType: 'budget_adjustment',
    });
  } else if (indirectUsage >= 80) {
    recommendations.push({
      type: 'warning',
      priority: 'medium',
      category: 'indirect',
      title: 'Indirect Costs Budget Approaching Limit',
      message: `Indirect costs budget is ${indirectUsage.toFixed(1)}% used.`,
      action: 'Monitor indirect costs spending closely.',
      actionable: true,
      actionType: 'budget_adjustment',
    });
  }

  if (dccUsage >= 90) {
    recommendations.push({
      type: 'warning',
      priority: 'high',
      category: 'dcc',
      title: 'DCC Budget Critical',
      message: `Direct Construction Costs budget is ${dccUsage.toFixed(1)}% used.`,
      action: 'Review phase budgets and consider contingency draw or budget adjustment.',
      actionable: true,
      actionType: 'contingency_draw',
    });
  }

  // Recommendation 2: Contingency usage
  if (contingencyUsage >= 80 && contingencyUsage < 100) {
    recommendations.push({
      type: 'info',
      priority: 'medium',
      category: 'contingency',
      title: 'High Contingency Usage',
      message: `Contingency reserve is ${contingencyUsage.toFixed(1)}% used. ${contingencySummary.remaining.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} remaining.`,
      action: 'Monitor project risks closely. Consider additional contingency if risks increase.',
      actionable: true,
      actionType: 'budget_adjustment',
    });
  }

  // Recommendation 3: Forecast-based recommendations
  try {
    const dccForecast = await forecastCategorySpending(projectId, 'dcc', projectEndDate);
    if (dccForecast.variancePercentage > 10) {
      recommendations.push({
        type: 'warning',
        priority: 'high',
        category: 'dcc',
        title: 'DCC Forecast Exceeds Budget',
        message: `Forecasted DCC spending is ${dccForecast.variancePercentage.toFixed(1)}% over budget.`,
        action: `Consider budget adjustment of ${Math.abs(dccForecast.variance).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} or cost reduction measures.`,
        actionable: true,
        actionType: 'budget_adjustment',
        suggestedAmount: Math.abs(dccForecast.variance),
      });
    }

    const indirectForecast = await forecastCategorySpending(projectId, 'indirect', projectEndDate);
    if (indirectForecast.variancePercentage > 10) {
      recommendations.push({
        type: 'warning',
        priority: 'high',
        category: 'indirect',
        title: 'Indirect Costs Forecast Exceeds Budget',
        message: `Forecasted indirect costs are ${indirectForecast.variancePercentage.toFixed(1)}% over budget.`,
        action: `Consider budget adjustment of ${Math.abs(indirectForecast.variance).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}.`,
        actionable: true,
        actionType: 'budget_adjustment',
        suggestedAmount: Math.abs(indirectForecast.variance),
      });
    }
  } catch (error) {
    console.error('Error generating forecast-based recommendations:', error);
  }

  // Recommendation 4: Trend-based recommendations
  try {
    const dccTrends = await analyzeCategoryTrends(projectId, 'dcc');
    if (dccTrends.trend.direction === 'increasing' && dccTrends.trend.changeRate > 20) {
      recommendations.push({
        type: 'info',
        priority: 'medium',
        category: 'dcc',
        title: 'Rapid DCC Spending Increase',
        message: `DCC spending is increasing at ${dccTrends.trend.changeRate.toFixed(1)}% per period.`,
        action: 'Review spending patterns and ensure costs are within budget projections.',
        actionable: false,
      });
    }

    const indirectTrends = await analyzeCategoryTrends(projectId, 'indirect');
    if (indirectTrends.trend.direction === 'increasing' && indirectTrends.trend.changeRate > 15) {
      recommendations.push({
        type: 'info',
        priority: 'medium',
        category: 'indirect',
        title: 'Rapid Indirect Costs Increase',
        message: `Indirect costs are increasing at ${indirectTrends.trend.changeRate.toFixed(1)}% per period.`,
        action: 'Review indirect costs and identify opportunities for cost optimization.',
        actionable: false,
      });
    }
  } catch (error) {
    console.error('Error generating trend-based recommendations:', error);
  }

  // Recommendation 5: Budget transfer opportunities
  if (preconstructionUsage < 50 && dccUsage > 80) {
    const transferAmount = Math.min(preconstructionRemaining * 0.2, (dccBudget * 0.1));
    if (transferAmount > 10000) { // Only suggest if meaningful amount
      recommendations.push({
        type: 'suggestion',
        priority: 'low',
        category: 'budget_transfer',
        title: 'Consider Budget Transfer',
        message: `Preconstruction budget has ${preconstructionRemaining.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} available while DCC is ${dccUsage.toFixed(1)}% used.`,
        action: `Consider transferring ${transferAmount.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} from preconstruction to DCC.`,
        actionable: true,
        actionType: 'budget_transfer',
        suggestedAmount: transferAmount,
        fromCategory: 'preconstruction',
        toCategory: 'dcc',
      });
    }
  }

  if (indirectUsage < 50 && dccUsage > 80) {
    const transferAmount = Math.min(indirectRemaining * 0.2, (dccBudget * 0.1));
    if (transferAmount > 10000) {
      recommendations.push({
        type: 'suggestion',
        priority: 'low',
        category: 'budget_transfer',
        title: 'Consider Budget Transfer',
        message: `Indirect costs budget has ${indirectRemaining.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} available while DCC is ${dccUsage.toFixed(1)}% used.`,
        action: `Consider transferring ${transferAmount.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} from indirect to DCC.`,
        actionable: true,
        actionType: 'budget_transfer',
        suggestedAmount: transferAmount,
        fromCategory: 'indirect',
        toCategory: 'dcc',
      });
    }
  }

  // Recommendation 6: Contingency draw suggestions
  if (dccUsage > 85 && contingencyUsage < 50) {
    const suggestedDraw = Math.min(dccBudget * 0.05, contingencySummary.remaining * 0.3);
    if (suggestedDraw > 50000) {
      recommendations.push({
        type: 'suggestion',
        priority: 'medium',
        category: 'contingency',
        title: 'Consider Contingency Draw',
        message: `DCC budget is ${dccUsage.toFixed(1)}% used. Contingency reserve has ${contingencySummary.remaining.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} available.`,
        action: `Consider requesting a contingency draw of ${suggestedDraw.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} to support DCC.`,
        actionable: true,
        actionType: 'contingency_draw',
        suggestedAmount: suggestedDraw,
      });
    }
  }

  // Sort recommendations by priority (high -> medium -> low) and type (warning -> info -> suggestion)
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  const typeOrder = { warning: 3, info: 2, suggestion: 1 };

  recommendations.sort((a, b) => {
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return typeOrder[b.type] - typeOrder[a.type];
  });

  return recommendations;
}

/**
 * Get recommendation summary
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Recommendation summary
 */
export async function getRecommendationSummary(projectId) {
  const recommendations = await generateRecommendations(projectId);

  const summary = {
    total: recommendations.length,
    byType: {
      warning: recommendations.filter(r => r.type === 'warning').length,
      info: recommendations.filter(r => r.type === 'info').length,
      suggestion: recommendations.filter(r => r.type === 'suggestion').length,
    },
    byPriority: {
      high: recommendations.filter(r => r.priority === 'high').length,
      medium: recommendations.filter(r => r.priority === 'medium').length,
      low: recommendations.filter(r => r.priority === 'low').length,
    },
    actionable: recommendations.filter(r => r.actionable).length,
  };

  return {
    summary,
    recommendations,
  };
}
