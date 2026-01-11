/**
 * Retry Supplier API Route
 * POST /api/purchase-orders/[id]/retry-supplier
 * Retries a rejected purchase order with the same supplier using adjustments
 * Auth: PM, OWNER
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotifications } from '@/lib/notifications';
import { sendPurchaseOrderEmail } from '@/lib/email-templates/purchase-order-templates';
import { sendSMS, generatePurchaseOrderSMS, generateRetryOrderSMS, formatPhoneNumber } from '@/lib/sms-service';
import { sendPushToSupplier } from '@/lib/push-service';
import { generateShortUrl } from '@/lib/generators/url-shortener';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/[id]/retry-supplier
 * Retry a rejected purchase order with the same supplier
 * Body: { adjustments, notes, communicationChannels }
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
    const canRetry = await hasPermission(user.id, 'retry_purchase_order');
    if (!canRetry) {
      return errorResponse('Insufficient permissions to retry purchase order', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid order ID', 400);
    }

    const body = await request.json();
    const { 
      adjustments = {}, 
      notes = '', 
      communicationChannels = ['email'],
      sendImmediately = true 
    } = body || {};

    // Validate adjustments
    const validAdjustmentFields = ['unitCost', 'quantityOrdered', 'deliveryDate', 'terms', 'notes'];
    const invalidFields = Object.keys(adjustments).filter(field => !validAdjustmentFields.includes(field));
    if (invalidFields.length > 0) {
      return errorResponse(`Invalid adjustment fields: ${invalidFields.join(', ')}`, 400);
    }

    // Validate communication channels
    const validChannels = ['email', 'sms', 'push'];
    const invalidChannels = communicationChannels.filter(channel => !validChannels.includes(channel));
    if (invalidChannels.length > 0) {
      return errorResponse(`Invalid communication channels: ${invalidChannels.join(', ')}`, 400);
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

    // Check if order can be retried
    if (purchaseOrder.status !== 'order_rejected') {
      return errorResponse(`Cannot retry order with status: ${purchaseOrder.status}. Only rejected orders can be retried.`, 400);
    }

    if (!purchaseOrder.isRetryable) {
      return errorResponse(`Order is not retryable. Reason: ${purchaseOrder.retryRecommendation}`, 400);
    }

    // Check retry limits (prevent infinite retries)
    const currentRetryCount = purchaseOrder.retryCount || 0;
    if (currentRetryCount >= 3) {
      return errorResponse('Maximum retry attempts (3) reached for this order', 400);
    }

    // Get supplier information
    const supplier = await db.collection('suppliers').findOne({
      _id: purchaseOrder.supplierId,
    });

    if (!supplier) {
      return errorResponse('Supplier not found', 404);
    }

    // Get material request for details
    const materialRequest = await db.collection('material_requests').findOne({
      _id: purchaseOrder.materialRequestId,
    });

    if (!materialRequest) {
      return errorResponse('Material request not found', 404);
    }

    // Apply adjustments to create new order data
    const retryOrderData = {
      ...purchaseOrder,
      unitCost: adjustments.unitCost !== undefined ? parseFloat(adjustments.unitCost) : purchaseOrder.unitCost,
      quantityOrdered: adjustments.quantityOrdered !== undefined ? parseFloat(adjustments.quantityOrdered) : purchaseOrder.quantityOrdered,
      deliveryDate: adjustments.deliveryDate ? new Date(adjustments.deliveryDate) : purchaseOrder.deliveryDate,
      terms: adjustments.terms || purchaseOrder.terms,
      notes: adjustments.notes || purchaseOrder.notes,
      totalCost: 0, // Will be recalculated
    };

    // Recalculate total cost
    retryOrderData.totalCost = retryOrderData.quantityOrdered * retryOrderData.unitCost;

    // Validate the retry order data
    if (retryOrderData.unitCost < 0) {
      return errorResponse('Unit cost cannot be negative', 400);
    }
    if (retryOrderData.quantityOrdered <= 0) {
      return errorResponse('Quantity must be greater than 0', 400);
    }
    if (new Date(retryOrderData.deliveryDate) <= new Date()) {
      return errorResponse('Delivery date must be in the future', 400);
    }

    // Generate new response token for retry
    const responseToken = generateShortUrl(`${id}-retry-${currentRetryCount + 1}-${Date.now()}`);
    const responseTokenExpiresAt = new Date();
    responseTokenExpiresAt.setDate(responseTokenExpiresAt.getDate() + 7); // 7 days expiry

    // Update order status to retry_sent
    const updateData = {
      status: 'retry_sent',
      retryCount: currentRetryCount + 1,
      retryRequestedAt: new Date(),
      retryRequestedBy: userProfile._id,
      retryAdjustments: {
        ...adjustments,
        originalUnitCost: purchaseOrder.unitCost,
        originalQuantityOrdered: purchaseOrder.quantityOrdered,
        originalDeliveryDate: purchaseOrder.deliveryDate,
        originalTotalCost: purchaseOrder.totalCost,
        newUnitCost: retryOrderData.unitCost,
        newQuantityOrdered: retryOrderData.quantityOrdered,
        newDeliveryDate: retryOrderData.deliveryDate,
        newTotalCost: retryOrderData.totalCost,
        requestedBy: userProfile._id,
        requestedByName: userProfile.name || userProfile.email,
        requestedAt: new Date(),
        notes: notes.trim(),
      },
      unitCost: retryOrderData.unitCost,
      quantityOrdered: retryOrderData.quantityOrdered,
      deliveryDate: retryOrderData.deliveryDate,
      terms: retryOrderData.terms,
      notes: retryOrderData.notes,
      totalCost: retryOrderData.totalCost,
      responseToken,
      responseTokenExpiresAt,
      responseTokenUsedAt: null, // Reset for retry
      supplierResponse: null, // Reset supplier response
      supplierResponseDate: null, // Reset response date
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

    // Send communications if requested
    const communicationResults = [];
    if (sendImmediately && communicationChannels.length > 0) {
      const responseUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/purchase-orders/respond/${responseToken}`;
      const shortLink = generateShortUrl(responseToken);

      for (const channel of communicationChannels) {
        try {
          let result = { channel, success: false, error: null };

          if (channel === 'email') {
            if (!supplier.emailEnabled || !supplier.email) {
              result.error = 'Email not enabled or no email address';
            } else {
              const emailResult = await sendPurchaseOrderEmail({
                supplier,
                purchaseOrder: updatedOrder,
                responseToken,
                isRetry: true,
                retryCount: currentRetryCount + 1,
                adjustments: updateData.retryAdjustments,
              });
              result.success = true;
              result.messageId = emailResult.messageId;
            }
          } else if (channel === 'sms') {
            if (!supplier.smsEnabled || !supplier.phone) {
              result.error = 'SMS not enabled or no phone number';
            } else {
              const formattedPhone = formatPhoneNumber(supplier.phone);
              
              // Use retry order SMS with context
              const adjustments = {};
              if (retryOrderData.unitCost !== purchaseOrder.unitCost) {
                adjustments.unitCost = retryOrderData.unitCost;
              }
              if (retryOrderData.quantityOrdered !== purchaseOrder.quantityOrdered) {
                adjustments.quantityOrdered = retryOrderData.quantityOrdered;
              }
              if (retryOrderData.deliveryDate && purchaseOrder.deliveryDate && 
                  new Date(retryOrderData.deliveryDate).getTime() !== new Date(purchaseOrder.deliveryDate).getTime()) {
                adjustments.deliveryDate = retryOrderData.deliveryDate;
              }
              
              const smsMessage = generateRetryOrderSMS({
                purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
                originalPONumber: purchaseOrder.purchaseOrderNumber,
                rejectionReason: purchaseOrder.rejectionReason || purchaseOrder.rejectionSubcategory || 'Not specified',
                adjustments: Object.keys(adjustments).length > 0 ? adjustments : null,
                supplier: supplier // Pass supplier for language detection
              });

              const smsResult = await sendSMS({
                to: formattedPhone,
                message: smsMessage,
              });

              result.success = smsResult.success;
              result.messageId = smsResult.messageId;
              if (!smsResult.success) {
                result.error = smsResult.error;
              }
            }
          } else if (channel === 'push') {
            if (!supplier.pushNotificationsEnabled) {
              result.error = 'Push notifications not enabled';
            } else {
              const pushActions = [
                { action: 'accept', title: 'Accept' },
                { action: 'reject', title: 'Reject' },
                { action: 'view', title: 'View Details' },
              ];

              const pushData = {
                purchaseOrderId: id,
                token: responseToken,
                url: responseUrl,
                isRetry: true,
                retryCount: currentRetryCount + 1,
              };

              const pushResults = await sendPushToSupplier({
                supplierId: purchaseOrder.supplierId.toString(),
                title: `Retry Request: ${purchaseOrder.purchaseOrderNumber}`,
                message: `${materialRequest.materialName} - ${retryOrderData.quantityOrdered} ${materialRequest.unit} - ${retryOrderData.totalCost.toLocaleString()} KES (Retry #${currentRetryCount + 1})`,
                actions: pushActions,
                data: pushData,
              });

              const successfulPushes = pushResults.filter((r) => r.success);
              result.success = successfulPushes.length > 0;
              result.subscriptionCount = successfulPushes.length;
              result.totalSubscriptions = pushResults.length;
              if (!result.success) {
                result.error = 'All push notifications failed';
              }
            }
          }

          communicationResults.push(result);

          // Track communication in order
          await db.collection('purchase_orders').updateOne(
            { _id: new ObjectId(id) },
            {
              $push: {
                communications: {
                  channel,
                  sentAt: new Date(),
                  status: result.success ? 'sent' : 'failed',
                  messageId: result.messageId || null,
                  error: result.error || null,
                  isRetry: true,
                  retryCount: currentRetryCount + 1,
                },
              },
            }
          );

        } catch (error) {
          communicationResults.push({
            channel,
            success: false,
            error: error.message,
          });

          // Track failed communication
          await db.collection('purchase_orders').updateOne(
            { _id: new ObjectId(id) },
            {
              $push: {
                communications: {
                  channel,
                  sentAt: new Date(),
                  status: 'failed',
                  error: error.message,
                  isRetry: true,
                  retryCount: currentRetryCount + 1,
                },
              },
            }
          );
        }
      }
    }

    // Create notifications for PM/OWNER
    const managers = await db.collection('users').find({
      role: { $in: ['pm', 'project_manager', 'owner'] },
      status: 'active',
    }).toArray();

    if (managers.length > 0) {
      const notifications = managers.map(manager => ({
        userId: manager._id.toString(),
        type: 'order_retry',
        title: 'Purchase Order Retry Sent',
        message: `Retry #${currentRetryCount + 1} sent to ${supplier.name} for PO ${purchaseOrder.purchaseOrderNumber}. Adjustments: ${Object.keys(adjustments).join(', ') || 'None'}`,
        projectId: purchaseOrder.projectId.toString(),
        relatedModel: 'PURCHASE_ORDER',
        relatedId: id,
        createdBy: userProfile._id.toString(),
        metadata: {
          retryCount: currentRetryCount + 1,
          adjustments: updateData.retryAdjustments,
          communicationChannels,
          communicationResults,
        }
      }));

      await createNotifications(notifications);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'RETRIED',
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      projectId: purchaseOrder.projectId.toString(),
      changes: {
        before: purchaseOrder,
        after: updatedOrder,
        retryCount: currentRetryCount + 1,
        adjustments: updateData.retryAdjustments,
        communicationChannels,
        communicationResults,
      },
      metadata: {
        isRetry: true,
        retryCount: currentRetryCount + 1,
        originalRejectionReason: purchaseOrder.rejectionReason,
        originalRejectionSubcategory: purchaseOrder.rejectionSubcategory,
      }
    });

    return successResponse({
      order: updatedOrder,
      retryCount: currentRetryCount + 1,
      adjustments: updateData.retryAdjustments,
      communicationResults,
      responseUrl: sendImmediately ? `${process.env.NEXT_PUBLIC_APP_URL}/purchase-orders/respond/${responseToken}` : null,
    }, `Purchase order retry #${currentRetryCount + 1} sent successfully`);

  } catch (error) {
    console.error('Retry purchase order error:', error);
    return errorResponse('Failed to retry purchase order', 500);
  }
}
