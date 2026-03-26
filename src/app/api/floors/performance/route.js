/**
 * Floor Performance Scoring API
 * GET: Get performance scores for all floors in a project
 *
 * GET /api/floors/performance?projectId=xxx
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/floors/performance
 * Returns performance scores for all floors
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

    // Get all floors for the project
    const floors = await db.collection('floors').find({
      projectId: projectObjectId,
      deletedAt: null
    }).toArray();

    if (floors.length === 0) {
      return successResponse({
        floors: [],
        summary: {},
        topPerformers: [],
        needsAttention: []
      }, 'No floors found');
    }

    // Calculate performance scores for each floor
    const floorScores = await Promise.all(
      floors.map(async (floor) => {
        const score = await calculateFloorPerformance(floor, db);
        return {
          floorId: floor._id.toString(),
          floorName: floor.name || `Floor ${floor.floorNumber}`,
          floorNumber: floor.floorNumber,
          ...score
        };
      })
    );

    // Sort by overall score
    const sortedByScore = [...floorScores].sort((a, b) => b.overallScore - a.overallScore);

    // Get top performers (top 25%)
    const topCount = Math.ceil(floorScores.length * 0.25);
    const topPerformers = sortedByScore.slice(0, topCount);

    // Get floors needing attention (bottom 25% or score < 50)
    const needsAttention = sortedByScore.filter(f => f.overallScore < 50);

    // Calculate summary statistics
    const summary = {
      totalFloors: floors.length,
      avgOverallScore: Math.round(floorScores.reduce((sum, f) => sum + f.overallScore, 0) / floorScores.length),
      avgCapitalEfficiency: Math.round(floorScores.reduce((sum, f) => sum + f.capitalEfficiency.score, 0) / floorScores.length),
      avgBudgetAdherence: Math.round(floorScores.reduce((sum, f) => sum + f.budgetAdherence.score, 0) / floorScores.length),
      avgProgressVelocity: Math.round(floorScores.reduce((sum, f) => sum + f.progressVelocity.score, 0) / floorScores.length),
      excellentCount: floorScores.filter(f => f.overallScore >= 80).length,
      goodCount: floorScores.filter(f => f.overallScore >= 60 && f.overallScore < 80).length,
      fairCount: floorScores.filter(f => f.overallScore >= 40 && f.overallScore < 60).length,
      poorCount: floorScores.filter(f => f.overallScore < 40).length
    };

    return successResponse({
      projectId,
      floors: floorScores,
      summary,
      topPerformers,
      needsAttention
    }, 'Floor performance scores calculated successfully');
  } catch (error) {
    console.error('Floor performance scoring error:', error);
    return errorResponse('Failed to calculate floor performance scores', 500);
  }
}

/**
 * Calculate comprehensive performance score for a floor
 */
async function calculateFloorPerformance(floor, db) {
  const capitalAllocation = floor.capitalAllocation || { total: 0, used: 0, remaining: 0 };
  const budgetAllocation = floor.budgetAllocation || { total: floor.totalBudget || 0 };
  const actualCost = floor.actualCost || 0;
  const completionPercentage = floor.progress?.completionPercentage || 0;

  // 1. Capital Efficiency Score (0-100)
  // Measures how well capital is being utilized
  const capitalEfficiency = calculateCapitalEfficiency(floor, capitalAllocation, actualCost);

  // 2. Budget Adherence Score (0-100)
  // Measures how close actual spending is to budget
  const budgetAdherence = calculateBudgetAdherence(floor, budgetAllocation, actualCost);

  // 3. Progress Velocity Score (0-100)
  // Measures progress rate compared to expected rate
  const progressVelocity = await calculateProgressVelocity(floor, completionPercentage, db);

  // 4. Capital Coverage Score (0-100)
  // Measures if capital is sufficient for remaining work
  const capitalCoverage = calculateCapitalCoverage(floor, capitalAllocation, budgetAllocation, completionPercentage);

  // 5. Spending Efficiency Score (0-100)
  // Measures if spending rate matches progress rate
  const spendingEfficiency = calculateSpendingEfficiency(floor, actualCost, budgetAllocation, completionPercentage);

  // Calculate weighted overall score
  const weights = {
    capitalEfficiency: 0.20,
    budgetAdherence: 0.25,
    progressVelocity: 0.25,
    capitalCoverage: 0.15,
    spendingEfficiency: 0.15
  };

  const overallScore = Math.round(
    capitalEfficiency.score * weights.capitalEfficiency +
    budgetAdherence.score * weights.budgetAdherence +
    progressVelocity.score * weights.progressVelocity +
    capitalCoverage.score * weights.capitalCoverage +
    spendingEfficiency.score * weights.spendingEfficiency
  );

  // Determine performance tier
  let performanceTier = 'poor';
  if (overallScore >= 80) performanceTier = 'excellent';
  else if (overallScore >= 60) performanceTier = 'good';
  else if (overallScore >= 40) performanceTier = 'fair';

  // Generate insights
  const insights = generatePerformanceInsights({
    capitalEfficiency,
    budgetAdherence,
    progressVelocity,
    capitalCoverage,
    spendingEfficiency,
    overallScore,
    performanceTier
  });

  return {
    overallScore,
    performanceTier,
    capitalEfficiency,
    budgetAdherence,
    progressVelocity,
    capitalCoverage,
    spendingEfficiency,
    insights,
    calculatedAt: new Date().toISOString()
  };
}

