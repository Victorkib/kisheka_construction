/**
 * Floor Dashboard API
 * GET: Get comprehensive floor dashboard data for a project
 *
 * GET /api/floors/dashboard?projectId=xxx
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { MATERIAL_APPROVED_STATUSES } from '@/lib/status-constants';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/floors/dashboard
 * Returns comprehensive dashboard data for floor management
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid project ID is required', 400);
    }

    const db = await getDatabase();
    const projectObjectId = new ObjectId(projectId);

    // Get all floors for the project
    const floors = await db.collection('floors').find({
      projectId: projectObjectId,
      deletedAt: null
    }).sort({ floorNumber: 1 }).toArray();

    if (floors.length === 0) {
      return successResponse({
        summary: {
          totalFloors: 0,
          floorsNotStarted: 0,
          floorsInProgress: 0,
          floorsCompleted: 0,
          floorsOverBudget: 0,
          avgProgress: 0,
          totalBudget: 0,
          totalCapital: 0,
          totalActualCost: 0
        },
        floors: [],
        alerts: [],
        progressVisualization: []
      }, 'No floors found for this project');
    }

    // Enrich floor data with counts and calculations
    const enrichedFloors = await Promise.all(
      floors.map(async (floor) => {
        // Get counts
        const [materialsCount, requestsCount, purchaseOrdersCount] = await Promise.all([
          db.collection('materials').countDocuments({
            floor: floor._id,
            deletedAt: null,
          }),
          db.collection('material_requests').countDocuments({
            floorId: floor._id,
            deletedAt: null,
          }),
          db.collection('purchase_orders').countDocuments({
            floorId: floor._id,
            deletedAt: null,
          }),
        ]);

        // Get progress data
        const progressData = floor.progress || { completionPercentage: 0 };
        const completionPercentage = progressData.completionPercentage || 0;

        // Get capital allocation data
        const capitalAllocation = floor.capitalAllocation || { total: 0, remaining: 0, used: 0, committed: 0 };
        const capitalTotal = capitalAllocation.total || 0;
        const capitalRemaining = capitalAllocation.remaining !== undefined
          ? capitalAllocation.remaining
          : capitalTotal;
        const capitalUsed = capitalAllocation.used || 0;
        const capitalCommitted = capitalAllocation.committed || 0;

        // Get budget data
        const budgetAllocation = floor.budgetAllocation || { total: floor.totalBudget || 0 };
        const budgetTotal = budgetAllocation.total || 0;
        const actualCost = floor.actualCost || 0;
        const budgetUtilization = budgetTotal > 0 ? (actualCost / budgetTotal) * 100 : 0;
        const budgetRemaining = Math.max(0, budgetTotal - actualCost);

        // Determine floor status alerts
        let alertType = null;
        let alertSeverity = null;
        if (budgetTotal > 0 && actualCost > budgetTotal) {
          alertType = 'over_budget';
          alertSeverity = 'critical';
        } else if (capitalTotal > 0 && capitalRemaining < capitalTotal * 0.15) {
          alertType = 'low_capital';
          alertSeverity = 'warning';
        } else if (completionPercentage === 0 && actualCost > 0) {
          alertType = 'no_progress';
          alertSeverity = 'info';
        } else if (completionPercentage > 0 && completionPercentage < 25 && actualCost > budgetTotal * 0.5) {
          alertType = 'cost_overrun';
          alertSeverity = 'critical';
        }

        // Calculate capital coverage
        const capitalCoverage = budgetTotal > 0 ? (capitalTotal / budgetTotal) * 100 : 0;

        return {
          _id: floor._id.toString(),
          floorNumber: floor.floorNumber,
          name: floor.name || `Floor ${floor.floorNumber}`,
          status: floor.status || 'NOT_STARTED',
          completionPercentage,
          budget: {
            total: budgetTotal,
            actual: actualCost,
            remaining: budgetRemaining,
            utilization: Math.round(budgetUtilization)
          },
          capital: {
            total: capitalTotal,
            used: capitalUsed,
            committed: capitalCommitted,
            remaining: capitalRemaining,
            coverage: Math.round(capitalCoverage)
          },
          dependencies: {
            materials: materialsCount,
            requests: requestsCount,
            purchaseOrders: purchaseOrdersCount
          },
          alert: alertType ? { type: alertType, severity: alertSeverity } : null,
          startDate: floor.startDate,
          completionDate: floor.completionDate
        };
      })
    );

    // Calculate summary statistics
    const summary = {
      totalFloors: enrichedFloors.length,
      floorsNotStarted: enrichedFloors.filter(f => f.status === 'NOT_STARTED').length,
      floorsInProgress: enrichedFloors.filter(f => f.status === 'IN_PROGRESS').length,
      floorsCompleted: enrichedFloors.filter(f => f.status === 'COMPLETED').length,
      floorsOverBudget: enrichedFloors.filter(f => f.alert?.type === 'over_budget').length,
      floorsLowCapital: enrichedFloors.filter(f => f.alert?.type === 'low_capital').length,
      floorsNoProgress: enrichedFloors.filter(f => f.alert?.type === 'no_progress').length,
      avgProgress: enrichedFloors.length > 0
        ? Math.round(enrichedFloors.reduce((sum, f) => sum + f.completionPercentage, 0) / enrichedFloors.length)
        : 0,
      totalBudget: enrichedFloors.reduce((sum, f) => sum + f.budget.total, 0),
      totalCapital: enrichedFloors.reduce((sum, f) => sum + f.capital.total, 0),
      totalActualCost: enrichedFloors.reduce((sum, f) => sum + f.budget.actual, 0),
      avgCapitalCoverage: enrichedFloors.length > 0
        ? Math.round(enrichedFloors.reduce((sum, f) => sum + f.capital.coverage, 0) / enrichedFloors.length)
        : 0
    };

    // Generate alerts
    const alerts = enrichedFloors
      .filter(f => f.alert)
      .map(f => ({
        floorId: f._id,
        floorName: f.name,
        floorNumber: f.floorNumber,
        ...f.alert,
        message: getAlertMessage(f.alert.type, f),
        budget: f.budget,
        capital: f.capital,
        progress: f.completionPercentage
      }));

    // Sort alerts by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Prepare progress visualization data
    const progressVisualization = enrichedFloors.map(f => ({
      floorId: f._id,
      name: f.name,
      floorNumber: f.floorNumber,
      progress: f.completionPercentage,
      budget: f.budget.total,
      actual: f.budget.actual,
      capital: f.capital.total,
      status: f.status,
      alert: f.alert
    })).sort((a, b) => a.floorNumber - b.floorNumber);

    return successResponse({
      projectId,
      summary,
      floors: enrichedFloors,
      alerts,
      progressVisualization
    }, 'Floor dashboard data retrieved successfully');
  } catch (error) {
    console.error('Get floor dashboard error:', error);
    return errorResponse('Failed to retrieve floor dashboard data', 500);
  }
}

/**
 * Generate alert message based on alert type
 */
function getAlertMessage(alertType, floor) {
  switch (alertType) {
    case 'over_budget':
      return `Budget exceeded by ${(floor.budget.utilization - 100).toFixed(0)}%. Actual: ${formatCurrency(floor.budget.actual)}, Budget: ${formatCurrency(floor.budget.total)}`;
    case 'low_capital':
      return `Only ${(floor.capital.remaining / floor.capital.total * 100).toFixed(0)}% capital remaining. ${formatCurrency(floor.capital.remaining)} of ${formatCurrency(floor.capital.total)} left`;
    case 'no_progress':
      return `No progress recorded despite ${formatCurrency(floor.budget.actual)} spent`;
    case 'cost_overrun':
      return `At ${floor.completionPercentage}% progress but ${floor.budget.utilization}% of budget used`;
    default:
      return '';
  }
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}
