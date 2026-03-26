/**
 * Floor Budget Benchmarking API
 * GET: Get budget benchmarking data for similar floors
 *
 * GET /api/floors/benchmarking?projectId=xxx&floorId=xxx (optional)
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/floors/benchmarking
 * Returns budget benchmarking data for comparing floors
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
    const floorId = searchParams.get('floorId'); // Optional: get benchmarks for specific floor

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
        byFloorType: {},
        averages: {},
        comparisons: [],
        suggestions: []
      }, 'No floors found for benchmarking');
    }

    // Group floors by type
    const floorsByType = {
      basement: [],
      ground: [],
      typical: [],
      penthouse: [],
      rooftop: []
    };

    floors.forEach(floor => {
      const floorType = getFloorType(floor.floorNumber);
      if (floorsByType[floorType]) {
        floorsByType[floorType].push(floor);
      }
    });

    // Calculate benchmarks for each floor type
    const benchmarks = {};
    
    Object.keys(floorsByType).forEach(type => {
      const typeFloors = floorsByType[type];
      if (typeFloors.length === 0) return;

      const validFloors = typeFloors.filter(f => 
        f.budgetAllocation?.total > 0 || f.totalBudget > 0
      );

      if (validFloors.length === 0) {
        benchmarks[type] = {
          count: 0,
          message: 'No budgeted floors of this type'
        };
        return;
      }

      // Calculate averages
      const totalBudgets = validFloors.map(f => f.budgetAllocation?.total || f.totalBudget || 0);
      const avgBudget = totalBudgets.reduce((sum, b) => sum + b, 0) / totalBudgets.length;
      const minBudget = Math.min(...totalBudgets);
      const maxBudget = Math.max(...totalBudgets);

      // Calculate category percentages
      const categoryPercentages = {
        materials: [],
        labour: [],
        equipment: [],
        subcontractors: [],
        contingency: []
      };

      validFloors.forEach(floor => {
        const budget = floor.budgetAllocation || { total: floor.totalBudget || 0 };
        const total = budget.total || 0;
        
        if (total > 0) {
          categoryPercentages.materials.push((budget.materials || 0) / total * 100);
          categoryPercentages.labour.push((budget.labour || 0) / total * 100);
          categoryPercentages.equipment.push((budget.equipment || 0) / total * 100);
          categoryPercentages.subcontractors.push((budget.subcontractors || 0) / total * 100);
          categoryPercentages.contingency.push((budget.contingency || 0) / total * 100);
        }
      });

      const avgPercentages = {
        materials: categoryPercentages.materials.length > 0 
          ? categoryPercentages.materials.reduce((sum, p) => sum + p, 0) / categoryPercentages.materials.length 
          : 65,
        labour: categoryPercentages.labour.length > 0 
          ? categoryPercentages.labour.reduce((sum, p) => sum + p, 0) / categoryPercentages.labour.length 
          : 25,
        equipment: categoryPercentages.equipment.length > 0 
          ? categoryPercentages.equipment.reduce((sum, p) => sum + p, 0) / categoryPercentages.equipment.length 
          : 5,
        subcontractors: categoryPercentages.subcontractors.length > 0 
          ? categoryPercentages.subcontractors.reduce((sum, p) => sum + p, 0) / categoryPercentages.subcontractors.length 
          : 3,
        contingency: categoryPercentages.contingency.length > 0 
          ? categoryPercentages.contingency.reduce((sum, p) => sum + p, 0) / categoryPercentages.contingency.length 
          : 2
      };

      // Calculate phase breakdown averages
      const phaseAverages = {};
      const phaseCodes = ['PHASE-01', 'PHASE-02', 'PHASE-03', 'PHASE-04'];
      
      phaseCodes.forEach(phaseCode => {
        const phaseBudgets = validFloors
          .map(f => f.budgetAllocation?.byPhase?.[phaseCode]?.total || 0)
          .filter(b => b > 0);
        
        if (phaseBudgets.length > 0) {
          phaseAverages[phaseCode] = {
            avg: phaseBudgets.reduce((sum, b) => sum + b, 0) / phaseBudgets.length,
            min: Math.min(...phaseBudgets),
            max: Math.max(...phaseBudgets),
            count: phaseBudgets.length
          };
        }
      });

      benchmarks[type] = {
        count: validFloors.length,
        totalFloors: typeFloors.length,
        budget: {
          avg: Math.round(avgBudget),
          min: Math.round(minBudget),
          max: Math.round(maxBudget),
          median: calculateMedian(totalBudgets)
        },
        categoryPercentages: {
          avg: avgPercentages,
          typical: {
            materials: 65,
            labour: 25,
            equipment: 5,
            subcontractors: 3,
            contingency: 2
          }
        },
        phaseBreakdown: phaseAverages,
        floors: validFloors.map(f => ({
          _id: f._id.toString(),
          name: f.name || `Floor ${f.floorNumber}`,
          floorNumber: f.floorNumber,
          totalBudget: f.budgetAllocation?.total || f.totalBudget || 0,
          categoryPercentages: getCategoryPercentages(f.budgetAllocation || { total: f.totalBudget })
        }))
      };
    });

    // Generate comparisons for specific floor if requested
    let comparisons = [];
    let suggestions = [];

    if (floorId && ObjectId.isValid(floorId)) {
      const targetFloor = await db.collection('floors').findOne({
        _id: new ObjectId(floorId),
        projectId: projectObjectId,
        deletedAt: null
      });

      if (targetFloor) {
        const floorType = getFloorType(targetFloor.floorNumber);
        const typeBenchmark = benchmarks[floorType];

        if (typeBenchmark && typeBenchmark.count > 0) {
          const floorBudget = targetFloor.budgetAllocation?.total || targetFloor.totalBudget || 0;
          
          // Compare to average
          const variance = floorBudget - typeBenchmark.budget.avg;
          const variancePercent = typeBenchmark.budget.avg > 0 
            ? (variance / typeBenchmark.budget.avg) * 100 
            : 0;

          comparisons.push({
            metric: 'Total Budget',
            floorValue: floorBudget,
            benchmarkValue: typeBenchmark.budget.avg,
            variance: Math.round(variance),
            variancePercent: Math.round(variancePercent),
            status: Math.abs(variancePercent) < 10 ? 'normal' : variancePercent < 0 ? 'below' : 'above'
          });

          // Compare category percentages
          const floorPercentages = getCategoryPercentages(targetFloor.budgetAllocation || { total: floorBudget });
          
          Object.keys(floorPercentages).forEach(category => {
            const floorPct = floorPercentages[category];
            const benchmarkPct = typeBenchmark.categoryPercentages.avg[category];
            const pctVariance = floorPct - benchmarkPct;
            
            if (Math.abs(pctVariance) > 3) { // Only show if variance > 3%
              comparisons.push({
                metric: `${category} %`,
                floorValue: Math.round(floorPct * 100) / 100,
                benchmarkValue: Math.round(benchmarkPct * 100) / 100,
                variance: Math.round(pctVariance * 100) / 100,
                variancePercent: Math.round((pctVariance / benchmarkPct) * 100),
                status: pctVariance > 3 ? 'high' : pctVariance < -3 ? 'low' : 'normal'
              });
            }
          });

          // Generate suggestions
          if (variancePercent < -15) {
            suggestions.push({
              type: 'increase',
              priority: 'high',
              message: `Budget is ${Math.abs(Math.round(variancePercent))}% below average for ${floorType} floors`,
              recommendation: `Consider increasing budget by ${formatCurrency(Math.abs(variance))} to match typical ${floorType} floor spending`
            });
          } else if (variancePercent > 15) {
            suggestions.push({
              type: 'review',
              priority: 'medium',
              message: `Budget is ${Math.round(variancePercent)}% above average for ${floorType} floors`,
              recommendation: 'Review budget allocation - may be over-budgeted compared to similar floors'
            });
          }

          // Category-specific suggestions
          Object.keys(floorPercentages).forEach(category => {
            const floorPct = floorPercentages[category];
            const benchmarkPct = typeBenchmark.categoryPercentages.avg[category];
            
            if (floorPct > benchmarkPct + 5) {
              suggestions.push({
                type: 'category_high',
                priority: 'low',
                category,
                message: `${category} allocation (${Math.round(floorPct)}%) is higher than typical (${Math.round(benchmarkPct)}%)`,
                recommendation: `Consider reducing ${category} allocation to match benchmark patterns`
              });
            } else if (floorPct < benchmarkPct - 5) {
              suggestions.push({
                type: 'category_low',
                priority: 'low',
                category,
                message: `${category} allocation (${Math.round(floorPct)}%) is lower than typical (${Math.round(benchmarkPct)}%)`,
                recommendation: `Consider increasing ${category} allocation to match benchmark patterns`
              });
            }
          });
        }
      }
    }

    return successResponse({
      byFloorType: benchmarks,
      averages: calculateProjectAverages(floors),
      comparisons,
      suggestions,
      floorType: floorId ? getFloorType(
        floors.find(f => f._id.toString() === floorId)?.floorNumber
      ) : null
    }, 'Budget benchmarking data retrieved successfully');
  } catch (error) {
    console.error('Budget benchmarking error:', error);
    return errorResponse('Failed to retrieve budget benchmarking data', 500);
  }
}

/**
 * Get floor type from floor number
 */
