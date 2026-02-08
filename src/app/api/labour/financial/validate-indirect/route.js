import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { validateIndirectCostsBudget } from '@/lib/indirect-costs-helpers';

/**
 * GET /api/labour/financial/validate-indirect
 * 
 * Validates indirect costs budget for a project
 * Used by frontend for real-time budget validation of indirect labour entries
 * 
 * Query Parameters:
 * - projectId (required): Project ID
 * - indirectCost (required): Cost amount to validate
 * - category (optional): Cost category (default: siteOverhead)
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     isValid: boolean,
 *     available: number,
 *     required: number,
 *     shortfall: number,
 *     message: string,
 *     warning?: boolean
 *   }
 * }
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const indirectCost = parseFloat(searchParams.get('indirectCost') || '0');
    const categoryParam = searchParams.get('category');
    const category = categoryParam && categoryParam.trim() !== '' ? categoryParam : null;

    // Validate input
    if (!projectId) {
      return errorResponse('projectId is required', 400);
    }

    if (indirectCost < 0) {
      return errorResponse('indirectCost must be non-negative', 400);
    }

    // If no cost to validate, allow
    if (indirectCost === 0) {
      return successResponse({
        isValid: true,
        available: 0,
        required: 0,
        shortfall: 0,
        message: 'No cost to validate'
      });
    }

    // Call the validation helper
    const validation = await validateIndirectCostsBudget(projectId, indirectCost, category);

    // Ensure validation has required properties
    if (!validation || typeof validation.isValid === 'undefined') {
      throw new Error('Invalid validation response structure from validateIndirectCostsBudget');
    }

    return successResponse(validation, 'Indirect costs budget validation completed');

  } catch (error) {
    console.error('GET /api/labour/financial/validate-indirect error:', error);
    return errorResponse(`Budget validation failed: ${error.message}`, 500);
  }
}
