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
import { sendSMS, generateModificationApprovalSMS, formatPhoneNumber } from '@/lib/sms-service';
import { updateCommittedCost, recalculateProjectFinances, validateCapitalAvailability } from '@/lib/financial-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/purchase-orders/[id]/approve-modification
 * Approve supplier modifications to a purchase order
 * Body: { approvalNotes?: string, autoCommit?: boolean }
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

      // OPTIONAL CAPITAL: Only block if capital is set AND insufficient
      // If capital is not set (capitalNotSet = true), allow the operation
      if (!capitalValidation.isValid && !capitalValidation.capitalNotSet) {
        return errorResponse(
          `Insufficient capital (not budget) for auto-commit. Available capital: ${capitalValidation.available.toLocaleString()}, Required: ${newTotalCost.toLocaleString()}. Add capital to the project to proceed.`,
          400
        );
      }
      // If capital is not set, operation is allowed (isValid = true, capitalNotSet = true)
      // Spending will still be tracked regardless
    }

    // CRITICAL FIX: For bulk orders, update materials array with approved modifications
    let updatedMaterials = purchaseOrder.materials;
    if (purchaseOrder.isBulkOrder && purchaseOrder.materials && Array.isArray(purchaseOrder.materials) && purchaseOrder.materialResponses) {
      // Update materials array based on approved materialResponses
      updatedMaterials = purchaseOrder.materials.map(material => {
        const materialResponse = purchaseOrder.materialResponses.find(
          r => {
            const responseId = r.materialRequestId?.toString();
            const materialId = material.materialRequestId?.toString() || material._id?.toString();
            return responseId === materialId;
          }
        );
        
        // If material has modifications in response, apply them
        if (materialResponse && materialResponse.modifications) {
          const unitCost = materialResponse.modifications.unitCost !== undefined 
            ? parseFloat(materialResponse.modifications.unitCost) 
            : material.unitCost;
          const quantity = materialResponse.modifications.quantityOrdered !== undefined 
            ? parseFloat(materialResponse.modifications.quantityOrdered) 
            : material.quantity;
          
          // CRITICAL FIX: Validate unitCost > 0
          if (unitCost === undefined || unitCost === null || isNaN(unitCost) || unitCost <= 0) {
            throw new Error(
              `Invalid unit cost in modification for material "${material.materialName || material.materialRequestId}": ${unitCost}. ` +
              `Unit cost must be greater than 0.`
            );
          }
          
          // CRITICAL FIX: Validate quantity > 0
          if (quantity === undefined || quantity === null || isNaN(quantity) || quantity <= 0) {
            throw new Error(
              `Invalid quantity in modification for material "${material.materialName || material.materialRequestId}": ${quantity}. ` +
              `Quantity must be greater than 0.`
            );
          }
          
          const totalCost = unitCost * quantity;
          
          return {
            ...material,
            unitCost,
            quantity,
            totalCost
          };
        }
        
        return material; // Keep original if no modifications
      });
      
      // CRITICAL FIX: Validate all updated materials have valid costs
      for (const material of updatedMaterials) {
        if (material.unitCost !== undefined && material.unitCost !== null && material.unitCost <= 0) {
          throw new Error(
            `Invalid materials array after modification approval: Material "${material.materialName || material.materialRequestId}" has invalid unitCost: ${material.unitCost}. ` +
            `All materials must have unitCost > 0.`
          );
        }
        if (material.quantity !== undefined && material.quantity !== null && material.quantity <= 0) {
          throw new Error(
            `Invalid materials array after modification approval: Material "${material.materialName || material.materialRequestId}" has invalid quantity: ${material.quantity}. ` +
            `All materials must have quantity > 0.`
          );
        }
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
      // CRITICAL: Update materials array for bulk orders
      ...(updatedMaterials && { materials: updatedMaterials }),
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

      // CRITICAL FIX: Update phase committed costs immediately
      try {
        const { updatePhaseCommittedCostsForPO } = await import('@/lib/phase-helpers');
        await updatePhaseCommittedCostsForPO(updatedOrder || purchaseOrder);
      } catch (phaseError) {
        console.error('[Approve Modification] Phase committed cost update failed (non-critical):', phaseError);
        // Don't fail the request - phase update can be done later
      }

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

      // Send SMS to supplier if enabled
      try {
        const supplierProfile = await db.collection('suppliers').findOne({
          userId: purchaseOrder.supplierId,
          status: 'active'
        });

        if (supplierProfile && supplierProfile.smsEnabled && supplierProfile.phone) {
          const formattedPhone = formatPhoneNumber(supplierProfile.phone);
          const smsMessage = generateModificationApprovalSMS({
            purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
            modifications: modifications,
            autoCommit: autoCommit,
            deliveryDate: newDeliveryDate,
            supplier: supplierProfile // Pass supplier for language detection
          });

          await sendSMS({
            to: formattedPhone,
            message: smsMessage
          });

          console.log(`[Approve Modification] SMS sent to supplier for PO ${purchaseOrder.purchaseOrderNumber}`);
        }
      } catch (smsError) {
        console.error('[Approve Modification] SMS send failed:', smsError);
        // Don't fail the request if SMS fails
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
