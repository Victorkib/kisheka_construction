/**
 * Material Request Convert to Order API Route
 * POST /api/material-requests/[id]/convert-to-order
 * Marks a material request as converted to purchase order
 * Auth: PM, OWNER
 * 
 * Note: This endpoint just marks the request as converted.
 * Actual purchase order creation is separate.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotification } from '@/lib/notifications';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/material-requests/[id]/convert-to-order
 * Mark material request as converted to purchase order
 * Auth: PM, OWNER
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission (PM/OWNER can convert)
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const userRole = userProfile.role?.toLowerCase();
    const canConvert = ['pm', 'project_manager', 'owner'].includes(userRole);
    if (!canConvert) {
      return errorResponse('Insufficient permissions. Only PM and OWNER can convert requests to orders.', 403);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid request ID', 400);
    }

    // Handle request body - make it optional to support workflow where PO doesn't exist yet
    // The frontend may not send a body, so we need to handle empty bodies gracefully
    // This supports the workflow where user clicks "Convert to Order" before creating the PO
    let purchaseOrderId = null;
    try {
      const body = await request.json().catch(() => ({})); // Handle empty body gracefully
      purchaseOrderId = body?.purchaseOrderId;
    } catch (error) {
      // If body is empty or invalid JSON, that's okay - we'll just mark as converted without linking PO
      purchaseOrderId = null;
    }

    const db = await getDatabase();

    // Get existing request
    const materialRequest = await db.collection('material_requests').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!materialRequest) {
      return errorResponse('Material request not found', 404);
    }

    // Check if status allows conversion
    if (materialRequest.status !== 'approved') {
      return errorResponse(`Cannot convert request with status: ${materialRequest.status}. Request must be approved first.`, 400);
    }

    // Check if already converted
    if (materialRequest.status === 'converted_to_order') {
      return errorResponse('Material request has already been converted to order', 400);
    }

    // If purchaseOrderId provided, verify it exists and is linked to this request
    let purchaseOrder = null;
    if (purchaseOrderId) {
      if (!ObjectId.isValid(purchaseOrderId)) {
        return errorResponse('Invalid purchase order ID', 400);
      }

      purchaseOrder = await db.collection('purchase_orders').findOne({
        _id: new ObjectId(purchaseOrderId),
        deletedAt: null,
      });

      if (!purchaseOrder) {
        return errorResponse('Purchase order not found', 404);
      }

      // Verify purchase order is linked to this request
      if (purchaseOrder.materialRequestId?.toString() !== id) {
        return errorResponse('Purchase order is not linked to this material request', 400);
      }
    }

    // Update request status
    const updateData = {
      status: 'converted_to_order',
      updatedAt: new Date(),
    };

    // Only set linkedPurchaseOrderId if provided
    if (purchaseOrderId && ObjectId.isValid(purchaseOrderId)) {
      updateData.linkedPurchaseOrderId = new ObjectId(purchaseOrderId);
    }

    await db.collection('material_requests').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Get updated request
    const updatedRequest = await db.collection('material_requests').findOne({
      _id: new ObjectId(id),
    });

    // Create notification for requester
    // If purchase order exists, point to it; otherwise point to material request
    const notificationRelatedModel = purchaseOrder ? 'PURCHASE_ORDER' : 'MATERIAL_REQUEST';
    const notificationRelatedId = purchaseOrder ? purchaseOrderId : id;
    
    await createNotification({
      userId: materialRequest.requestedBy.toString(),
      type: 'approval_status',
      title: 'Material Request Converted to Order',
      message: purchaseOrder 
        ? `Your request for ${materialRequest.quantityNeeded} ${materialRequest.unit} of ${materialRequest.materialName} has been converted to purchase order ${purchaseOrder.purchaseOrderNumber}.`
        : `Your request for ${materialRequest.quantityNeeded} ${materialRequest.unit} of ${materialRequest.materialName} has been converted to purchase order.`,
      projectId: materialRequest.projectId.toString(),
      relatedModel: notificationRelatedModel,
      relatedId: notificationRelatedId,
      createdBy: userProfile._id.toString(),
    });

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'CONVERTED_TO_ORDER',
      entityType: 'MATERIAL_REQUEST',
      entityId: id,
      projectId: materialRequest.projectId.toString(),
      changes: {
        before: materialRequest,
        after: updatedRequest,
        ...(purchaseOrderId && { purchaseOrderId: purchaseOrderId }),
      },
    });

    return successResponse(updatedRequest, 'Material request marked as converted to order');
  } catch (error) {
    console.error('Convert material request to order error:', error);
    return errorResponse('Failed to convert material request to order', 500);
  }
}

