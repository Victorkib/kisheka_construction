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
import { withTransaction } from '@/lib/mongodb/transaction-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/[id]/accept
 * Supplier accepts a purchase order
 * Auth: SUPPLIER
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

    // CRITICAL FIX: Validate unit cost is provided and > 0
    if (finalUnitCost !== undefined && finalUnitCost !== null) {
      const parsedUnitCost = parseFloat(finalUnitCost);
      if (isNaN(parsedUnitCost) || parsedUnitCost <= 0) {
        return errorResponse(
          'Invalid unit cost provided. Unit cost must be a positive number greater than 0. ' +
          'Please provide a valid unit cost when accepting the purchase order.',
          400
        );
      }
      unitCostToUse = parsedUnitCost;
      finalTotalCost = purchaseOrder.quantityOrdered * unitCostToUse;
    } else if (purchaseOrder.unitCost === 0 || purchaseOrder.unitCost === null || purchaseOrder.unitCost === undefined) {
      // If supplier doesn't provide unit cost and PO has 0 or missing unit cost, require it
      return errorResponse(
        'Unit cost is required to accept this purchase order. ' +
        'The purchase order does not have a valid unit cost. ' +
        'Please provide the finalUnitCost when accepting the order.',
        400
      );
    }

    // CRITICAL: Validate capital availability before accepting
    const capitalValidation = await validateCapitalAvailability(
      purchaseOrder.projectId.toString(),
      finalTotalCost
    );

    // OPTIONAL CAPITAL: Only block if capital is set AND insufficient
    // If capital is not set (capitalNotSet = true), allow the operation
    if (!capitalValidation.isValid && !capitalValidation.capitalNotSet) {
      return errorResponse(
        `Cannot accept order: Insufficient capital (not budget). Available capital: ${capitalValidation.available.toLocaleString()}, Required: ${finalTotalCost.toLocaleString()}, Shortfall: ${(finalTotalCost - capitalValidation.available).toLocaleString()}. Add capital to the project to proceed.`,
        400
      );
    }
    // If capital is not set, operation is allowed (isValid = true, capitalNotSet = true)
    // Spending will still be tracked regardless

    // CRITICAL: Wrap critical operations in transaction for atomicity
    // This ensures PO status update and financial update happen together or not at all
    console.log('[POST /api/purchase-orders/[id]/accept] Starting transaction for atomic operations');

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

    const transactionResult = await withTransaction(async ({ db, session }) => {
      // 1. Update purchase order status (atomic)
      await db.collection('purchase_orders').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { session }
      );

      // 2. Update committed cost in project_finances (atomic with PO update)
      await updateCommittedCost(
        purchaseOrder.projectId.toString(),
        finalTotalCost,
        'add',
        session
      );

      // Note: Phase committed cost update happens outside transaction (non-critical)
      // It will be called after transaction completes

      // 3. Create audit log (atomic with above)
      await createAuditLog({
        userId: userProfile._id.toString(),
        action: 'ACCEPTED',
        entityType: 'PURCHASE_ORDER',
        entityId: id,
        projectId: purchaseOrder.projectId.toString(),
        changes: {
          before: purchaseOrder,
          after: { ...purchaseOrder, ...updateData },
          committedCost: finalTotalCost,
          capitalValidation: {
            available: capitalValidation.available,
            required: finalTotalCost,
            isValid: true,
          },
        },
      }, { session });

      return { success: true };
    });

    console.log('[POST /api/purchase-orders/[id]/accept] Transaction completed successfully');

    // Get updated order (after transaction)
    const updatedOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
    });

    // Non-critical operations (can fail without affecting core data)
    // CRITICAL FIX: Update phase committed costs immediately
    try {
      const { updatePhaseCommittedCostsForPO } = await import('@/lib/phase-helpers');
      await updatePhaseCommittedCostsForPO(updatedOrder || purchaseOrder);
    } catch (phaseError) {
      console.error('[POST /api/purchase-orders/[id]/accept] Phase committed cost update failed (non-critical):', phaseError);
      // Don't fail the request - phase update can be done later
    }

    // Trigger financial recalculation (read-heavy, can happen outside transaction)
    try {
      await recalculateProjectFinances(purchaseOrder.projectId.toString());
    } catch (recalcError) {
      console.error('[POST /api/purchase-orders/[id]/accept] Financial recalculation failed (non-critical):', recalcError);
      // Don't fail the request - recalculation can be done later
    }

    // Create notifications for PM/OWNER (non-critical)
    try {
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
    } catch (notifError) {
      console.error('[POST /api/purchase-orders/[id]/accept] Notification creation failed (non-critical):', notifError);
      // Don't fail the request - notifications are non-critical
    }

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

