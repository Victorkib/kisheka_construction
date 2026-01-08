/**
 * Purchase Order Fulfill API Route
 * POST /api/purchase-orders/[id]/fulfill
 * Supplier marks order as fulfilled (ready for delivery)
 * Auth: SUPPLIER (only their own orders)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotifications } from '@/lib/notifications';
import { createMaterialFromPurchaseOrder } from '@/lib/material-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/[id]/fulfill
 * Supplier fulfills a purchase order (marks as ready for delivery)
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
    const canFulfill = await hasPermission(user.id, 'fulfill_purchase_order');
    if (!canFulfill) {
      return errorResponse('Insufficient permissions. Only SUPPLIER can fulfill purchase orders.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid order ID', 400);
    }

    const body = await request.json();
    const { deliveryNoteFileUrl, actualQuantityDelivered, supplierNotes } = body || {};

    if (!deliveryNoteFileUrl || deliveryNoteFileUrl.trim().length === 0) {
      return errorResponse('Delivery note file URL is required', 400);
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
      return errorResponse('You can only fulfill your own purchase orders', 403);
    }

    // Check if status allows fulfillment
    if (purchaseOrder.status !== 'order_accepted') {
      return errorResponse(`Cannot fulfill order with status: ${purchaseOrder.status}. Order must be accepted first.`, 400);
    }

    // Update order status and store actual quantity if provided
    const updateData = {
      status: 'ready_for_delivery',
      deliveryNoteFileUrl: deliveryNoteFileUrl.trim(),
      updatedAt: new Date(),
      ...(actualQuantityDelivered !== undefined && actualQuantityDelivered !== null && {
        actualQuantityDelivered: parseFloat(actualQuantityDelivered),
      }),
      ...(supplierNotes && { supplierNotes: supplierNotes.trim() }),
    };

    await db.collection('purchase_orders').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Get updated order
    const updatedOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
    });

    // AUTOMATIC MATERIAL CREATION: Create material entry automatically when supplier fulfills
    // Materials created from POs are automatically approved for immediate financial state accuracy
    // Get the PM/OWNER who created the purchase order to use as material creator
    let materialCreationResult = null;
    let materialCreationError = null;
    
    try {
      const poCreator = await db.collection('users').findOne({
        _id: purchaseOrder.createdBy,
        status: 'active',
      });

      if (poCreator) {
        // Create material automatically (will be auto-approved)
        materialCreationResult = await createMaterialFromPurchaseOrder({
          purchaseOrderId: id,
          creatorUserProfile: poCreator,
          actualQuantityReceived: actualQuantityDelivered,
          notes: supplierNotes,
          isAutomatic: true,
        });
      } else {
        console.warn(`PO creator (${purchaseOrder.createdBy}) not found or inactive. Material will need to be created manually.`);
      }
    } catch (error) {
      // Log error but don't fail the fulfill operation
      // Material can still be created manually later
      console.error('Error automatically creating material from purchase order:', error);
      materialCreationError = error.message;
    }

    // Create notifications for CLERK/PM
    // If material was automatically created, notifications are already sent by createMaterialFromPurchaseOrder
    // Only send additional notifications if material creation failed or was skipped
    if (!materialCreationResult) {
      const clerks = await db.collection('users').find({
        role: { $in: ['clerk', 'site_clerk'] },
        status: 'active',
      }).toArray();

      const managers = await db.collection('users').find({
        role: { $in: ['pm', 'project_manager'] },
        status: 'active',
      }).toArray();

      const recipients = [...clerks, ...managers];

      if (recipients.length > 0) {
        const notifications = recipients.map(recipient => ({
          userId: recipient._id.toString(),
          type: 'item_received',
          title: materialCreationError 
            ? 'Purchase Order Fulfilled - Material Creation Failed' 
            : 'Purchase Order Ready for Delivery',
          message: materialCreationError
            ? `${purchaseOrder.supplierName} has fulfilled purchase order ${purchaseOrder.purchaseOrderNumber}, but material creation failed: ${materialCreationError}. Please create material manually.`
            : `${purchaseOrder.supplierName} has fulfilled purchase order ${purchaseOrder.purchaseOrderNumber}. Material entry automatically created and approved.`,
          projectId: purchaseOrder.projectId.toString(),
          relatedModel: materialCreationError ? 'PURCHASE_ORDER' : 'MATERIAL',
          relatedId: materialCreationError ? id : (materialCreationResult?.material?._id?.toString() || id),
          createdBy: userProfile._id.toString(),
        }));

        await createNotifications(notifications);
      }
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'FULFILLED',
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      projectId: purchaseOrder.projectId.toString(),
      changes: {
        before: purchaseOrder,
        after: updatedOrder,
        materialCreated: materialCreationResult ? true : false,
        materialCreationError: materialCreationError || null,
      },
    });

    // Return response with material creation info
    return successResponse({
      order: updatedOrder,
      material: materialCreationResult?.material || null,
      materialCreated: !!materialCreationResult,
      materialCreationError: materialCreationError || null,
    }, materialCreationResult 
      ? 'Purchase order fulfilled and material entry automatically created and approved' 
      : (materialCreationError 
          ? `Purchase order fulfilled, but material creation failed: ${materialCreationError}. Please create material manually.`
          : 'Purchase order marked as ready for delivery'));
  } catch (error) {
    console.error('Fulfill purchase order error:', error);
    return errorResponse('Failed to fulfill purchase order', 500);
  }
}

