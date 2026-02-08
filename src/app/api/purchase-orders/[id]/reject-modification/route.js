/**
 * Purchase Order Modification Rejection API Route
 * POST /api/purchase-orders/[id]/reject-modification
 * PM/OWNER rejects supplier modifications
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
import { sendSMS, generateModificationRejectionSMS, formatPhoneNumber } from '@/lib/sms-service';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/[id]/reject-modification
 * Reject supplier modifications to a purchase order
 * Body: { rejectionReason: string, revertToOriginal?: boolean }
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
    const canReject = await hasPermission(user.id, 'reject_purchase_order_modification');
    if (!canReject) {
      // Fallback: check if user is PM or OWNER
      const userProfile = await getUserProfile(user.id);
      if (!userProfile) {
        return errorResponse('User profile not found', 404);
      }
      const userRole = userProfile.role?.toLowerCase();
      if (!['pm', 'project_manager', 'owner'].includes(userRole)) {
        return errorResponse('Insufficient permissions. Only PM and OWNER can reject modifications.', 403);
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
    const { rejectionReason, revertToOriginal = true } = body || {};

    if (!rejectionReason || !rejectionReason.trim()) {
      return errorResponse('Rejection reason is required', 400);
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

    // Check if order is in modification status
    if (purchaseOrder.status !== 'order_modified') {
      return errorResponse(`Cannot reject modifications for order with status: ${purchaseOrder.status}. Order must be in 'order_modified' status.`, 400);
    }

    // Check if modifications exist
    if (!purchaseOrder.supplierModifications || Object.keys(purchaseOrder.supplierModifications).length === 0) {
      return errorResponse('No modifications found to reject', 400);
    }

    // Check if already approved/rejected
    if (purchaseOrder.modificationApproved !== undefined && purchaseOrder.modificationApproved !== null) {
      return errorResponse(`Modifications have already been ${purchaseOrder.modificationApproved ? 'approved' : 'rejected'}.`, 400);
    }

    // Store original values before modifications (if not already stored)
    const originalValues = {
      unitCost: purchaseOrder.unitCost,
      quantityOrdered: purchaseOrder.quantityOrdered,
      totalCost: purchaseOrder.totalCost,
      deliveryDate: purchaseOrder.deliveryDate,
      notes: purchaseOrder.notes,
    };

    // Prepare update data
    const updateData = {
      modificationApproved: false,
      modificationApprovedAt: new Date(),
      modificationApprovedBy: userProfile._id,
      modificationApprovedByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      modificationRejectionReason: rejectionReason.trim(),
      // Revert to original values if requested
      ...(revertToOriginal && {
        unitCost: originalValues.unitCost,
        quantityOrdered: originalValues.quantityOrdered,
        totalCost: originalValues.totalCost,
        deliveryDate: originalValues.deliveryDate,
        notes: originalValues.notes,
      }),
      // Reset status to order_sent (supplier can respond again)
      status: 'order_sent',
      supplierResponse: null,
      supplierResponseDate: null,
      supplierModifications: null, // Clear modifications
      updatedAt: new Date(),
    };

    // Update order
    await db.collection('purchase_orders').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Get updated order
    const updatedOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
    });

    // Notify supplier about rejection
    const supplier = await db.collection('users').findOne({
      _id: purchaseOrder.supplierId,
      status: 'active'
    });

    if (supplier) {
      try {
        await sendPushToUser({
          userId: supplier._id.toString(),
          title: 'Modifications Rejected',
          message: `Your modifications to PO ${purchaseOrder.purchaseOrderNumber} were rejected. Reason: ${rejectionReason.trim()}`,
          data: {
            url: `/purchase-orders/${id}`,
            purchaseOrderId: id
          }
        });
      } catch (pushError) {
        console.error('Push notification to supplier failed:', pushError);
      }

      // Send SMS to supplier if enabled
      try {
        const supplierProfile = await db.collection('suppliers').findOne({
          userId: purchaseOrder.supplierId,
          status: 'active'
        });

        if (supplierProfile && supplierProfile.smsEnabled && supplierProfile.phone) {
          const formattedPhone = formatPhoneNumber(supplierProfile.phone);
          const smsMessage = generateModificationRejectionSMS({
            purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
            rejectionReason: rejectionReason.trim(),
            originalTerms: revertToOriginal ? originalValues : {
              unitCost: purchaseOrder.unitCost,
              quantityOrdered: purchaseOrder.quantityOrdered,
              deliveryDate: purchaseOrder.deliveryDate
            },
            alternativeOffer: null, // Can be enhanced later to include alternative offers
            supplier: supplierProfile // Pass supplier for language detection
          });

          await sendSMS({
            to: formattedPhone,
            message: smsMessage
          });

          console.log(`[Reject Modification] SMS sent to supplier for PO ${purchaseOrder.purchaseOrderNumber}`);
        }
      } catch (smsError) {
        console.error('[Reject Modification] SMS send failed:', smsError);
        // Don't fail the request if SMS fails
      }
    }

    // Create notifications for PM/OWNER
    const managers = await db.collection('users').find({
      role: { $in: ['pm', 'project_manager', 'owner'] },
      status: 'active',
      _id: { $ne: userProfile._id } // Exclude rejector
    }).toArray();

    if (managers.length > 0) {
      const notifications = managers.map(manager => ({
        userId: manager._id.toString(),
        type: 'modification_rejected',
        title: 'Purchase Order Modifications Rejected',
        message: `${userProfile.firstName || userProfile.email} rejected modifications to PO ${purchaseOrder.purchaseOrderNumber}`,
        projectId: purchaseOrder.projectId.toString(),
        relatedModel: 'PURCHASE_ORDER',
        relatedId: id,
        createdBy: userProfile._id.toString(),
        metadata: {
          rejectionReason: rejectionReason.trim(),
          revertToOriginal
        }
      }));

      await createNotifications(notifications);
    }

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'REJECTED_MODIFICATION',
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      projectId: purchaseOrder.projectId.toString(),
      changes: {
        before: purchaseOrder,
        after: updatedOrder,
        rejectedModifications: purchaseOrder.supplierModifications,
        rejectionReason: rejectionReason.trim(),
        revertToOriginal
      },
    });

    return successResponse({
      order: updatedOrder,
      rejectedModifications: purchaseOrder.supplierModifications,
      revertToOriginal,
      message: revertToOriginal 
        ? 'Modifications rejected and order reverted to original values'
        : 'Modifications rejected. Order remains with current values.'
    }, 'Modifications rejected successfully');

  } catch (error) {
    console.error('Reject modification error:', error);
    return errorResponse('Failed to reject modifications', 500);
  }
}
