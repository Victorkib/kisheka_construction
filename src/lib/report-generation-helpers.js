/**
 * Report Generation Helpers
 * Functions for generating comprehensive project reports
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
import { forecastProjectSpending } from './forecasting-helpers';
import { compareCategoryTrends } from './trend-analysis-helpers';
import { getRecommendationSummary } from './recommendation-engine';
import { calculateTotalPhaseBudgets } from '@/lib/phase-helpers';

/**
 * Generate comprehensive project financial report
 * @param {string} projectId - Project ID
 * @param {Object} options - Report options
 * @returns {Promise<Object>} Complete report data
 */
export async function generateProjectFinancialReport(projectId, options = {}) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    deletedAt: null,
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const {
    includeForecast = true,
    includeTrends = true,
    includeRecommendations = true,
    dateRange = null, // { start: Date, end: Date }
  } = options || {};

  // Get all budget information
  const dccBudget = project.budget?.directConstructionCosts || 0;
  const preconstructionBudget = await getPreConstructionBudget(projectId);
  const indirectBudget = await getIndirectCostsBudget(projectId);
  const contingencyBudget = await getContingencyReserveBudget(projectId);

  // Get all spending
  const phases = await db.collection('phases').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).toArray();

  const totalPhaseSpending = phases.reduce((sum, phase) => {
    return sum + (phase.actualSpending?.total || 0);
  }, 0);

  const preconstructionSpending = await getPreConstructionSpending(projectId);
  const indirectSpending = await calculateIndirectCostsSpending(projectId);
  const contingencySummary = await getContingencySummary(projectId);

  // Get detailed breakdowns
  const phaseBreakdown = phases.map(phase => ({
    phaseId: phase._id.toString(),
    phaseName: phase.phaseName || phase.name,
    phaseCode: phase.phaseCode,
    budget: phase.budget?.total || 0,
    spending: phase.actualSpending?.total || 0,
    remaining: (phase.budget?.total || 0) - (phase.actualSpending?.total || 0),
    usagePercentage: phase.budget?.total > 0 
      ? ((phase.actualSpending?.total || 0) / phase.budget.total) * 100 
      : 0,
  }));

  // Get materials breakdown
  const materials = await db.collection('materials').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    ...(dateRange ? {
      createdAt: {
        $gte: new Date(dateRange.start),
        $lte: new Date(dateRange.end),
      },
    } : {}),
  }).toArray();

  const materialsTotal = materials
    .filter(m => m.status === 'approved')
    .reduce((sum, m) => sum + (m.totalCost || 0), 0);

  // Get labour breakdown
  const labourEntries = await db.collection('labour_entries').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    isIndirectLabour: { $ne: true },
    ...(dateRange ? {
      entryDate: {
        $gte: new Date(dateRange.start),
        $lte: new Date(dateRange.end),
      },
    } : {}),
  }).toArray();

  const labourTotal = labourEntries
    .filter(l => l.status === 'approved' || l.status === 'paid')
    .reduce((sum, l) => sum + (l.totalCost || 0), 0);

  // Get equipment breakdown
  const equipment = await db.collection('equipment').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    equipmentScope: { $ne: 'site_wide' },
    ...(dateRange ? {
      createdAt: {
        $gte: new Date(dateRange.start),
        $lte: new Date(dateRange.end),
      },
    } : {}),
  }).toArray();

  const equipmentTotal = equipment.reduce((sum, eq) => sum + (eq.totalCost || 0), 0);

  // Get expenses breakdown
  const expenses = await db.collection('expenses').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    isIndirectCost: { $ne: true },
    ...(dateRange ? {
      createdAt: {
        $gte: new Date(dateRange.start),
        $lte: new Date(dateRange.end),
      },
    } : {}),
  }).toArray();

  const expensesTotal = expenses
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Get initial expenses breakdown
  const initialExpenses = await db.collection('initial_expenses').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    ...(dateRange ? {
      createdAt: {
        $gte: new Date(dateRange.start),
        $lte: new Date(dateRange.end),
      },
    } : {}),
  }).toArray();

  const initialExpensesTotal = initialExpenses
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Get indirect expenses breakdown
  const indirectExpenses = await db.collection('expenses').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    isIndirectCost: true,
    ...(dateRange ? {
      createdAt: {
        $gte: new Date(dateRange.start),
        $lte: new Date(dateRange.end),
      },
    } : {}),
  }).toArray();

  const indirectExpensesTotal = indirectExpenses
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Get site-wide equipment
  const siteWideEquipment = await db.collection('equipment').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    equipmentScope: 'site_wide',
    ...(dateRange ? {
      createdAt: {
        $gte: new Date(dateRange.start),
        $lte: new Date(dateRange.end),
      },
    } : {}),
  }).toArray();

  const siteWideEquipmentTotal = siteWideEquipment.reduce((sum, eq) => sum + (eq.totalCost || 0), 0);

  // Get indirect labour
  const indirectLabour = await db.collection('labour_entries').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    isIndirectLabour: true,
    ...(dateRange ? {
      entryDate: {
        $gte: new Date(dateRange.start),
        $lte: new Date(dateRange.end),
      },
    } : {}),
  }).toArray();

  const indirectLabourTotal = indirectLabour
    .filter(l => l.status === 'approved' || l.status === 'paid')
    .reduce((sum, l) => sum + (l.totalCost || 0), 0);

  // Get contingency draws
  const contingencyDraws = await db.collection('contingency_draws').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    status: { $in: ['approved', 'completed'] },
    ...(dateRange ? {
      createdAt: {
        $gte: new Date(dateRange.start),
        $lte: new Date(dateRange.end),
      },
    } : {}),
  }).toArray();

  const contingencyDrawsTotal = contingencyDraws.reduce((sum, d) => sum + (d.amount || 0), 0);

  // Get budget transfers
  const budgetTransfers = await db.collection('budget_transfers').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    status: { $in: ['approved', 'completed'] },
    ...(dateRange ? {
      createdAt: {
        $gte: new Date(dateRange.start),
        $lte: new Date(dateRange.end),
      },
    } : {}),
  }).toArray();

  // Get budget adjustments
  const budgetAdjustments = await db.collection('budget_adjustments').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
    status: { $in: ['approved', 'completed'] },
    ...(dateRange ? {
      createdAt: {
        $gte: new Date(dateRange.start),
        $lte: new Date(dateRange.end),
      },
    } : {}),
  }).toArray();

  // Calculate totals
  const totalBudget = dccBudget + preconstructionBudget + indirectBudget + contingencyBudget;
  const totalSpending = totalPhaseSpending + (preconstructionSpending.total || 0) + indirectSpending + contingencySummary.used;
  const totalRemaining = totalBudget - totalSpending;

  // Build report
  const report = {
    project: {
      _id: project._id.toString(),
      projectName: project.projectName,
      projectCode: project.projectCode,
      startDate: project.startDate,
      endDate: project.endDate,
      status: project.status,
    },
    generatedAt: new Date(),
    dateRange: dateRange || {
      start: project.startDate || new Date(project.createdAt),
      end: new Date(),
    },
    summary: {
      totalBudget,
      totalSpending,
      totalRemaining,
      overallUsagePercentage: totalBudget > 0 ? (totalSpending / totalBudget) * 100 : 0,
    },
    budgets: {
      dcc: {
        budgeted: dccBudget,
        spent: totalPhaseSpending,
        remaining: dccBudget - totalPhaseSpending,
        usagePercentage: dccBudget > 0 ? (totalPhaseSpending / dccBudget) * 100 : 0,
      },
      preconstruction: {
        budgeted: preconstructionBudget,
        spent: preconstructionSpending.total || 0,
        remaining: preconstructionBudget - (preconstructionSpending.total || 0),
        usagePercentage: preconstructionBudget > 0 ? ((preconstructionSpending.total || 0) / preconstructionBudget) * 100 : 0,
      },
      indirect: {
        budgeted: indirectBudget,
        spent: indirectSpending,
        remaining: indirectBudget - indirectSpending,
        usagePercentage: indirectBudget > 0 ? (indirectSpending / indirectBudget) * 100 : 0,
      },
      contingency: {
        budgeted: contingencyBudget,
        used: contingencySummary.used,
        remaining: contingencySummary.remaining,
        usagePercentage: contingencyBudget > 0 ? (contingencySummary.used / contingencyBudget) * 100 : 0,
      },
    },
    breakdowns: {
      phases: phaseBreakdown,
      dcc: {
        materials: materialsTotal,
        labour: labourTotal,
        equipment: equipmentTotal,
        expenses: expensesTotal,
        total: materialsTotal + labourTotal + equipmentTotal + expensesTotal,
      },
      preconstruction: {
        initialExpenses: initialExpensesTotal,
        total: initialExpensesTotal,
      },
      indirect: {
        expenses: indirectExpensesTotal,
        equipment: siteWideEquipmentTotal,
        labour: indirectLabourTotal,
        total: indirectExpensesTotal + siteWideEquipmentTotal + indirectLabourTotal,
      },
      contingency: {
        draws: contingencyDrawsTotal,
        byType: contingencySummary.byType || {},
      },
    },
    transactions: {
      budgetTransfers: budgetTransfers.map(t => ({
        _id: t._id.toString(),
        fromCategory: t.fromCategory,
        toCategory: t.toCategory,
        amount: t.amount,
        status: t.status,
        createdAt: t.createdAt,
      })),
      budgetAdjustments: budgetAdjustments.map(a => ({
        _id: a._id.toString(),
        category: a.category,
        adjustmentType: a.adjustmentType,
        adjustmentAmount: a.adjustmentAmount,
        status: a.status,
        createdAt: a.createdAt,
      })),
    },
  };

  // Add forecast if requested
  if (includeForecast) {
    try {
      report.forecast = await forecastProjectSpending(projectId);
    } catch (error) {
      console.error('Error generating forecast for report:', error);
      report.forecast = null;
    }
  }

  // Add trends if requested
  if (includeTrends) {
    try {
      report.trends = await compareCategoryTrends(projectId);
    } catch (error) {
      console.error('Error generating trends for report:', error);
      report.trends = null;
    }
  }

  // Add recommendations if requested
  if (includeRecommendations) {
    try {
      report.recommendations = await getRecommendationSummary(projectId);
    } catch (error) {
      console.error('Error generating recommendations for report:', error);
      report.recommendations = null;
    }
  }

  return report;
}