/**
 * Calculate capital efficiency score
 */
function calculateCapitalEfficiency(floor, capitalAllocation, actualCost) {
  const capitalTotal = capitalAllocation.total || 0;
  const capitalUsed = capitalAllocation.used || 0;
  const capitalRemaining = capitalAllocation.remaining !== undefined
    ? capitalAllocation.remaining
    : capitalTotal - capitalUsed;

  // Capital utilization rate (should be neither too low nor too high)
  const utilizationRate = capitalTotal > 0 ? capitalUsed / capitalTotal : 0;
  
  // Optimal utilization is between 60-90%
  let utilizationScore = 0;
  if (utilizationRate >= 0.6 && utilizationRate <= 0.9) {
    utilizationScore = 100;
  } else if (utilizationRate < 0.6) {
    utilizationScore = Math.round((utilizationRate / 0.6) * 100);
  } else {
    utilizationScore = Math.round(100 - ((utilizationRate - 0.9) / 0.1) * 100);
  }

  // Capital coverage (remaining vs needed)
  const budgetTotal = floor.budgetAllocation?.total || floor.totalBudget || 0;
  const budgetRemaining = budgetTotal - actualCost;
  const coverageRate = capitalRemaining > 0 && budgetRemaining > 0
    ? Math.min(1, capitalRemaining / budgetRemaining)
    : 0;

  const coverageScore = Math.round(coverageRate * 100);

  // Combined score
  const score = Math.round(utilizationScore * 0.5 + coverageScore * 0.5);

  return {
    score,
    utilizationRate: Math.round(utilizationRate * 100),
    coverageRate: Math.round(coverageRate * 100),
    status: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor'
  };
}

/**
 * Calculate budget adherence score
 */
function calculateBudgetAdherence(floor, budgetAllocation, actualCost) {
  const budgetTotal = budgetAllocation.total || 0;
  
  if (budgetTotal === 0) {
    return {
      score: 50, // Neutral if no budget set
      variance: 0,
      variancePercent: 0,
      status: 'neutral'
    };
  }

  const variance = actualCost - budgetTotal;
  const variancePercent = (variance / budgetTotal) * 100;

  // Score based on how close to budget
  let score = 100;
  if (variancePercent > 0) {
    // Over budget
    score = Math.max(0, 100 - (variancePercent * 2)); // Penalize over-budget more
  } else {
    // Under budget (less penalized)
    score = Math.max(50, 100 - (Math.abs(variancePercent) * 0.5));
  }

  let status = 'excellent';
  if (variancePercent > 10) status = 'poor';
  else if (variancePercent > 5) status = 'fair';
  else if (variancePercent > 0) status = 'good';

  return {
    score: Math.round(score),
    variance: Math.round(variance),
    variancePercent: Math.round(variancePercent),
    status
  };
}

/**
 * Calculate progress velocity score
 */
async function calculateProgressVelocity(floor, completionPercentage, db) {
  const createdAt = floor.createdAt ? new Date(floor.createdAt) : new Date();
  const daysSinceCreation = Math.max(1, (new Date() - createdAt) / (1000 * 60 * 60 * 24));
  
  // Actual velocity
  const actualVelocity = completionPercentage / daysSinceCreation;

  // Expected velocity (assume 100% in 90 days as baseline)
  const expectedVelocity = 100 / 90; // ~1.11% per day

  // Velocity ratio
  const velocityRatio = actualVelocity / expectedVelocity;

  // Score based on velocity ratio
  let score = Math.min(100, Math.round(velocityRatio * 100));
  
  // Penalize extremely slow progress more
  if (velocityRatio < 0.5) {
    score = Math.round(velocityRatio * 100); // Steeper penalty
  }

  // Bonus for on-track or ahead
  if (velocityRatio >= 1) {
    score = Math.min(100, score + 10);
  }

  let status = 'poor';
  if (velocityRatio >= 1) status = 'excellent';
  else if (velocityRatio >= 0.8) status = 'good';
  else if (velocityRatio >= 0.5) status = 'fair';

  return {
    score,
    actualVelocity: Math.round(actualVelocity * 100) / 100,
    expectedVelocity: Math.round(expectedVelocity * 100) / 100,
    velocityRatio: Math.round(velocityRatio * 100),
    daysSinceCreation: Math.round(daysSinceCreation),
    projectedDaysToComplete: actualVelocity > 0 ? Math.round((100 - completionPercentage) / actualVelocity) : null,
    status
  };
}

