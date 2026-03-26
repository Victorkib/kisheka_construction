/**
 * Professional Roles API Route
 * GET: List active professional roles
 *
 * GET /api/professional-roles
 * Auth: All authenticated users
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getActiveProfessionalRoles } from '@/lib/schemas/professional-roles-schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const db = await getDatabase();
    const roles = await getActiveProfessionalRoles(db);

    return successResponse({
      roles: roles.map((role) => ({
        _id: role._id.toString(),
        code: role.code,
        slug: role.slug,
        name: role.name,
        kind: role.kind,
        defaultContractTypes: role.defaultContractTypes || [],
        defaultFeeTypes: role.defaultFeeTypes || [],
        supportsSpecializations: role.supportsSpecializations || false,
        specializationOptions: role.specializationOptions || [],
        defaultRateFields: role.defaultRateFields || [],
      })),
    });
  } catch (error) {
    console.error('Get professional roles error:', error);
    return errorResponse('Failed to retrieve professional roles', 500);
  }
}

