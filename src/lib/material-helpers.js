/**
 * Material Helper Functions
 * Shared functions for material creation and management
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';
import { calculateTotalCost } from '@/lib/calculations';
import { decreaseCommittedCost, recalculateProjectFinances } from '@/lib/financial-helpers';
import { createNotifications } from '@/lib/notifications';
import { createAuditLog } from '@/lib/audit-log';
import { ObjectId } from 'mongodb';

/**
 * Create material entry from fulfilled purchase order
 * This function is used both for automatic creation (when supplier fulfills) and manual creation (by PM/OWNER)
 * 
 * @param {Object} params - Parameters for material creation
 * @param {string} params.purchaseOrderId - Purchase order ID
 * @param {Object} params.creatorUserProfile - User profile of the creator (PM/OWNER who created the PO, or PM/OWNER manually creating)
 * @param {number} [params.actualQuantityReceived] - Actual quantity received (if different from ordered)
 * @param {number} [params.actualUnitCost] - Actual unit cost (if different from ordered)
 * @param {string} [params.notes] - Additional notes
 * @param {boolean} [params.isAutomatic] - Whether this is automatic creation (from fulfill) or manual
 * @param {boolean} [params.allowFromAccepted] - Allow creation from 'order_accepted' status (for Owner/PM delivery confirmation)
 * @returns {Promise<Object>} Created material and updated purchase order
 */
