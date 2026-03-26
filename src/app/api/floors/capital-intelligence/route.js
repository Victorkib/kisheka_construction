/**
 * Floor Capital Intelligence API
 * GET: Get smart capital suggestions and heat map data
 *
 * GET /api/floors/capital-intelligence?projectId=xxx
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/floors/capital-intelligence
 * Returns smart capital suggestions, heat map data, and recommendations
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId required', 400);
    }

    const db = await getDatabase();
    const projectObjectId = new ObjectId(projectId);

    // Get project finances
    const projectFinances = await db.collection('project_finances').findOne({
      projectId: projectObjectId,
      deletedAt: null
    });

    const availableProjectCapital = projectFinances?.capitalBalance || 0;
    const totalInvested = projectFinances?.totalInvested || 0;

    // Get all floors for the project
    const floors = await db.collection('floors').find({
      projectId: projectObjectId,
      deletedAt: null
    }).sort({ floorNumber: 1 }).toArray();

    if (floors.length === 0) {
      return successResponse({
        heatMap: [],
        suggestions: [],
        alerts: [],
        summary: {
          totalFloors: 0,
          floorsWithCapital: 0,
          floorsWithoutCapital: 0,
          avgCoverage: 0,
          totalCapitalAllocated: 0,
          totalCapitalNeeded: 0
        }
      }, 'No floors found');
    }

    // Analyze each floor
    const floorAnalysis = await Promise.all(
      floors.map(async (floor) => {
        const capitalAllocation = floor.capitalAllocation || { total: 0, used: 0, committed: 0, remaining: 0 };
        const budgetAllocation = floor.budgetAllocation || { total: floor.totalBudget || 0 };
        
        const capitalTotal = capitalAllocation.total || 0;
        const capitalUsed = capitalAllocation.used || 0;
        const capitalCommitted = capitalAllocation.committed || 0;
        const capitalRemaining = capitalAllocation.remaining !== undefined 
          ? capitalAllocation.remaining 
          : capitalTotal - capitalUsed - capitalCommitted;
        
        const budgetTotal = budgetAllocation.total || 0;
        const actualSpending = floor.actualCost || 0;
        
        // Calculate coverage
        const coverage = budgetTotal > 0 ? (capitalTotal / budgetTotal) * 100 : 0;
        const coverageStatus = getCoverageStatus(coverage);
        
        // Calculate minimum required capital (actual + committed)
        const minimumRequired = actualSpending + capitalCommitted;
        
        // Calculate suggested capital (80% of budget or minimum required, whichever is higher)
        const targetCoverage = 0.80;
        const suggestedCapital = Math.max(
          minimumRequired,
          budgetTotal * targetCoverage
        );
        
        const capitalGap = suggestedCapital - capitalTotal;
        
        // Calculate spending velocity (daily rate)
        const daysSinceCreation = floor.createdAt 
          ? Math.max(1, (new Date() - new Date(floor.createdAt)) / (1000 * 60 * 60 * 24))
          : 1;
        const dailySpendingRate = actualSpending / daysSinceCreation;
        
        // Predict days until shortfall
        const daysUntilShortfall = dailySpendingRate > 0 ? capitalRemaining / dailySpendingRate : Infinity;
        
        // Determine alerts
        const alerts = [];
        if (coverage < 50) {
          alerts.push({ type: 'critical', message: 'Capital coverage critically low (<50%)' });
        } else if (coverage < 80) {
          alerts.push({ type: 'warning', message: 'Capital coverage below target (<80%)' });
        }
        
        if (daysUntilShortfall < 7 && dailySpendingRate > 0) {
          alerts.push({ 
            type: 'critical', 
            message: `Capital shortfall predicted in ${Math.round(daysUntilShortfall)} days` 
          });
        } else if (daysUntilShortfall < 14 && dailySpendingRate > 0) {
          alerts.push({ 
            type: 'warning', 
            message: `Capital shortfall predicted in ${Math.round(daysUntilShortfall)} days` 
          });
        }
        
        if (capitalTotal === 0 && budgetTotal > 0) {
          alerts.push({ type: 'critical', message: 'No capital allocated despite budget' });
        }
        
        if (coverage > 120 && budgetTotal > 0) {
          alerts.push({ type: 'info', message: 'Capital exceeds budget (consider reallocating)' });
        }
        
        return {
          _id: floor._id.toString(),
          floorNumber: floor.floorNumber,
          name: floor.name || `Floor ${floor.floorNumber}`,
          capital: {
            total: capitalTotal,
            used: capitalUsed,
            committed: capitalCommitted,
            remaining: capitalRemaining
          },
          budget: {
            total: budgetTotal,
            actual: actualSpending
          },
          coverage: Math.round(coverage),
          coverageStatus,
          minimumRequired,
          suggestedCapital: Math.round(suggestedCapital),
          capitalGap: Math.round(capitalGap),
          dailySpendingRate: Math.round(dailySpendingRate),
          daysUntilShortfall: daysUntilShortfall === Infinity ? null : Math.round(daysUntilShortfall),
          alerts,
          recommendation: getRecommendation(coverage, capitalGap, daysUntilShortfall, coverageStatus)
        };
      })
    );

    // Sort by coverage (lowest first for heat map)
    const heatMap = [...floorAnalysis].sort((a, b) => a.coverage - b.coverage);
    
    // Generate suggestions
    const suggestions = generateSuggestions(floorAnalysis, availableProjectCapital);
    
    // Generate alerts summary
    const allAlerts = floorAnalysis
      .filter(f => f.alerts.length > 0)
      .flatMap(f => f.alerts.map(a => ({
        floorId: f._id,
        floorName: f.name,
        ...a
      })))
      .sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        return severityOrder[a.type] - severityOrder[b.type];
      });

    // Calculate summary
    const summary = {
      totalFloors: floors.length,
      floorsWithCapital: floorAnalysis.filter(f => f.capital.total > 0).length,
      floorsWithoutCapital: floorAnalysis.filter(f => f.capital.total === 0).length,
      avgCoverage: Math.round(floorAnalysis.reduce((sum, f) => sum + f.coverage, 0) / floorAnalysis.length),
      totalCapitalAllocated: floorAnalysis.reduce((sum, f) => sum + f.capital.total, 0),
      totalCapitalNeeded: floorAnalysis.reduce((sum, f) => sum + f.suggestedCapital, 0),
      floorsNeedingCapital: floorAnalysis.filter(f => f.capitalGap > 0).length,
      floorsExcessCapital: floorAnalysis.filter(f => f.coverage > 120).length,
      criticalAlerts: allAlerts.filter(a => a.type === 'critical').length,
      warningAlerts: allAlerts.filter(a => a.type === 'warning').length
    };

    return successResponse({
      projectId,
      heatMap,
      suggestions,
      alerts: allAlerts,
      summary,
      availableProjectCapital,
      totalInvested,
      capitalShortfall: Math.max(0, summary.totalCapitalNeeded - summary.totalCapitalAllocated - availableProjectCapital)
    }, 'Capital intelligence retrieved successfully');
  } catch (error) {
    console.error('Capital intelligence error:', error);
    return errorResponse('Failed to retrieve capital intelligence', 500);
  }
}

/**
 * Get coverage status
 */
