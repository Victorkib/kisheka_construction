/**
 * Purchase Order Push Confirmation API Route
 * POST: Process supplier confirmation via push notification
 * 
 * POST /api/purchase-orders/[id]/confirm-push
 * Auth: None (public, token + subscription based)
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { createMaterialFromPurchaseOrder } from '@/lib/material-helpers';
import { updateCommittedCost, recalculateProjectFinances } from '@/lib/financial-helpers';
import { sendPushToUser } from '@/lib/push-service';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/[id]/confirm-push
 * Process supplier confirmation via push notification
 * Body: { action: 'accept'|'reject', token, subscriptionEndpoint }
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, token, subscriptionEndpoint } = body;

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid purchase order ID', 400);
    }

    if (!action || !['accept', 'reject'].includes(action)) {
      return errorResponse('Invalid action. Must be "accept" or "reject"', 400);
    }

    if (!token) {
      return errorResponse('Response token is required', 400);
    }

    if (!subscriptionEndpoint) {
      return errorResponse('Subscription endpoint is required', 400);
    }

    const db = await getDatabase();

    // Get purchase order
    const purchaseOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
      deletedAt: null
    });

    if (!purchaseOrder) {
      return errorResponse('Purchase order not found', 404);
    }

    // Validate token
    if (purchaseOrder.responseToken !== token) {
      return errorResponse('Invalid response token', 401);
    }

    // Check if token is expired
    if (purchaseOrder.responseTokenExpiresAt && new Date() > new Date(purchaseOrder.responseTokenExpiresAt)) {
      return errorResponse('Response token has expired', 401);
    }

    // Validate subscription endpoint matches
    const subscription = await db.collection('push_subscriptions').findOne({
      endpoint: subscriptionEndpoint,
      supplierId: purchaseOrder.supplierId,
      userType: 'supplier',
      status: 'active'
    });

    if (!subscription) {
      return errorResponse('Invalid subscription', 401);
    }

    // Check if order can be confirmed
    if (purchaseOrder.status !== 'order_sent' && purchaseOrder.status !== 'order_modified') {
      return errorResponse(`Cannot ${action} order with status: ${purchaseOrder.status}`, 400);
    }

    if (action === 'accept') {
      // Update order status to accepted
      const updateData = {
        status: 'order_accepted',
        supplierResponse: 'accept',
        supplierResponseDate: new Date(),
        financialStatus: 'committed',
        committedAt: new Date(),
        autoConfirmed: true,
        autoConfirmedAt: new Date(),
        autoConfirmationMethod: 'push',
        updatedAt: new Date()
      };

      await db.collection('purchase_orders').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      // Increase committedCost
      await updateCommittedCost(
        purchaseOrder.projectId.toString(),
        purchaseOrder.totalCost,
        'add'
      );

      // Trigger financial recalculation
      await recalculateProjectFinances(purchaseOrder.projectId.toString());

      // Get the PM/OWNER who created the purchase order
      const poCreator = await db.collection('users').findOne({
        _id: purchaseOrder.createdBy,
        status: 'active'
      });

      // Automatically create material entry if configured
      let materialCreated = false;
      if (process.env.AUTO_CREATE_MATERIAL_ON_CONFIRM === 'true' && poCreator) {
        try {
          await createMaterialFromPurchaseOrder({
            purchaseOrderId: id,
            creatorUserProfile: poCreator,
            actualQuantityReceived: purchaseOrder.quantityOrdered,
            notes: 'Auto-created from push notification confirmation',
            isAutomatic: true
          });
          materialCreated = true;
        } catch (materialError) {
          console.error('Auto-create material error:', materialError);
          // Don't fail the confirmation if material creation fails
        }
      }

      // Send push notification to PM/OWNER
      if (poCreator) {
        try {
          await sendPushToUser({
            userId: poCreator._id.toString(),
            title: 'Purchase Order Confirmed',
            message: `${purchaseOrder.supplierName} confirmed PO ${purchaseOrder.purchaseOrderNumber}${materialCreated ? ' - Material entry created' : ''}`,
            data: {
              url: `/purchase-orders/${id}`,
              purchaseOrderId: id
            }
          });
        } catch (pushError) {
          console.error('Push notification to PM/OWNER failed:', pushError);
        }
      }

      // Create audit log
      await createAuditLog({
        userId: null, // System action
        action: 'AUTO_CONFIRMED',
        entityType: 'PURCHASE_ORDER',
        entityId: id,
        projectId: purchaseOrder.projectId.toString(),
        changes: {
          before: purchaseOrder,
          after: { ...purchaseOrder, ...updateData },
          confirmationMethod: 'push',
          materialCreated
        }
      });

      return successResponse({
        orderId: id,
        status: 'order_accepted',
        materialCreated,
        message: materialCreated 
          ? 'Order confirmed and material entry created automatically'
          : 'Order confirmed successfully'
      }, 'Purchase order confirmed successfully');
    } else if (action === 'reject') {
      // For reject, we need a reason - but push notification can't provide it
      // So we'll mark it as rejected but require follow-up
      const updateData = {
        status: 'order_rejected',
        supplierResponse: 'reject',
        supplierResponseDate: new Date(),
        autoConfirmed: true,
        autoConfirmedAt: new Date(),
        autoConfirmationMethod: 'push',
        supplierNotes: 'Rejected via push notification - reason required',
        updatedAt: new Date()
      };

      await db.collection('purchase_orders').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      // Notify PM/OWNER
      const poCreator = await db.collection('users').findOne({
        _id: purchaseOrder.createdBy,
        status: 'active'
      });

      if (poCreator) {
        try {
          await sendPushToUser({
            userId: poCreator._id.toString(),
            title: 'Purchase Order Rejected',
            message: `${purchaseOrder.supplierName} rejected PO ${purchaseOrder.purchaseOrderNumber}`,
            data: {
              url: `/purchase-orders/${id}`,
              purchaseOrderId: id
            }
          });
        } catch (pushError) {
          console.error('Push notification to PM/OWNER failed:', pushError);
        }
      }

      // Create audit log
      await createAuditLog({
        userId: null,
        action: 'AUTO_REJECTED',
        entityType: 'PURCHASE_ORDER',
        entityId: id,
        projectId: purchaseOrder.projectId.toString(),
        changes: {
          before: purchaseOrder,
          after: { ...purchaseOrder, ...updateData },
          confirmationMethod: 'push'
        }
      });

      return successResponse({
        orderId: id,
        status: 'order_rejected',
        note: 'Order rejected. Please contact supplier for reason if needed.'
      }, 'Purchase order rejected');
    }
  } catch (error) {
    console.error('Confirm push error:', error);
    return errorResponse('Failed to process push confirmation', 500);
  }
}

