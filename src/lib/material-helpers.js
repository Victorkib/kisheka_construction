/**
 * Material Helper Functions
 * Shared functions for material creation and management
 */

import { getDatabase } from '@/lib/mongodb/connection';
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
 * @returns {Promise<Object>} Created material and updated purchase order
 */
export async function createMaterialFromPurchaseOrder({
  purchaseOrderId,
  creatorUserProfile,
  actualQuantityReceived,
  actualUnitCost,
  notes,
  isAutomatic = false,
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
  if (purchaseOrder.status !== 'ready_for_delivery') {
    throw new Error(`Cannot create material from order with status: ${purchaseOrder.status}. Order must be fulfilled first.`);
  }

  // Check if material already created
  if (purchaseOrder.linkedMaterialId) {
    throw new Error('Material has already been created from this purchase order');
  }

  // Get material request
  const materialRequest = await db.collection('material_requests').findOne({
    _id: purchaseOrder.materialRequestId,
  });

  if (!materialRequest) {
    throw new Error('Material request not found');
  }

  // Use actual quantities/costs if provided, otherwise use order values
  // For automatic creation, check if actualQuantityDelivered was stored in purchase order
  let quantityReceived = actualQuantityReceived !== undefined 
    ? parseFloat(actualQuantityReceived) 
    : (purchaseOrder.actualQuantityDelivered !== undefined 
        ? parseFloat(purchaseOrder.actualQuantityDelivered) 
        : purchaseOrder.quantityOrdered);
  
  let unitCost = actualUnitCost !== undefined 
    ? parseFloat(actualUnitCost) 
    : purchaseOrder.unitCost;
  
  const totalCost = calculateTotalCost(quantityReceived, unitCost);

  // Build material document
  const material = {
    projectId: purchaseOrder.projectId,
    ...(purchaseOrder.floorId && { floor: purchaseOrder.floorId }),
    ...(purchaseOrder.categoryId && { categoryId: purchaseOrder.categoryId }),
    ...(purchaseOrder.category && { category: purchaseOrder.category }),
    name: purchaseOrder.materialName,
    description: purchaseOrder.description || '',
    quantityPurchased: quantityReceived,
    quantityDelivered: quantityReceived, // Assume delivered when created from order
    quantityUsed: 0,
    quantityRemaining: quantityReceived,
    wastage: 0,
    unit: purchaseOrder.unit,
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
    notes: notes?.trim() || purchaseOrder.notes || '',
    approvalNotes: '',
    // Dual Workflow fields
    entryType: 'new_procurement',
    isRetroactiveEntry: false,
    materialRequestId: purchaseOrder.materialRequestId,
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

  // Insert material
  const materialResult = await db.collection('materials').insertOne(material);
  const insertedMaterial = { ...material, _id: materialResult.insertedId };

  // Update purchase order
  const orderUpdateData = {
    status: 'delivered',
    linkedMaterialId: materialResult.insertedId,
    fulfilledAt: new Date(),
    financialStatus: 'fulfilled',
    updatedAt: new Date(),
  };

  await db.collection('purchase_orders').updateOne(
    { _id: new ObjectId(purchaseOrderId) },
    { $set: orderUpdateData }
  );

  // Update material request to mark as converted (if not already)
  if (materialRequest.status !== 'converted_to_order' || !materialRequest.linkedPurchaseOrderId) {
    await db.collection('material_requests').updateOne(
      { _id: purchaseOrder.materialRequestId },
      {
        $set: {
          status: 'converted_to_order',
          linkedPurchaseOrderId: new ObjectId(purchaseOrderId),
          updatedAt: new Date(),
        },
      }
    );
  }

  // CRITICAL: Decrease committedCost (order fulfilled, material created)
  await decreaseCommittedCost(
    purchaseOrder.projectId.toString(),
    purchaseOrder.totalCost
  );

  // Trigger financial recalculation
  await recalculateProjectFinances(purchaseOrder.projectId.toString());

  // Create notifications for CLERK
  const clerks = await db.collection('users').find({
    role: { $in: ['clerk', 'site_clerk'] },
    status: 'active',
  }).toArray();

  if (clerks.length > 0) {
    const notifications = clerks.map(clerk => ({
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
      relatedId: materialResult.insertedId.toString(),
      createdBy: creatorUserProfile._id.toString(),
    }));

    await createNotifications(notifications);
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
      material: insertedMaterial,
      committedCostDecreased: purchaseOrder.totalCost,
      isAutomatic,
    },
  });

  const updatedOrder = await db.collection('purchase_orders').findOne({
    _id: new ObjectId(purchaseOrderId),
  });

  return {
    material: insertedMaterial,
    purchaseOrder: updatedOrder,
  };
}

