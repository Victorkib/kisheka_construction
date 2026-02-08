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
    const labourCost = parseFloat(searchParams.get('labourCost') || '0');

    if (!phaseId) {
      return errorResponse('phaseId is required', 400);
    }

    const validation = await validatePhaseLabourBudget(phaseId, labourCost);

    return successResponse(validation, 'Budget validation completed');
  } catch (error) {
    console.error('GET /api/labour/financial/validate error:', error);
    return errorResponse('Failed to validate budget', 500);
  }
}

