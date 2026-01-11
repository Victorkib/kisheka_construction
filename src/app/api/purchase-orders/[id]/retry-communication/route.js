/**
 * Retry Communication API Route
 * POST /api/purchase-orders/[id]/retry-communication
 * Retries sending email, SMS, or push notification for a purchase order
 * Auth: PM, OWNER
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { sendPurchaseOrderEmail } from '@/lib/email-templates/purchase-order-templates';
import { sendSMS, sendMultipleSMS, generatePurchaseOrderSMS, generateBulkPurchaseOrderSMS, formatPhoneNumber } from '@/lib/sms-service';
import { sendPushToSupplier } from '@/lib/push-service';
import { generateShortUrl } from '@/lib/generators/url-shortener';

/**
 * POST /api/purchase-orders/[id]/retry-communication
 * Retry sending communication (email, SMS, or push) for a purchase order
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
    const canEdit = await hasPermission(user.id, 'edit_purchase_order');
    if (!canEdit) {
      return errorResponse('Insufficient permissions to retry communications', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid order ID', 400);
    }

    const body = await request.json();
    const { channel } = body;

    if (!channel || !['email', 'sms', 'push'].includes(channel)) {
      return errorResponse('Invalid channel. Must be: email, sms, or push', 400);
    }

    const db = await getDatabase();

    // Get purchase order
    const purchaseOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!purchaseOrder) {
      return errorResponse('Purchase order not found', 404);
    }

    // Get supplier
    const supplier = await db.collection('suppliers').findOne({
      _id: purchaseOrder.supplierId,
    });

    if (!supplier) {
      return errorResponse('Supplier not found', 404);
    }

    // Get material request for details (for single orders)
    let materialRequest = null;
    if (purchaseOrder.materialRequestId && !purchaseOrder.isBulkOrder) {
      materialRequest = await db.collection('material_requests').findOne({
        _id: purchaseOrder.materialRequestId,
      });

      if (!materialRequest) {
        return errorResponse('Material request not found', 404);
      }
    }

    const responseToken = purchaseOrder.responseToken;
    if (!responseToken) {
      return errorResponse('Response token not found. Cannot retry communication.', 400);
    }

    const responseUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/purchase-orders/respond/${responseToken}`;
    const shortLink = generateShortUrl(responseToken);

    let result = { success: false, error: null };

    // Retry based on channel
    try {
      if (channel === 'email') {
        if (!supplier.emailEnabled) {
          return errorResponse('Email is disabled for this supplier', 400);
        }

        if (!supplier.email) {
          return errorResponse('Supplier email not found', 400);
        }

        const emailResult = await sendPurchaseOrderEmail({
          supplier,
          purchaseOrder,
          responseToken,
        });

        result = { success: true, messageId: emailResult.messageId };

        // Track communication
        await db.collection('purchase_orders').updateOne(
          { _id: new ObjectId(id) },
          {
            $push: {
              communications: {
                channel: 'email',
                sentAt: new Date(),
                status: 'sent',
                messageId: emailResult.messageId || null,
                retry: true,
              },
            },
          }
        );
      } else if (channel === 'sms') {
        if (!supplier.smsEnabled) {
          return errorResponse('SMS is disabled for this supplier', 400);
        }

        if (!supplier.phone) {
          return errorResponse('Supplier phone number not found', 400);
        }

        const formattedPhone = formatPhoneNumber(supplier.phone);
        
        // Use detailed bulk order SMS for bulk orders, regular SMS for single orders
        let smsMessage;
        let isMultiPart = false;
        
        if (purchaseOrder.isBulkOrder && purchaseOrder.materials && Array.isArray(purchaseOrder.materials) && purchaseOrder.materials.length > 0) {
          // Bulk order - use detailed message with material breakdown (may return array for multi-part)
          smsMessage = await generateBulkPurchaseOrderSMS({
            purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
            materials: purchaseOrder.materials,
            totalCost: purchaseOrder.totalCost,
            shortLink,
            deliveryDate: purchaseOrder.deliveryDate,
            enableMultiPart: true,
            supplier: supplier, // Pass supplier for language detection
            projectId: purchaseOrder.projectId?.toString() || null,
            enablePersonalization: true
          });
          isMultiPart = Array.isArray(smsMessage);
        } else if (materialRequest) {
          // Single order - use regular SMS
          smsMessage = await generatePurchaseOrderSMS({
            purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
            materialName: materialRequest.materialName,
            quantity: purchaseOrder.quantityOrdered,
            unit: materialRequest.unit,
            totalCost: purchaseOrder.totalCost,
            shortLink,
            deliveryDate: purchaseOrder.deliveryDate,
            unitCost: purchaseOrder.unitCost || null,
            supplier: supplier, // Pass supplier for language detection
            projectId: purchaseOrder.projectId?.toString() || null,
            enablePersonalization: true
          });
        } else {
          // Fallback if no material request found
          return errorResponse('Cannot generate SMS: Material details not found', 400);
        }

        let smsResult;
        if (isMultiPart) {
          // Send multiple messages for bulk orders with 5+ materials
          smsResult = await sendMultipleSMS({
            to: formattedPhone,
            messages: smsMessage,
            delayBetweenMessages: 1000
          });
          
          if (smsResult.success) {
            result = { 
              success: true, 
              messageId: smsResult.messageIds?.[0] || null,
              isMultiPart: true,
              totalParts: smsMessage.length,
              totalSent: smsResult.totalSent
            };

            // Track communication
            await db.collection('purchase_orders').updateOne(
              { _id: new ObjectId(id) },
              {
                $push: {
                  communications: {
                    channel: 'sms',
                    sentAt: new Date(),
                    status: 'sent',
                    messageId: smsResult.messageIds?.[0] || null,
                    retry: true,
                    isMultiPart: true,
                    totalParts: smsMessage.length,
                    totalSent: smsResult.totalSent,
                    totalFailed: smsResult.totalFailed
                  },
                },
              }
            );
          } else {
            throw new Error(smsResult.errors?.[0]?.error || 'SMS send failed');
          }
        } else {
          // Single message
          smsResult = await sendSMS({
            to: formattedPhone,
            message: smsMessage,
          });

          if (smsResult.success && !smsResult.skipped) {
            result = { success: true, messageId: smsResult.messageId };

            // Track communication
            await db.collection('purchase_orders').updateOne(
              { _id: new ObjectId(id) },
              {
                $push: {
                  communications: {
                    channel: 'sms',
                    sentAt: new Date(),
                    status: 'sent',
                    messageId: smsResult.messageId || null,
                    retry: true,
                  },
                },
              }
            );
          } else {
            throw new Error(smsResult.error || 'SMS send failed');
          }
        }
      } else if (channel === 'push') {
        if (!supplier.pushNotificationsEnabled) {
          return errorResponse('Push notifications are disabled for this supplier', 400);
        }

        const pushActions = [
          { action: 'accept', title: 'Accept' },
          { action: 'reject', title: 'Reject' },
          { action: 'view', title: 'View Details' },
        ];

        const pushData = {
          purchaseOrderId: id,
          token: responseToken,
          url: responseUrl,
        };

        // Get supplier's push subscriptions
        const subscriptions = await db.collection('push_subscriptions').find({
          supplierId: purchaseOrder.supplierId,
          userType: 'supplier',
          status: 'active',
        }).toArray();

        if (subscriptions.length === 0) {
          return errorResponse('No active push subscriptions found for this supplier', 400);
        }

        const pushResults = await sendPushToSupplier({
          supplierId: purchaseOrder.supplierId.toString(),
          title: `New Purchase Order: ${purchaseOrder.purchaseOrderNumber}`,
          message: `${materialRequest.materialName} - ${purchaseOrder.quantityOrdered} ${materialRequest.unit} - ${purchaseOrder.totalCost.toLocaleString()} KES`,
          actions: pushActions,
          data: pushData,
        });

        const successfulPushes = pushResults.filter((r) => r.success);
        if (successfulPushes.length > 0) {
          result = { success: true, subscriptionCount: successfulPushes.length };

          // Track communication
          await db.collection('purchase_orders').updateOne(
            { _id: new ObjectId(id) },
            {
              $push: {
                communications: {
                  channel: 'push',
                  sentAt: new Date(),
                  status: 'sent',
                  subscriptionCount: successfulPushes.length,
                  totalSubscriptions: subscriptions.length,
                  retry: true,
                },
              },
            }
          );
        } else {
          throw new Error('All push notifications failed');
        }
      }

      return successResponse(result, `${channel.toUpperCase()} communication retried successfully`);
    } catch (error) {
      console.error(`[Retry ${channel}] Error:`, error);

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
              retry: true,
            },
          },
        }
      );

      return errorResponse(`Failed to retry ${channel} communication: ${error.message}`, 500);
    }
  } catch (error) {
    console.error('Retry communication error:', error);
    return errorResponse('Failed to retry communication', 500);
  }
}

