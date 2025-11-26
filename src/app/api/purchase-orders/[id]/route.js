/**
 * Purchase Order Detail API Route
 * GET: Get single purchase order
 * PATCH: Update purchase order
 * DELETE: Soft delete purchase order
 * 
 * GET /api/purchase-orders/[id]
 * PATCH /api/purchase-orders/[id]
 * DELETE /api/purchase-orders/[id]
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDatabase } from '@/lib/mongodb/connection';
import { getUserProfile } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/role-helpers';
import { createAuditLog } from '@/lib/audit-log';
import { validateCapitalAvailability, decreaseCommittedCost } from '@/lib/financial-helpers';
import { ObjectId } from 'mongodb';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * GET /api/purchase-orders/[id]
 * Get single purchase order by ID
 * Auth: PM, OWNER, SUPPLIER, ACCOUNTANT
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
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

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid order ID', 400);
    }

    const db = await getDatabase();

    const purchaseOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!purchaseOrder) {
      return errorResponse('Purchase order not found', 404);
    }

    // Role-based access check
    const userRole = userProfile.role?.toLowerCase();
    if (userRole === 'supplier') {
      // SUPPLIER can only see their own orders
      if (purchaseOrder.supplierId.toString() !== userProfile._id.toString()) {
        return errorResponse('Insufficient permissions to view this order', 403);
      }
    }

    // Populate related data
    const project = await db.collection('projects').findOne({
      _id: purchaseOrder.projectId,
    });

    const supplier = await db.collection('users').findOne({
      _id: purchaseOrder.supplierId,
    });

    const creator = await db.collection('users').findOne({
      _id: purchaseOrder.createdBy,
    });

    let materialRequest = null;
    if (purchaseOrder.materialRequestId) {
      materialRequest = await db.collection('material_requests').findOne({
        _id: purchaseOrder.materialRequestId,
      });
    }

    let linkedMaterial = null;
    if (purchaseOrder.linkedMaterialId) {
      linkedMaterial = await db.collection('materials').findOne({
        _id: purchaseOrder.linkedMaterialId,
      });
    }

    return successResponse({
      ...purchaseOrder,
      project: project ? {
        _id: project._id.toString(),
        projectCode: project.projectCode,
        projectName: project.projectName,
      } : null,
      supplier: supplier ? {
        _id: supplier._id.toString(),
        name: `${supplier.firstName || ''} ${supplier.lastName || ''}`.trim() || supplier.email,
        email: supplier.email,
      } : null,
      creator: creator ? {
        _id: creator._id.toString(),
        name: `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email,
        email: creator.email,
      } : null,
      materialRequest: materialRequest ? {
        _id: materialRequest._id.toString(),
        requestNumber: materialRequest.requestNumber,
        materialName: materialRequest.materialName,
        status: materialRequest.status,
      } : null,
      linkedMaterial: linkedMaterial ? {
        _id: linkedMaterial._id.toString(),
        name: linkedMaterial.name,
        status: linkedMaterial.status,
      } : null,
    });
  } catch (error) {
    console.error('Get purchase order error:', error);
    return errorResponse('Failed to retrieve purchase order', 500);
  }
}

/**
 * PATCH /api/purchase-orders/[id]
 * Update purchase order (only if status allows)
 * Auth: PM, OWNER
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canEdit = await hasPermission(user.id, 'edit_purchase_order');
    if (!canEdit) {
      return errorResponse('Insufficient permissions to edit purchase orders', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid order ID', 400);
    }

    const body = await request.json();
    const db = await getDatabase();

    // Get existing order
    const existingOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingOrder) {
      return errorResponse('Purchase order not found', 404);
    }

    // Check if status allows editing
    const editableStatuses = ['order_sent', 'order_modified'];
    if (!editableStatuses.includes(existingOrder.status)) {
      return errorResponse(`Cannot edit order with status: ${existingOrder.status}`, 400);
    }

    // Build update object (only allow updating certain fields)
    const allowedFields = [
      'quantityOrdered',
      'unitCost',
      'deliveryDate',
      'terms',
      'notes',
    ];

    const updateData = {
      updatedAt: new Date(),
    };

    let totalCostChanged = false;
    let newTotalCost = existingOrder.totalCost;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'deliveryDate') {
          const deliveryDateObj = new Date(body[field]);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (deliveryDateObj < today) {
            return errorResponse('Delivery date must be a future date', 400);
          }
          updateData[field] = deliveryDateObj;
        } else if (field === 'quantityOrdered' || field === 'unitCost') {
          updateData[field] = parseFloat(body[field]);
          totalCostChanged = true;
        } else {
          updateData[field] = body[field]?.trim() || '';
        }
      }
    }

    // Recalculate total cost if quantity or unit cost changed
    if (totalCostChanged) {
      const quantityOrdered = updateData.quantityOrdered !== undefined ? updateData.quantityOrdered : existingOrder.quantityOrdered;
      const unitCost = updateData.unitCost !== undefined ? updateData.unitCost : existingOrder.unitCost;
      newTotalCost = quantityOrdered * unitCost;
      updateData.totalCost = newTotalCost;

      // If total cost changed and order was already accepted (committed), re-validate capital
      if (existingOrder.financialStatus === 'committed') {
        const capitalValidation = await validateCapitalAvailability(
          existingOrder.projectId.toString(),
          newTotalCost - existingOrder.totalCost // Only the difference
        );

        if (!capitalValidation.isValid) {
          return errorResponse(
            `Insufficient capital for cost increase. Available: ${capitalValidation.available.toLocaleString()}, Additional Required: ${(newTotalCost - existingOrder.totalCost).toLocaleString()}`,
            400
          );
        }
      } else {
        // If not committed yet, validate total cost
        const capitalValidation = await validateCapitalAvailability(
          existingOrder.projectId.toString(),
          newTotalCost
        );

        if (!capitalValidation.isValid) {
          return errorResponse(
            `Insufficient capital. Available: ${capitalValidation.available.toLocaleString()}, Required: ${newTotalCost.toLocaleString()}`,
            400
          );
        }
      }
    }

    // Update order
    await db.collection('purchase_orders').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    // Get updated order
    const updatedOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
    });

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'UPDATED',
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      projectId: existingOrder.projectId.toString(),
      changes: { before: existingOrder, after: updatedOrder },
    });

    return successResponse(updatedOrder, 'Purchase order updated successfully');
  } catch (error) {
    console.error('Update purchase order error:', error);
    return errorResponse('Failed to update purchase order', 500);
  }
}

/**
 * DELETE /api/purchase-orders/[id]
 * Soft delete purchase order (only if status allows)
 * Auth: OWNER
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Check permission
    const canDelete = await hasPermission(user.id, 'delete_purchase_order');
    if (!canDelete) {
      return errorResponse('Insufficient permissions to delete purchase orders', 403);
    }

    const userProfile = await getUserProfile(user.id);
    if (!userProfile) {
      return errorResponse('User profile not found', 404);
    }

    if (!id || !ObjectId.isValid(id)) {
      return errorResponse('Invalid order ID', 400);
    }

    const db = await getDatabase();

    // Get existing order
    const existingOrder = await db.collection('purchase_orders').findOne({
      _id: new ObjectId(id),
      deletedAt: null,
    });

    if (!existingOrder) {
      return errorResponse('Purchase order not found', 404);
    }

    // Check if status allows deletion
    const deletableStatuses = ['order_sent', 'order_rejected', 'cancelled'];
    if (!deletableStatuses.includes(existingOrder.status)) {
      return errorResponse(`Cannot delete order with status: ${existingOrder.status}`, 400);
    }

    // If order was accepted (committed), decrease committed cost
    if (existingOrder.financialStatus === 'committed') {
      await decreaseCommittedCost(
        existingOrder.projectId.toString(),
        existingOrder.totalCost
      );
    }

    // Soft delete
    await db.collection('purchase_orders').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Create audit log
    await createAuditLog({
      userId: userProfile._id.toString(),
      action: 'DELETED',
      entityType: 'PURCHASE_ORDER',
      entityId: id,
      projectId: existingOrder.projectId.toString(),
      changes: { deleted: existingOrder },
    });

    return successResponse(null, 'Purchase order deleted successfully');
  } catch (error) {
    console.error('Delete purchase order error:', error);
    return errorResponse('Failed to delete purchase order', 500);
  }
}