/**
 * Generate cost category summary report
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Cost category summary
 */
export async function generateCostCategorySummary(projectId) {
  const db = await getDatabase();
  
  const project = await db.collection('projects').findOne({
    _id: new ObjectId(projectId),
    deletedAt: null,
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const dccBudget = project.budget?.directConstructionCosts || 0;
  const preconstructionBudget = await getPreConstructionBudget(projectId);
  const indirectBudget = await getIndirectCostsBudget(projectId);
  const contingencyBudget = await getContingencyReserveBudget(projectId);

  const phases = await db.collection('phases').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).toArray();

  const totalPhaseSpending = phases.reduce((sum, phase) => {
    return sum + (phase.actualSpending?.total || 0);
  }, 0);

  const preconstructionSpending = await getPreConstructionSpending(projectId);
  const indirectSpending = await calculateIndirectCostsSpending(projectId);
  const contingencySummary = await getContingencySummary(projectId);

  return {
    projectId,
    generatedAt: new Date(),
    categories: {
      dcc: {
        budgeted: dccBudget,
        spent: totalPhaseSpending,
        remaining: dccBudget - totalPhaseSpending,
        usagePercentage: dccBudget > 0 ? (totalPhaseSpending / dccBudget) * 100 : 0,
      },
      preconstruction: {
        budgeted: preconstructionBudget,
        spent: preconstructionSpending.total || 0,
        remaining: preconstructionBudget - (preconstructionSpending.total || 0),
        usagePercentage: preconstructionBudget > 0 ? ((preconstructionSpending.total || 0) / preconstructionBudget) * 100 : 0,
      },
      indirect: {
        budgeted: indirectBudget,
        spent: indirectSpending,
        remaining: indirectBudget - indirectSpending,
        usagePercentage: indirectBudget > 0 ? (indirectSpending / indirectBudget) * 100 : 0,
      },
      contingency: {
        budgeted: contingencyBudget,
        used: contingencySummary.used,
        remaining: contingencySummary.remaining,
        usagePercentage: contingencyBudget > 0 ? (contingencySummary.used / contingencyBudget) * 100 : 0,
      },
    },
    total: {
      budgeted: dccBudget + preconstructionBudget + indirectBudget + contingencyBudget,
      spent: totalPhaseSpending + (preconstructionSpending.total || 0) + indirectSpending + contingencySummary.used,
      remaining: (dccBudget + preconstructionBudget + indirectBudget + contingencyBudget) - 
                  (totalPhaseSpending + (preconstructionSpending.total || 0) + indirectSpending + contingencySummary.used),
    },
  };
}

/**
 * Generate phase-wise spending report
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Phase-wise report
 */
export async function generatePhaseWiseReport(projectId) {
  const db = await getDatabase();
  
  const phases = await db.collection('phases').find({
    projectId: new ObjectId(projectId),
    deletedAt: null,
  }).sort({ order: 1 }).toArray();

  const phaseReports = [];

  for (const phase of phases) {
    // Get materials for phase
    const materials = await db.collection('materials').find({
      phaseId: phase._id,
      deletedAt: null,
      status: 'approved',
    }).toArray();

    const materialsTotal = materials.reduce((sum, m) => sum + (m.totalCost || 0), 0);

    // Get labour for phase
    const labour = await db.collection('labour_entries').find({
      phaseId: phase._id,
      deletedAt: null,
      isIndirectLabour: { $ne: true },
      status: { $in: ['approved', 'paid'] },
    }).toArray();

    const labourTotal = labour.reduce((sum, l) => sum + (l.totalCost || 0), 0);

    // Get equipment for phase
    const equipment = await db.collection('equipment').find({
      phaseId: phase._id,
      deletedAt: null,
      equipmentScope: { $ne: 'site_wide' },
    }).toArray();

    const equipmentTotal = equipment.reduce((sum, eq) => sum + (eq.totalCost || 0), 0);

    // Get work items for phase
    const workItems = await db.collection('work_items').find({
      phaseId: phase._id,
      deletedAt: null,
    }).toArray();

    const workItemsTotal = workItems.reduce((sum, wi) => {
      return sum + (wi.actualCost || wi.estimatedCost || 0);
    }, 0);

    phaseReports.push({
      phaseId: phase._id.toString(),
      phaseName: phase.phaseName || phase.name,
      phaseCode: phase.phaseCode,
      budget: phase.budget?.total || 0,
      spending: {
        materials: materialsTotal,
        labour: labourTotal,
        equipment: equipmentTotal,
        workItems: workItemsTotal,
        total: materialsTotal + labourTotal + equipmentTotal + workItemsTotal,
      },
      remaining: (phase.budget?.total || 0) - (materialsTotal + labourTotal + equipmentTotal + workItemsTotal),
      usagePercentage: phase.budget?.total > 0 
        ? ((materialsTotal + labourTotal + equipmentTotal + workItemsTotal) / phase.budget.total) * 100 
        : 0,
      itemCounts: {
        materials: materials.length,
        labour: labour.length,
        equipment: equipment.length,
        workItems: workItems.length,
      },
    });
  }

  return {
    projectId,
    generatedAt: new Date(),
    phases: phaseReports,
    summary: {
      totalBudget: phaseReports.reduce((sum, p) => sum + p.budget, 0),
      totalSpending: phaseReports.reduce((sum, p) => sum + p.spending.total, 0),
      totalRemaining: phaseReports.reduce((sum, p) => sum + p.remaining, 0),
    },
  };
}
