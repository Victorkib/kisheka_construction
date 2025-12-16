/**
 * SMS Webhook API Route
 * POST: Receive SMS replies from Africa's Talking
 * 
 * POST /api/sms/webhook
 * Auth: Webhook secret validation
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';
import { parseSMSReply, sendSMS } from '@/lib/sms-service';
import { updateCommittedCost, recalculateProjectFinances } from '@/lib/financial-helpers';
import { createMaterialFromPurchaseOrder } from '@/lib/material-helpers';
import { sendPushToUser } from '@/lib/push-service';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import crypto from 'crypto';

/**
 * Validate webhook signature (if Africa's Talking provides it)
 */
function validateWebhookSignature(body, signature, secret) {
  if (!secret || !signature) {
    return true; // Skip validation if not configured
  }

  const hash = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
  return hash === signature;
}

/**
 * POST /api/sms/webhook
 * Process SMS replies from Africa's Talking
 * Body: Africa's Talking webhook payload
 */
export async function POST(request) {
  try {
    const body = await request.json();
    
    // Validate webhook secret if configured
    const webhookSecret = process.env.AFRICASTALKING_WEBHOOK_SECRET;
    const signature = request.headers.get('x-africastalking-signature');
    
    if (webhookSecret && signature) {
      if (!validateWebhookSignature(body, signature, webhookSecret)) {
        return errorResponse('Invalid webhook signature', 401);
      }
    }

    // Parse Africa's Talking webhook format
    // Format: { from: '+254712345678', to: '+254700000000', text: 'ACCEPT PO-001', date: '2024-01-01 12:00:00' }
    const { from, to, text, date } = body;

    if (!from || !text) {
      return errorResponse('Invalid webhook payload', 400);
    }

    // Parse SMS reply
    const parsed = parseSMSReply(text);
    
    if (!parsed.action) {
      // Not a valid command, ignore
      return successResponse({ processed: false }, 'SMS not processed - invalid command');
    }

    const db = await getDatabase();

    // Find purchase order by number or by supplier phone
    let purchaseOrder = null;

    if (parsed.purchaseOrderNumber) {
      // Find by PO number
      purchaseOrder = await db.collection('purchase_orders').findOne({
        purchaseOrderNumber: parsed.purchaseOrderNumber,
        deletedAt: null
      });
    } else {
      // Find by supplier phone (most recent pending order)
      const supplier = await db.collection('suppliers').findOne({
        phone: from.replace(/^\+/, '') || from,
        status: 'active',
        deletedAt: null
      });

      if (supplier) {
        purchaseOrder = await db.collection('purchase_orders').findOne({
          supplierId: supplier._id,
          status: { $in: ['order_sent', 'order_modified'] },
          deletedAt: null
        }, {
          sort: { createdAt: -1 }
        });
      }
    }

    if (!purchaseOrder) {
      // Send error SMS back to supplier
      try {
        await sendSMS({
          to: from,
          message: 'Sorry, we could not find your purchase order. Please contact us directly.',
        });
        console.log(`[SMS Webhook] Error SMS sent to ${from} - PO not found`);
      } catch (smsError) {
        console.error('[SMS Webhook] Failed to send error SMS:', smsError);
      }
      return successResponse({ processed: false }, 'Purchase order not found');
    }

    // Validate response token (if order has one)
    if (purchaseOrder.responseTokenExpiresAt && new Date() > new Date(purchaseOrder.responseTokenExpiresAt)) {
      return successResponse({ processed: false }, 'Response token expired');
    }

    // Process action
    if (parsed.action === 'accept') {
      // CRITICAL: Wrap critical operations in transaction for atomicity
      console.log('[SMS Webhook] Starting transaction for atomic operations');

      const updateData = {
        status: 'order_accepted',
        supplierResponse: 'accept',
        supplierResponseDate: new Date(),
        financialStatus: 'committed',
        committedAt: new Date(),
        autoConfirmed: true,
        autoConfirmedAt: new Date(),
        autoConfirmationMethod: 'sms',
        supplierNotes: `Accepted via SMS: ${text}`,
        updatedAt: new Date()
      };

      const transactionResult = await withTransaction(async ({ db, session }) => {
        // 1. Update purchase order status (atomic)
        await db.collection('purchase_orders').updateOne(
          { _id: purchaseOrder._id },
          { $set: updateData },
          { session }
        );

        // 2. Increase committedCost (atomic with PO update)
        await updateCommittedCost(
          purchaseOrder.projectId.toString(),
          purchaseOrder.totalCost,
          'add',
          session
        );

        // 3. Create audit log (atomic with above)
        await createAuditLog({
          userId: null,
          action: 'AUTO_CONFIRMED',
          entityType: 'PURCHASE_ORDER',
          entityId: purchaseOrder._id.toString(),
          projectId: purchaseOrder.projectId.toString(),
          changes: {
            before: purchaseOrder,
            after: { ...purchaseOrder, ...updateData },
            confirmationMethod: 'sms',
            materialCreated: false, // Will be updated after material creation if it happens
          },
        }, { session });

        return { success: true };
      });

      console.log('[SMS Webhook] Transaction completed successfully');

      // Non-critical operations (can fail without affecting core data)
      // Trigger financial recalculation (read-heavy, can happen outside transaction)
      try {
        await recalculateProjectFinances(purchaseOrder.projectId.toString());
      } catch (recalcError) {
        console.error('[SMS Webhook] Financial recalculation failed (non-critical):', recalcError);
        // Don't fail the webhook - recalculation can be done later
      }

      // Auto-create material if configured
      let materialCreated = false;
      if (process.env.AUTO_CREATE_MATERIAL_ON_CONFIRM === 'true') {
        const poCreator = await db.collection('users').findOne({
          _id: purchaseOrder.createdBy,
          status: 'active'
        });

        if (poCreator) {
          try {
            await createMaterialFromPurchaseOrder({
              purchaseOrderId: purchaseOrder._id.toString(),
              creatorUserProfile: poCreator,
              actualQuantityReceived: purchaseOrder.quantityOrdered,
              notes: 'Auto-created from SMS confirmation',
              isAutomatic: true
            });
            materialCreated = true;
          } catch (materialError) {
            console.error('Auto-create material error:', materialError);
          }
        }
      }

      // Notify PM/OWNER
      const poCreator = await db.collection('users').findOne({
        _id: purchaseOrder.createdBy,
        status: 'active'
      });

      if (poCreator) {
        try {
          await sendPushToUser({
            userId: poCreator._id.toString(),
            title: 'Purchase Order Confirmed',
            message: `${purchaseOrder.supplierName} confirmed PO ${purchaseOrder.purchaseOrderNumber} via SMS${materialCreated ? ' - Material entry created' : ''}`,
            data: {
              url: `/purchase-orders/${purchaseOrder._id.toString()}`,
              purchaseOrderId: purchaseOrder._id.toString()
            }
          });
        } catch (pushError) {
          console.error('[SMS Webhook] Push notification failed (non-critical):', pushError);
          // Don't fail the webhook - notification is non-critical
        }
      }

      // Note: Audit log already created inside transaction above (line 152)

      // Send confirmation SMS back to supplier
      try {
        const confirmationMessage = `Thank you! PO-${purchaseOrder.purchaseOrderNumber} ACCEPTED. We'll contact you soon.`;
        await sendSMS({
          to: from,
          message: confirmationMessage,
        });
        console.log(`[SMS Webhook] Confirmation SMS sent to ${from}`);
      } catch (smsError) {
        console.error('[SMS Webhook] Failed to send confirmation SMS:', smsError);
        // Don't fail the webhook processing if SMS confirmation fails
      }

      return successResponse({
        processed: true,
        action: 'accept',
        purchaseOrderId: purchaseOrder._id.toString(),
        materialCreated
      }, 'Purchase order confirmed via SMS');
    } else if (parsed.action === 'reject') {
      // Update order status
      const updateData = {
        status: 'order_rejected',
        supplierResponse: 'reject',
        supplierResponseDate: new Date(),
        autoConfirmed: true,
        autoConfirmedAt: new Date(),
        autoConfirmationMethod: 'sms',
        supplierNotes: `Rejected via SMS: ${text}`,
        updatedAt: new Date()
      };

      await db.collection('purchase_orders').updateOne(
        { _id: purchaseOrder._id },
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
            message: `${purchaseOrder.supplierName} rejected PO ${purchaseOrder.purchaseOrderNumber} via SMS`,
            data: {
              url: `/purchase-orders/${purchaseOrder._id.toString()}`,
              purchaseOrderId: purchaseOrder._id.toString()
            }
          });
        } catch (pushError) {
          console.error('Push notification failed:', pushError);
        }
      }

      // Create audit log
      await createAuditLog({
        userId: null,
        action: 'AUTO_REJECTED',
        entityType: 'PURCHASE_ORDER',
        entityId: purchaseOrder._id.toString(),
        projectId: purchaseOrder.projectId.toString(),
        changes: {
          before: purchaseOrder,
          after: { ...purchaseOrder, ...updateData },
          confirmationMethod: 'sms'
        }
      });

      // Send confirmation SMS back to supplier
      try {
        const confirmationMessage = `Thank you! PO-${purchaseOrder.purchaseOrderNumber} REJECTED. We'll contact you soon.`;
        await sendSMS({
          to: from,
          message: confirmationMessage,
        });
        console.log(`[SMS Webhook] Confirmation SMS sent to ${from}`);
      } catch (smsError) {
        console.error('[SMS Webhook] Failed to send confirmation SMS:', smsError);
        // Don't fail the webhook processing if SMS confirmation fails
      }

      return successResponse({
        processed: true,
        action: 'reject',
        purchaseOrderId: purchaseOrder._id.toString()
      }, 'Purchase order rejected via SMS');
    }

    return successResponse({ processed: false }, 'Action not recognized');
  } catch (error) {
    console.error('SMS webhook error:', error);
    return errorResponse('Failed to process SMS webhook', 500);
  }
}

