/**
 * Phase Financial Tracking API Route
 * GET: Get phase financial summary
 * POST: Update phase spending (from materials/expenses)
 * 
 * GET /api/phases/[id]/financial
 * POST /api/phases/[id]/financial
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { calculatePhaseFinancialSummary, updatePhaseSpending } from '@/lib/schemas/phase-schema';
import { MATERIAL_APPROVED_STATUSES, EXPENSE_APPROVED_STATUSES } from '@/lib/status-constants';
import { calculatePhaseCommittedCost, calculatePhaseEstimatedCost } from '@/lib/phase-helpers';
import { calculatePhaseEquipmentCost } from '@/lib/equipment-helpers';
import { calculatePhaseSubcontractorCost } from '@/lib/subcontractor-helpers';

/**
 * GET /api/phases/[id]/financial
 * Returns phase financial summary with actual spending breakdown
 * Auth: All authenticated users
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const db = await getDatabase();

    // Get phase
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    // Calculate actual spending from materials and expenses
    const materialsSpending = await db.collection('materials').aggregate([
      {
        $match: {
          phaseId: new ObjectId(id),
          deletedAt: null,
          status: { $in: MATERIAL_APPROVED_STATUSES }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalCost' }
        }
      }
    ]).toArray();

    const expensesSpending = await db.collection('expenses').aggregate([
      {
        $match: {
          phaseId: new ObjectId(id),
          deletedAt: null,
          status: { $in: EXPENSE_APPROVED_STATUSES },
          $or: [
            { isIndirectCost: { $exists: false } },
            { isIndirectCost: false }
          ]
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]).toArray();

    // Get professional services spending for this phase
    const { calculatePhaseProfessionalServicesSpending } = await import('@/lib/professional-services-helpers');
    const professionalServicesSpending = await calculatePhaseProfessionalServicesSpending(id);

    // Calculate labour spending from approved/paid labour entries
    // Use phase.actualSpending.labour if available and recent, otherwise recalculate
    let labourSpending = phase.actualSpending?.labour || 0;
    
    // Verify labour spending is accurate by recalculating from entries
    // This ensures data consistency even if actualSpending wasn't updated
    const { recalculatePhaseLabourSpending } = await import('@/lib/labour-financial-helpers');
    try {
      const recalculatedLabour = await recalculatePhaseLabourSpending(id);
      // Use recalculated value for accuracy
      labourSpending = recalculatedLabour;
    } catch (error) {
      console.error('Error recalculating phase labour spending:', error);
      // Fall back to phase.actualSpending.labour if recalculation fails
      labourSpending = phase.actualSpending?.labour || 0;
    }
    
    // Phase 4: Calculate equipment spending
    const equipmentSpending = await calculatePhaseEquipmentCost(id);
    
    // Phase 5: Calculate subcontractor spending
    const subcontractorSpending = await calculatePhaseSubcontractorCost(id);

    // Calculate committed cost
    const committedCost = await calculatePhaseCommittedCost(id);

    // Calculate estimated cost
    const estimatedCost = await calculatePhaseEstimatedCost(id);

    const actualSpending = {
      materials: materialsSpending[0]?.total || 0,
      expenses: expensesSpending[0]?.total || 0,
      professionalServices: professionalServicesSpending.total || 0, // Tracked separately for visibility
      labour: labourSpending,
      equipment: equipmentSpending,
      subcontractors: subcontractorSpending,
      total: (materialsSpending[0]?.total || 0) + 
             (expensesSpending[0]?.total || 0) + 
             (professionalServicesSpending.total || 0) + 
             labourSpending + 
             equipmentSpending + 
             subcontractorSpending
    };

    // Update phase with actual spending, committed cost, and estimated cost
    const updatedPhase = {
      ...phase,
      actualSpending,
      professionalServices: {
        totalFees: professionalServicesSpending.total || 0,
        activitiesCount: professionalServicesSpending.activitiesCount || 0,
        architectFees: professionalServicesSpending.architectFees || 0,
        engineerFees: professionalServicesSpending.engineerFees || 0,
      },
      financialStates: {
        ...phase.financialStates,
        actual: actualSpending.total,
        committed: committedCost,
        estimated: estimatedCost,
        remaining: Math.max(0, (phase.budgetAllocation?.total || 0) - actualSpending.total - committedCost)
      }
    };

    // Calculate financial summary
    const financialSummary = calculatePhaseFinancialSummary(updatedPhase);

    // Get spending breakdown by category
    const materialsByCategory = await db.collection('materials').aggregate([
      {
        $match: {
          phaseId: new ObjectId(id),
          deletedAt: null,
          status: { $in: MATERIAL_APPROVED_STATUSES }
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$totalCost' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]).toArray();

    const expensesByCategory = await db.collection('expenses').aggregate([
      {
        $match: {
          phaseId: new ObjectId(id),
          deletedAt: null,
          status: { $in: EXPENSE_APPROVED_STATUSES },
          $or: [
            { isIndirectCost: { $exists: false } },
            { isIndirectCost: false }
          ]
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { total: -1 }
      }
    ]).toArray();

    return successResponse({
      phase: updatedPhase,
      financialSummary,
      spendingBreakdown: {
        materials: actualSpending.materials,
        expenses: actualSpending.expenses,
        labour: actualSpending.labour,
        equipment: actualSpending.equipment,
        subcontractors: actualSpending.subcontractors,
        total: actualSpending.total
      },
      categoryBreakdown: {
        materials: materialsByCategory.map(cat => ({
          category: cat._id || 'Uncategorized',
          total: cat.total,
          count: cat.count
        })),
        expenses: expensesByCategory.map(cat => ({
          category: cat._id || 'Uncategorized',
          total: cat.total,
          count: cat.count
        }))
      }
    }, 'Phase financial summary retrieved successfully');
  } catch (error) {
    console.error('Get phase financial error:', error);
    return errorResponse('Failed to retrieve phase financial summary', 500);
  }
}

/**
 * POST /api/phases/[id]/financial
 * Updates phase spending (typically called when materials/expenses are created/updated)
 * Auth: System/internal use (can be called by material/expense APIs)
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid phase ID', 400);
    }

    const body = await request.json();
    const {
      materials = 0,
      expenses = 0,
      labour = 0,
      equipment = 0,
      subcontractors = 0
    } = body;

    const db = await getDatabase();

    // Get phase
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    // Recalculate actual spending from database
    const materialsSpending = await db.collection('materials').aggregate([
      {
        $match: {
          phaseId: new ObjectId(id),
          deletedAt: null,
          status: { $in: MATERIAL_APPROVED_STATUSES }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalCost' }
        }
      }
    ]).toArray();

    const expensesSpending = await db.collection('expenses').aggregate([
      {
        $match: {
          phaseId: new ObjectId(id),
          deletedAt: null,
          status: { $in: EXPENSE_APPROVED_STATUSES },
          $or: [
            { isIndirectCost: { $exists: false } },
            { isIndirectCost: false }
          ]
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]).toArray();

    // Calculate committed cost
    const committedCost = await calculatePhaseCommittedCost(id);

    // Calculate estimated cost
    const estimatedCost = await calculatePhaseEstimatedCost(id);

    const actualSpending = {
      materials: materialsSpending[0]?.total || 0,
      expenses: expensesSpending[0]?.total || 0,
      labour: labour || 0,
      equipment: equipment || 0,
      subcontractors: subcontractors || 0,
      total: (materialsSpending[0]?.total || 0) + (expensesSpending[0]?.total || 0) + labour + equipment + subcontractors
    };

    // Update phase
    const updateResult = await db.collection('phases').findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          actualSpending,
          'financialStates.actual': actualSpending.total,
          'financialStates.committed': committedCost,
          'financialStates.estimated': estimatedCost,
          'financialStates.remaining': Math.max(0, (phase.budgetAllocation?.total || 0) - actualSpending.total - committedCost),
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!updateResult) {
      return errorResponse('Failed to update phase spending', 500);
    }

    return successResponse({
      phase: updateResult,
      actualSpending
    }, 'Phase spending updated successfully');
  } catch (error) {
    console.error('Update phase spending error:', error);
    return errorResponse('Failed to update phase spending', 500);
  }
}

