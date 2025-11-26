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

