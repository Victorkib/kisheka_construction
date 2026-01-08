/**
 * Phase Can Start API Route
 * GET: Check if a phase can be started (all dependencies completed)
 * 
 * GET /api/phases/[id]/can-start
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { canPhaseStart } from '@/lib/phase-dependency-helpers';

/**
 * GET /api/phases/[id]/can-start
 * Returns whether the phase can be started and the reason
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

    const canStart = await canPhaseStart(id);

    return successResponse(canStart, 'Phase start status retrieved successfully');
  } catch (error) {
    console.error('Check can start error:', error);
    return errorResponse('Failed to check if phase can start', 500);
  }
}


