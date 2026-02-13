/**
 * Pre-Budget Spending Summary API Route
 * GET: Get comprehensive spending summary for projects with zero budget
 * 
 * GET /api/projects/[id]/pre-budget-summary
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { 
  calculateDCCSpending, 
  getPreConstructionSpending,
  getCurrentTotalUsed,
  calculateCommittedCost
} from '@/lib/financial-helpers';
import { calculateIndirectCostsSpending } from '@/lib/indirect-costs-helpers';
import { calculateContingencyUsage } from '@/lib/contingency-helpers';
import { calculateTotalPhaseBudgets } from '@/lib/phase-helpers';
import { MATERIAL_APPROVED_STATUSES, EXPENSE_APPROVED_STATUSES, LABOUR_APPROVED_STATUSES } from '@/lib/status-constants';

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/pre-budget-summary
 * Returns comprehensive spending summary for projects with zero budget
 * Auth: All authenticated users
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid project ID', 400);
    }

    const db = await getDatabase();
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    // Get all spending categories
    const [
      dccSpending,
      preConstructionSpending,
      indirectSpending,
      contingencyUsage,
      totalUsed,
      committedCost,
      phases,
      floors
    ] = await Promise.all([
      calculateDCCSpending(id),
      getPreConstructionSpending(id),
      calculateIndirectCostsSpending(id),
      calculateContingencyUsage(id),
      getCurrentTotalUsed(id),
      calculateCommittedCost(id),
      db.collection('phases').find({
        projectId: new ObjectId(id),
        deletedAt: null
      }).sort({ sequence: 1 }).toArray(),
      db.collection('floors').find({
        projectId: new ObjectId(id),
        deletedAt: null
      }).sort({ floorNumber: 1 }).toArray()
    ]);

    // Calculate phase spending breakdown
    const phaseSpending = phases.map(phase => {
      const actualSpending = phase.actualSpending || {};
      const committed = phase.financialStates?.committed || 0;
      
      return {
        phaseId: phase._id.toString(),
        phaseName: phase.phaseName || phase.phaseCode,
        phaseCode: phase.phaseCode,
        actualSpending: actualSpending.total || 0,
        committedCost: committed,
        minimumRequired: (actualSpending.total || 0) + committed,
        breakdown: {
          materials: actualSpending.materials || 0,
          labour: actualSpending.labour || 0,
          equipment: actualSpending.equipment || 0,
          expenses: actualSpending.expenses || 0,
          subcontractors: actualSpending.subcontractors || 0
        }
      };
    });

    // Calculate floor spending breakdown (for Superstructure phase floors)
    const superstructurePhase = phases.find(p => p.phaseCode === 'PHASE-02');
    const floorSpending = [];
    
    if (superstructurePhase) {
      const { calculateFloorActualSpending, calculateFloorCommittedCosts } = await import('@/lib/floor-financial-helpers');
      
      for (const floor of floors) {
        try {
          const actual = await calculateFloorActualSpending(floor._id.toString());
          const committed = await calculateFloorCommittedCosts(floor._id.toString());
          
          floorSpending.push({
            floorId: floor._id.toString(),
            floorNumber: floor.floorNumber,
            floorName: floor.name || `Floor ${floor.floorNumber}`,
            actualSpending: actual.total || 0,
            committedCosts: committed.total || 0,
            minimumRequired: (actual.total || 0) + (committed.total || 0),
            breakdown: {
              materials: actual.materials || 0,
              labour: actual.labour || 0,
              equipment: actual.equipment || 0,
              subcontractors: actual.subcontractors || 0
            }
          });
        } catch (error) {
          console.error(`Error calculating spending for floor ${floor._id}:`, error);
          // Continue with other floors
        }
      }
    }

    // Calculate total spending by category
    const totalSpending = {
      dcc: dccSpending.total || 0,
      preConstruction: preConstructionSpending.total || 0,
      indirect: indirectSpending || 0,
      contingency: contingencyUsage || 0,
      total: totalUsed || 0
    };

    // Calculate minimum budget recommendations (with 10% buffer)
    const recommendations = {
      dcc: Math.ceil((dccSpending.total || 0) * 1.1),
      preConstruction: Math.ceil((preConstructionSpending.total || 0) * 1.1),
      indirect: Math.ceil((indirectSpending || 0) * 1.1),
      contingency: Math.ceil((contingencyUsage || 0) * 1.1),
      total: Math.ceil((totalUsed || 0) * 1.1)
    };

    // Calculate phase allocation recommendations
    const phaseRecommendations = phaseSpending.map(phase => {
      const minimum = phase.minimumRequired || 0;
      const recommended = Math.ceil(minimum * 1.1); // 10% buffer
      
      // Map to standard allocation percentages
      const phaseCodeToPercentage = {
        'PHASE-01': 0.15, // Basement: 15%
        'PHASE-02': 0.65, // Superstructure: 65%
        'PHASE-03': 0.15, // Finishing: 15%
        'PHASE-04': 0.05  // Final Systems: 5%
      };
      
      const percentage = phaseCodeToPercentage[phase.phaseCode] || 0;
      const proportionalRecommendation = recommendations.dcc * percentage;
      
      // Use the higher of minimum required or proportional
      return {
        phaseId: phase.phaseId,
        phaseName: phase.phaseName,
        minimumRequired: minimum,
        recommended: Math.max(recommended, proportionalRecommendation),
        proportional: proportionalRecommendation
      };
    });

    // Calculate floor allocation recommendations (for Superstructure)
    const floorRecommendations = [];
    if (superstructurePhase && floorSpending.length > 0) {
      const superstructureRecommended = phaseRecommendations.find(p => p.phaseId === superstructurePhase._id.toString());
      const totalFloorMinimum = floorSpending.reduce((sum, f) => sum + f.minimumRequired, 0);
      const totalFloorRecommended = Math.ceil(totalFloorMinimum * 1.1);
      
      // Even distribution recommendation
      const evenPerFloor = superstructureRecommended ? superstructureRecommended.recommended / floorSpending.length : 0;
      
      // Weighted distribution recommendation
      const weights = floorSpending.map(f => {
        if (f.floorNumber < 0) return 1.2; // Basement
        if (f.floorNumber >= 10) return 1.3; // Penthouse
        return 1.0; // Typical
      });
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      const weightedPerFloor = superstructureRecommended ? weights.map(w => (superstructureRecommended.recommended * w) / totalWeight) : [];
      
      floorSpending.forEach((floor, index) => {
        floorRecommendations.push({
          floorId: floor.floorId,
          floorNumber: floor.floorNumber,
          floorName: floor.floorName,
          minimumRequired: floor.minimumRequired,
          recommendedEven: Math.max(floor.minimumRequired, evenPerFloor),
          recommendedWeighted: Math.max(floor.minimumRequired, weightedPerFloor[index] || 0)
        });
      });
    }

    // Calculate spending by category (for DCC breakdown)
    const dccBreakdown = {
      materials: dccSpending.breakdown?.materials || 0,
      labour: dccSpending.breakdown?.labour || 0,
      equipment: dccSpending.breakdown?.equipment || 0,
      expenses: dccSpending.breakdown?.expenses || 0,
      workItems: dccSpending.breakdown?.workItems || 0,
      total: dccSpending.total || 0
    };

    return successResponse({
      projectId: id,
      projectName: project.projectName,
      totalSpending,
      dccBreakdown,
      preConstructionSpending: {
        total: preConstructionSpending.total || 0,
        breakdown: preConstructionSpending.breakdown || {}
      },
      indirectSpending: indirectSpending || 0,
      contingencyUsage: contingencyUsage || 0,
      committedCost: committedCost || 0,
      phaseSpending,
      floorSpending,
      recommendations,
      phaseRecommendations,
      floorRecommendations,
      hasSpending: totalUsed > 0,
      summary: {
        totalSpent: totalUsed,
        totalCommitted: committedCost,
        totalRequired: totalUsed + committedCost,
        recommendedBudget: recommendations.total
      }
    }, 'Pre-budget spending summary retrieved successfully');
  } catch (error) {
    console.error('Get pre-budget summary error:', error);
    return errorResponse('Failed to retrieve pre-budget spending summary', 500);
  }
}
