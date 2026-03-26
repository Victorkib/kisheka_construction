/**
 * Contract Value Calculator API Route
 * Calculates suggested contract value based on rates and payment schedule
 * 
 * POST /api/professional-services/calculate-contract-value
 * Auth: All authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { calculateContractValueEstimate } from '@/lib/professional-rates-helpers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/professional-services/calculate-contract-value
 * Calculates suggested contract value
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
    if (!body.libraryId || !ObjectId.isValid(body.libraryId)) {
      return errorResponse('Valid libraryId is required', 400);
    }

    if (!body.paymentSchedule) {
      return errorResponse('Payment schedule is required', 400);
    }

    if (!body.contractType) {
      return errorResponse('Contract type is required', 400);
    }

    if (!body.contractStartDate) {
      return errorResponse('Contract start date is required', 400);
    }

    const db = await getDatabase();

    // Get library entry for rates
    const library = await db.collection('professional_services_library').findOne({
      _id: new ObjectId(body.libraryId),
      deletedAt: null,
    });

    if (!library) {
      return errorResponse('Professional not found in library', 404);
    }

    // Calculate contract value estimate
    const result = calculateContractValueEstimate({
      hourlyRate: library.defaultHourlyRate || null,
      perVisitRate: library.defaultPerVisitRate || null,
      perFloorRate: library.defaultPerFloorRate || null,
      monthlyRetainer: library.defaultMonthlyRetainer || null,
      paymentSchedule: body.paymentSchedule,
      contractType: body.contractType,
      contractStartDate: body.contractStartDate,
      contractEndDate: body.contractEndDate || null,
      visitFrequency: body.visitFrequency || null,
      floorsCount: body.floorsCount || null,
    });

    if (result.error) {
      return errorResponse(result.error, 400);
    }

    return successResponse(result);
  } catch (err) {
    console.error('Error calculating contract value:', err);
    return errorResponse('Failed to calculate contract value', 500);
  }
}