function getCoverageStatus(coverage) {
  if (coverage >= 100) return 'full';
  if (coverage >= 80) return 'good';
  if (coverage >= 50) return 'fair';
  if (coverage > 0) return 'low';
  return 'none';
}

/**
 * Get recommendation based on analysis
 */
function getRecommendation(coverage, capitalGap, daysUntilShortfall, coverageStatus) {
  if (coverage === 0) {
    return {
      action: 'allocate',
      priority: 'critical',
      message: 'Allocate capital immediately - no capital allocated'
    };
  }
  
  if (coverage < 50) {
    return {
      action: 'increase',
      priority: 'critical',
      message: `Increase capital urgently - only ${coverage}% coverage`
    };
  }
  
  if (daysUntilShortfall < 7 && daysUntilShortfall !== null) {
    return {
      action: 'replenish',
      priority: 'critical',
      message: `Replenish capital within ${Math.round(daysUntilShortfall)} days`
    };
  }
  
  if (coverage < 80) {
    return {
      action: 'increase',
      priority: 'high',
      message: `Increase capital to reach 80% coverage target`
    };
  }
  
  if (coverage > 120) {
    return {
      action: 'reduce',
      priority: 'low',
      message: 'Consider reducing excess capital for other floors'
    };
  }
  
  return {
    action: 'maintain',
    priority: 'normal',
    message: 'Capital allocation is adequate'
  };
}

/**
 * Generate smart suggestions
 */
function generateSuggestions(floorAnalysis, availableCapital) {
  const suggestions = [];
  
  // Sort by priority (critical first)
  const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
  const sortedFloors = [...floorAnalysis].sort((a, b) => 
    priorityOrder[a.recommendation.priority] - priorityOrder[b.recommendation.priority]
  );
  
  let remainingCapital = availableCapital;
  
  for (const floor of sortedFloors) {
    if (floor.recommendation.action === 'maintain') continue;
    
    const suggestedAmount = floor.capitalGap > 0 ? floor.capitalGap : 0;
    
    if (suggestedAmount > 0) {
      const allocateAmount = Math.min(suggestedAmount, remainingCapital);
      
      if (allocateAmount > 0) {
        suggestions.push({
          floorId: floor._id,
          floorName: floor.name,
          currentCapital: floor.capital.total,
          suggestedCapital: floor.suggestedCapital,
          allocateAmount,
          priority: floor.recommendation.priority,
          reason: floor.recommendation.message,
          impact: {
            newCoverage: Math.round(((floor.capital.total + allocateAmount) / floor.budget.total) * 100) || 0,
            daysOfRunway: floor.dailySpendingRate > 0 
              ? Math.round((floor.capital.remaining + allocateAmount) / floor.dailySpendingRate)
              : null
          }
        });
        
        remainingCapital -= allocateAmount;
      }
    } else if (floor.recommendation.action === 'reduce') {
      // Suggest reducing excess capital
      const excessAmount = Math.round(floor.capital.total - (floor.budget.total * 0.80));
      
      if (excessAmount > 0) {
        suggestions.push({
          floorId: floor._id,
          floorName: floor.name,
          currentCapital: floor.capital.total,
          suggestedCapital: Math.round(floor.budget.total * 0.80),
          reduceAmount: excessAmount,
          priority: 'low',
          reason: 'Excess capital - consider reallocating to other floors',
          impact: {
            newCoverage: 80,
            freedCapital: excessAmount
          }
        });
      }
    }
  }
  
  return suggestions;
}
