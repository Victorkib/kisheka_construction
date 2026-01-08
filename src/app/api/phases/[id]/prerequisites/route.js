/**
 * Phase Prerequisites API Route
 * GET: Get all prerequisite phases for a given phase
 * 
 * GET /api/phases/[id]/prerequisites
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getPrerequisitePhases } from '@/lib/phase-dependency-helpers';

/**
 * GET /api/phases/[id]/prerequisites
 * Returns all prerequisite phases for the given phase
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

    const prerequisites = await getPrerequisitePhases(id);

    return successResponse(prerequisites, 'Prerequisites retrieved successfully');
  } catch (error) {
    console.error('Get prerequisites error:', error);
    return errorResponse('Failed to retrieve prerequisites', 500);
  }
}


