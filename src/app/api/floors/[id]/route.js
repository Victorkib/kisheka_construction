/**
 * Floor Detail API Route
 * GET: Get single floor
 * PATCH: Update floor status/budget (PM, OWNER only)
 * 
 * GET /api/floors/[id]
 * PATCH /api/floors/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/floors/[id]
 * Returns a single floor by ID
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
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid floor ID', 400);
    }

    const db = await getDatabase();
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(id),
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    return successResponse(floor, 'Floor retrieved successfully');
  } catch (error) {
    console.error('Get floor error:', error);
    return errorResponse('Failed to retrieve floor', 500);
  }
}

/**
 * PATCH /api/floors/[id]
 * Updates floor status, budget, or dates
 * Auth: PM, OWNER only
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasEditPermission = await hasPermission(user.id, 'edit_floor');
    if (!hasEditPermission) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can edit floors.', 403);
    }

    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return errorResponse('Invalid floor ID', 400);
    }

    const body = await request.json();
    const { status, totalBudget, actualCost, startDate, completionDate, description } = body;

    const db = await getDatabase();
    
    // Check if floor exists
    const existingFloor = await db.collection('floors').findOne({
      _id: new ObjectId(id),
    });

    if (!existingFloor) {
      return errorResponse('Floor not found', 404);
    }

    // Build update object
    const updateData = {
      updatedAt: new Date(),
    };

    if (status && ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
      updateData.status = status;
    }

    if (totalBudget !== undefined) {
      updateData.totalBudget = parseFloat(totalBudget) || 0;
    }

    if (actualCost !== undefined) {
      updateData.actualCost = parseFloat(actualCost) || 0;
    }

    if (startDate) {
      updateData.startDate = new Date(startDate);
    }

    if (completionDate) {
      updateData.completionDate = new Date(completionDate);
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || '';
    }

    // Update floor
    const result = await db.collection('floors').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return successResponse(result.value, 'Floor updated successfully');
  } catch (error) {
    console.error('Update floor error:', error);
    return errorResponse('Failed to update floor', 500);
  }
}

/**
 * DELETE /api/floors/[id]
 * Deletes a floor (if not in use)
 * Auth: PM, OWNER only
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const hasDeletePermission = await hasPermission(user.id, 'delete_floor');
    if (!hasDeletePermission) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can delete floors.', 403);
    }

    const { id } = await params;
    
    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid floor ID', 400);
    }

    const db = await getDatabase();

    // Check if floor exists
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(id),
    });

    if (!floor) {
      return errorResponse('Floor not found', 404);
    }

    // Check dependencies: materials, material requests, purchase orders
    const [materialCount, materialRequestCount, purchaseOrderCount] = await Promise.all([
      db.collection('materials').countDocuments({
        floor: new ObjectId(id),
        deletedAt: null,
      }),
      db.collection('material_requests').countDocuments({
        floorId: new ObjectId(id),
        deletedAt: null,
      }),
      // Check if any purchase orders reference this floor through material requests
      db.collection('purchase_orders').countDocuments({
        floorId: new ObjectId(id),
        deletedAt: null,
      }),
    ]);

    const dependencies = [];
    if (materialCount > 0) {
      dependencies.push(`${materialCount} material(s)`);
    }
    if (materialRequestCount > 0) {
      dependencies.push(`${materialRequestCount} material request(s)`);
    }
    if (purchaseOrderCount > 0) {
      dependencies.push(`${purchaseOrderCount} purchase order(s)`);
    }

    if (dependencies.length > 0) {
      return errorResponse(
        `Cannot delete floor. It is used by: ${dependencies.join(', ')}. Please reassign or remove these items first.`,
        400
      );
    }

    // Delete floor
    await db.collection('floors').deleteOne({
      _id: new ObjectId(id),
    });

    return successResponse(null, 'Floor deleted successfully', 200);
  } catch (error) {
    console.error('Delete floor error:', error);
    return errorResponse('Failed to delete floor', 500);
  }
}

