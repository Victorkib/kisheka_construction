/**
 * Purchase Order Accept API Route
 * POST /api/purchase-orders/[id]/accept
 * Supplier accepts a purchase order
 * Auth: SUPPLIER (only their own orders)
 * 
 * CRITICAL: Increases committedCost when order is accepted
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotification, createNotifications } from '@/lib/notifications';
import { validateCapitalAvailability, updateCommittedCost, recalculateProjectFinances } from '@/lib/financial-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/[id]/accept
 * Supplier accepts a purchase order
 * Auth: SUPPLIER
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
    const canAccept = await hasPermission(user.id, 'accept_purchase_order');
    if (!canAccept) {
      return errorResponse('Insufficient permissions. Only SUPPLIER can accept purchase orders.', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid order ID', 400);
    }

    const body = await request.json();
    const { supplierNotes, finalUnitCost } = body || {};

    const db = await getDatabase();

    // Get existing order
    const purchaseOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!purchaseOrder) {
      return errorResponse('Purchase order not found', 404);
    }

    // Check if supplier matches
    if (purchaseOrder.supplierId.toString() !== userProfile._id.toString()) {
      return errorResponse('You can only accept your own purchase orders', 403);
    }

    // Check if status allows acceptance
    const acceptableStatuses = ['order_sent', 'order_modified'];
    if (!acceptableStatuses.includes(purchaseOrder.status)) {
      return errorResponse(`Cannot accept order with status: ${purchaseOrder.status}`, 400);
    }

    // If supplier provides final unit cost, use it (may differ from original)
    let finalTotalCost = purchaseOrder.totalCost;
    let unitCostToUse = purchaseOrder.unitCost;

    if (finalUnitCost !== undefined && finalUnitCost >= 0) {
      unitCostToUse = parseFloat(finalUnitCost);
      finalTotalCost = purchaseOrder.quantityOrdered * unitCostToUse;
    }

    // CRITICAL: Validate capital availability before accepting
    const capitalValidation = await validateCapitalAvailability(
      purchaseOrder.projectId.toString(),
      finalTotalCost
    );

    if (!capitalValidation.isValid) {
      return errorResponse(
        `Cannot accept order: Insufficient capital. Available: ${capitalValidation.available.toLocaleString()}, Required: ${finalTotalCost.toLocaleString()}, Shortfall: ${(finalTotalCost - capitalValidation.available).toLocaleString()}`,
        400
      );
    }

    // Update order status
    const updateData = {
      status: 'order_accepted',
      supplierResponse: 'accept',
      supplierResponseDate: new Date(),
      supplierNotes: supplierNotes?.trim() || null,
      unitCost: unitCostToUse,
      totalCost: finalTotalCost,
      financialStatus: 'committed',
      committedAt: new Date(),
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

    // CRITICAL: Increase committedCost in project_finances
    await updateCommittedCost(
      purchaseOrder.projectId.toString(),
      finalTotalCost,
      'add'
    );

    // Trigger financial recalculation
    await recalculateProjectFinances(purchaseOrder.projectId.toString());

    // Create notifications for PM/OWNER
    const managers = await db.collection('users').find({
      role: { $in: ['pm', 'project_manager', 'owner'] },
      status: 'active',
    }).toArray();

    if (managers.length > 0) {
      const notifications = managers.map(manager => ({
        userId: manager._id.toString(),
        type: 'approval_status',
        title: 'Purchase Order Accepted',
        message: `${purchaseOrder.supplierName} accepted purchase order ${purchaseOrder.purchaseOrderNumber} for ${purchaseOrder.quantityOrdered} ${purchaseOrder.unit} of ${purchaseOrder.materialName}`,
        projectId: purchaseOrder.projectId.toString(),
        relatedModel: 'PURCHASE_ORDER',
        relatedId: id,
        createdBy: userProfile._id.toString(),
      }));

      await createNotifications(notifications);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'ACCEPTED',
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      projectId: purchaseOrder.projectId.toString(),
      changes: {
        before: purchaseOrder,
        after: updatedOrder,
        committedCost: finalTotalCost,
        capitalValidation: {
          available: capitalValidation.available,
          required: finalTotalCost,
          isValid: true,
        },
      },
    });

    return successResponse({
      order: updatedOrder,
      capitalInfo: {
        available: capitalValidation.available,
        required: finalTotalCost,
        remaining: capitalValidation.available - finalTotalCost,
      },
    }, 'Purchase order accepted successfully');
  } catch (error) {
    console.error('Accept purchase order error:', error);
    return errorResponse('Failed to accept purchase order', 500);
  }
}

