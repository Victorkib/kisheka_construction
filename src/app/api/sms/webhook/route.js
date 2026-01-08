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
import { parseSMSReply, sendSMS, generateConfirmationSMS } from '@/lib/sms-service';
import { updateCommittedCost, recalculateProjectFinances } from '@/lib/financial-helpers';
import { createMaterialFromPurchaseOrder } from '@/lib/material-helpers';
import { sendPushToUser } from '@/lib/push-service';
import { createAuditLog } from '@/lib/audit-log';
import { assessRetryability, formatRejectionReason } from '@/lib/rejection-reasons';
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
    // Africa's Talking sends webhook data as form-encoded, not JSON
    // We need to detect Content-Type and parse accordingly
    const contentType = request.headers.get('content-type') || '';
    console.log('[SMS Webhook] Received request with Content-Type:', contentType);
    
    let body;
    
    // Read raw body first (can only read once)
    const rawBody = await request.text();
    console.log('[SMS Webhook] Raw body (first 200 chars):', rawBody.substring(0, 200));
    
    try {
      if (contentType.includes('application/json')) {
        // Parse as JSON
        body = JSON.parse(rawBody);
        console.log('[SMS Webhook] Parsed as JSON:', body);
      } else {
        // Default to form-encoded (Africa's Talking format)
        // Parse all possible fields (both incoming SMS and delivery status reports)
        const params = new URLSearchParams(rawBody);
        body = {
          // Incoming SMS fields
          from: params.get('from'),
          to: params.get('to'),
          text: params.get('text'),
          date: params.get('date'),
          // Delivery status report fields
          phoneNumber: params.get('phoneNumber'),
          status: params.get('status'),
          failureReason: params.get('failureReason'),
          id: params.get('id'), // Message ID
          retryCount: params.get('retryCount'),
          networkCode: params.get('networkCode'),
        };
        console.log('[SMS Webhook] Parsed as form-encoded:', body);
      }
    } catch (parseError) {
      console.error('[SMS Webhook] Error parsing request body:', parseError);
      console.error('[SMS Webhook] Raw body (full):', rawBody);
      console.error('[SMS Webhook] Raw body length:', rawBody.length);
      return errorResponse('Failed to parse webhook payload', 400);
    }
    
    // Validate webhook secret if configured
    const webhookSecret = process.env.AFRICASTALKING_WEBHOOK_SECRET;
    const signature = request.headers.get('x-africastalking-signature');
    
    if (webhookSecret && signature) {
      if (!validateWebhookSignature(body, signature, webhookSecret)) {
        console.error('[SMS Webhook] Invalid webhook signature');
        return errorResponse('Invalid webhook signature', 401);
      }
    }

    // Detect webhook type: Delivery Status Report vs Incoming SMS
    // Delivery status reports have: phoneNumber, status, id
    // Incoming SMS have: from, to, text
    const isDeliveryStatus = body.phoneNumber && body.status && body.id;
    const isIncomingSMS = body.from && body.text;

    if (isDeliveryStatus) {
      // Handle delivery status report
      console.log('[SMS Webhook] Received delivery status report');
      console.log('[SMS Webhook] Message ID:', body.id);
      console.log('[SMS Webhook] Phone:', body.phoneNumber);
      console.log('[SMS Webhook] Status:', body.status);
      console.log('[SMS Webhook] Failure Reason:', body.failureReason || 'N/A');
      
      // Decode URL-encoded phone number (%2B = +)
      const phoneNumber = decodeURIComponent(body.phoneNumber);
      
      // Update SMS status in purchase order communications if messageId matches
      const db = await getDatabase();
      try {
        const purchaseOrder = await db.collection('purchase_orders').findOne({
          'communications.messageId': body.id,
          deletedAt: null,
        });

        if (purchaseOrder) {
          // Update the communication status
          await db.collection('purchase_orders').updateOne(
            { 
              _id: purchaseOrder._id,
              'communications.messageId': body.id
            },
            {
              $set: {
                'communications.$.status': body.status.toLowerCase(),
                'communications.$.deliveryStatus': body.status,
                'communications.$.failureReason': body.failureReason || null,
                'communications.$.networkCode': body.networkCode || null,
                'communications.$.deliveryReportedAt': new Date(),
              }
            }
          );
          console.log('[SMS Webhook] Updated SMS delivery status in purchase order:', purchaseOrder.purchaseOrderNumber);
        } else {
          console.log('[SMS Webhook] No purchase order found with message ID:', body.id);
        }
      } catch (updateError) {
        console.error('[SMS Webhook] Error updating delivery status:', updateError);
        // Don't fail the webhook - delivery status update is non-critical
      }

      // Return success for delivery status reports (they're just notifications)
      return successResponse({
        type: 'delivery_status',
        messageId: body.id,
        phoneNumber: phoneNumber,
        status: body.status,
        failureReason: body.failureReason,
      }, 'Delivery status report processed');
    }

    // Handle incoming SMS message
    if (!isIncomingSMS) {
      console.error('[SMS Webhook] Unknown webhook type. Body:', body);
      return errorResponse('Invalid webhook payload: neither incoming SMS nor delivery status', 400);
    }

    const { from, to, text, date } = body;
    console.log('[SMS Webhook] Processing incoming SMS from:', from, 'Text:', text);

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
      // Normalize phone numbers for matching (handle both +254... and 254... formats)
      const normalizedFrom = from.replace(/^\+/, ''); // Remove leading +
      const supplier = await db.collection('suppliers').findOne({
        $or: [
          { phone: from },                    // Match with +
          { phone: normalizedFrom },          // Match without +
          { phone: `+${normalizedFrom}` }     // Match with + added
        ],
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
      // Materials created from POs are automatically approved for immediate financial state accuracy
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
        const confirmationMessage = generateConfirmationSMS({
          purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
          action: 'accept',
          deliveryDate: purchaseOrder.deliveryDate
        });
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
      // Assess retryability based on extracted rejection reason
      let retryabilityAssessment = { retryable: false, recommendation: 'Manual review required' };
      if (parsed.rejectionReason) {
        retryabilityAssessment = assessRetryability(parsed.rejectionReason, parsed.rejectionSubcategory);
      }

      // Build structured rejection data
      const formattedReason = parsed.rejectionReason 
        ? formatRejectionReason(parsed.rejectionReason, parsed.rejectionSubcategory)
        : 'No reason specified';

      // Update order status with structured rejection data
      const updateData = {
        status: 'order_rejected',
        supplierResponse: 'reject',
        supplierResponseDate: new Date(),
        autoConfirmed: true,
        autoConfirmedAt: new Date(),
        autoConfirmationMethod: 'sms',
        supplierNotes: `Rejected via SMS: ${text}`,
        rejectionReason: parsed.rejectionReason || null,
        rejectionSubcategory: parsed.rejectionSubcategory || null,
        isRetryable: retryabilityAssessment.retryable,
        retryRecommendation: retryabilityAssessment.recommendation,
        rejectionMetadata: {
          assessedAt: new Date(),
          reasonCategory: parsed.rejectionReason,
          subcategory: parsed.rejectionSubcategory,
          priority: retryabilityAssessment.priority,
          confidence: parsed.confidence || retryabilityAssessment.confidence || 0.5,
          formattedReason: formattedReason,
          responseMethod: 'sms',
          parsedFromText: true,
          originalText: text
        },
        updatedAt: new Date()
      };

      await db.collection('purchase_orders').updateOne(
        { _id: purchaseOrder._id },
        { $set: updateData }
      );

      // Mark order as needing reassignment if retryable
      if (retryabilityAssessment.retryable) {
        await db.collection('purchase_orders').updateOne(
          { _id: purchaseOrder._id },
          {
            $set: {
              needsReassignment: true,
              reassignmentSuggestedAt: new Date(),
              updatedAt: new Date()
            }
          }
        );
      }

      // Notify PM/OWNER with structured rejection information
      const poCreator = await db.collection('users').findOne({
        _id: purchaseOrder.createdBy,
        status: 'active'
      });

      if (poCreator) {
        try {
          const retryInfo = retryabilityAssessment.retryable 
            ? ` (Retryable: ${retryabilityAssessment.recommendation})` 
            : ' (Not retryable)';
          
          await sendPushToUser({
            userId: poCreator._id.toString(),
            title: 'Purchase Order Rejected',
            message: `${purchaseOrder.supplierName} rejected PO ${purchaseOrder.purchaseOrderNumber} via SMS. Reason: ${formattedReason}${retryInfo}`,
            data: {
              url: `/purchase-orders/${purchaseOrder._id.toString()}`,
              purchaseOrderId: purchaseOrder._id.toString(),
              rejectionReason: parsed.rejectionReason,
              rejectionSubcategory: parsed.rejectionSubcategory,
              isRetryable: retryabilityAssessment.retryable,
              retryRecommendation: retryabilityAssessment.recommendation
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
          confirmationMethod: 'sms',
          rejectionReason: parsed.rejectionReason,
          rejectionSubcategory: parsed.rejectionSubcategory,
          isRetryable: retryabilityAssessment.retryable
        }
      });

      // Send confirmation SMS back to supplier
      try {
        const confirmationMessage = generateConfirmationSMS({
          purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
          action: 'reject',
          deliveryDate: null // No delivery date for rejected orders
        });
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
        purchaseOrderId: purchaseOrder._id.toString(),
        rejectionReason: parsed.rejectionReason,
        isRetryable: retryabilityAssessment.retryable
      }, 'Purchase order rejected via SMS');
    } else if (parsed.action === 'modify') {
      // Handle MODIFY action - create modification request for Owner/PM approval
      console.log('[SMS Webhook] Processing MODIFY action');

      const modifications = {};
      if (parsed.modificationDetails) {
        if (parsed.modificationDetails.unitCost !== null) {
          modifications.unitCost = parsed.modificationDetails.unitCost;
        }
        if (parsed.modificationDetails.quantityOrdered !== null) {
          modifications.quantityOrdered = parsed.modificationDetails.quantityOrdered;
        }
        if (parsed.modificationDetails.deliveryDate) {
          modifications.deliveryDate = new Date(parsed.modificationDetails.deliveryDate);
        }
        if (parsed.modificationDetails.notes) {
          modifications.notes = parsed.modificationDetails.notes;
        }
      }

      // Calculate new total if cost or quantity changed
      let newTotalCost = purchaseOrder.totalCost;
      const newQuantity = modifications.quantityOrdered || purchaseOrder.quantityOrdered;
      const newUnitCost = modifications.unitCost || purchaseOrder.unitCost;
      newTotalCost = newQuantity * newUnitCost;

      // Update order status to order_modified
      const updateData = {
        status: 'order_modified',
        supplierResponse: 'modify',
        supplierResponseDate: new Date(),
        autoConfirmed: true,
        autoConfirmedAt: new Date(),
        autoConfirmationMethod: 'sms',
        supplierNotes: `Modification requested via SMS: ${text}`,
        supplierModifications: Object.keys(modifications).length > 0 ? modifications : null,
        modificationApproved: false,
        unitCost: newUnitCost,
        quantityOrdered: newQuantity,
        totalCost: newTotalCost,
        ...(modifications.deliveryDate && { deliveryDate: modifications.deliveryDate }),
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
          const modDetails = [];
          if (modifications.unitCost) modDetails.push(`Price: KES ${modifications.unitCost.toLocaleString()}`);
          if (modifications.quantityOrdered) modDetails.push(`Quantity: ${modifications.quantityOrdered}`);
          if (modifications.deliveryDate) modDetails.push(`Delivery: ${new Date(modifications.deliveryDate).toLocaleDateString()}`);
          
          await sendPushToUser({
            userId: poCreator._id.toString(),
            title: 'Purchase Order Modification Request',
            message: `${purchaseOrder.supplierName} requested modifications to PO ${purchaseOrder.purchaseOrderNumber} via SMS${modDetails.length > 0 ? `: ${modDetails.join(', ')}` : ''}`,
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
        action: 'AUTO_MODIFIED',
        entityType: 'PURCHASE_ORDER',
        entityId: purchaseOrder._id.toString(),
        projectId: purchaseOrder.projectId.toString(),
        changes: {
          before: purchaseOrder,
          after: { ...purchaseOrder, ...updateData },
          confirmationMethod: 'sms',
          modifications: modifications
        }
      });

      // Send confirmation SMS back to supplier
      try {
        const modSummary = [];
        if (modifications.unitCost) modSummary.push(`Price: KES ${modifications.unitCost.toLocaleString()}`);
        if (modifications.quantityOrdered) modSummary.push(`Qty: ${modifications.quantityOrdered}`);
        if (modifications.deliveryDate) modSummary.push(`Date: ${new Date(modifications.deliveryDate).toLocaleDateString()}`);
        
        const confirmationMessage = `Thank you! Modification request for ${purchaseOrder.purchaseOrderNumber} received${modSummary.length > 0 ? `: ${modSummary.join(', ')}` : ''}. We'll review and respond soon.`;
        await sendSMS({
          to: from,
          message: confirmationMessage,
        });
        console.log(`[SMS Webhook] Confirmation SMS sent to ${from}`);
      } catch (smsError) {
        console.error('[SMS Webhook] Failed to send confirmation SMS:', smsError);
      }

      return successResponse({
        processed: true,
        action: 'modify',
        purchaseOrderId: purchaseOrder._id.toString(),
        modifications: modifications
      }, 'Purchase order modification requested via SMS');
    }

    return successResponse({ processed: false }, 'Action not recognized');
  } catch (error) {
    console.error('SMS webhook error:', error);
    return errorResponse('Failed to process SMS webhook', 500);
  }
}

