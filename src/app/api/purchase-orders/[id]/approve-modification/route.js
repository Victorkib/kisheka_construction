/**
 * Purchase Order Modification Approval API Route
 * POST /api/purchase-orders/[id]/approve-modification
 * PM/OWNER approves supplier modifications
 * Auth: PM, OWNER
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { createNotifications } from '@/lib/notifications';
import { sendPushToUser } from '@/lib/push-service';
import { updateCommittedCost, recalculateProjectFinances, validateCapitalAvailability } from '@/lib/financial-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/[id]/approve-modification
 * Approve supplier modifications to a purchase order
 * Body: { approvalNotes?: string, autoCommit?: boolean }
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
    const canApprove = await hasPermission(user.id, 'approve_purchase_order_modification');
    if (!canApprove) {
      // Fallback: check if user is PM or OWNER
      const userProfile = await getUserProfile(user.id);
      if (!userProfile) {
        return errorResponse('User profile not found', 404);
      }
      const userRole = userProfile.role?.toLowerCase();
      if (!['pm', 'project_manager', 'owner'].includes(userRole)) {
        return errorResponse('Insufficient permissions. Only PM and OWNER can approve modifications.', 403);
      }
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid order ID', 400);
    }

    const body = await request.json();
    const { approvalNotes, autoCommit = false } = body || {};

    const db = await getDatabase();

    // Get existing order
    const purchaseOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!purchaseOrder) {
      return errorResponse('Purchase order not found', 404);
    }

    // Check if order is in modification status
    if (purchaseOrder.status !== 'order_modified') {
      return errorResponse(`Cannot approve modifications for order with status: ${purchaseOrder.status}. Order must be in 'order_modified' status.`, 400);
    }

    // Check if modifications exist
    if (!purchaseOrder.supplierModifications || Object.keys(purchaseOrder.supplierModifications).length === 0) {
      return errorResponse('No modifications found to approve', 400);
    }

    // Check if already approved/rejected
    if (purchaseOrder.modificationApproved !== undefined && purchaseOrder.modificationApproved !== null) {
      return errorResponse(`Modifications have already been ${purchaseOrder.modificationApproved ? 'approved' : 'rejected'}.`, 400);
    }

    // Calculate new total cost from modifications
    const modifications = purchaseOrder.supplierModifications;
    const newQuantity = modifications.quantityOrdered || purchaseOrder.quantityOrdered;
    const newUnitCost = modifications.unitCost !== undefined ? modifications.unitCost : purchaseOrder.unitCost;
    const newTotalCost = newQuantity * newUnitCost;
    const newDeliveryDate = modifications.deliveryDate || purchaseOrder.deliveryDate;

    // Validate capital availability if auto-committing
    if (autoCommit) {
      const capitalValidation = await validateCapitalAvailability(
        purchaseOrder.projectId.toString(),
        newTotalCost
      );

      if (!capitalValidation.isValid) {
        return errorResponse(
          `Insufficient capital for auto-commit. Available: ${capitalValidation.available.toLocaleString()}, Required: ${newTotalCost.toLocaleString()}`,
          400
        );
      }
    }

    // Prepare update data
    const updateData = {
      modificationApproved: true,
      modificationApprovedAt: new Date(),
      modificationApprovedBy: userProfile._id,
      modificationApprovedByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      modificationApprovalNotes: approvalNotes?.trim() || null,
      // Apply modifications to order
      unitCost: newUnitCost,
      quantityOrdered: newQuantity,
      totalCost: newTotalCost,
      deliveryDate: newDeliveryDate,
      ...(modifications.notes && { notes: modifications.notes }),
      // Update status based on auto-commit
      status: autoCommit ? 'order_accepted' : 'order_sent',
      supplierResponse: autoCommit ? 'accept' : null,
      supplierResponseDate: autoCommit ? new Date() : purchaseOrder.supplierResponseDate,
      financialStatus: autoCommit ? 'committed' : purchaseOrder.financialStatus,
      ...(autoCommit && { committedAt: new Date() }),
      updatedAt: new Date(),
    };

    // Update order
    await db.collection('purchase_orders').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // If auto-committing, update financials
    if (autoCommit) {
      await updateCommittedCost(
        purchaseOrder.projectId.toString(),
        newTotalCost,
        'add'
      );
      await recalculateProjectFinances(purchaseOrder.projectId.toString());
    }

    // Get updated order
    const updatedOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
    });

    // Notify supplier about approval
    const supplier = await db.collection('users').findOne({
      _id: purchaseOrder.supplierId,
      status: 'active'
    });

    if (supplier) {
      try {
        await sendPushToUser({
          userId: supplier._id.toString(),
          title: 'Modifications Approved',
          message: `Your modifications to PO ${purchaseOrder.purchaseOrderNumber} have been approved${autoCommit ? ' and order is now accepted' : ''}`,
          data: {
            url: `/purchase-orders/${id}`,
            purchaseOrderId: id
          }
        });
      } catch (pushError) {
        console.error('Push notification to supplier failed:', pushError);
      }
    }

    // Create notifications for PM/OWNER
    const managers = await db.collection('users').find({
      role: { $in: ['pm', 'project_manager', 'owner'] },
      status: 'active',
      _id: { $ne: userProfile._id } // Exclude approver
    }).toArray();

    if (managers.length > 0) {
      const notifications = managers.map(manager => ({
        userId: manager._id.toString(),
        type: 'modification_approved',
        title: 'Purchase Order Modifications Approved',
        message: `${userProfile.firstName || userProfile.email} approved modifications to PO ${purchaseOrder.purchaseOrderNumber}${autoCommit ? ' and committed the order' : ''}`,
        projectId: purchaseOrder.projectId.toString(),
        relatedModel: 'PURCHASE_ORDER',
        relatedId: id,
        createdBy: userProfile._id.toString(),
        metadata: {
          modifications: modifications,
          autoCommit,
          approvalNotes
        }
      }));

      await createNotifications(notifications);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'APPROVED_MODIFICATION',
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      projectId: purchaseOrder.projectId.toString(),
      changes: {
        before: purchaseOrder,
        after: updatedOrder,
        modifications: modifications,
        autoCommit,
        approvalNotes
      },
    });

    return successResponse({
      order: updatedOrder,
      modifications: modifications,
      autoCommit,
      message: autoCommit 
        ? 'Modifications approved and order committed successfully'
        : 'Modifications approved. Order will be resent to supplier.'
    }, 'Modifications approved successfully');

  } catch (error) {
    console.error('Approve modification error:', error);
    return errorResponse('Failed to approve modifications', 500);
  }
}
