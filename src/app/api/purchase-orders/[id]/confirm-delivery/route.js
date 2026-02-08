/**
 * Purchase Order Delivery Confirmation API Route
 * POST /api/purchase-orders/[id]/confirm-delivery
 * Owner/PM confirms delivery and automatically creates materials
 * Auth: OWNER, PM
 * 
 * This endpoint allows Owner/PM to confirm delivery when suppliers don't have system access.
 * It updates the PO status to 'delivered' and automatically creates material entries.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createMaterialFromPurchaseOrder } from '@/lib/material-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotifications } from '@/lib/notifications';
import { sendSMS, generateDeliveryConfirmationSMS, formatPhoneNumber } from '@/lib/sms-service';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/[id]/confirm-delivery
 * Confirm delivery and create materials
 * Auth: OWNER, PM
 */

// Force dynamic rendering to prevent caching stale data
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission - only Owner/PM can confirm delivery
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

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid purchase order ID', 400);
    }

    const body = await request.json();
    const { deliveryNoteFileUrl, actualQuantityDelivered, actualUnitCost, notes, materialQuantities, materialUnitCosts } = body || {};
    
    // materialQuantities: Array of { materialRequestId: string, quantity: number } for bulk orders
    // If materialQuantities is provided, it overrides actualQuantityDelivered for bulk orders
    // For single orders, actualQuantityDelivered is used
    // materialUnitCosts: Array of { materialRequestId: string, unitCost: number } for bulk orders
    // If materialUnitCosts is provided, it overrides actualUnitCost for bulk orders (per-material)
    // For single orders, actualUnitCost is used

    // Validate delivery note is provided
    if (!deliveryNoteFileUrl || deliveryNoteFileUrl.trim().length === 0) {
      return errorResponse('Delivery note file URL is required', 400);
    }

    // Validate quantity if provided
    if (actualQuantityDelivered !== undefined && actualQuantityDelivered !== null) {
      const quantity = parseFloat(actualQuantityDelivered);
      if (isNaN(quantity) || quantity <= 0) {
        return errorResponse('Actual quantity delivered must be greater than 0', 400);
      }
    }

    // Validate unit cost if provided
    if (actualUnitCost !== undefined && actualUnitCost !== null) {
      const cost = parseFloat(actualUnitCost);
      if (isNaN(cost) || cost < 0) {
        return errorResponse('Actual unit cost cannot be negative', 400);
      }
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

    // Check if status allows confirmation
    if (purchaseOrder.status !== 'order_accepted') {
      return errorResponse(
        `Cannot confirm delivery for order with status: ${purchaseOrder.status}. Order must be accepted first.`,
        400
      );
    }

    // Check if material already created
    if (purchaseOrder.linkedMaterialId) {
      return errorResponse('Material has already been created from this purchase order', 400);
    }

    // For bulk orders, check if any materials exist
    if (purchaseOrder.isBulkOrder) {
      const existingMaterials = await db.collection('materials').countDocuments({
        linkedPurchaseOrderId: new ObjectId(id),
        deletedAt: null,
      });
      if (existingMaterials > 0) {
        return errorResponse('Materials have already been created from this bulk purchase order', 400);
      }
    }

    // Update purchase order with delivery confirmation data BEFORE creating materials
    // This ensures the delivery note and actual quantities are stored
    const updateData = {
      deliveryNoteFileUrl: deliveryNoteFileUrl.trim(),
      deliveryConfirmedBy: userProfile._id,
      deliveryConfirmedAt: new Date(),
      deliveryConfirmationMethod: 'owner_pm_manual',
      updatedAt: new Date(),
      ...(actualQuantityDelivered !== undefined && actualQuantityDelivered !== null && {
        actualQuantityDelivered: parseFloat(actualQuantityDelivered),
      }),
      ...(actualUnitCost !== undefined && actualUnitCost !== null && {
        actualUnitCost: parseFloat(actualUnitCost),
      }),
      ...(notes && notes.trim() && {
        deliveryConfirmedNotes: notes.trim(),
      }),
    };

    await db.collection('purchase_orders').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Get updated purchase order (with delivery confirmation data)
    const updatedOrderBeforeMaterial = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
    });

    // Create materials using the helper function
    // Materials created from POs are automatically approved for immediate financial state accuracy
    let materialCreationResult = null;
    let materialCreationError = null;

    try {
      // Prepare per-material quantities if provided (for bulk orders)
      let materialQuantitiesMap = null;
      if (materialQuantities && Array.isArray(materialQuantities) && materialQuantities.length > 0) {
        materialQuantitiesMap = {};
        materialQuantities.forEach((mq) => {
          if (mq.materialRequestId && mq.quantity !== undefined && mq.quantity !== null) {
            const quantity = parseFloat(mq.quantity);
            if (!isNaN(quantity) && quantity > 0) {
              materialQuantitiesMap[mq.materialRequestId] = quantity;
            }
          }
        });
      }

      // Prepare per-material unit costs if provided (for bulk orders)
      let materialUnitCostsMap = null;
      if (materialUnitCosts && Array.isArray(materialUnitCosts) && materialUnitCosts.length > 0) {
        materialUnitCostsMap = {};
        materialUnitCosts.forEach((muc) => {
          if (muc.materialRequestId && muc.unitCost !== undefined && muc.unitCost !== null) {
            const cost = parseFloat(muc.unitCost);
            if (!isNaN(cost) && cost > 0) {
              materialUnitCostsMap[muc.materialRequestId] = cost;
            }
          }
        });
      }

      materialCreationResult = await createMaterialFromPurchaseOrder({
        purchaseOrderId: id,
        creatorUserProfile: userProfile,
        actualQuantityReceived: actualQuantityDelivered !== undefined && actualQuantityDelivered !== null 
          ? parseFloat(actualQuantityDelivered) 
          : undefined,
        actualUnitCost: actualUnitCost !== undefined && actualUnitCost !== null 
          ? parseFloat(actualUnitCost) 
          : undefined,
        materialQuantities: materialQuantitiesMap, // Per-material quantities for bulk orders
        materialUnitCosts: materialUnitCostsMap, // Per-material unit costs for bulk orders
        notes: notes && notes.trim() 
          ? notes.trim() 
          : 'Delivery confirmed by Owner/PM',
        isAutomatic: false, // Manual confirmation by Owner/PM
        // Note: allowFromAccepted parameter is deprecated but kept for backward compatibility
        // Materials from POs are now always auto-approved
      });
    } catch (error) {
      console.error('Error creating material from purchase order:', error);
      materialCreationError = error.message;
      return errorResponse(
        `Failed to create material: ${materialCreationError}`,
        400
      );
    }

    // Get final updated purchase order (after material creation)
    const updatedOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
    });

    // Create notifications for relevant users
    try {
      const notifications = [];

      // Notify the PO creator (if different from current user)
      if (purchaseOrder.createdBy && purchaseOrder.createdBy.toString() !== userProfile._id.toString()) {
        const poCreator = await db.collection('users').findOne({
          _id: purchaseOrder.createdBy,
          status: 'active',
        });

        if (poCreator) {
          notifications.push({
            userId: poCreator._id.toString(),
            type: 'approval_status',
            title: 'Purchase Order Delivery Confirmed',
            message: `${userProfile.firstName || userProfile.email} confirmed delivery for PO ${purchaseOrder.purchaseOrderNumber}. Material entry created.`,
            projectId: purchaseOrder.projectId.toString(),
            relatedModel: 'PURCHASE_ORDER',
            relatedId: id,
            createdBy: userProfile._id.toString(),
          });
        }
      }

      // Notify clerks about new material
      const clerks = await db.collection('users').find({
        role: { $in: ['clerk', 'site_clerk'] },
        status: 'active',
      }).toArray();

      if (materialCreationResult?.createdMaterials && materialCreationResult.createdMaterials.length > 0) {
        materialCreationResult.createdMaterials.forEach((material) => {
          clerks.forEach((clerk) => {
            notifications.push({
              userId: clerk._id.toString(),
              type: 'item_received',
              title: 'New Material Entry Created',
              message: `Material entry created from PO ${purchaseOrder.purchaseOrderNumber}: ${material.materialName || material.name}`,
              projectId: purchaseOrder.projectId.toString(),
              relatedModel: 'MATERIAL',
              relatedId: material._id.toString(),
              createdBy: userProfile._id.toString(),
            });
          });
        });
      }

      if (notifications.length > 0) {
        await createNotifications(notifications);
      }
    } catch (notifError) {
      console.error('Error creating notifications (non-critical):', notifError);
      // Don't fail the request if notifications fail
    }

    // Send SMS to supplier about delivery confirmation
    try {
      const supplier = await db.collection('suppliers').findOne({
        _id: purchaseOrder.supplierId,
        status: 'active'
      });

      if (supplier && supplier.smsEnabled && supplier.phone) {
        const formattedPhone = formatPhoneNumber(supplier.phone);
        
        // Get material details for SMS
        let materialName = purchaseOrder.materialName || 'Materials';
        let quantityReceived = actualQuantityDelivered || purchaseOrder.quantityOrdered;
        let unit = purchaseOrder.unit || '';
        
        // For bulk orders, summarize materials
        if (purchaseOrder.isBulkOrder && purchaseOrder.materials && Array.isArray(purchaseOrder.materials)) {
          const materialCount = purchaseOrder.materials.length;
          materialName = `${materialCount} material${materialCount > 1 ? 's' : ''}`;
          // Sum up quantities if materialQuantities provided
          if (materialQuantities && Array.isArray(materialQuantities)) {
            quantityReceived = materialQuantities.reduce((sum, mq) => sum + (mq.quantity || 0), 0);
          }
        }
        
        const smsMessage = generateDeliveryConfirmationSMS({
          purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
          materialName: materialName,
          quantityReceived: quantityReceived,
          unit: unit,
          deliveryDate: new Date(),
          status: 'approved',
          supplier: supplier // Pass supplier for language detection
        });

        await sendSMS({
          to: formattedPhone,
          message: smsMessage
        });

        console.log(`[Confirm Delivery] SMS sent to supplier for PO ${purchaseOrder.purchaseOrderNumber}`);
      }
    } catch (smsError) {
      console.error('[Confirm Delivery] SMS send failed (non-critical):', smsError);
      // Don't fail the request if SMS fails
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELIVERY_CONFIRMED',
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      projectId: purchaseOrder.projectId.toString(),
      changes: {
        before: purchaseOrder,
        after: updatedOrder,
        materialCreated: !!materialCreationResult,
        materialIds: materialCreationResult?.materialIds?.map(id => id.toString()) || [],
        confirmationMethod: 'owner_pm_manual',
        deliveryNoteFileUrl: deliveryNoteFileUrl.trim(),
        actualQuantityDelivered: actualQuantityDelivered !== undefined && actualQuantityDelivered !== null ? parseFloat(actualQuantityDelivered) : null,
        actualUnitCost: actualUnitCost !== undefined && actualUnitCost !== null ? parseFloat(actualUnitCost) : null,
        deliveryNotes: notes && notes.trim() ? notes.trim() : null,
      },
    });

    return successResponse({
      purchaseOrder: updatedOrder,
      materials: materialCreationResult?.createdMaterials || [],
      materialIds: materialCreationResult?.materialIds?.map(id => id.toString()) || [],
      materialCreated: !!materialCreationResult,
    }, 'Delivery confirmed and material entries created successfully', 200);
  } catch (error) {
    console.error('Confirm delivery error:', error);
    return errorResponse('Failed to confirm delivery', 500);
  }
}

