/**
 * Auto-Reorder API Route
 * POST: Auto-create batch from low stock items
 * 
 * POST /api/material-requests/auto-reorder
 * Auth: CLERK, SUPERVISOR, PM, OWNER
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { checkLowStock, generateBulkRequestFromLowStock, autoCreateLowStockBatch } from '@/lib/helpers/auto-reorder-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/material-requests/auto-reorder
 * Auto-creates a batch from low stock items
 * 
 * Request Body:
 * {
 *   projectId: ObjectId (required),
 *   threshold: Number (optional, default: 20),
 *   settings: {
 *     urgency: String (optional, default: 'medium'),
 *     reason: String (optional),
 *     floorId: ObjectId (optional),
 *     categoryId: ObjectId (optional),
 *     autoApprove: Boolean (optional, default: false)
 *   },
 *   preview: Boolean (optional, default: false) - If true, returns preview without creating batch
 * }
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canCreate = await hasPermission(user.id, 'create_bulk_material_request');
    if (!canCreate) {
      return errorResponse(
        'Insufficient permissions. You do not have permission to create bulk requests.',
        403
      );
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const { projectId, threshold = 20, settings = {}, preview = false } = body;

    if (!projectId || !ObjectId.isValid(projectId)) {
      return errorResponse('Valid projectId is required', 400);
    }

    // Check for low stock items
    const lowStockItems = await checkLowStock(projectId, threshold);

    if (lowStockItems.length === 0) {
      return successResponse({
        lowStockItems: [],
        materials: [],
        message: 'No low stock items found',
      });
    }

    // Generate materials for bulk request
    const materials = await generateBulkRequestFromLowStock(projectId, threshold, {
      urgency: settings.urgency || 'medium',
      reason: settings.reason || 'Low stock - automated reorder',
      floorId: settings.floorId || null,
      categoryId: settings.categoryId || null,
    });

    // If preview mode, return without creating batch
    if (preview) {
      return successResponse({
        lowStockItems,
        materials,
        summary: {
          totalItems: lowStockItems.length,
          totalMaterials: materials.length,
          estimatedTotalCost: materials.reduce((sum, m) => sum + (m.estimatedCost || 0), 0),
        },
      });
    }

    // Determine auto-approve (OWNER only)
    const userRole = userProfile.role?.toLowerCase();
    const willAutoApprove = settings.autoApprove && userRole === 'owner';

    // Create batch
    const batchSettings = {
      projectId: projectId,
      batchName: `Auto-Reorder - ${new Date().toLocaleDateString('en-KE')}`,
      defaultFloorId: settings.floorId || null,
      defaultCategoryId: settings.categoryId || null,
      defaultUrgency: settings.urgency || 'medium',
      defaultReason: settings.reason || 'Low stock - automated reorder',
    };

    const batch = await autoCreateLowStockBatch(projectId, {
      enabled: true,
      threshold,
      urgency: settings.urgency || 'medium',
      reason: settings.reason || 'Low stock - automated reorder',
      floorId: settings.floorId || null,
      categoryId: settings.categoryId || null,
      autoApprove: willAutoApprove,
    }, userProfile._id.toString());

    if (!batch) {
      return errorResponse('Failed to create batch', 500);
    }

    return successResponse({
      batchId: batch._id.toString(),
      batchNumber: batch.batchNumber,
      status: batch.status,
      requiresApproval: !willAutoApprove,
      lowStockItems,
      materials,
      summary: {
        totalItems: lowStockItems.length,
        totalMaterials: materials.length,
        estimatedTotalCost: materials.reduce((sum, m) => sum + (m.estimatedCost || 0), 0),
      },
    });
  } catch (error) {
    console.error('Auto-reorder error:', error);
    return errorResponse('Failed to create auto-reorder batch', 500);
  }
}

