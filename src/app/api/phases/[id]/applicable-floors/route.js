/**
 * Get Applicable Floors for Phase API
 * Returns floors that are applicable to a specific phase
 * 
 * Route: /api/phases/[id]/applicable-floors
 * Method: GET
 */

import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getApplicableFloorsForPhase } from '@/lib/phase-floor-validation-helpers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/phases/[id]/applicable-floors
 * Returns floors applicable to the specified phase
 * Query params: projectId (optional, will use phase's project if not provided)
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

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    // Get applicable floors
    const result = await getApplicableFloorsForPhase(id, projectId || null);

    if (!result.success) {
      return errorResponse(result.error || 'Failed to get applicable floors', 400);
    }

    // Also get all floors for the project (for comparison)
    const db = await getDatabase();
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!phase) {
      return errorResponse('Phase not found', 404);
    }

    const targetProjectId = projectId || phase.projectId;
    const allFloors = await db.collection('floors').find({
      projectId: new ObjectId(targetProjectId),
      deletedAt: null
    }).sort({ floorNumber: 1 }).toArray();

    return successResponse({
      phaseId: id,
      phaseCode: result.phaseCode,
      phaseName: result.phaseName,
      applicableFloors: result.floors || [],
      allFloors: allFloors,
      totalApplicable: result.floors?.length || 0,
      totalFloors: allFloors.length
    }, 'Applicable floors retrieved successfully');
  } catch (error) {
    console.error('Get applicable floors error:', error);
    return errorResponse('Failed to get applicable floors', 500);
  }
}
