/**
 * Purchase Order Create Material API Route
 * POST /api/purchase-orders/[id]/create-material
 * PM/OWNER creates material entry from fulfilled purchase order
 * Auth: PM, OWNER
 * 
 * CRITICAL: Decreases committedCost when material is created
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createMaterialFromPurchaseOrder } from '@/lib/material-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/[id]/create-material
 * Create material entry from fulfilled purchase order
 * Auth: PM, OWNER
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canCreateMaterial = await hasPermission(user.id, 'create_material_from_order');
    if (!canCreateMaterial) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can create materials from purchase orders.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid order ID', 400);
    }

    const body = await request.json();
    const { actualQuantityReceived, actualUnitCost, notes } = body || {};

    const db = await getDatabase();

    // Get existing order to verify it exists and check status
    const purchaseOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!purchaseOrder) {
      return errorResponse('Purchase order not found', 404);
    }

    // Check if status allows material creation
    if (purchaseOrder.status !== 'ready_for_delivery') {
      return errorResponse(`Cannot create material from order with status: ${purchaseOrder.status}. Order must be fulfilled first.`, 400);
    }

    // Check if material already created
    if (purchaseOrder.linkedMaterialId) {
      return errorResponse('Material has already been created from this purchase order', 400);
    }

    // Use the helper function to create material
    // Materials created from POs are automatically approved for immediate financial state accuracy
    try {
      const result = await createMaterialFromPurchaseOrder({
        purchaseOrderId: id,
        creatorUserProfile: userProfile,
        actualQuantityReceived,
        actualUnitCost,
        notes,
        isAutomatic: false, // Manual creation by PM/OWNER
      });

      return successResponse({
        material: result.material,
        purchaseOrder: result.purchaseOrder,
      }, 'Material entry created successfully from purchase order', 201);
    } catch (error) {
      console.error('Create material from order error:', error);
      return errorResponse(error.message || 'Failed to create material from purchase order', 400);
    }
  } catch (error) {
    console.error('Create material from order error:', error);
    return errorResponse('Failed to create material from purchase order', 500);
  }
}