function getFloorType(floorNumber) {
  if (floorNumber === undefined || floorNumber === null) return 'unknown';
  if (floorNumber < 0) return 'basement';
  if (floorNumber === 0) return 'ground';
  return 'typical';
}

/**
 * Calculate category percentages from budget allocation
 */
function getCategoryPercentages(budget) {
  const total = budget.total || 0;
  if (total === 0) {
    return { materials: 0, labour: 0, equipment: 0, subcontractors: 0, contingency: 0 };
  }

  return {
    materials: (budget.materials || 0) / total * 100,
    labour: (budget.labour || 0) / total * 100,
    equipment: (budget.equipment || 0) / total * 100,
    subcontractors: (budget.subcontractors || 0) / total * 100,
    contingency: (budget.contingency || 0) / total * 100
  };
}

/**
 * Calculate median
 */
function calculateMedian(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Calculate project-wide averages
 */
function calculateProjectAverages(floors) {
  const validFloors = floors.filter(f => f.budgetAllocation?.total > 0 || f.totalBudget > 0);
  
  if (validFloors.length === 0) {
    return { count: 0 };
  }

  const totalBudgets = validFloors.map(f => f.budgetAllocation?.total || f.totalBudget || 0);
  const avgBudget = totalBudgets.reduce((sum, b) => sum + b, 0) / totalBudgets.length;

  return {
    count: validFloors.length,
    avgBudget: Math.round(avgBudget),
    totalBudget: totalBudgets.reduce((sum, b) => sum + b, 0)
  };
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
