/**
 * Phase Dependents API Route
 * GET: Get all phases that depend on the given phase
 * 
 * GET /api/phases/[id]/dependents
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getDependentPhases } from '@/lib/phase-dependency-helpers';

/**
 * GET /api/phases/[id]/dependents
 * Returns all phases that depend on the given phase
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
      return errorResponse('Invalid phase ID', 400);
    }

    const dependents = await getDependentPhases(id);

    return successResponse(dependents, 'Dependent phases retrieved successfully');
  } catch (error) {
    console.error('Get dependents error:', error);
    return errorResponse('Failed to retrieve dependent phases', 500);
  }
}


