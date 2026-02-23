/**
 * Professional Services Rates API Route
 * Returns rates for a professional service assignment
 * 
 * GET /api/professional-services/[id]/rates
 * Auth: All authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getRatesFromAssignment } from '@/lib/professional-rates-helpers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/professional-services/[id]/rates
 * Returns rates for an assignment
 */
export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid assignment ID is required', 400);
    }

    const db = await getDatabase();

    // Get assignment
    const assignment = await db.collection('professional_services').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!assignment) {
      return errorResponse('Professional service assignment not found', 404);
    }

    // Get library entry for fallback
    let library = null;
    if (assignment.libraryId) {
      library = await db.collection('professional_services_library').findOne({
        _id: assignment.libraryId,
        deletedAt: null,
      });
    }

    // Get rates (with fallback to library)
    const rates = getRatesFromAssignment(assignment, library);

    return successResponse({
      ...rates,
      assignmentId: id,
      hasRates: !!(rates.hourlyRate || rates.perVisitRate || rates.monthlyRetainer),
    });
  } catch (err) {
    console.error('Error fetching assignment rates:', err);
    return errorResponse('Failed to fetch rates', 500);
  }
}
