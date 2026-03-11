/**
 * Bulk Purchase Order Delivery Confirmation API Route
 * POST /api/purchase-orders/bulk/confirm-delivery
 * Owner/PM confirms delivery for multiple purchase orders and automatically creates materials
 * Auth: OWNER, PM
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createMaterialFromPurchaseOrder } from '@/lib/material-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { sendSupplierDeliveryConfirmedEmail } from '@/lib/email-templates/communication-event-templates';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';

/**
 * POST /api/purchase-orders/bulk/confirm-delivery
 * Confirm delivery for multiple purchase orders
 * Auth: OWNER, PM
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';
const SUPPLIER_DELIVERY_FALLBACK_EMAIL =
  process.env.SUPPLIER_DELIVERY_FALLBACK_EMAIL || 'qinalexander56@gmail.com';

async function resolveSupplierEmailRecipient(db, purchaseOrder) {
  console.log(`[Bulk Confirm Delivery] Resolving supplier email for PO ${purchaseOrder.purchaseOrderNumber}`);
  console.log(`[Bulk Confirm Delivery] PO supplierId: ${purchaseOrder.supplierId}, supplierEmail: ${purchaseOrder.supplierEmail}, supplierName: ${purchaseOrder.supplierName}`);
  
  // Priority 1: Use supplierEmail stored on PO (this is what was used when PO was created)
  if (purchaseOrder?.supplierEmail && purchaseOrder.supplierEmail.trim()) {
    console.log(`[Bulk Confirm Delivery] Using supplierEmail from PO: ${purchaseOrder.supplierEmail}`);
    
    // Still try to get supplier details for name/contactPerson, but use PO email
    let supplierDetails = null;
    const supplierId = purchaseOrder?.supplierId;
    const normalizedSupplierId =
      supplierId instanceof ObjectId
        ? supplierId
        : ObjectId.isValid(supplierId)
          ? new ObjectId(supplierId)
          : null;

    if (normalizedSupplierId) {
      supplierDetails = await db.collection('suppliers').findOne({
        _id: normalizedSupplierId
      });
      if (!supplierDetails) {
        supplierDetails = await db.collection('suppliers').findOne({ _id: normalizedSupplierId });
      }
    }

    return {
      ...(supplierDetails || {}),
      email: purchaseOrder.supplierEmail.trim(),
      name: supplierDetails?.name || purchaseOrder.supplierName || 'Supplier',
      contactPerson: supplierDetails?.contactPerson || purchaseOrder.supplierName || 'Supplier',
      emailEnabled: supplierDetails?.emailEnabled !== false, // Allow missing emailEnabled (legacy records)
      _source: 'purchase_order_email'
    };
  }

  // Priority 2: Look up supplier by ID and use their email
  const supplierId = purchaseOrder?.supplierId;
  const normalizedSupplierId =
    supplierId instanceof ObjectId
      ? supplierId
      : ObjectId.isValid(supplierId)
        ? new ObjectId(supplierId)
        : null;

  let supplier = null;
  if (normalizedSupplierId) {
    supplier = await db.collection('suppliers').findOne({
      _id: normalizedSupplierId,
      status: 'active'
    });
    if (!supplier) {
      supplier = await db.collection('suppliers').findOne({ _id: normalizedSupplierId });
    }
    
    if (supplier?.email && supplier.email.trim()) {
      console.log(`[Bulk Confirm Delivery] Using supplier email from supplier lookup: ${supplier.email}`);
      return {
        ...supplier,
        email: supplier.email.trim(),
        emailEnabled: supplier.emailEnabled !== false,
        _source: 'supplier_lookup'
      };
    }
  }

  // Priority 3: Fallback to hardcoded email
  console.warn(
    `[Bulk Confirm Delivery] No valid supplier email found for PO ${purchaseOrder.purchaseOrderNumber}. ` +
    `supplierId: ${supplierId}, supplierEmail: ${purchaseOrder?.supplierEmail}. ` +
    `Using fallback: ${SUPPLIER_DELIVERY_FALLBACK_EMAIL}`
  );
  
  return {
    ...(supplier || {}),
    email: SUPPLIER_DELIVERY_FALLBACK_EMAIL,
    name: supplier?.name || purchaseOrder?.supplierName || 'Supplier',
    contactPerson: supplier?.contactPerson || purchaseOrder?.supplierName || 'Supplier',
    emailEnabled: true,
    _isFallbackRecipient: true,
    _source: 'fallback'
  };
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canConfirm = await hasPermission(user.id, 'confirm_delivery') || 
                      await hasPermission(user.id, 'create_material_from_order');
    if (!canConfirm) {
      return errorResponse('Insufficient permissions. Only Owner and PM can confirm delivery.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    // Verify user is Owner or PM
    const userRole = userProfile.role?.toLowerCase();
    if (!['owner', 'pm', 'project_manager'].includes(userRole)) {
      return errorResponse('Only Owner and Project Managers can confirm delivery', 403);
    }

    const body = await request.json();
    const { purchaseOrderIds } = body || {};

    if (!purchaseOrderIds || !Array.isArray(purchaseOrderIds) || purchaseOrderIds.length === 0) {
      return errorResponse('purchaseOrderIds array is required', 400);
    }

    // Validate all IDs
    const validIds = purchaseOrderIds.filter(id => ObjectId.isValid(id));
    if (validIds.length === 0) {
      return errorResponse('No valid purchase order IDs provided', 400);
    }

    const db = await getDatabase();

    // Get all purchase orders
    const purchaseOrders = await db.collection('purchase_orders').find({
      _id: { $in: validIds.map(id => new ObjectId(id)) },
      deletedAt: null,
    }).toArray();

    if (purchaseOrders.length === 0) {
      return errorResponse('No purchase orders found', 404);
    }

    // Filter to only orders that can be confirmed (status = 'order_accepted' and no materials created)
    const confirmableOrders = purchaseOrders.filter(po => {
      if (po.status !== 'order_accepted') {
        return false;
      }
      if (po.linkedMaterialId) {
        return false;
      }
      // For bulk orders, check if any materials exist
      if (po.isBulkOrder) {
        // We'll check this in the transaction
        return true;
      }
      return true;
    });

    if (confirmableOrders.length === 0) {
      return errorResponse('No purchase orders can be confirmed. All orders must have status "order_accepted" and no materials created.', 400);
    }

    const results = {
      confirmed: [],
      failed: [],
      skipped: [],
    };

    // Process each order
    for (const purchaseOrder of confirmableOrders) {
      try {
        // For bulk orders, check if materials already exist
        if (purchaseOrder.isBulkOrder) {
          const existingMaterials = await db.collection('materials').countDocuments({
            linkedPurchaseOrderId: purchaseOrder._id,
            deletedAt: null,
          });
          if (existingMaterials > 0) {
            results.skipped.push({
              purchaseOrderId: purchaseOrder._id.toString(),
              purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
              reason: 'Materials already created',
            });
            continue;
          }
        }

        // Confirm delivery and create materials
        // Materials created from POs are automatically approved for immediate financial state accuracy
        const materialResult = await createMaterialFromPurchaseOrder({
          purchaseOrderId: purchaseOrder._id.toString(),
          creatorUserProfile: userProfile,
          notes: 'Bulk delivery confirmation by Owner/PM',
          isAutomatic: false,
          // Note: allowFromAccepted parameter is deprecated but kept for backward compatibility
          // Materials from POs are now always auto-approved
        });

        results.confirmed.push({
          purchaseOrderId: purchaseOrder._id.toString(),
          purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
          materialIds: materialResult.materialIds?.map(id => id.toString()) || [],
          materialCount: materialResult.createdMaterials?.length || 0,
        });

        // Send supplier confirmation email (non-critical)
        try {
          const supplier = await resolveSupplierEmailRecipient(db, purchaseOrder);

          console.log(`[Bulk Confirm Delivery] Resolved supplier for PO ${purchaseOrder.purchaseOrderNumber}:`, {
            email: supplier?.email,
            name: supplier?.name,
            contactPerson: supplier?.contactPerson,
            emailEnabled: supplier?.emailEnabled,
            source: supplier?._source,
            isFallback: supplier?._isFallbackRecipient
          });

          if (supplier && supplier.email && supplier.emailEnabled !== false) {
            if (supplier._isFallbackRecipient) {
              console.warn(
                `[Bulk Confirm Delivery] Supplier email missing for PO ${purchaseOrder.purchaseOrderNumber}. ` +
                  `Using fallback recipient: ${SUPPLIER_DELIVERY_FALLBACK_EMAIL}`
              );
            } else {
              console.log(`[Bulk Confirm Delivery] Sending delivery confirmation email to supplier: ${supplier.email} (source: ${supplier._source || 'unknown'})`);
            }
            const eventKey = `supplier_delivery_confirmed:${purchaseOrder._id.toString()}`;
            const existingSend = await db.collection('purchase_orders').findOne({
              _id: purchaseOrder._id,
              communications: {
                $elemMatch: {
                  channel: 'email',
                  eventType: 'supplier_delivery_confirmed',
                  eventKey,
                  status: 'sent'
                }
              }
            });
            if (!existingSend) {
              const itemSummary = purchaseOrder.isBulkOrder && Array.isArray(purchaseOrder.materials)
                ? `${purchaseOrder.materials.length} material${purchaseOrder.materials.length > 1 ? 's' : ''}`
                : (purchaseOrder.materialName || `${purchaseOrder.quantityOrdered || ''} ${purchaseOrder.unit || ''}`.trim());
              const confirmedBy = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim()
                || userProfile.email
                || userProfile._id?.toString()
                || 'Project team';

              const emailResult = await sendSupplierDeliveryConfirmedEmail({
                supplier,
                purchaseOrder,
                deliverySummary: {
                  deliveryDate: new Date(),
                  itemSummary,
                  confirmedBy
                }
              });

              await db.collection('purchase_orders').updateOne(
                { _id: purchaseOrder._id },
                {
                  $push: {
                    communications: {
                      channel: 'email',
                      eventType: 'supplier_delivery_confirmed',
                      eventKey,
                      recipientType: 'supplier',
                      recipientEmail: supplier.email,
                      sentAt: new Date(),
                      status: 'sent',
                      messageId: emailResult.messageId || null
                    }
                  }
                }
              );
            }
          }
        } catch (emailError) {
          console.error(`[Bulk Confirm Delivery] Supplier email failed for ${purchaseOrder.purchaseOrderNumber}:`, emailError);
          await db.collection('purchase_orders').updateOne(
            { _id: purchaseOrder._id },
            {
              $push: {
                communications: {
                  channel: 'email',
                  eventType: 'supplier_delivery_confirmed',
                  eventKey: `supplier_delivery_confirmed:${purchaseOrder._id.toString()}`,
                  recipientType: 'supplier',
                  sentAt: new Date(),
                  status: 'failed',
                  error: emailError.message
                }
              }
            }
          );
        }

        // Create audit log
        await createAuditLog({
          userId: userProfile._id.toString(),
          action: 'DELIVERY_CONFIRMED',
          entityType: 'PURCHASE_ORDER',
          entityId: purchaseOrder._id.toString(),
          projectId: purchaseOrder.projectId.toString(),
          changes: {
            before: purchaseOrder,
            after: { ...purchaseOrder, status: 'delivered', financialStatus: 'fulfilled' },
            materialCreated: true,
            materialIds: materialResult.materialIds?.map(id => id.toString()) || [],
            confirmationMethod: 'owner_pm_bulk',
          },
        });
      } catch (error) {
        console.error(`Error confirming delivery for PO ${purchaseOrder.purchaseOrderNumber}:`, error);
        results.failed.push({
          purchaseOrderId: purchaseOrder._id.toString(),
          purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
          error: error.message || 'Unknown error',
        });
      }
    }

    // Return summary
    return successResponse({
      total: confirmableOrders.length,
      confirmed: results.confirmed.length,
      failed: results.failed.length,
      skipped: results.skipped.length,
      results: {
        confirmed: results.confirmed,
        failed: results.failed,
        skipped: results.skipped,
      },
    }, `Bulk delivery confirmation completed: ${results.confirmed.length} confirmed, ${results.failed.length} failed, ${results.skipped.length} skipped`, 200);
  } catch (error) {
    console.error('Bulk confirm delivery error:', error);
    return errorResponse('Failed to confirm deliveries', 500);
  }
}