export async function createMaterialFromPurchaseOrder({
  purchaseOrderId,
  creatorUserProfile,
  actualQuantityReceived,
  actualUnitCost,
  notes,
  isAutomatic = false,
  allowFromAccepted = false,
}) {
  const db = await getDatabase();

  // Get existing order
  const purchaseOrder = await db.collection('purchase_orders').findOne({
    _id: new ObjectId(purchaseOrderId),
    deletedAt: null,
  });

  if (!purchaseOrder) {
    throw new Error('Purchase order not found');
  }

  // Check if status allows material creation
  // Allow 'ready_for_delivery' (normal flow) or 'order_accepted' (when Owner/PM confirms delivery)
  const allowedStatuses = allowFromAccepted 
    ? ['ready_for_delivery', 'order_accepted']
    : ['ready_for_delivery'];
  
  if (!allowedStatuses.includes(purchaseOrder.status)) {
    throw new Error(`Cannot create material from order with status: ${purchaseOrder.status}. Order must be fulfilled first or delivery must be confirmed.`);
  }

  // Check if materials already created (for bulk orders, check if any materials exist)
  if (purchaseOrder.isBulkOrder && purchaseOrder.materialRequestIds) {
    const existingMaterials = await db.collection('materials').countDocuments({
      linkedPurchaseOrderId: new ObjectId(purchaseOrderId),
      deletedAt: null,
    });
    if (existingMaterials > 0) {
      throw new Error('Materials have already been created from this bulk purchase order');
    }
  } else if (purchaseOrder.linkedMaterialId) {
    throw new Error('Material has already been created from this purchase order');
  }

  // Get material requests
  let materialRequests = [];
  if (purchaseOrder.isBulkOrder && purchaseOrder.materialRequestIds && Array.isArray(purchaseOrder.materialRequestIds)) {
    // Bulk order - get all material requests
    materialRequests = await db
      .collection('material_requests')
      .find({
        _id: { $in: purchaseOrder.materialRequestIds.map((id) => new ObjectId(id)) },
      })
      .toArray();
  } else if (purchaseOrder.materialRequestId) {
    // Single material order
    const materialRequest = await db.collection('material_requests').findOne({
      _id: purchaseOrder.materialRequestId,
    });
    if (materialRequest) {
      materialRequests = [materialRequest];
    }
  }

  if (materialRequests.length === 0) {
    throw new Error('Material request(s) not found');
  }

  // CRITICAL: Wrap all critical operations in transaction for atomicity
  // This ensures material creation, status updates, and financial updates happen together or not at all
  console.log('[createMaterialFromPurchaseOrder] Starting transaction for atomic operations');

  const transactionResult = await withTransaction(async ({ db, session }) => {
    // For bulk orders, create a material entry for each material request
    // For single orders, create one material entry
    const createdMaterials = [];
    const materialIds = [];

    for (const materialRequest of materialRequests) {
      // Get material details from PO's materials array if available, otherwise use PO-level data
      let materialData = null;
      if (purchaseOrder.materials && Array.isArray(purchaseOrder.materials)) {
        materialData = purchaseOrder.materials.find(
          (m) => m.materialRequestId?.toString() === materialRequest._id.toString()
        );
      }

      // Use actual quantities/costs if provided, otherwise use order values
      let quantityReceived = actualQuantityReceived !== undefined
        ? parseFloat(actualQuantityReceived)
        : materialData
        ? materialData.quantity || materialRequest.quantityNeeded
        : purchaseOrder.actualQuantityDelivered !== undefined
        ? parseFloat(purchaseOrder.actualQuantityDelivered)
        : materialRequest.quantityNeeded;

      let unitCost = actualUnitCost !== undefined
        ? parseFloat(actualUnitCost)
        : materialData
        ? materialData.unitCost
        : purchaseOrder.unitCost || materialRequest.estimatedUnitCost || 0;

      const totalCost = calculateTotalCost(quantityReceived, unitCost);

      // Build material document
      const material = {
        projectId: purchaseOrder.projectId,
        ...(materialRequest.floorId && { floor: materialRequest.floorId }),
        ...(materialRequest.categoryId && { categoryId: materialRequest.categoryId }),
        ...(materialRequest.category && { category: materialRequest.category }),
        name: materialRequest.materialName,
        description: materialRequest.description || materialData?.description || '',
        quantityPurchased: quantityReceived,
        quantityDelivered: quantityReceived, // Assume delivered when created from order
        quantityUsed: 0,
        quantityRemaining: quantityReceived,
        wastage: 0,
        unit: materialRequest.unit,
        unitCost: unitCost,
        totalCost: totalCost,
        supplierName: purchaseOrder.supplierName,
        paymentMethod: 'PENDING', // Will be updated when payment is made
        invoiceNumber: '',
        invoiceDate: null,
        datePurchased: purchaseOrder.deliveryDate || new Date(),
        dateDelivered: new Date(),
        dateUsed: null,
        receiptFileUrl: purchaseOrder.deliveryNoteFileUrl || null,
        invoiceFileUrl: null,
        deliveryNoteFileUrl: purchaseOrder.deliveryNoteFileUrl || null,
        receiptUploadedAt: purchaseOrder.deliveryNoteFileUrl ? new Date() : null,
        status: 'pending_receipt', // Will be updated to 'received' or 'in_use' when approved
        submittedBy: {
          userId: new ObjectId(creatorUserProfile._id),
          name: `${creatorUserProfile.firstName || ''} ${creatorUserProfile.lastName || ''}`.trim() || creatorUserProfile.email,
          email: creatorUserProfile.email,
        },
        enteredBy: new ObjectId(creatorUserProfile._id),
        receivedBy: null,
        approvedBy: null,
        verifiedBy: null,
        approvalChain: [],
        notes: notes?.trim() || materialData?.notes || materialRequest.notes || purchaseOrder.notes || '',
        approvalNotes: '',
        // Dual Workflow fields
        entryType: 'new_procurement',
        isRetroactiveEntry: false,
        materialRequestId: materialRequest._id,
        purchaseOrderId: new ObjectId(purchaseOrderId),
        orderFulfillmentDate: new Date(),
        retroactiveNotes: null,
        originalPurchaseDate: null,
        documentationStatus: purchaseOrder.deliveryNoteFileUrl ? 'complete' : 'partial',
        costStatus: 'actual',
        costVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // 1. Insert material (atomic)
      const materialResult = await db.collection('materials').insertOne(material, { session });
      const insertedMaterial = { ...material, _id: materialResult.insertedId };
      createdMaterials.push(insertedMaterial);
      materialIds.push(materialResult.insertedId);

      // 2. Update material request status (atomic with material insertion)
      await db.collection('material_requests').updateOne(
        { _id: materialRequest._id },
        {
          $set: {
            status: 'converted_to_material',
            updatedAt: new Date(),
          },
        },
        { session }
      );
    }

    // 3. Update purchase order (atomic with above)
    // If coming from 'order_accepted' status, this is a delivery confirmation
    // If coming from 'ready_for_delivery', this is normal fulfillment
    const orderUpdateData = {
      status: 'delivered',
      fulfilledAt: new Date(),
      financialStatus: 'fulfilled',
      updatedAt: new Date(),
      // If confirming delivery from 'order_accepted', mark as confirmed by Owner/PM
      ...(purchaseOrder.status === 'order_accepted' && {
        deliveryConfirmedBy: creatorUserProfile._id,
        deliveryConfirmedAt: new Date(),
        deliveryConfirmationMethod: 'owner_pm_manual',
      }),
    };

    // For single orders, set linkedMaterialId for backward compatibility
    if (!purchaseOrder.isBulkOrder && createdMaterials.length > 0) {
      orderUpdateData.linkedMaterialId = createdMaterials[0]._id;
    }

    await db.collection('purchase_orders').updateOne(
      { _id: new ObjectId(purchaseOrderId) },
      { $set: orderUpdateData },
      { session }
    );

    // 4. Decrease committedCost (atomic with above)
    await decreaseCommittedCost(
      purchaseOrder.projectId.toString(),
      purchaseOrder.totalCost,
      session
    );

    return { createdMaterials, materialIds };
  });

  console.log('[createMaterialFromPurchaseOrder] Transaction completed successfully');

  const { createdMaterials, materialIds } = transactionResult;

  // Non-critical operations (can fail without affecting core data)
  // Trigger financial recalculation (read-heavy, can happen outside transaction)
  try {
    await recalculateProjectFinances(purchaseOrder.projectId.toString());
  } catch (recalcError) {
    console.error('[createMaterialFromPurchaseOrder] Financial recalculation failed (non-critical):', recalcError);
    // Don't fail the request - recalculation can be done later
  }

  // Create notifications for CLERK
  const clerks = await db.collection('users').find({
    role: { $in: ['clerk', 'site_clerk'] },
    status: 'active',
  }).toArray();

  if (clerks.length > 0) {
    const notifications = [];
    clerks.forEach((clerk) => {
      if (createdMaterials.length === 1) {
        // Single material notification
        notifications.push({
          userId: clerk._id.toString(),
          type: 'item_received',
          title: isAutomatic
            ? 'Material Entry Automatically Created'
            : 'New Material Entry Created',
          message: isAutomatic
            ? `Material entry automatically created from purchase order ${purchaseOrder.purchaseOrderNumber}. Please verify and approve.`
            : `Material entry created from purchase order ${purchaseOrder.purchaseOrderNumber}. Please verify and approve.`,
          projectId: purchaseOrder.projectId.toString(),
          relatedModel: 'MATERIAL',
          relatedId: createdMaterials[0]._id.toString(),
          createdBy: creatorUserProfile._id.toString(),
        });
      } else {
        // Bulk order notification
        notifications.push({
          userId: clerk._id.toString(),
          type: 'bulk_materials_created',
          title: isAutomatic
            ? 'Bulk Materials Automatically Created'
            : 'New Bulk Materials Created',
          message: isAutomatic
            ? `${createdMaterials.length} material entries automatically created from bulk purchase order ${purchaseOrder.purchaseOrderNumber}. Please verify and approve.`
            : `${createdMaterials.length} material entries created from bulk purchase order ${purchaseOrder.purchaseOrderNumber}. Please verify and approve.`,
          projectId: purchaseOrder.projectId.toString(),
          relatedModel: 'PURCHASE_ORDER',
          relatedId: purchaseOrderId,
          createdBy: creatorUserProfile._id.toString(),
        });
      }
    });

    if (notifications.length > 0) {
      await createNotifications(notifications);
    }
  }

  // Create audit log
  await createAuditLog({
    userId: creatorUserProfile._id.toString(),
    action: isAutomatic ? 'AUTO_CREATED_MATERIAL_FROM_ORDER' : 'CREATED_MATERIAL_FROM_ORDER',
    entityType: 'PURCHASE_ORDER',
    entityId: purchaseOrderId,
    projectId: purchaseOrder.projectId.toString(),
    changes: {
      purchaseOrder: purchaseOrder,
      materials: createdMaterials.map((m) => ({
        _id: m._id.toString(),
        name: m.name,
        quantity: m.quantityPurchased,
        totalCost: m.totalCost,
      })),
      materialCount: createdMaterials.length,
      committedCostDecreased: purchaseOrder.totalCost,
      isAutomatic,
      isBulkOrder: purchaseOrder.isBulkOrder || false,
    },
  });

  const updatedOrder = await db.collection('purchase_orders').findOne({
    _id: new ObjectId(purchaseOrderId),
  });

  return {
    materials: createdMaterials,
    material: createdMaterials.length > 0 ? createdMaterials[0] : null, // For backward compatibility
    purchaseOrder: updatedOrder,
  };
}


