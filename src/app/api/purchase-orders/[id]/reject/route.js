/**
 * Purchase Order Reject API Route
 * POST /api/purchase-orders/[id]/reject
 * Supplier rejects a purchase order
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
 * POST /api/purchase-orders/[id]/reject
 * Supplier rejects a purchase order
 * Auth: SUPPLIER
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
    const canReject = await hasPermission(user.id, 'reject_purchase_order');
    if (!canReject) {
      return errorResponse('Insufficient permissions. Only SUPPLIER can reject purchase orders.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid order ID', 400);
    }

    const body = await request.json();
    const { supplierNotes } = body || {};

    if (!supplierNotes || supplierNotes.trim().length === 0) {
      return errorResponse('Rejection reason (supplierNotes) is required', 400);
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
      return errorResponse('You can only reject your own purchase orders', 403);
    }

    // Check if status allows rejection
    const rejectableStatuses = ['order_sent', 'order_modified'];
    if (!rejectableStatuses.includes(purchaseOrder.status)) {
      return errorResponse(`Cannot reject order with status: ${purchaseOrder.status}`, 400);
    }

    // Update order status
    const updateData = {
      status: 'order_rejected',
      supplierResponse: 'reject',
      supplierResponseDate: new Date(),
      supplierNotes: supplierNotes.trim(),
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
        type: 'approval_status',
        title: 'Purchase Order Rejected',
        message: `${purchaseOrder.supplierName} rejected purchase order ${purchaseOrder.purchaseOrderNumber}. Reason: ${supplierNotes.trim()}`,
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
      action: 'REJECTED',
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      projectId: purchaseOrder.projectId.toString(),
      changes: {
        before: purchaseOrder,
        after: updatedOrder,
      },
    });

    return successResponse(updatedOrder, 'Purchase order rejected successfully');
  } catch (error) {
    console.error('Reject purchase order error:', error);
    return errorResponse('Failed to reject purchase order', 500);
  }
}

