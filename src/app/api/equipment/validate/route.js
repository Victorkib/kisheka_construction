/**
 * Equipment Validation API
 * POST: Validate equipment budget and capital before creation
 *
 * POST /api/equipment/validate
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { validateEquipmentBudgetAndCapital } from '@/lib/equipment-helpers';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/equipment/validate
 * Validate equipment before creation (returns validation result without creating)
 */
export async function POST(request) {
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

    const body = await request.json();
    const {
      projectId,
      equipmentScope,
      phaseId,
      phaseIds,
      floorId,
      totalCost,
      costSplit
    } = body;

    // Validation
    if (!projectId) {
      return errorResponse('Project ID is required', 400);
    }

    if (totalCost === undefined || totalCost === null) {
      return errorResponse('Total cost is required for validation', 400);
    }

    // Perform budget and capital validation
    const validation = await validateEquipmentBudgetAndCapital({
      projectId,
      equipmentScope: equipmentScope || 'phase_specific',
      phaseId: phaseId || null,
      phaseIds: phaseIds || [],
      floorId: floorId || null,
      totalCost: parseFloat(totalCost) || 0,
      costSplit: costSplit || null
    });

    return successResponse(validation, 'Validation completed');
  } catch (error) {
    console.error('Equipment validation error:', error);
    return errorResponse('Failed to validate equipment', 500);
  }
}
