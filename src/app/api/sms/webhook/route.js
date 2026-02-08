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
import { parseSMSReply, sendSMS, generateConfirmationSMS, generateShortCodeHelpSMS } from '@/lib/sms-service';
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

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

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
  console.log('\n[SMS Webhook] ========================================');
  console.log('[SMS Webhook] Webhook called - Incoming request');
  console.log('[SMS Webhook] ========================================');
  console.log('[SMS Webhook] Request Method:', request.method);
  console.log('[SMS Webhook] Request URL:', request.url);
  
  try {
    // Africa's Talking sends webhook data as form-encoded, not JSON
    // We need to detect Content-Type and parse accordingly
    const contentType = request.headers.get('content-type') || '';
    console.log('[SMS Webhook] Content-Type:', contentType);
    console.log('[SMS Webhook] All Headers:', Object.fromEntries(request.headers.entries()));
    
    let body;
    
    // Read raw body first (can only read once)
    const rawBody = await request.text();
    console.log('[SMS Webhook] Raw Body Length:', rawBody.length, 'characters');
    console.log('[SMS Webhook] Raw Body (first 500 chars):', rawBody.substring(0, 500));
    console.log('[SMS Webhook] Raw Body (full):', rawBody);
    
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
    
    // CRITICAL FIX: Initialize database connection early (before any db operations)
    console.log('[SMS Webhook] Initializing database connection...');
    const db = await getDatabase();
    console.log('[SMS Webhook] ✅ Database connected');
    
    // Validate webhook secret if configured
    const webhookSecret = process.env.AFRICASTALKING_WEBHOOK_SECRET;
    const signature = request.headers.get('x-africastalking-signature');
    
    console.log('[SMS Webhook] Webhook Secret configured:', !!webhookSecret);
    console.log('[SMS Webhook] Signature provided:', !!signature);
    
    if (webhookSecret && signature) {
      if (!validateWebhookSignature(body, signature, webhookSecret)) {
        console.error('[SMS Webhook] ❌ Invalid webhook signature');
        return errorResponse('Invalid webhook signature', 401);
      }
      console.log('[SMS Webhook] ✅ Webhook signature validated');
    } else {
      console.log('[SMS Webhook] ⚠️  Webhook signature validation skipped (not configured)');
    }

    // Detect webhook type: Delivery Status Report vs Incoming SMS
    // Delivery status reports have: phoneNumber, status, id
    // Incoming SMS have: from, to, text
    console.log('[SMS Webhook] Detecting webhook type...');
    console.log('[SMS Webhook] Body fields:', {
      hasPhoneNumber: !!body.phoneNumber,
      hasStatus: !!body.status,
      hasId: !!body.id,
      hasFrom: !!body.from,
      hasTo: !!body.to,
      hasText: !!body.text
    });
    
    const isDeliveryStatus = body.phoneNumber && body.status && body.id;
    const isIncomingSMS = body.from && body.text;
    
    console.log('[SMS Webhook] Webhook Type Detection:');
    console.log('[SMS Webhook]   - Is Delivery Status:', isDeliveryStatus);
    console.log('[SMS Webhook]   - Is Incoming SMS:', isIncomingSMS);

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
      // Note: db is already initialized above (line 95)
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
    console.log('[SMS Webhook] ========================================');
    console.log('[SMS Webhook] Processing Incoming SMS');
    console.log('[SMS Webhook] ========================================');
    console.log('[SMS Webhook] From:', from);
    console.log('[SMS Webhook] To:', to);
    console.log('[SMS Webhook] Text:', text);
    console.log('[SMS Webhook] Date:', date);

    // Check for help requests first
    const helpKeywords = ['HELP', 'MSAADA', 'INFO', 'MAELEZO', '?', 'H'];
    const isHelpRequest = helpKeywords.some(keyword => text.toUpperCase().includes(keyword));
    console.log('[SMS Webhook] Is Help Request:', isHelpRequest);
    
    if (isHelpRequest) {
      console.log('[SMS Webhook] Processing HELP request...');
      // Send help SMS
      try {
        const normalizedFrom = from.replace(/^\+/, '');
        console.log('[SMS Webhook] Finding supplier by phone:', from, '(normalized:', normalizedFrom + ')');
        const supplier = await db.collection('suppliers').findOne({
          $or: [
            { phone: from },
            { phone: normalizedFrom },
            { phone: `+${normalizedFrom}` }
          ],
          status: 'active',
          deletedAt: null
        });
        
        const helpMessage = generateShortCodeHelpSMS({ supplier });
        
        await sendSMS({
          to: from,
          message: helpMessage
        });
        
        console.log(`[SMS Webhook] Help SMS sent to ${from}`);
        return successResponse({ processed: true, type: 'help' }, 'Help SMS sent');
      } catch (helpError) {
        console.error('[SMS Webhook] Failed to send help SMS:', helpError);
        return successResponse({ processed: false }, 'Help request received but failed to send help');
      }
    }
    
    // Parse SMS reply
    console.log('[SMS Webhook] Parsing SMS reply...');
    const parsed = parseSMSReply(text);
    console.log('[SMS Webhook] Parsed Result:', JSON.stringify(parsed, null, 2));
    
    if (!parsed.action) {
      console.log('[SMS Webhook] ❌ No action parsed from SMS - sending error message');
      // Not a valid command, send help or error message
      try {
        const normalizedFrom = from.replace(/^\+/, '');
        console.log('[SMS Webhook] Finding supplier by phone for error message:', from);
        const supplier = await db.collection('suppliers').findOne({
          $or: [
            { phone: from },
            { phone: normalizedFrom },
            { phone: `+${normalizedFrom}` }
          ],
          status: 'active',
          deletedAt: null
        });
        
        const language = supplier?.languagePreference === 'sw' ? 'sw' : 'en';
        let errorMessage;
        
        if (language === 'sw') {
          errorMessage = 'Jibu lako halikukubalika. Tafadhali tumia: KUBALI, KATA, au BADILISHA. Au jibu "MSAADA" kwa msaada.';
        } else {
          errorMessage = 'Your response was not recognized. Please use: ACCEPT, REJECT, or MODIFY. Or reply "HELP" for assistance.';
        }
        
        await sendSMS({
          to: from,
          message: errorMessage
        });
        
        console.log(`[SMS Webhook] Error SMS sent to ${from} - invalid command`);
      } catch (errorSmsError) {
        console.error('[SMS Webhook] Failed to send error SMS:', errorSmsError);
      }
      
      return successResponse({ processed: false }, 'SMS not processed - invalid command');
    }

    console.log('[SMS Webhook] ✅ Action parsed:', parsed.action);
    console.log('[SMS Webhook] Is Short Code:', parsed.isShortCode);
    console.log('[SMS Webhook] Purchase Order Number:', parsed.purchaseOrderNumber || 'None (will find by phone)');

    // Find purchase order by number or by supplier phone
    console.log('[SMS Webhook] Finding purchase order...');
    let purchaseOrder = null;

    if (parsed.purchaseOrderNumber) {
      console.log('[SMS Webhook] Finding purchase order by PO number:', parsed.purchaseOrderNumber);
      // Find by PO number
      purchaseOrder = await db.collection('purchase_orders').findOne({
        purchaseOrderNumber: parsed.purchaseOrderNumber,
        deletedAt: null
      });
      console.log('[SMS Webhook] Purchase order found by PO number:', purchaseOrder ? purchaseOrder.purchaseOrderNumber : 'NOT FOUND');
    } else {
      console.log('[SMS Webhook] Finding purchase order by supplier phone (short code response)');
      // Find by supplier phone (most recent pending order)
      // Normalize phone numbers for matching (handle both +254... and 254... formats)
      const normalizedFrom = from.replace(/^\+/, ''); // Remove leading +
      console.log('[SMS Webhook] Finding supplier by phone:', from, '(normalized:', normalizedFrom + ')');
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
        console.log('[SMS Webhook] ✅ Supplier found:', {
          _id: supplier._id.toString(),
          name: supplier.name,
          phone: supplier.phone
        });
        
        // If short code response (no PO number), find most recent pending order
        if (parsed.isShortCode) {
          console.log('[SMS Webhook] Finding most recent pending order for supplier...');
          purchaseOrder = await db.collection('purchase_orders').findOne({
            supplierId: supplier._id,
            status: { $in: ['order_sent', 'order_modified'] },
            deletedAt: null
          }, {
            sort: { createdAt: -1 }
          });
          
          // If multiple pending orders, we'll use the most recent one
          // Log this for monitoring
          if (purchaseOrder) {
            const pendingCount = await db.collection('purchase_orders').countDocuments({
              supplierId: supplier._id,
              status: { $in: ['order_sent', 'order_modified'] },
              deletedAt: null
            });
            
            console.log(`[SMS Webhook] Found ${pendingCount} pending order(s) for supplier`);
            if (pendingCount > 1) {
              console.log(`[SMS Webhook] ⚠️  Multiple pending orders (${pendingCount}), using most recent: ${purchaseOrder.purchaseOrderNumber}`);
            } else {
              console.log(`[SMS Webhook] ✅ Using order: ${purchaseOrder.purchaseOrderNumber}`);
            }
          } else {
            console.log('[SMS Webhook] ❌ No pending orders found for supplier');
          }
        } else {
          // Regular response with PO number - find by number
          console.log('[SMS Webhook] Finding purchase order by PO number for supplier:', parsed.purchaseOrderNumber);
          purchaseOrder = await db.collection('purchase_orders').findOne({
            supplierId: supplier._id,
            purchaseOrderNumber: parsed.purchaseOrderNumber,
            deletedAt: null
          });
          console.log('[SMS Webhook] Purchase order found:', purchaseOrder ? purchaseOrder.purchaseOrderNumber : 'NOT FOUND');
        }
      } else {
        console.log('[SMS Webhook] ❌ Supplier NOT found for phone:', from);
      }
    }

    if (!purchaseOrder) {
      console.log('[SMS Webhook] ❌ Purchase order not found');
      // Send error SMS back to supplier (try to detect language from phone number)
      try {
        // Try to find supplier by phone to detect language preference
        const normalizedFrom = from.replace(/^\+/, '');
        const supplier = await db.collection('suppliers').findOne({
          $or: [
            { phone: from },
            { phone: normalizedFrom },
            { phone: `+${normalizedFrom}` }
          ],
          status: 'active',
          deletedAt: null
        });
        
        const language = supplier?.languagePreference === 'sw' ? 'sw' : 'en';
        let errorMessage;
        
        if (parsed.isShortCode) {
          // Short code used but no pending order found
          if (language === 'sw') {
            errorMessage = 'Samahani, hakuna agizo linalosubiri jibu. Tafadhali tumia nambari ya agizo (PO-XXX) au wasiliana nasi.';
          } else {
            errorMessage = 'Sorry, no pending order found. Please include PO number (PO-XXX) or contact us.';
          }
        } else {
          // PO number provided but not found
          if (language === 'sw') {
            errorMessage = 'Samahani, hatukuweza kupata agizo lako la ununuzi. Tafadhali wasiliana nasi moja kwa moja.';
          } else {
            errorMessage = 'Sorry, we could not find your purchase order. Please contact us directly.';
          }
        }
        
        await sendSMS({
          to: from,
          message: errorMessage,
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

    console.log('[SMS Webhook] ✅ Purchase order found:', purchaseOrder.purchaseOrderNumber);
    console.log('[SMS Webhook] Purchase order status:', purchaseOrder.status);
    console.log('[SMS Webhook] Processing action:', parsed.action);
    
    // Process action
    if (parsed.action === 'accept') {
      console.log('[SMS Webhook] ========================================');
      console.log('[SMS Webhook] Processing ACCEPT action');
      console.log('[SMS Webhook] ========================================');
      // CRITICAL FIX: Validate unit cost before accepting
      // For single orders, check if PO has valid unit cost
      // For bulk orders, validate all materials have valid unit costs
      if (!purchaseOrder.isBulkOrder) {
        if (purchaseOrder.unitCost === 0 || purchaseOrder.unitCost === null || purchaseOrder.unitCost === undefined) {
          // Send error SMS to supplier
          try {
            const supplier = await db.collection('suppliers').findOne({
              _id: purchaseOrder.supplierId,
              status: 'active'
            });
            
            if (supplier && supplier.smsEnabled && supplier.phone) {
              const { sendSMS, formatPhoneNumber, generateErrorSMS } = await import('@/lib/sms-service');
              const formattedPhone = formatPhoneNumber(supplier.phone);
              const errorSMS = generateErrorSMS({
                errorType: 'invalid_status',
                purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
                suggestion: 'This order requires unit cost information. Please contact us to provide the unit cost.',
                supplier: supplier
              });
              await sendSMS({ to: formattedPhone, message: errorSMS });
            }
          } catch (smsError) {
            console.error('[SMS Webhook] Failed to send error SMS:', smsError);
          }
          
          return errorResponse(
            'Cannot accept purchase order: Unit cost is missing or zero. ' +
            'Please provide unit cost information when accepting this order. ' +
            'For SMS responses, contact us directly to provide the unit cost.',
            400
          );
        }
      } else {
        // CRITICAL FIX: For bulk orders, validate all materials have valid unit costs
        // This prevents accepting orders that will fail during delivery confirmation
        if (!purchaseOrder.materials || !Array.isArray(purchaseOrder.materials) || purchaseOrder.materials.length === 0) {
          return errorResponse(
            'Cannot accept bulk purchase order: Materials array is missing or empty. ' +
            'Please contact us to resolve this issue.',
            400
          );
        }
        
        // Check each material has valid unit cost
        const materialsWithInvalidCosts = [];
        for (const material of purchaseOrder.materials) {
          const unitCost = material.unitCost;
          if (unitCost === undefined || unitCost === null || isNaN(parseFloat(unitCost)) || parseFloat(unitCost) <= 0) {
            materialsWithInvalidCosts.push(material.materialName || material.materialRequestId || 'Unknown');
          }
        }
        
        if (materialsWithInvalidCosts.length > 0) {
          // Send error SMS to supplier
          try {
            const supplier = await db.collection('suppliers').findOne({
              _id: purchaseOrder.supplierId,
              status: 'active'
            });
            
            if (supplier && supplier.smsEnabled && supplier.phone) {
              const { sendSMS, formatPhoneNumber, generateErrorSMS } = await import('@/lib/sms-service');
              const formattedPhone = formatPhoneNumber(supplier.phone);
              const errorSMS = generateErrorSMS({
                errorType: 'invalid_status',
                purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
                suggestion: `This bulk order has ${materialsWithInvalidCosts.length} material(s) without valid unit costs. Please contact us to provide unit costs for: ${materialsWithInvalidCosts.slice(0, 3).join(', ')}${materialsWithInvalidCosts.length > 3 ? '...' : ''}`,
                supplier: supplier
              });
              await sendSMS({ to: formattedPhone, message: errorSMS });
            }
          } catch (smsError) {
            console.error('[SMS Webhook] Failed to send error SMS:', smsError);
          }
          
          return errorResponse(
            `Cannot accept bulk purchase order: ${materialsWithInvalidCosts.length} material(s) have missing or zero unit costs. ` +
            `Materials: ${materialsWithInvalidCosts.join(', ')}. ` +
            `Please contact us to provide unit costs for these materials before accepting.`,
            400
          );
        }
        
        console.log('[SMS Webhook] Bulk order unit cost validation passed - all materials have valid unit costs');
      }
      
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
      // CRITICAL FIX: Update phase committed costs immediately
      try {
        const { updatePhaseCommittedCostsForPO } = await import('@/lib/phase-helpers');
        await updatePhaseCommittedCostsForPO(purchaseOrder);
      } catch (phaseError) {
        console.error('[SMS Webhook] Phase committed cost update failed (non-critical):', phaseError);
        // Don't fail the webhook - phase update can be done later
      }

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
        // Get supplier for language detection
        const supplier = await db.collection('suppliers').findOne({
          _id: purchaseOrder.supplierId,
          status: 'active'
        });
        
        const confirmationMessage = generateConfirmationSMS({
          purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
          action: 'accept',
          deliveryDate: purchaseOrder.deliveryDate,
          supplier: supplier // Pass supplier for language detection
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
        // Get supplier for language detection
        const supplier = await db.collection('suppliers').findOne({
          _id: purchaseOrder.supplierId,
          status: 'active'
        });
        
        const confirmationMessage = generateConfirmationSMS({
          purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
          action: 'reject',
          deliveryDate: null, // No delivery date for rejected orders
          supplier: supplier // Pass supplier for language detection
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
        // Get supplier for language detection
        const supplier = await db.collection('suppliers').findOne({
          _id: purchaseOrder.supplierId,
          status: 'active'
        });
        
        const modSummary = [];
        if (modifications.unitCost) modSummary.push(`Price: KES ${modifications.unitCost.toLocaleString()}`);
        if (modifications.quantityOrdered) modSummary.push(`Qty: ${modifications.quantityOrdered}`);
        if (modifications.deliveryDate) modSummary.push(`Date: ${new Date(modifications.deliveryDate).toLocaleDateString()}`);
        
        // Use language-appropriate message
        const language = supplier?.languagePreference === 'sw' ? 'sw' : 'en';
        let confirmationMessage;
        if (language === 'sw') {
          confirmationMessage = `Asante! Ombi la mabadiliko la ${purchaseOrder.purchaseOrderNumber} limepokelewa${modSummary.length > 0 ? `: ${modSummary.join(', ')}` : ''}. Tutakagua na kujibu hivi karibuni.`;
        } else {
          confirmationMessage = `Thank you! Modification request for ${purchaseOrder.purchaseOrderNumber} received${modSummary.length > 0 ? `: ${modSummary.join(', ')}` : ''}. We'll review and respond soon.`;
        }
        
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
    } else if (parsed.isPartialResponse && parsed.materialResponses && purchaseOrder.isBulkOrder) {
      // Handle partial response for bulk orders via SMS
      console.log('[SMS Webhook] Processing partial response for bulk order via SMS');
      
      // Validate that this is a bulk order
      if (!purchaseOrder.isBulkOrder || !purchaseOrder.supportsPartialResponse) {
        try {
          await sendSMS({
            to: from,
            message: 'Partial responses are only supported for bulk orders. Please respond to the entire order or use the web link.',
          });
        } catch (smsError) {
          console.error('[SMS Webhook] Failed to send error SMS:', smsError);
        }
        return successResponse({ processed: false }, 'Partial responses not supported for this order type');
      }

      if (!purchaseOrder.materials || !Array.isArray(purchaseOrder.materials) || purchaseOrder.materials.length === 0) {
        try {
          await sendSMS({
            to: from,
            message: 'Error: Bulk order has no materials. Please contact us.',
          });
        } catch (smsError) {
          console.error('[SMS Webhook] Failed to send error SMS:', smsError);
        }
        return successResponse({ processed: false }, 'Bulk order has no materials');
      }

      // Convert material indices to material responses format
      const materialResponses = [];
      for (const mr of parsed.materialResponses) {
        if (mr.materials === 'all') {
          // Handle "ACCEPT ALL" or "REJECT ALL"
          purchaseOrder.materials.forEach((material, index) => {
            const materialRequestId = material.materialRequestId?.toString() || material._id?.toString();
            if (materialRequestId) {
              materialResponses.push({
                materialRequestId,
                action: mr.action,
                notes: `All materials ${mr.action}ed via SMS`,
                rejectionReason: mr.action === 'reject' ? 'other' : null,
                rejectionSubcategory: mr.action === 'reject' ? 'not_specified' : null
              });
            }
          });
        } else if (Array.isArray(mr.materials)) {
          // Handle numbered responses: "ACCEPT 1,3,5"
          mr.materials.forEach(materialIndex => {
            // Material indices are 1-based in SMS, convert to 0-based
            const arrayIndex = materialIndex - 1;
            if (arrayIndex >= 0 && arrayIndex < purchaseOrder.materials.length) {
              const material = purchaseOrder.materials[arrayIndex];
              const materialRequestId = material.materialRequestId?.toString() || material._id?.toString();
              if (materialRequestId) {
                materialResponses.push({
                  materialRequestId,
                  action: mr.action,
                  notes: `Material ${materialIndex} ${mr.action}ed via SMS`,
                  rejectionReason: mr.action === 'reject' ? 'other' : null,
                  rejectionSubcategory: mr.action === 'reject' ? 'not_specified' : null
                });
              }
            }
          });
        }
      }

      if (materialResponses.length === 0) {
        try {
          await sendSMS({
            to: from,
            message: 'Error: Could not process partial response. Please use the web link or contact us.',
          });
        } catch (smsError) {
          console.error('[SMS Webhook] Failed to send error SMS:', smsError);
        }
        return successResponse({ processed: false }, 'No valid material responses found');
      }

      // Import and call handlePartialResponse (we'll need to adapt it or create a simplified version)
      // For now, send a message directing to web interface for complex partial responses
      // Or we can implement a simplified handler here
      
      // Simplified handler: Process basic accept/reject partial responses
      const acceptedMaterials = materialResponses.filter(mr => mr.action === 'accept');
      const rejectedMaterials = materialResponses.filter(mr => mr.action === 'reject');
      const modifiedMaterials = materialResponses.filter(mr => mr.action === 'modify');

      // Determine overall status
      let overallStatus = 'order_partially_responded';
      if (rejectedMaterials.length === 0 && modifiedMaterials.length === 0) {
        overallStatus = 'order_accepted';
      } else if (acceptedMaterials.length === 0 && modifiedMaterials.length === 0) {
        overallStatus = 'order_rejected';
      }

      // Update purchase order with partial response
      const updateData = {
        status: overallStatus,
        supplierResponse: parsed.action,
        supplierResponseDate: new Date(),
        autoConfirmed: true,
        autoConfirmedAt: new Date(),
        autoConfirmationMethod: 'sms',
        supplierNotes: `Partial response via SMS: ${text}`,
        materialResponses: materialResponses.map(mr => ({
          ...mr,
          status: mr.action,
          respondedAt: new Date()
        })),
        updatedAt: new Date()
      };

      // If all accepted, update financial status
      if (overallStatus === 'order_accepted') {
        updateData.financialStatus = 'committed';
        updateData.committedAt = new Date();
      }

      await db.collection('purchase_orders').updateOne(
        { _id: purchaseOrder._id },
        { $set: updateData }
      );

      // Update committed cost if all accepted
      if (overallStatus === 'order_accepted') {
        try {
          await updateCommittedCost(
            purchaseOrder.projectId.toString(),
            purchaseOrder.totalCost,
            'add'
          );
        } catch (costError) {
          console.error('[SMS Webhook] Failed to update committed cost:', costError);
        }
      }

      // Notify PM/OWNER
      const poCreator = await db.collection('users').findOne({
        _id: purchaseOrder.createdBy,
        status: 'active'
      });

      if (poCreator) {
        try {
          const responseSummary = [];
          if (acceptedMaterials.length > 0) responseSummary.push(`${acceptedMaterials.length} accepted`);
          if (rejectedMaterials.length > 0) responseSummary.push(`${rejectedMaterials.length} rejected`);
          if (modifiedMaterials.length > 0) responseSummary.push(`${modifiedMaterials.length} modified`);
          
          await sendPushToUser({
            userId: poCreator._id.toString(),
            title: 'Purchase Order Partial Response',
            message: `${purchaseOrder.supplierName} responded to PO ${purchaseOrder.purchaseOrderNumber} via SMS: ${responseSummary.join(', ')}`,
            data: {
              url: `/purchase-orders/${purchaseOrder._id.toString()}`,
              purchaseOrderId: purchaseOrder._id.toString()
            }
          });
        } catch (pushError) {
          console.error('[SMS Webhook] Push notification failed:', pushError);
        }
      }

      // Send confirmation SMS
      try {
        // Get supplier for language detection
        const supplier = await db.collection('suppliers').findOne({
          _id: purchaseOrder.supplierId,
          status: 'active'
        });
        
        const responseSummary = [];
        if (acceptedMaterials.length > 0) responseSummary.push(`${acceptedMaterials.length} accepted`);
        if (rejectedMaterials.length > 0) responseSummary.push(`${rejectedMaterials.length} rejected`);
        if (modifiedMaterials.length > 0) responseSummary.push(`${modifiedMaterials.length} modified`);
        
        // Use language-appropriate message
        const language = supplier?.languagePreference === 'sw' ? 'sw' : 'en';
        let confirmationMessage;
        if (language === 'sw') {
          const swSummary = [];
          if (acceptedMaterials.length > 0) swSummary.push(`${acceptedMaterials.length} zimekubaliwa`);
          if (rejectedMaterials.length > 0) swSummary.push(`${rejectedMaterials.length} zimekataliwa`);
          if (modifiedMaterials.length > 0) swSummary.push(`${modifiedMaterials.length} zimebadilishwa`);
          confirmationMessage = `Asante! Jibu la sehemu kwa ${purchaseOrder.purchaseOrderNumber} limepokelewa: ${swSummary.join(', ')}. Tutakagua na kujibu hivi karibuni.`;
        } else {
          confirmationMessage = `Thank you! Partial response for ${purchaseOrder.purchaseOrderNumber} received: ${responseSummary.join(', ')}. We'll review and respond soon.`;
        }
        
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
        action: parsed.action,
        purchaseOrderId: purchaseOrder._id.toString(),
        isPartialResponse: true,
        acceptedCount: acceptedMaterials.length,
        rejectedCount: rejectedMaterials.length,
        modifiedCount: modifiedMaterials.length
      }, 'Partial response processed via SMS');
    }

    return successResponse({ processed: false }, 'Action not recognized');
  } catch (error) {
    console.error('\n[SMS Webhook] ========================================');
    console.error('[SMS Webhook] ❌ EXCEPTION CAUGHT');
    console.error('[SMS Webhook] ========================================');
    console.error('[SMS Webhook] Error Name:', error.name);
    console.error('[SMS Webhook] Error Message:', error.message);
    console.error('[SMS Webhook] Error Stack:', error.stack);
    console.error('[SMS Webhook] ========================================\n');
    return errorResponse('Failed to process SMS webhook', 500);
  }
}

/**
 * GET /api/sms/webhook
 * Health check endpoint to verify webhook route is accessible
 */
export async function GET(request) {
  console.log('[SMS Webhook] Health check called');
  const explicitWebhookUrl = process.env.AFRICASTALKING_WEBHOOK_URL || null;
  const ngrokUrl = process.env.NGROK_URL || null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || null;
  const expectedBaseUrl = explicitWebhookUrl || ngrokUrl || appUrl;
  const expectedWebhookUrl = expectedBaseUrl
    ? `${expectedBaseUrl.replace(/\/$/, '')}/api/sms/webhook`
    : null;

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'SMS webhook endpoint is accessible',
    webhookUrl: '/api/sms/webhook',
    method: 'POST',
    configuredWebhookUrl: explicitWebhookUrl,
    expectedWebhookUrl,
  }, { headers: { 'Cache-Control': 'no-store' } });
}