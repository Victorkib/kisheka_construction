/**
 * Purchase Order Modify API Route
 * POST /api/purchase-orders/[id]/modify
 * Supplier proposes modifications to a purchase order
 * Auth: SUPPLIER (only their own orders)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotifications } from '@/lib/notifications';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/[id]/modify
 * Supplier proposes modifications to a purchase order
 * Auth: SUPPLIER
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

    // Check permission
    const canModify = await hasPermission(user.id, 'modify_purchase_order');
    if (!canModify) {
      return errorResponse('Insufficient permissions. Only SUPPLIER can modify purchase orders.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid order ID', 400);
    }

    const body = await request.json();
    const { supplierModifications } = body || {};

    if (!supplierModifications || typeof supplierModifications !== 'object') {
      return errorResponse('Supplier modifications object is required', 400);
    }

    const { quantityOrdered, unitCost, deliveryDate, notes } = supplierModifications;

    // Validate at least one modification is provided
    if (quantityOrdered === undefined && unitCost === undefined && deliveryDate === undefined && !notes) {
      return errorResponse('At least one modification must be provided', 400);
    }

    const db = await getDatabase();

    // Get existing order
    const purchaseOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!purchaseOrder) {
      return errorResponse('Purchase order not found', 404);
    }

    // Check if supplier matches
    if (purchaseOrder.supplierId.toString() !== userProfile._id.toString()) {
      return errorResponse('You can only modify your own purchase orders', 403);
    }

    // Check if status allows modification
    if (purchaseOrder.status !== 'order_sent') {
      return errorResponse(`Cannot modify order with status: ${purchaseOrder.status}`, 400);
    }

    // Build modifications object
    const modifications = {};
    if (quantityOrdered !== undefined) {
      if (quantityOrdered <= 0) {
        return errorResponse('Quantity ordered must be greater than 0', 400);
      }
      modifications.quantityOrdered = parseFloat(quantityOrdered);
    }
    if (unitCost !== undefined) {
      if (unitCost < 0) {
        return errorResponse('Unit cost must be >= 0', 400);
      }
      modifications.unitCost = parseFloat(unitCost);
    }
    if (deliveryDate) {
      const deliveryDateObj = new Date(deliveryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (deliveryDateObj < today) {
        return errorResponse('Delivery date must be a future date', 400);
      }
      modifications.deliveryDate = deliveryDateObj;
    }
    if (notes) {
      modifications.notes = notes.trim();
    }

    // Update order status
    const updateData = {
      status: 'order_modified',
      supplierResponse: 'modify',
      supplierResponseDate: new Date(),
      supplierModifications: modifications,
      modificationApproved: false,
      updatedAt: new Date(),
    };

    await db.collection('purchase_orders').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Get updated order
    const updatedOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
    });

    // Create notifications for PM/OWNER
    const managers = await db.collection('users').find({
      role: { $in: ['pm', 'project_manager', 'owner'] },
      status: 'active',
    }).toArray();

    if (managers.length > 0) {
      const notifications = managers.map(manager => ({
        userId: manager._id.toString(),
        type: 'approval_needed',
        title: 'Purchase Order Modification Request',
        message: `${purchaseOrder.supplierName} has proposed modifications to purchase order ${purchaseOrder.purchaseOrderNumber}`,
        projectId: purchaseOrder.projectId.toString(),
        relatedModel: 'PURCHASE_ORDER',
        relatedId: id,
        createdBy: userProfile._id.toString(),
      }));

      await createNotifications(notifications);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'MODIFIED',
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      projectId: purchaseOrder.projectId.toString(),
      changes: {
        before: purchaseOrder,
        after: updatedOrder,
        modifications,
      },
    });

    return successResponse(updatedOrder, 'Purchase order modification request submitted successfully');
  } catch (error) {
    console.error('Modify purchase order error:', error);
    return errorResponse('Failed to modify purchase order', 500);
  }
}

