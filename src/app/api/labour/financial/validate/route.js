/**
 * Labour Financial Validation API Route
 * GET: Validate labour budget
 * 
 * GET /api/labour/financial/validate
 * Auth: All authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validatePhaseLabourBudget } from '@/lib/labour-financial-helpers';

/**
 * GET /api/labour/financial/validate
 * Validate labour cost against phase budget
 * Query params: phaseId, labourCost
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const phaseId = searchParams.get('phaseId');
    const floorId = searchParams.get('floorId');
    const labourCost = parseFloat(searchParams.get('labourCost') || '0');

    if (!phaseId) {
      return errorResponse('phaseId is required', 400);
    }

    const validation = await validatePhaseLabourBudget(phaseId, labourCost);

    // Phase 4: Floor Budget Validation (optional, secondary check)
    let floorValidation = null;
    if (floorId && labourCost > 0) {
      try {
        const { validateFloorBudget } = await import('@/lib/floor-financial-helpers');
        floorValidation = await validateFloorBudget(floorId, labourCost, 'labour');
      } catch (floorValidationError) {
        console.error('Floor budget validation error (non-blocking):', floorValidationError);
        // Don't fail if floor validation fails
      }
    }

    return successResponse({
      ...validation,
      floorValidation: floorValidation, // Include floor validation if available
    }, 'Budget validation completed');
  } catch (error) {
    console.error('GET /api/labour/financial/validate error:', error);
    return errorResponse('Failed to validate budget', 500);
  }
}

