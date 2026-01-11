/**
 * Bulk Purchase Orders API Route
 * POST: Create multiple purchase orders from bulk supplier assignments
 * 
 * POST /api/purchase-orders/bulk
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotifications } from '@/lib/notifications';
import { validateBulkPOCreation, createPOFromSupplierGroup } from '@/lib/helpers/bulk-po-helpers';
import { recalculateProjectFinances } from '@/lib/financial-helpers';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';
import { sendPurchaseOrderEmail } from '@/lib/email-templates/purchase-order-templates';
import { sendSMS, sendMultipleSMS, generatePurchaseOrderSMS, generateBulkPurchaseOrderSMS, formatPhoneNumber } from '@/lib/sms-service';
import { sendPushToSupplier } from '@/lib/push-service';
import { generateShortUrl } from '@/lib/generators/url-shortener';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/bulk
 * Creates multiple purchase orders from bulk supplier assignments
 * Auth: PM, OWNER
 * 
 * Request Body:
 * {
 *   batchId: ObjectId,
 *   assignments: [
 *     {
 *       supplierId: ObjectId,
 *       materialRequestIds: [ObjectId],
 *       deliveryDate: Date,
 *       terms: String (optional),
 *       notes: String (optional),
 *       materialOverrides: [ // Optional
 *         {
 *           materialRequestId: ObjectId,
 *           unitCost: Number,
 *           quantityOrdered: Number,
 *           notes: String
 *         }
 *       ]
 *     }
 *   ]
 * }
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canCreate = await hasPermission(user.id, 'create_bulk_purchase_orders');
    if (!canCreate) {
      return errorResponse(
        'Insufficient permissions. Only PM and OWNER can create bulk purchase orders.',
        403
      );
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const body = await request.json();
    const { batchId, assignments } = body;

    // Validate required fields
    if (!batchId || !ObjectId.isValid(batchId)) {
      return errorResponse('Valid batchId is required', 400);
    }

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return errorResponse('At least one supplier assignment is required', 400);
    }

    // Validate bulk PO creation
    const validation = await validateBulkPOCreation(batchId, assignments);
    if (!validation.isValid) {
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    const db = await getDatabase();

    // Get batch info before transaction (for validation and later use)
    const batch = await db.collection('material_request_batches').findOne({
      _id: new ObjectId(batchId),
    });

    if (!batch) {
      return errorResponse('Batch not found', 404);
    }

    console.log('[POST /api/purchase-orders/bulk] Starting transaction for atomic bulk PO creation');

    // Wrap all critical operations in transaction for atomicity
    // Use partial success handling: continue creating other POs if one fails
    const transactionResult = await withTransaction(async ({ db: transactionDb, session }) => {
      const createdPOs = [];
      const errors = [];
      const successfulAssignments = [];

      // Create purchase orders for each supplier group (atomic)
      for (const assignment of assignments) {
        try {
          const po = await createPOFromSupplierGroup(assignment, batchId, userProfile, {
            session,
            db: transactionDb,
          });
          createdPOs.push(po);
          successfulAssignments.push(assignment);

          // Create audit log (atomic with PO creation)
          await createAuditLog(
            {
              userId: userProfile._id.toString(),
              action: 'CREATED',
              entityType: 'PURCHASE_ORDER',
              entityId: po._id.toString(),
              projectId: po.projectId.toString(),
              changes: { created: po },
            },
            { session }
          );
        } catch (err) {
          console.error(`Error creating PO for supplier ${assignment.supplierId}:`, err);
          errors.push({
            supplierId: assignment.supplierId,
            materialRequestIds: assignment.materialRequestIds || [],
            error: err.message,
          });
          // Continue with other assignments instead of throwing
          // This allows partial success
        }
      }

      if (createdPOs.length === 0) {
        throw new Error('Failed to create any purchase orders. All assignments failed.');
      }

      // Update batch status based on successful POs only (atomic with PO creation)
      const successfulRequestIds = successfulAssignments
        .flatMap((a) => a.materialRequestIds || [])
        .map((id) => new ObjectId(id));
      
      const totalRequests = batch.materialRequestIds?.length || 0;
      
      // Count requests that are converted to order (including newly converted ones)
      const orderedRequests = await transactionDb
        .collection('material_requests')
        .countDocuments(
          {
            _id: { $in: batch.materialRequestIds.map((id) => new ObjectId(id)) },
            status: 'converted_to_order',
          },
          { session }
        );

      const newBatchStatus =
        orderedRequests === totalRequests ? 'fully_ordered' : 'partially_ordered';

      // Update batch with successful POs only
      await transactionDb.collection('material_request_batches').updateOne(
        { _id: new ObjectId(batchId) },
        {
          $set: {
            status: newBatchStatus,
            updatedAt: new Date(),
          },
          $addToSet: {
            purchaseOrderIds: { $each: createdPOs.map((po) => po._id) },
            assignedSuppliers: { $each: successfulAssignments.map((a) => new ObjectId(a.supplierId)) },
          },
        },
        { session }
      );

      return { createdPOs, errors, successfulAssignments };
    });

    console.log('[POST /api/purchase-orders/bulk] Transaction completed successfully');

    const { createdPOs, errors, successfulAssignments } = transactionResult;

    // Log partial success if there were errors
    if (errors.length > 0) {
      console.warn(`[POST /api/purchase-orders/bulk] Partial success: ${createdPOs.length} POs created, ${errors.length} failed`);
    }

    // Send communications for each PO (non-critical - can fail without affecting core data)
    console.log('[POST /api/purchase-orders/bulk] Sending communications for created POs');
    for (const po of createdPOs) {
      try {
        // Get supplier details
        const supplier = await db.collection('suppliers').findOne({
          _id: po.supplierId,
        });

        if (!supplier) {
          console.warn(`[POST /api/purchase-orders/bulk] Supplier not found for PO ${po.purchaseOrderNumber}`);
          continue;
        }

        const responseUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/purchase-orders/respond/${po.responseToken}`;
        const shortLink = generateShortUrl(po.responseToken);
        const communicationUpdates = [];

        // 1. Send Email
        if (supplier.emailEnabled && supplier.email) {
          try {
            // Get project and batch for email
            const project = await db.collection('projects').findOne({
              _id: po.projectId,
              deletedAt: null
            });
            
            const batch = po.batchId ? await db.collection('material_request_batches').findOne({
              _id: po.batchId,
              deletedAt: null
            }) : null;

            const emailResult = await sendPurchaseOrderEmail({
              supplier,
              purchaseOrder: po,
              responseToken: po.responseToken,
              project,
              batch
            });
            communicationUpdates.push({
              channel: 'email',
              sentAt: new Date(),
              status: 'sent',
              messageId: emailResult.messageId || null,
            });
            console.log(`[POST /api/purchase-orders/bulk] Email sent for PO ${po.purchaseOrderNumber}`);
          } catch (emailError) {
            console.error(`[POST /api/purchase-orders/bulk] Email send failed for PO ${po.purchaseOrderNumber}:`, emailError);
            communicationUpdates.push({
              channel: 'email',
              sentAt: new Date(),
              status: 'failed',
              error: emailError.message,
            });
          }
        }

        // 2. Send SMS
        if (supplier.smsEnabled && supplier.phone) {
          try {
            const formattedPhone = formatPhoneNumber(supplier.phone);
            
            // Use detailed bulk order SMS for bulk orders, regular SMS for single orders
            let smsMessage;
            let isMultiPart = false;
            
            if (po.isBulkOrder && po.materials && Array.isArray(po.materials) && po.materials.length > 0) {
              // Bulk order - use detailed message with material breakdown (may return array for multi-part)
              smsMessage = await generateBulkPurchaseOrderSMS({
                purchaseOrderNumber: po.purchaseOrderNumber,
                materials: po.materials,
                totalCost: po.totalCost,
                shortLink,
                deliveryDate: po.deliveryDate,
                enableMultiPart: true,
                supplier: supplier, // Pass supplier for language detection
                projectId: po.projectId?.toString() || null,
                enablePersonalization: true
              });
              isMultiPart = Array.isArray(smsMessage);
            } else {
              // Single order or fallback - use regular SMS
              const materialSummary = po.materials?.length > 0
                ? `${po.materials.length} item${po.materials.length > 1 ? 's' : ''}`
                : po.materialName || 'Materials';
              smsMessage = await generatePurchaseOrderSMS({
                purchaseOrderNumber: po.purchaseOrderNumber,
                materialName: materialSummary,
                quantity: po.quantityOrdered,
                unit: po.unit,
                totalCost: po.totalCost,
                shortLink,
                deliveryDate: po.deliveryDate,
                unitCost: po.unitCost || null,
                supplier: supplier, // Pass supplier for language detection
                projectId: po.projectId?.toString() || null,
                enablePersonalization: true
              });
            }

            let smsResult;
            if (isMultiPart) {
              // Send multiple messages for bulk orders with 5+ materials
              smsResult = await sendMultipleSMS({
                to: formattedPhone,
                messages: smsMessage,
                delayBetweenMessages: 1000
              });
              
              // Store first message ID (or all if needed)
              communicationUpdates.push({
                channel: 'sms',
                sentAt: new Date(),
                status: smsResult.success ? 'sent' : 'failed',
                messageId: smsResult.messageIds?.[0] || null,
                isMultiPart: true,
                totalParts: smsMessage.length,
                totalSent: smsResult.totalSent,
                totalFailed: smsResult.totalFailed,
                errors: smsResult.errors || []
              });
              
              if (smsResult.success) {
                console.log(`[POST /api/purchase-orders/bulk] Multi-part SMS sent (${smsResult.totalSent} parts) for PO ${po.purchaseOrderNumber}`);
              } else {
                console.warn(`[POST /api/purchase-orders/bulk] Multi-part SMS partially failed (${smsResult.totalSent} sent, ${smsResult.totalFailed} failed) for PO ${po.purchaseOrderNumber}`);
              }
            } else {
              // Single message
              smsResult = await sendSMS({
                to: formattedPhone,
                message: smsMessage,
              });
              
              communicationUpdates.push({
                channel: 'sms',
                sentAt: new Date(),
                status: smsResult.success && !smsResult.skipped ? 'sent' : 'failed',
                messageId: smsResult.messageId || null,
              });
              
              if (smsResult.success && !smsResult.skipped) {
                console.log(`[POST /api/purchase-orders/bulk] SMS sent for PO ${po.purchaseOrderNumber}`);
              }
            }
          } catch (smsError) {
            console.error(`[POST /api/purchase-orders/bulk] SMS send failed for PO ${po.purchaseOrderNumber}:`, smsError);
            communicationUpdates.push({
              channel: 'sms',
              sentAt: new Date(),
              status: 'failed',
              error: smsError.message,
            });
          }
        }

        // 3. Send Push Notification
        if (supplier.pushNotificationsEnabled) {
          try {
            const pushActions = [
              { action: 'accept', title: 'Accept' },
              { action: 'reject', title: 'Reject' },
              { action: 'view', title: 'View Details' },
            ];
            const pushData = {
              purchaseOrderId: po._id.toString(),
              token: po.responseToken,
              url: responseUrl,
              subscriptionEndpoint: null,
            };
            const materialSummary = po.materials?.length > 0
              ? `${po.materials.length} material(s)`
              : po.materialName || 'Materials';
            
            const deliveryDateStr = po.deliveryDate 
              ? new Date(po.deliveryDate).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })
              : null;
            
            const pushMessage = deliveryDateStr
              ? `${materialSummary} - ${po.quantityOrdered} ${po.unit} - ${po.totalCost.toLocaleString()} KES - Delivery: ${deliveryDateStr}`
              : `${materialSummary} - ${po.quantityOrdered} ${po.unit} - ${po.totalCost.toLocaleString()} KES`;
            
            const pushResults = await sendPushToSupplier({
              supplierId: supplier._id.toString(),
              title: `New Purchase Order: ${po.purchaseOrderNumber}`,
              message: pushMessage,
              actions: pushActions,
              data: pushData,
            });

            const successfulPushes = pushResults.filter((r) => r.success);
            if (successfulPushes.length > 0) {
              communicationUpdates.push({
                channel: 'push',
                sentAt: new Date(),
                status: 'sent',
                subscriptionCount: successfulPushes.length,
                totalSubscriptions: pushResults.length,
              });
              console.log(`[POST /api/purchase-orders/bulk] Push sent for PO ${po.purchaseOrderNumber}`);
            } else {
              communicationUpdates.push({
                channel: 'push',
                sentAt: new Date(),
                status: 'failed',
                error: 'No active push subscriptions found',
              });
            }
          } catch (pushError) {
            console.error(`[POST /api/purchase-orders/bulk] Push send failed for PO ${po.purchaseOrderNumber}:`, pushError);
            communicationUpdates.push({
              channel: 'push',
              sentAt: new Date(),
              status: 'failed',
              error: pushError.message,
            });
          }
        }

        // Update PO with communication results
        if (communicationUpdates.length > 0) {
          await db.collection('purchase_orders').updateOne(
            { _id: po._id },
            {
              $push: {
                communications: { $each: communicationUpdates },
              },
            }
          );
        }
      } catch (commError) {
        console.error(`[POST /api/purchase-orders/bulk] Communication error for PO ${po.purchaseOrderNumber}:`, commError);
        // Don't fail the entire request - communications are non-critical
      }
    }

    // Create notifications for suppliers (in-app notifications)
    const notifications = [];
    for (const po of createdPOs) {
      // Get supplier user (if exists)
      const supplierUser = await db.collection('users').findOne({
        email: po.supplierEmail,
        status: 'active',
      });

      if (supplierUser) {
        notifications.push({
          userId: supplierUser._id.toString(),
          type: 'purchase_order_created',
          title: 'New Purchase Order',
          message: `Purchase order ${po.purchaseOrderNumber} has been created with ${po.materials?.length || 1} material(s)`,
          projectId: po.projectId.toString(),
          relatedModel: 'PURCHASE_ORDER',
          relatedId: po._id.toString(),
          createdBy: userProfile._id.toString(),
        });
      }
    }

    if (notifications.length > 0) {
      await createNotifications(notifications);
    }

    // Recalculate project finances
    if (batch.projectId) {
      await recalculateProjectFinances(batch.projectId.toString());
    }

    // Calculate summary
    const totalCost = createdPOs.reduce((sum, po) => sum + (po.totalCost || 0), 0);
    const uniqueSuppliers = new Set(createdPOs.map((po) => po.supplierId.toString()));
    const successfulMaterialCount = successfulAssignments.reduce(
      (sum, a) => sum + (a.materialRequestIds?.length || 0),
      0
    );
    const attemptedMaterialCount = assignments.reduce(
      (sum, a) => sum + (a.materialRequestIds?.length || 0),
      0
    );

    return successResponse({
      batchId: batchId,
      purchaseOrders: createdPOs.map((po) => ({
        purchaseOrderId: po._id,
        purchaseOrderNumber: po.purchaseOrderNumber,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        materialCount: po.materials?.length || 1,
        totalCost: po.totalCost,
        status: po.status,
      })),
      summary: {
        totalPOs: createdPOs.length,
        totalSuppliers: uniqueSuppliers.size,
        totalMaterials: successfulMaterialCount,
        totalCost: totalCost,
        attempted: assignments.length,
        succeeded: createdPOs.length,
        failed: errors.length,
      },
      errors: errors.length > 0 ? errors : undefined,
      partialSuccess: errors.length > 0 && createdPOs.length > 0,
    });
  } catch (error) {
    console.error('Create bulk purchase orders error:', error);
    return errorResponse('Failed to create bulk purchase orders', 500);
  }
}

