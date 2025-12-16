/**
 * Purchase Orders API Route
 * GET: List all purchase orders with filters
 * POST: Create new purchase order from approved request
 * 
 * GET /api/purchase-orders
 * POST /api/purchase-orders
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotification } from '@/lib/notifications';
import { generatePurchaseOrderNumber } from '@/lib/generators/purchase-order-number-generator';
import { generateResponseToken, getTokenExpirationDate } from '@/lib/generators/response-token-generator';
import { generateShortUrl } from '@/lib/generators/url-shortener';
import { validatePurchaseOrder } from '@/lib/schemas/purchase-order-schema';
import { validateCapitalAvailability } from '@/lib/financial-helpers';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';
import { sendPurchaseOrderEmail } from '@/lib/email-templates/purchase-order-templates';
import { sendSMS, generatePurchaseOrderSMS, formatPhoneNumber } from '@/lib/sms-service';
import { sendPushToSupplier, sendPushToUser } from '@/lib/push-service';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import crypto from 'crypto';

/**
 * GET /api/purchase-orders
 * Returns purchase orders with filtering, sorting, and pagination
 * Auth: PM, OWNER, SUPPLIER, ACCOUNTANT
 * Query params: projectId, status, supplierId, search, page, limit, sortBy, sortOrder
 */