/**
 * Calculate capital coverage score
 */
function calculateCapitalCoverage(floor, capitalAllocation, budgetAllocation, completionPercentage) {
  const capitalRemaining = capitalAllocation.remaining !== undefined
    ? capitalAllocation.remaining
    : (capitalAllocation.total || 0) - (capitalAllocation.used || 0) - (capitalAllocation.committed || 0);

  const budgetTotal = budgetAllocation.total || 0;
  const actualCost = floor.actualCost || 0;
  const budgetRemaining = budgetTotal - actualCost;
  const workRemaining = 100 - completionPercentage;

  // Capital needed for remaining work (proportional)
  const capitalNeeded = workRemaining > 0 ? (budgetRemaining * (workRemaining / 100)) : 0;

  // Coverage ratio
  const coverageRatio = capitalNeeded > 0 ? capitalRemaining / capitalNeeded : 1;

  let score = Math.min(100, Math.round(coverageRatio * 100));
  
  // Bonus for healthy buffer
  if (coverageRatio >= 1.2) {
    score = Math.min(100, score + 5);
  }

  // Penalty for critical shortage
  if (coverageRatio < 0.5) {
    score = Math.round(coverageRatio * 50); // Steep penalty
  }

  let status = 'poor';
  if (coverageRatio >= 1) status = 'excellent';
  else if (coverageRatio >= 0.8) status = 'good';
  else if (coverageRatio >= 0.5) status = 'fair';

  return {
    score,
    coverageRatio: Math.round(coverageRatio * 100),
    capitalRemaining: Math.round(capitalRemaining),
    capitalNeeded: Math.round(capitalNeeded),
    surplus: Math.round(capitalRemaining - capitalNeeded),
    status
  };
}

/**
 * Calculate spending efficiency score
 */
function calculateSpendingEfficiency(floor, actualCost, budgetAllocation, completionPercentage) {
  const budgetTotal = budgetAllocation.total || 0;
  
  if (budgetTotal === 0 || completionPercentage === 0) {
    return {
      score: 50,
      expectedSpend: 0,
      actualSpend: actualCost,
      efficiencyRatio: 1,
      status: 'neutral'
    };
  }

  // Expected spend at this completion percentage
  const expectedSpend = budgetTotal * (completionPercentage / 100);
  
  // Efficiency ratio (expected / actual)
  const efficiencyRatio = actualCost > 0 ? expectedSpend / actualCost : 1;

  let score = Math.min(100, Math.round(efficiencyRatio * 100));

  // Penalize overspending
  if (efficiencyRatio < 1) {
    score = Math.round(efficiencyRatio * 80); // Steeper penalty for overspending
  }

  let status = 'poor';
  if (efficiencyRatio >= 1) status = 'excellent';
  else if (efficiencyRatio >= 0.8) status = 'good';
  else if (efficiencyRatio >= 0.6) status = 'fair';

  return {
    score,
    expectedSpend: Math.round(expectedSpend),
    actualSpend: actualCost,
    efficiencyRatio: Math.round(efficiencyRatio * 100),
    variance: Math.round(expectedSpend - actualCost),
    status
  };
}

/**
 * Generate performance insights
 */
function generatePerformanceInsights(metrics) {
  const insights = [];

  // Capital efficiency insights
  if (metrics.capitalEfficiency.status === 'poor') {
    insights.push({
      category: 'capital',
      priority: 'high',
      title: 'Low Capital Efficiency',
      description: 'Capital is either underutilized or depleted too quickly',
      recommendation: 'Review capital allocation and spending patterns'
    });
  }

  // Budget adherence insights
  if (metrics.budgetAdherence.status === 'poor') {
    insights.push({
      category: 'budget',
      priority: 'critical',
      title: 'Over Budget',
      description: `Spending exceeds budget by ${Math.abs(metrics.budgetAdherence.variancePercent)}%`,
      recommendation: 'Implement cost control measures immediately'
    });
  }

  // Progress velocity insights
  if (metrics.progressVelocity.status === 'poor') {
    insights.push({
      category: 'progress',
      priority: 'high',
      title: 'Slow Progress',
      description: `Progress velocity is ${100 - metrics.progressVelocity.velocityRatio}% below expected`,
      recommendation: 'Identify and address bottlenecks'
    });
  }

  // Capital coverage insights
  if (metrics.capitalCoverage.status === 'poor') {
    insights.push({
      category: 'capital',
      priority: 'critical',
      title: 'Capital Shortfall Risk',
      description: `Capital covers only ${metrics.capitalCoverage.coverageRatio}% of remaining work`,
      recommendation: 'Allocate additional capital or reduce scope'
    });
  }

  // Positive insights
  if (metrics.overallScore >= 80) {
    insights.push({
      category: 'general',
      priority: 'info',
      title: 'Excellent Performance',
      description: 'This floor is performing exceptionally well across all metrics',
      recommendation: 'Consider using as a benchmark for other floors'
    });
  }

  return insights;
}
