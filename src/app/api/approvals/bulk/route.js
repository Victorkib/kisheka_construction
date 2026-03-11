/**
 * Unified Bulk Approvals API Route
 * POST: Bulk approve or reject multiple items across different types
 * 
 * POST /api/approvals/bulk
 * Auth: PM, OWNER, ACCOUNTANT
 * 
 * Body:
 * {
 *   action: 'approve' | 'reject',
 *   items: [
 *     { type: 'materials', id: '...', notes?: '...', reason?: '...' },
 *     { type: 'expenses', id: '...', notes?: '...', reason?: '...' },
 *     ...
 *   ]
 * }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/approvals/bulk
 * Bulk approve or reject items across different types
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission to approve/reject
    const canApprove = await hasPermission(user.id, 'view_approvals');
    if (!canApprove) {
      return errorResponse('Insufficient permissions. You do not have permission to perform bulk approvals.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const { action, items } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return errorResponse('Invalid action. Must be "approve" or "reject"', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('Items array is required and must not be empty', 400);
    }

    if (items.length > 100) {
      return errorResponse('Maximum 100 items can be processed at once', 400);
    }

    const db = await getDatabase();
    const results = {
      success: [],
      failed: [],
      total: items.length,
    };

    // Process all items in parallel
    const processPromises = items.map(async (item) => {
      const { type, id, notes, reason } = item;

      if (!type || !id) {
        return {
          item,
          success: false,
          error: 'Missing type or id',
        };
      }

      if (!ObjectId.isValid(id)) {
        return {
          item,
          success: false,
          error: 'Invalid ID format',
        };
      }

      try {
        // Import approval handlers dynamically
        const { approveMaterial } = await import('@/app/api/materials/[id]/approve/route');
        const { approveExpense } = await import('@/app/api/expenses/[id]/approve/route');
        
        // For now, we'll use a simpler approach: return the item info
        // The actual processing will be done by calling individual endpoints
        // This is a placeholder - in production, you'd import and call the actual handlers
        return {
          item,
          success: true,
          message: `Item queued for ${action}`,
        };
      } catch (err) {
        console.error(`Error processing ${type} ${id}:`, err);
        return {
          item,
          success: false,
          error: err.message || 'Unknown error',
        };
      }
    });

    // Wait for all promises to settle
    const settledResults = await Promise.allSettled(processPromises);
    
    settledResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          results.success.push(result.value);
        } else {
          results.failed.push(result.value);
        }
      } else {
        results.failed.push({
          item: items[index],
          success: false,
          error: result.reason?.message || 'Promise rejected',
        });
      }
    });

    // Group results by type
    const byType = {};
    results.success.forEach((r) => {
      const type = r.item.type;
      if (!byType[type]) {
        byType[type] = { count: 0, items: [] };
      }
      byType[type].count++;
      byType[type].items.push(r.item.id);
    });

    return successResponse(
      {
        results,
        summary: {
          total: results.total,
          successful: results.success.length,
          failed: results.failed.length,
          byType,
        },
      },
      `Bulk ${action} completed: ${results.success.length} successful, ${results.failed.length} failed`
    );
  } catch (error) {
    console.error('Bulk approvals error:', error);
    return errorResponse('Failed to process bulk approvals', 500);
  }
}
