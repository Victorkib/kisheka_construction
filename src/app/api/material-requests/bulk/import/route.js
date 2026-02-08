/**
 * Bulk Material Request Import API Route
 * POST: Import materials from CSV
 * 
 * POST /api/material-requests/bulk/import
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { importMaterialsFromCSV } from '@/lib/helpers/import-helpers';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/material-requests/bulk/import
 * Parses CSV and returns materials with validation
 * Auth: CLERK, SUPERVISOR, PM, OWNER
 * 
 * Request Body:
 * {
 *   csvText: String (required),
 *   projectId: ObjectId (optional, for defaults),
 *   defaults: {
 *     defaultUrgency: String,
 *     defaultReason: String,
 *     defaultFloorId: ObjectId,
 *     defaultCategoryId: ObjectId
 *   }
 * }
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canImport = await hasPermission(user.id, 'create_bulk_material_request');
    if (!canImport) {
      return errorResponse(
        'Insufficient permissions. You do not have permission to import materials.',
        403
      );
    }

    const body = await request.json();
    const { csvText, projectId, defaults } = body;

    if (!csvText || csvText.trim().length === 0) {
      return errorResponse('CSV text is required', 400);
    }

    // Import and validate
    const result = await importMaterialsFromCSV(csvText, projectId, defaults || {});

    return successResponse({
      materials: result.materials,
      errors: result.errors,
      totalParsed: result.materials.length + result.errors.length,
      validCount: result.materials.length,
      errorCount: result.errors.length,
    });
  } catch (error) {
    console.error('Import materials error:', error);
    return errorResponse('Failed to import materials', 500);
  }
}

