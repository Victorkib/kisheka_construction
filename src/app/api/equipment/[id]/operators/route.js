/**
 * Equipment Operator Report API Route
 * GET: Get operator labour data for equipment
 * 
 * GET /api/equipment/[id]/operators
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getEquipmentOperatorStatistics } from '@/lib/equipment-operator-helpers';
import { ObjectId } from 'mongodb';

/**
 * GET /api/equipment/[id]/operators
 * Get operator labour data for equipment
 * Query params: dateFrom, dateTo
 * Auth: All authenticated users
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Valid equipment ID is required', 400);
    }

    const statistics = await getEquipmentOperatorStatistics(id);

    if (!statistics) {
      return errorResponse('Equipment not found', 404);
    }

    return successResponse(statistics, 'Equipment operator data retrieved successfully');
  } catch (error) {
    console.error('GET /api/equipment/[id]/operators error:', error);
    return errorResponse('Failed to retrieve equipment operator data', 500);
  }
}

