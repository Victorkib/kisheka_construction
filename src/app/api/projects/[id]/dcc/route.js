/**
 * DCC (Direct Construction Costs) API Route
 * GET: Get comprehensive DCC budget and spending
 * 
 * GET /api/projects/[id]/dcc
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { calculateDCCSpending } from '@/lib/financial-helpers';
import { calculateTotalPhaseBudgets } from '@/lib/phase-helpers';
import {
  isEnhancedBudget,
  getBudgetTotal,
} from '@/lib/schemas/budget-schema';

/**
 * GET /api/projects/[id]/dcc
 * Returns comprehensive DCC budget and spending
 * Auth: All authenticated users with project access
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

    // Verify project exists
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!project) {
      return errorResponse('Project not found', 404);
    }

    const budget = project.budget || {};
    
    // Calculate DCC budget
    let dccBudget = 0;
    if (isEnhancedBudget(budget)) {
      dccBudget = budget.directConstructionCosts || 0;
    } else {
      const totalBudget = getBudgetTotal(budget);
      const estimatedPreConstruction = totalBudget * 0.05;
      const estimatedIndirect = totalBudget * 0.05;
      const estimatedContingency = budget.contingency || (totalBudget * 0.05);
      dccBudget = Math.max(0, totalBudget - estimatedPreConstruction - estimatedIndirect - estimatedContingency);
    }

    // Get allocated to phases
    const allocatedToPhases = await calculateTotalPhaseBudgets(id);

    // Get comprehensive DCC spending
    const dccSpending = await calculateDCCSpending(id);

    // Get phases for breakdown
    const phases = await db.collection('phases').find({
      projectId: new ObjectId(id),
      deletedAt: null,
    }).sort({ order: 1 }).toArray();

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

    return successResponse({
      budgeted: dccBudget,
      spent: dccSpending.total,
      remaining: Math.max(0, dccBudget - dccSpending.total),
      allocated: allocatedToPhases,
      unallocated: Math.max(0, dccBudget - allocatedToPhases),
      usagePercentage: dccBudget > 0 ? (dccSpending.total / dccBudget) * 100 : 0,
      breakdown: dccSpending.breakdown,
      phases: phaseBreakdown,
      verified: dccSpending.verified,
    });
  } catch (error) {
    console.error('Get DCC data error:', error);
    return errorResponse('Failed to fetch DCC data', 500);
  }
}