export async function GET(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canView = await hasPermission(user.id, 'view_purchase_orders');
    if (!canView) {
      return errorResponse('Insufficient permissions to view purchase orders', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'sentAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const db = await getDatabase();

    // Build query
    const query = { deletedAt: null };
    const andConditions = [];

    // Note: Supplier role filtering removed - suppliers are now contacts, not users
    // PM, OWNER, ACCOUNTANT can see all orders

    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }

    if (status) {
      query.status = status;
    }

    if (supplierId && ObjectId.isValid(supplierId)) {
      query.supplierId = new ObjectId(supplierId);
    }

    // Search filter
    if (search) {
      const searchConditions = [
        { materialName: { $regex: search, $options: 'i' } },
        { purchaseOrderNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
      ];
      andConditions.push({ $or: searchConditions });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get total count
    const total = await db.collection('purchase_orders').countDocuments(query);

    // Get paginated results
    const skip = (page - 1) * limit;
    const orders = await db
      .collection('purchase_orders')
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    return successResponse({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get purchase orders error:', error);
    return errorResponse('Failed to retrieve purchase orders', 500);
  }
}

/**
 * POST /api/purchase-orders
 * Creates a new purchase order from approved material request
 * Auth: PM, OWNER
 * 
 * CRITICAL: Validates capital availability before creation
 */
export async function POST(request) {
  try {
    console.log('[POST /api/purchase-orders] Request received');
    console.log('[POST /api/purchase-orders] Request URL:', request.url);
    console.log('[POST /api/purchase-orders] Request Method:', request.method);
    
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[POST /api/purchase-orders] Unauthorized:', authError?.message || 'No user');
      return errorResponse('Unauthorized', 401);
    }

    console.log('[POST /api/purchase-orders] User authenticated:', user.id);

    // Check permission
    const canCreate = await hasPermission(user.id, 'create_purchase_order');
    if (!canCreate) {
      console.log('[POST /api/purchase-orders] Permission denied for user:', user.id);
      return errorResponse('Insufficient permissions. Only PM and OWNER can create purchase orders.', 403);
    }

    console.log('[POST /api/purchase-orders] Permission granted');

    const body = await request.json();
    console.log('[POST /api/purchase-orders] Request body received:', {
      materialRequestId: body.materialRequestId,
      supplierId: body.supplierId,
      quantityOrdered: body.quantityOrdered,
      unitCost: body.unitCost,
      deliveryDate: body.deliveryDate,
    });
    
    const {
      materialRequestId,
      supplierId,
      quantityOrdered,
      unitCost,
      deliveryDate,
      terms,
      notes,
    } = body;

    // Validate required fields
    if (!materialRequestId || !ObjectId.isValid(materialRequestId)) {
      return errorResponse('Valid materialRequestId is required', 400);
    }

    if (!supplierId || !ObjectId.isValid(supplierId)) {
      return errorResponse('Valid supplierId is required', 400);
    }

    if (!quantityOrdered || quantityOrdered <= 0) {
      return errorResponse('Quantity ordered must be greater than 0', 400);
    }

    if (unitCost === undefined || unitCost < 0) {
      return errorResponse('Unit cost must be >= 0', 400);
    }

    if (!deliveryDate) {
      return errorResponse('Delivery date is required', 400);
    }

    // Validate delivery date is in the future
    const deliveryDateObj = new Date(deliveryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deliveryDateObj < today) {
      return errorResponse('Delivery date must be a future date', 400);
    }

    // Calculate total cost
    const totalCost = quantityOrdered * unitCost;

    // Get user profile
    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    const db = await getDatabase();

    // Verify material request exists and is approved (not already converted)
    const materialRequest = await db.collection('material_requests').findOne({
      _id: new ObjectId(materialRequestId),
      status: 'approved', // Only allow 'approved', not 'converted_to_order'
      deletedAt: null,
    });

    if (!materialRequest) {
      console.log('[POST /api/purchase-orders] Material request not found or not in valid status');
      return errorResponse('Material request not found or not in valid status for PO creation. Request must be approved and not already converted to a purchase order.', 404);
    }

    // Check if request already has a purchase order
    if (materialRequest.linkedPurchaseOrderId && ObjectId.isValid(materialRequest.linkedPurchaseOrderId)) {
      const existingPO = await db.collection('purchase_orders').findOne({
        _id: new ObjectId(materialRequest.linkedPurchaseOrderId),
        deletedAt: null,
      });
      
      if (existingPO) {
        console.log('[POST /api/purchase-orders] Material request already has valid purchase order');
        return errorResponse('Material request has already been converted to a purchase order', 400);
      }
      // If linkedPurchaseOrderId exists but PO doesn't, it's an orphaned reference
      // We'll allow creation but log it for investigation
      console.warn('[POST /api/purchase-orders] Found orphaned linkedPurchaseOrderId reference');
    }

    // Verify supplier exists in suppliers collection (not users)
    const supplier = await db.collection('suppliers').findOne({
      _id: new ObjectId(supplierId),
      status: 'active',
      deletedAt: null
    });

    if (!supplier) {
      return errorResponse('Supplier not found or inactive', 404);
    }

    // CRITICAL: Validate capital availability
    const capitalValidation = await validateCapitalAvailability(
      materialRequest.projectId.toString(),
      totalCost
    );

    if (!capitalValidation.isValid) {
      return errorResponse(
        `Insufficient capital. Available: ${capitalValidation.available.toLocaleString()}, Required: ${totalCost.toLocaleString()}, Shortfall: ${(totalCost - capitalValidation.available).toLocaleString()}`,
        400
      );
    }

    // CRITICAL: Generate idempotency key to prevent duplicate POs on retry
    // This ensures that if the request fails after transaction commit (e.g., 404),
    // retrying will return the existing PO instead of creating a duplicate
    // Key is generated from request parameters to ensure same request = same key
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        materialRequestId,
        supplierId,
        quantityOrdered: parseFloat(quantityOrdered),
        unitCost: parseFloat(unitCost),
        deliveryDate,
      }))
      .digest('hex');

    console.log('[POST /api/purchase-orders] Generated idempotency key:', idempotencyKey.substring(0, 16) + '...');

    // Check if purchase order already exists with this idempotency key
    // This handles the case where transaction succeeded but HTTP response failed (e.g., 404)
    const existingPO = await db.collection('purchase_orders').findOne({
      idempotencyKey,
      deletedAt: null,
    });

    if (existingPO) {
      console.log('[POST /api/purchase-orders] Found existing PO with same idempotency key:', existingPO._id);
      
      // Verify the material request is still linked correctly
      const linkedRequest = await db.collection('material_requests').findOne({
        _id: new ObjectId(materialRequestId),
        linkedPurchaseOrderId: existingPO._id,
        deletedAt: null,
      });

      if (linkedRequest) {
        // Everything is consistent, return existing PO
        // This is an idempotent request - safe to retry after 404
        console.log('[POST /api/purchase-orders] Returning existing PO - idempotent request');
        
        // Get current capital info for the existing order
        const currentCapitalValidation = await validateCapitalAvailability(
          existingPO.projectId.toString(),
          existingPO.totalCost
        );
        
        return successResponse({
          order: existingPO,
          capitalInfo: {
            available: currentCapitalValidation.available,
            required: existingPO.totalCost,
            remaining: currentCapitalValidation.available - existingPO.totalCost,
          },
          isExisting: true,
          message: 'Purchase order already exists for this request',
        }, 'Purchase order already exists (idempotent request)', 200);
      } else {
        // PO exists but material request not linked - this is an orphaned state
        // We'll proceed with creation but log the issue for investigation
        console.warn('[POST /api/purchase-orders] Found existing PO but material request not linked - orphaned state detected');
        // Continue with creation - the transaction will handle linking
      }
    }

    // Generate purchase order number
    const purchaseOrderNumber = await generatePurchaseOrderNumber();

    // Generate response token for supplier response
    const responseToken = generateResponseToken(supplierId);
    const tokenExpirationDate = getTokenExpirationDate(
      parseInt(process.env.PO_RESPONSE_TOKEN_EXPIRY_DAYS || '7', 10)
    );

    // Build purchase order document
    const purchaseOrder = {
      purchaseOrderNumber,
      materialRequestId: new ObjectId(materialRequestId),
      supplierId: new ObjectId(supplierId),
      supplierName: supplier.name,
      supplierEmail: supplier.email,
      supplierPhone: supplier.phone, // NEW: Store supplier phone
      projectId: materialRequest.projectId,
      ...(materialRequest.floorId && { floorId: materialRequest.floorId }),
      ...(materialRequest.categoryId && { categoryId: materialRequest.categoryId }),
      ...(materialRequest.category && { category: materialRequest.category }),
      materialName: materialRequest.materialName,
      description: materialRequest.description || '',
      quantityOrdered: parseFloat(quantityOrdered),
      unit: materialRequest.unit,
      unitCost: parseFloat(unitCost),
      totalCost: parseFloat(totalCost),
      deliveryDate: deliveryDateObj,
      terms: terms?.trim() || '',
      notes: notes?.trim() || '',
      status: 'order_sent',
      sentAt: new Date(),
      financialStatus: 'not_committed',
      // CRITICAL: Idempotency key to prevent duplicates on retry
      idempotencyKey,
      // NEW: Token-based response system
      responseToken,
      responseTokenExpiresAt: tokenExpirationDate,
      responseTokenGeneratedAt: new Date(),
      // NEW: Communication tracking
      communications: [],
      // NEW: Automation tracking
      autoConfirmed: false,
      autoConfirmedAt: null,
      autoConfirmationMethod: null,
      createdBy: new ObjectId(userProfile._id),
      createdByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Validate purchase order
    const validation = validatePurchaseOrder(purchaseOrder);
    if (!validation.isValid) {
      console.log('[POST /api/purchase-orders] Validation failed:', validation.errors);
      return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    console.log('[POST /api/purchase-orders] Starting transaction for atomic operations');

    // Wrap critical operations in transaction for atomicity
    const transactionResult = await withTransaction(async ({ db, session }) => {
      // 1. Insert purchase order (atomic)
      const poResult = await db.collection('purchase_orders').insertOne(
        purchaseOrder,
        { session }
      );

      const insertedOrder = { ...purchaseOrder, _id: poResult.insertedId };
      console.log('[POST /api/purchase-orders] Purchase order inserted:', poResult.insertedId);

      // 2. Update material request to link to purchase order (atomic with PO insertion)
      const requestUpdateResult = await db.collection('material_requests').updateOne(
        { _id: new ObjectId(materialRequestId) },
        {
          $set: {
            linkedPurchaseOrderId: poResult.insertedId,
            status: 'converted_to_order', // Mark as converted when PO is created
            updatedAt: new Date(),
          },
        },
        { session }
      );
      console.log('[POST /api/purchase-orders] Material request updated:', requestUpdateResult.modifiedCount > 0);

      // 3. Create audit log (atomic with above)
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'CREATED',
        entityType: 'PURCHASE_ORDER',
        entityId: poResult.insertedId.toString(),
        projectId: materialRequest.projectId.toString(),
        changes: {
          created: insertedOrder,
          capitalValidation: {
            available: capitalValidation.available,
            required: totalCost,
            isValid: true,
          },
        },
      }, { session });

      console.log('[POST /api/purchase-orders] Audit log created');

      return { order: insertedOrder, poId: poResult.insertedId };
    });

    console.log('[POST /api/purchase-orders] Transaction completed successfully');

    // Multi-channel communication (non-critical - can fail without affecting core data)
    const communicationResults = {
      email: { sent: false, error: null },
      sms: { sent: false, error: null },
      push: { sent: false, error: null }
    };

    const responseUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/purchase-orders/respond/${responseToken}`;
    // Generate short URL for SMS (uses first 8 chars of token)
    const shortLink = generateShortUrl(responseToken);

    // Get project details for email
    const project = await db.collection('projects').findOne({
      _id: materialRequest.projectId,
      deletedAt: null
    });

    // 1. Send Email
    if (supplier.emailEnabled) {
      try {
        const emailResult = await sendPurchaseOrderEmail({
          supplier,
          purchaseOrder: transactionResult.order,
          responseToken,
          project
        });
        communicationResults.email = { sent: true, messageId: emailResult.messageId };
        
        // Track communication
        await db.collection('purchase_orders').updateOne(
          { _id: transactionResult.poId },
          {
            $push: {
              communications: {
                channel: 'email',
                sentAt: new Date(),
                status: 'sent',
                messageId: emailResult.messageId || null
              }
            }
          }
        );
        console.log('[POST /api/purchase-orders] Email sent to supplier');
      } catch (emailError) {
        console.error('[POST /api/purchase-orders] Email send failed:', emailError);
        communicationResults.email.error = emailError.message;
        
        // Track failed communication
        await db.collection('purchase_orders').updateOne(
          { _id: transactionResult.poId },
          {
            $push: {
              communications: {
                channel: 'email',
                sentAt: new Date(),
                status: 'failed',
                error: emailError.message
              }
            }
          }
        );
      }
    }

    // 2. Send SMS
    if (supplier.smsEnabled && supplier.phone) {
      try {
        const formattedPhone = formatPhoneNumber(supplier.phone);
        const smsMessage = generatePurchaseOrderSMS({
          purchaseOrderNumber,
          materialName: materialRequest.materialName,
          quantity: quantityOrdered,
          unit: materialRequest.unit,
          totalCost,
          shortLink,
          deliveryDate: deliveryDateObj,
          unitCost: parseFloat(unitCost)
        });

        const smsResult = await sendSMS({
          to: formattedPhone,
          message: smsMessage
        });
        
        communicationResults.sms = { sent: true, messageId: smsResult.messageId };
        
        // Track communication
        await db.collection('purchase_orders').updateOne(
          { _id: transactionResult.poId },
          {
            $push: {
              communications: {
                channel: 'sms',
                sentAt: new Date(),
                status: 'sent',
                messageId: smsResult.messageId || null
              }
            }
          }
        );
        console.log('[POST /api/purchase-orders] SMS sent to supplier');
      } catch (smsError) {
        console.error('[POST /api/purchase-orders] SMS send failed:', smsError);
        communicationResults.sms.error = smsError.message;
        
        // Track failed communication
        await db.collection('purchase_orders').updateOne(
          { _id: transactionResult.poId },
          {
            $push: {
              communications: {
                channel: 'sms',
                sentAt: new Date(),
                status: 'failed',
                error: smsError.message
              }
            }
          }
        );
      }
    }

    // 3. Send Push Notification to Supplier
    if (supplier.pushNotificationsEnabled) {
      try {
        const pushActions = [
          { action: 'accept', title: 'Accept' },
          { action: 'reject', title: 'Reject' },
          { action: 'view', title: 'View Details' }
        ];

        const pushData = {
          purchaseOrderId: transactionResult.poId.toString(),
          token: responseToken,
          url: responseUrl,
          subscriptionEndpoint: null // Will be set per subscription
        };

        // Get supplier's push subscriptions
        const subscriptions = await db.collection('push_subscriptions').find({
          supplierId: new ObjectId(supplierId),
          userType: 'supplier',
          status: 'active'
        }).toArray();

        if (subscriptions.length > 0) {
          // Send push to each subscription (sendPushToSupplier handles this internally)
          const deliveryDateStr = deliveryDateObj 
            ? new Date(deliveryDateObj).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })
            : null;
          
          const pushMessage = deliveryDateStr
            ? `${materialRequest.materialName} - ${quantityOrdered} ${materialRequest.unit} - ${totalCost.toLocaleString()} KES - Delivery: ${deliveryDateStr}`
            : `${materialRequest.materialName} - ${quantityOrdered} ${materialRequest.unit} - ${totalCost.toLocaleString()} KES`;
          
          const pushResults = await sendPushToSupplier({
            supplierId,
            title: `New Purchase Order: ${purchaseOrderNumber}`,
            message: pushMessage,
            actions: pushActions,
            data: pushData
          });

          const successfulPushes = pushResults.filter(r => r.success);
          if (successfulPushes.length > 0) {
            communicationResults.push.sent = true;
            
            // Track communication
            await db.collection('purchase_orders').updateOne(
              { _id: transactionResult.poId },
              {
                $push: {
                  communications: {
                    channel: 'push',
                    sentAt: new Date(),
                    status: 'sent',
                    subscriptionCount: successfulPushes.length,
                    totalSubscriptions: subscriptions.length
                  }
                }
              }
            );
            console.log(`[POST /api/purchase-orders] Push notification sent to ${successfulPushes.length} subscription(s)`);
          } else {
            communicationResults.push.error = 'All push notifications failed';
          }
        } else {
          console.log('[POST /api/purchase-orders] No push subscriptions found for supplier');
        }
      } catch (pushError) {
        console.error('[POST /api/purchase-orders] Push notification failed:', pushError);
        communicationResults.push.error = pushError.message;
      }
    }

    // 4. Send Push Notification to PM/OWNER
    try {
      await sendPushToUser({
        userId: userProfile._id.toString(),
        title: 'Purchase Order Created',
        message: `PO ${purchaseOrderNumber} sent to ${supplier.name}`,
        data: {
          url: `/purchase-orders/${transactionResult.poId.toString()}`,
          purchaseOrderId: transactionResult.poId.toString()
        }
      });
    } catch (pushError) {
      console.error('[POST /api/purchase-orders] Push to PM/OWNER failed (non-critical):', pushError);
    }

    // 5. Create in-app notifications
    try {
      const notifications = [];
      
      // Notify PM/OWNER about the created order (excluding creator)
      const managers = await db.collection('users').find({
        role: { $in: ['pm', 'project_manager', 'owner'] },
        status: 'active',
        _id: { $ne: new ObjectId(userProfile._id) } // Don't notify creator
      }).toArray();

      if (managers.length > 0) {
        managers.forEach(manager => {
          notifications.push({
            userId: manager._id.toString(),
            type: 'approval_needed',
            title: 'Purchase Order Created',
            message: `${userProfile.firstName || userProfile.email} created purchase order ${purchaseOrderNumber} for ${supplier.name}`,
            projectId: materialRequest.projectId.toString(),
            relatedModel: 'PURCHASE_ORDER',
            relatedId: transactionResult.poId.toString(),
            createdBy: userProfile._id.toString(),
          });
        });
      }

      // Notify the requester (person who created the material request) about the PO
      if (materialRequest.requestedBy && materialRequest.requestedBy.toString() !== userProfile._id.toString()) {
        notifications.push({
          userId: materialRequest.requestedBy.toString(),
          type: 'approval_status',
          title: 'Purchase Order Created for Your Request',
          message: `Purchase order ${purchaseOrderNumber} has been created for your request: ${materialRequest.quantityNeeded} ${materialRequest.unit} of ${materialRequest.materialName}`,
          projectId: materialRequest.projectId.toString(),
          relatedModel: 'PURCHASE_ORDER',
          relatedId: transactionResult.poId.toString(),
          createdBy: userProfile._id.toString(),
        });
      }

      if (notifications.length > 0) {
        await Promise.all(notifications.map(n => createNotification(n)));
        console.log('[POST /api/purchase-orders] In-app notifications created');
      }
    } catch (notifError) {
      console.error('[POST /api/purchase-orders] Notification creation failed (non-critical):', notifError);
    }

    console.log('[POST /api/purchase-orders] Returning success response');
    return successResponse({
      order: transactionResult.order,
      capitalInfo: {
        available: capitalValidation.available,
        required: totalCost,
        remaining: capitalValidation.available - totalCost,
      },
      communicationResults,
      responseToken, // Include token for testing/debugging (remove in production if needed)
      responseUrl
    }, 'Purchase order created successfully', 201);
  } catch (error) {
    console.error('[POST /api/purchase-orders] Error:', error);
    console.error('[POST /api/purchase-orders] Error stack:', error.stack);
    
    // Provide more specific error messages
    if (error.message && error.message.includes('Transaction')) {
      return errorResponse(`Transaction failed: ${error.message}. Please try again.`, 500);
    }
    
    return errorResponse('Failed to create purchase order', 500);
  }
}

