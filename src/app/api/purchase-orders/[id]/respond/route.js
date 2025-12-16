/**
 * Purchase Order Response API Route
 * POST: Process supplier response via secure token link
 * 
 * POST /api/purchase-orders/[id]/respond
 * Auth: None (public, token-based)
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { updateCommittedCost, recalculateProjectFinances, validateCapitalAvailability } from '@/lib/financial-helpers';
import { createMaterialFromPurchaseOrder } from '@/lib/material-helpers';
import { sendPushToUser } from '@/lib/push-service';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/[id]/respond
 * Process supplier response (via secure link)
 * Body: { action: 'accept'|'reject'|'modify', token, ... }
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, token, supplierNotes, finalUnitCost, quantityOrdered, deliveryDate, notes } = body;

    console.log('[POST /api/purchase-orders/[id]/respond] Request received:', {
      id,
      action,
      hasToken: !!token,
      tokenLength: token?.length
    });

    if (!id || !ObjectId.isValid(id)) {
      console.error('[POST /api/purchase-orders/[id]/respond] Invalid ID:', id);
      return errorResponse('Invalid purchase order ID', 400);
    }

    if (!action || !['accept', 'reject', 'modify'].includes(action)) {
      console.error('[POST /api/purchase-orders/[id]/respond] Invalid action:', action);
      return errorResponse('Invalid action. Must be "accept", "reject", or "modify"', 400);
    }

    if (!token) {
      console.error('[POST /api/purchase-orders/[id]/respond] Missing token');
      return errorResponse('Response token is required', 400);
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
      return errorResponse('Response token has expired', 410);
    }

    // Check if token has already been used
    if (purchaseOrder.responseTokenUsedAt) {
      return errorResponse('This response link has already been used. Please contact the buyer if you need to make changes.', 410);
    }

    // Check if order can be responded to
    if (purchaseOrder.status !== 'order_sent' && purchaseOrder.status !== 'order_modified') {
      return errorResponse(`Cannot respond to order with status: ${purchaseOrder.status}`, 400);
    }

    if (action === 'accept') {
      // Calculate final cost (may differ from original)
      let finalTotalCost = purchaseOrder.totalCost;
      let unitCostToUse = purchaseOrder.unitCost;

      // Handle bulk orders differently
      if (purchaseOrder.isBulkOrder && purchaseOrder.materials && Array.isArray(purchaseOrder.materials)) {
        // For bulk orders, if finalUnitCost is provided, we can't apply it to all materials
        // Instead, we use the original totalCost or recalculate from materials array
        if (finalUnitCost !== undefined && finalUnitCost >= 0) {
          // If supplier provides a new unit cost, we need to recalculate from materials
          // But since different materials have different costs, we'll use a weighted average
          // For now, we'll keep the original totalCost and log a warning
          console.warn('[PO Response] Bulk order: finalUnitCost provided but cannot be applied uniformly to all materials. Using original totalCost.');
          // Keep original totalCost for bulk orders
          finalTotalCost = purchaseOrder.totalCost;
        } else {
          // Use original totalCost
          finalTotalCost = purchaseOrder.totalCost;
        }
        // For bulk orders, unitCost is not applicable (set to 0)
        unitCostToUse = 0;
      } else {
        // Single material order - can apply finalUnitCost if provided
        if (finalUnitCost !== undefined && finalUnitCost >= 0) {
          unitCostToUse = parseFloat(finalUnitCost);
          finalTotalCost = purchaseOrder.quantityOrdered * unitCostToUse;
        }
      }

      // Validate capital availability
      const capitalValidation = await validateCapitalAvailability(
        purchaseOrder.projectId.toString(),
        finalTotalCost
      );

      if (!capitalValidation.isValid) {
        return errorResponse(
          `Insufficient capital. Available: ${capitalValidation.available.toLocaleString()}, Required: ${finalTotalCost.toLocaleString()}`,
          400
        );
      }

      // Update order status and invalidate token (one-time use)
      const updateData = {
        status: 'order_accepted',
        supplierResponse: 'accept',
        supplierResponseDate: new Date(),
        supplierNotes: supplierNotes?.trim() || null,
        unitCost: unitCostToUse,
        totalCost: finalTotalCost,
        financialStatus: 'committed',
        committedAt: new Date(),
        responseTokenUsedAt: new Date(), // Invalidate token - one-time use
        updatedAt: new Date()
      };

      await db.collection('purchase_orders').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      // Increase committedCost
      await updateCommittedCost(
        purchaseOrder.projectId.toString(),
        finalTotalCost,
        'add'
      );

      // Trigger financial recalculation
      await recalculateProjectFinances(purchaseOrder.projectId.toString());

      // Get PM/OWNER for notifications
      const poCreator = await db.collection('users').findOne({
        _id: purchaseOrder.createdBy,
        status: 'active'
      });

      // Auto-create material if configured
      let materialCreated = false;
      if (process.env.AUTO_CREATE_MATERIAL_ON_CONFIRM === 'true' && poCreator) {
        try {
          await createMaterialFromPurchaseOrder({
            purchaseOrderId: id,
            creatorUserProfile: poCreator,
            actualQuantityReceived: purchaseOrder.quantityOrdered,
            actualUnitCost: unitCostToUse,
            notes: supplierNotes || 'Accepted via secure link',
            isAutomatic: true
          });
          materialCreated = true;
        } catch (materialError) {
          console.error('Auto-create material error:', materialError);
        }
      }

      // Notify PM/OWNER
      if (poCreator) {
        try {
          await sendPushToUser({
            userId: poCreator._id.toString(),
            title: 'Purchase Order Accepted',
            message: `${purchaseOrder.supplierName} accepted PO ${purchaseOrder.purchaseOrderNumber}${materialCreated ? ' - Material entry created' : ''}`,
            data: {
              url: `/purchase-orders/${id}`,
              purchaseOrderId: id
            }
          });
        } catch (pushError) {
          console.error('Push notification failed:', pushError);
        }
      }

      // Create audit log
      await createAuditLog({
        userId: null,
        action: 'ACCEPTED',
        entityType: 'PURCHASE_ORDER',
        entityId: id,
        projectId: purchaseOrder.projectId.toString(),
        changes: {
          before: purchaseOrder,
          after: { ...purchaseOrder, ...updateData },
          confirmationMethod: 'token_link',
          materialCreated
        }
      });

      return successResponse({
        orderId: id,
        status: 'order_accepted',
        materialCreated
      }, 'Purchase order accepted successfully');
    } else if (action === 'reject') {
      if (!supplierNotes || !supplierNotes.trim()) {
        return errorResponse('Rejection reason is required', 400);
      }

      // Update order status and invalidate token (one-time use)
      const updateData = {
        status: 'order_rejected',
        supplierResponse: 'reject',
        supplierResponseDate: new Date(),
        supplierNotes: supplierNotes.trim(),
        responseTokenUsedAt: new Date(), // Invalidate token - one-time use
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
          console.error('Push notification failed:', pushError);
        }
      }

      // Create audit log
      await createAuditLog({
        userId: null,
        action: 'REJECTED',
        entityType: 'PURCHASE_ORDER',
        entityId: id,
        projectId: purchaseOrder.projectId.toString(),
        changes: {
          before: purchaseOrder,
          after: { ...purchaseOrder, ...updateData },
          confirmationMethod: 'token_link'
        }
      });

      return successResponse({
        orderId: id,
        status: 'order_rejected'
      }, 'Purchase order rejected');
    } else if (action === 'modify') {
      // Update order with modifications (requires PM/OWNER approval)
      const modifications = {
        ...(quantityOrdered && { quantityOrdered: parseFloat(quantityOrdered) }),
        ...(finalUnitCost !== undefined && { unitCost: parseFloat(finalUnitCost) }),
        ...(deliveryDate && { deliveryDate: new Date(deliveryDate) }),
        ...(notes && { notes: notes.trim() })
      };

      // Calculate new total if cost changed
      let newTotalCost = purchaseOrder.totalCost;
      const newQuantity = modifications.quantityOrdered || purchaseOrder.quantityOrdered;
      const newUnitCost = modifications.unitCost || purchaseOrder.unitCost;
      newTotalCost = newQuantity * newUnitCost;

      const updateData = {
        status: 'order_modified',
        supplierResponse: 'modify',
        supplierResponseDate: new Date(),
        supplierNotes: notes?.trim() || null,
        supplierModifications: modifications,
        modificationApproved: false,
        unitCost: newUnitCost,
        quantityOrdered: newQuantity,
        totalCost: newTotalCost,
        ...(modifications.deliveryDate && { deliveryDate: modifications.deliveryDate }),
        responseTokenUsedAt: new Date(), // Invalidate token - one-time use
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
            title: 'Purchase Order Modification Request',
            message: `${purchaseOrder.supplierName} requested modifications to PO ${purchaseOrder.purchaseOrderNumber}`,
            data: {
              url: `/purchase-orders/${id}`,
              purchaseOrderId: id
            }
          });
        } catch (pushError) {
          console.error('Push notification failed:', pushError);
        }
      }

      // Create audit log
      await createAuditLog({
        userId: null,
        action: 'MODIFIED',
        entityType: 'PURCHASE_ORDER',
        entityId: id,
        projectId: purchaseOrder.projectId.toString(),
        changes: {
          before: purchaseOrder,
          after: { ...purchaseOrder, ...updateData },
          confirmationMethod: 'token_link'
        }
      });

      return successResponse({
        orderId: id,
        status: 'order_modified',
        note: 'Modification request submitted. PM/OWNER will review and approve or reject.'
      }, 'Purchase order modification requested');
    }
  } catch (error) {
    console.error('Process response error:', error);
    return errorResponse('Failed to process supplier response', 500);
  }
}

