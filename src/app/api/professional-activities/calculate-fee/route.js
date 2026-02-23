/**
 * Activity Fee Calculator API Route
 * Calculates fee amount from activity using assignment rates
 * 
 * POST /api/professional-activities/calculate-fee
 * Auth: All authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { calculateFeeFromActivity } from '@/lib/professional-rates-helpers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/professional-activities/calculate-fee
 * Calculates fee from activity
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();

    // Validate required fields
    if (!body.professionalServiceId || !ObjectId.isValid(body.professionalServiceId)) {
      return errorResponse('Valid professionalServiceId is required', 400);
    }

    if (!body.activityType) {
      return errorResponse('Activity type is required', 400);
    }

    const db = await getDatabase();

    // Get assignment
    const assignment = await db.collection('professional_services').findOne({
      _id: new ObjectId(body.professionalServiceId),
      deletedAt: null,
    });

    if (!assignment) {
      return errorResponse('Professional service assignment not found', 404);
    }

    // Build activity object from request
    const activity = {
      activityType: body.activityType,
      visitDuration: body.visitDuration ? parseFloat(body.visitDuration) : null,
      inspectionDuration: body.inspectionDuration ? parseFloat(body.inspectionDuration) : null,
      revisionDuration: body.revisionDuration ? parseFloat(body.revisionDuration) : null,
    };

    // Calculate fee
    const result = calculateFeeFromActivity(activity, assignment);

    if (result.error) {
      return errorResponse(result.error, 400);
    }

    return successResponse({
      calculatedFee: result.calculatedFee,
      calculation: result.calculation,
      rateSource: 'assignment',
      canOverride: true,
    });
  } catch (err) {
    console.error('Error calculating activity fee:', err);
    return errorResponse('Failed to calculate fee', 500);
  }
}
