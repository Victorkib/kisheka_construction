/**
 * Material Helper Functions
 * Shared functions for material creation and management
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';
import { calculateTotalCost } from '@/lib/calculations';
import { decreaseCommittedCost, recalculateProjectFinances } from '@/lib/financial-helpers';
import { recalculatePhaseSpending } from '@/lib/phase-helpers';
import { createNotifications } from '@/lib/notifications';
import { createAuditLog } from '@/lib/audit-log';
import { updateSupplierPerformance } from '@/lib/supplier-performance';
import { MATERIAL_APPROVED_STATUSES } from '@/lib/status-constants';
import { ObjectId } from 'mongodb';

/**
 * Create material entry from fulfilled purchase order
 * This function is used both for automatic creation (when supplier fulfills) and manual creation (by PM/OWNER)
 * 
 * IMPORTANT: All materials created from purchase orders are automatically approved.
 * This ensures immediate financial state accuracy and eliminates gaps between creation and approval.
 * Since only Owner/PM interact with the system for this workflow, auto-approval is appropriate.
 * 
 * @param {Object} params - Parameters for material creation
 * @param {string} params.purchaseOrderId - Purchase order ID
 * @param {Object} params.creatorUserProfile - User profile of the creator (PM/OWNER who created the PO, or PM/OWNER manually creating)
 * @param {number} [params.actualQuantityReceived] - Actual quantity received (if different from ordered)
 * @param {number} [params.actualUnitCost] - Actual unit cost (if different from ordered)
 * @param {string} [params.notes] - Additional notes
 * @param {boolean} [params.isAutomatic] - Whether this is automatic creation (from fulfill) or manual
 * @param {boolean} [params.allowFromAccepted] - DEPRECATED: Always true now. Kept for backward compatibility.
 * @returns {Promise<Object>} Created material and updated purchase order
 */
export async function createMaterialFromPurchaseOrder({
  purchaseOrderId,
  creatorUserProfile,
  actualQuantityReceived,
  actualUnitCost,
  materialQuantities, // Map of materialRequestId -> quantity for bulk orders
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
  // Both statuses are allowed since materials from POs are always auto-approved
  const allowedStatuses = ['ready_for_delivery', 'order_accepted'];
  
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
        // Try multiple matching strategies for robustness
        // Strategy 1: Direct ID match (normalize both to strings)
        materialData = purchaseOrder.materials.find((m) => {
          if (!m.materialRequestId || !materialRequest._id) return false;
          
          // Normalize both IDs to strings for comparison
          const mRequestId = m.materialRequestId.toString();
          const requestId = materialRequest._id.toString();
          
          return mRequestId === requestId;
        });
        
        // Strategy 2: If not found by ID, try name-based match (fallback)
        if (!materialData) {
          const requestName = (materialRequest.materialName || '').toLowerCase().trim();
          if (requestName) {
            materialData = purchaseOrder.materials.find((m) => {
              const mName = (m.materialName || m.name || '').toLowerCase().trim();
              return mName && mName === requestName;
            });
          }
        }
        
        // Strategy 3: If still not found and arrays match in length, use index (last resort)
        if (!materialData && materialRequests.length === purchaseOrder.materials.length) {
          const index = materialRequests.findIndex(r => 
            r._id.toString() === materialRequest._id.toString()
          );
          if (index >= 0 && index < purchaseOrder.materials.length) {
            materialData = purchaseOrder.materials[index];
            console.warn(`[createMaterialFromPurchaseOrder] Using index-based match for material ${materialRequest.materialName} (index ${index})`);
          }
        }
        
        // Log error and throw if materialData not found for bulk orders
        if (purchaseOrder.isBulkOrder && !materialData) {
          console.error(`[createMaterialFromPurchaseOrder] CRITICAL: Material data not found for request ${materialRequest._id} (${materialRequest.materialName}) in bulk PO ${purchaseOrderId}`);
          console.error(`[createMaterialFromPurchaseOrder] Available materials in PO:`, purchaseOrder.materials?.map(m => ({
            materialRequestId: m.materialRequestId?.toString(),
            materialName: m.materialName || m.name,
            quantity: m.quantity,
            unitCost: m.unitCost
          })));
          throw new Error(`Cannot find material data for "${materialRequest.materialName}" in purchase order ${purchaseOrder.purchaseOrderNumber}. Material data is required for bulk orders.`);
        }
      }

      // Use actual quantities/costs if provided, otherwise use order values
      // Priority for BULK orders: materialQuantities (per-material) > materialData.quantity (ALWAYS) > error
      // Priority for SINGLE orders: materialQuantities > actualQuantityReceived > PO > materialRequest
      let quantityReceived;
      if (materialQuantities && materialQuantities[materialRequest._id.toString()] !== undefined) {
        // Per-material quantity specified (for bulk orders)
        quantityReceived = parseFloat(materialQuantities[materialRequest._id.toString()]);
        if (isNaN(quantityReceived) || quantityReceived <= 0) {
          throw new Error(`Invalid quantity specified for material ${materialRequest.materialName}: ${materialQuantities[materialRequest._id.toString()]}`);
        }
      } else if (purchaseOrder.isBulkOrder) {
        // For bulk orders, ALWAYS use materialData.quantity (NEVER use actualQuantityReceived)
        // This ensures each material gets its correct individual quantity, not the total
        if (materialData && materialData.quantity !== undefined && materialData.quantity !== null) {
          // Use quantity from PO's materials array (REQUIRED for bulk orders)
          // Note: Check for undefined/null, not falsy (0 is valid)
          quantityReceived = parseFloat(materialData.quantity);
          if (isNaN(quantityReceived) || quantityReceived <= 0) {
            throw new Error(`Invalid quantity in PO materials array for ${materialRequest.materialName}: ${materialData.quantity}`);
          }
        } else {
          // For bulk orders, we MUST have materialData with quantity - throw error
          throw new Error(`Cannot determine quantity for bulk order material "${materialRequest.materialName}". Material data not found in PO materials array or quantity is missing.`);
        }
      } else if (actualQuantityReceived !== undefined && actualQuantityReceived !== null) {
        // Single order: Use actualQuantityReceived if provided
        quantityReceived = parseFloat(actualQuantityReceived);
        if (isNaN(quantityReceived) || quantityReceived <= 0) {
          throw new Error(`Invalid actualQuantityReceived: ${actualQuantityReceived}`);
        }
      } else if (purchaseOrder.actualQuantityDelivered !== undefined && purchaseOrder.actualQuantityDelivered !== null) {
        // Single order: Use quantity from PO
        quantityReceived = parseFloat(purchaseOrder.actualQuantityDelivered);
        if (isNaN(quantityReceived) || quantityReceived <= 0) {
          throw new Error(`Invalid actualQuantityDelivered in PO: ${purchaseOrder.actualQuantityDelivered}`);
        }
      } else if (purchaseOrder.quantityOrdered !== undefined && purchaseOrder.quantityOrdered !== null) {
        // Single order: Use PO ordered quantity
        quantityReceived = parseFloat(purchaseOrder.quantityOrdered);
        if (isNaN(quantityReceived) || quantityReceived <= 0) {
          throw new Error(`Invalid quantityOrdered in PO: ${purchaseOrder.quantityOrdered}`);
        }
      } else {
        // Last resort: material request quantity (should rarely happen, only for edge cases)
        quantityReceived = parseFloat(materialRequest.quantityNeeded);
        if (isNaN(quantityReceived) || quantityReceived <= 0) {
          throw new Error(`Invalid quantityNeeded in material request: ${materialRequest.quantityNeeded}`);
        }
        console.warn(`[createMaterialFromPurchaseOrder] WARNING: Using material request quantity as fallback for ${materialRequest.materialName}: ${quantityReceived}. This should not happen for bulk orders.`);
      }

      // Unit cost priority: actualUnitCost > materialData.unitCost > PO unitCost > materialRequest.estimatedUnitCost
      let unitCost;
      if (actualUnitCost !== undefined && actualUnitCost !== null) {
        unitCost = parseFloat(actualUnitCost);
        if (isNaN(unitCost) || unitCost < 0) {
          throw new Error(`Invalid actualUnitCost: ${actualUnitCost}`);
        }
      } else if (materialData && materialData.unitCost !== undefined && materialData.unitCost !== null) {
        // Use unit cost from PO's materials array (PREFERRED for bulk orders)
        // Note: 0 is a valid cost, so we check for undefined/null, not falsy
        unitCost = parseFloat(materialData.unitCost);
        if (isNaN(unitCost) || unitCost < 0) {
          throw new Error(`Invalid unitCost in PO materials array for ${materialRequest.materialName}: ${materialData.unitCost}`);
        }
      } else if (purchaseOrder.isBulkOrder) {
        // For bulk orders, we MUST have materialData with unitCost - throw error
        throw new Error(`Cannot determine unit cost for bulk order material "${materialRequest.materialName}". Material data not found in PO materials array or unitCost is missing.`);
      } else if (purchaseOrder.unitCost !== undefined && purchaseOrder.unitCost !== null) {
        // Use PO-level unit cost (single orders)
        unitCost = parseFloat(purchaseOrder.unitCost);
        if (isNaN(unitCost) || unitCost < 0) {
          throw new Error(`Invalid unitCost in PO: ${purchaseOrder.unitCost}`);
        }
      } else {
        // Last resort: material request estimated cost (should rarely happen)
        unitCost = parseFloat(materialRequest.estimatedUnitCost || 0);
        if (isNaN(unitCost) || unitCost < 0) {
          unitCost = 0; // Default to 0 if invalid
        }
        console.warn(`[createMaterialFromPurchaseOrder] WARNING: Using material request estimatedUnitCost as fallback for ${materialRequest.materialName}: ${unitCost}. This should not happen for bulk orders.`);
      }

      const totalCost = calculateTotalCost(quantityReceived, unitCost);

      // ALWAYS auto-approve materials created from purchase orders
      // This ensures immediate financial state accuracy and eliminates gaps between creation and approval.
      // Since only Owner/PM interact with the system for this workflow, auto-approval is appropriate.
      const shouldAutoApprove = true; // Always true for materials created from POs
      const initialStatus = 'approved'; // Always approved when created from PO
      
      // Build approval chain entry (always created for materials from POs)
      const approvalChain = [{
        approverId: new ObjectId(creatorUserProfile._id),
        approverName: `${creatorUserProfile.firstName || ''} ${creatorUserProfile.lastName || ''}`.trim() || creatorUserProfile.email,
        status: 'approved',
        notes: 'Auto-approved upon creation from purchase order',
        approvedAt: new Date(),
      }];

      // Phase Management: Inherit phaseId from material request, or fallback to purchase order
      // Priority: materialRequest.phaseId > purchaseOrder.phaseId
      let phaseId = materialRequest.phaseId || purchaseOrder.phaseId;
      if (phaseId) {
        // Ensure phaseId is ObjectId format
        phaseId = typeof phaseId === 'string' ? new ObjectId(phaseId) : phaseId;
      }

      // Build material document
      const material = {
        projectId: purchaseOrder.projectId,
        ...(materialRequest.floorId && { floor: materialRequest.floorId }),
        ...(materialRequest.categoryId && { categoryId: materialRequest.categoryId }),
        ...(materialRequest.category && { category: materialRequest.category }),
        ...(phaseId && { phaseId }),
        name: materialRequest.materialName,
        description: materialRequest.description || materialData?.description || '',
        quantityPurchased: quantityReceived,
        quantityDelivered: quantityReceived, // Assume delivered when created from order
        quantityUsed: 0,
        quantityRemaining: quantityReceived,
        wastage: 0,
        // Use unit from materialData for bulk orders, otherwise from materialRequest
        unit: (purchaseOrder.isBulkOrder && materialData && materialData.unit) 
          ? materialData.unit 
          : materialRequest.unit,
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
        status: initialStatus, // Always 'approved' when created from PO
        submittedBy: {
          userId: new ObjectId(creatorUserProfile._id),
          name: `${creatorUserProfile.firstName || ''} ${creatorUserProfile.lastName || ''}`.trim() || creatorUserProfile.email,
          email: creatorUserProfile.email,
        },
        enteredBy: new ObjectId(creatorUserProfile._id),
        receivedBy: new ObjectId(creatorUserProfile._id), // Always set for materials from POs
        approvedBy: new ObjectId(creatorUserProfile._id), // Always set for materials from POs
        verifiedBy: null,
        approvalChain: approvalChain, // Always created for materials from POs
        notes: notes?.trim() || materialData?.notes || materialRequest.notes || purchaseOrder.notes || '',
        approvalNotes: 'Auto-approved upon creation from purchase order',
        // Dual Workflow fields
        entryType: 'new_procurement',
        isRetroactiveEntry: false,
        materialRequestId: materialRequest._id,
        purchaseOrderId: new ObjectId(purchaseOrderId),
        linkedPurchaseOrderId: new ObjectId(purchaseOrderId), // For duplicate checking (both single and bulk orders)
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

      // 1a. Create approval record in approvals collection (atomic)
      // Always created for materials from POs to maintain audit trail
      await db.collection('approvals').insertOne({
        relatedId: materialResult.insertedId,
        relatedModel: 'MATERIAL',
        action: 'APPROVED',
        approvedBy: new ObjectId(creatorUserProfile._id),
        reason: 'Auto-approved upon creation from purchase order',
        timestamp: new Date(),
        previousStatus: 'pending_receipt', // Historical: materials from POs are created as approved
        newStatus: 'approved',
        createdAt: new Date(),
      }, { session });

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

  // Recalculate phase spending for materials with phaseId
  try {
    const phaseIds = new Set();
    createdMaterials.forEach((material) => {
      if (material.phaseId && ObjectId.isValid(material.phaseId)) {
        phaseIds.add(material.phaseId.toString());
      }
    });

    // Recalculate spending for each unique phase
    await Promise.all(
      Array.from(phaseIds).map((phaseId) =>
        recalculatePhaseSpending(phaseId).catch((error) => {
          console.error(`[createMaterialFromPurchaseOrder] Phase recalculation failed for phase ${phaseId}:`, error);
          // Don't fail the request - phase recalculation can be done later
        })
      )
    );
  } catch (phaseRecalcError) {
    console.error('[createMaterialFromPurchaseOrder] Phase recalculation error:', phaseRecalcError);
    // Don't fail the request - phase recalculation can be done later
  }

  // Recalculate floor spending for materials with floorId
  try {
    const floorIds = new Set();
    createdMaterials.forEach((material) => {
      if (material.floor && ObjectId.isValid(material.floor)) {
        floorIds.add(material.floor.toString());
      }
    });

    // Recalculate spending for each unique floor
    await Promise.all(
      Array.from(floorIds).map((floorId) =>
        recalculateFloorSpending(floorId).catch((error) => {
          console.error(`[createMaterialFromPurchaseOrder] Floor recalculation failed for floor ${floorId}:`, error);
          // Don't fail the request - floor recalculation can be done later
        })
      )
    );
  } catch (floorRecalcError) {
    console.error('[createMaterialFromPurchaseOrder] Floor recalculation error:', floorRecalcError);
    // Don't fail the request - floor recalculation can be done later
  }

  // Update material request batch status if materials are from a batch
  try {
    const batchIds = new Set();
    for (const materialRequest of materialRequests) {
      if (materialRequest.batchId && ObjectId.isValid(materialRequest.batchId)) {
        batchIds.add(materialRequest.batchId.toString());
      }
    }

    // Update batch status for each unique batch
    await Promise.all(
      Array.from(batchIds).map((batchId) =>
        updateBatchStatusAfterMaterialCreation(batchId).catch((error) => {
          console.error(`[createMaterialFromPurchaseOrder] Batch status update failed for batch ${batchId}:`, error);
          // Don't fail the request - batch update can be done later
        })
      )
    );
  } catch (batchUpdateError) {
    console.error('[createMaterialFromPurchaseOrder] Batch status update error:', batchUpdateError);
    // Don't fail the request - batch update can be done later
  }

  // Update supplier performance metrics
  if (purchaseOrder.supplierId && ObjectId.isValid(purchaseOrder.supplierId)) {
    try {
      await updateSupplierPerformance(purchaseOrder.supplierId.toString()).catch((error) => {
        console.error(`[createMaterialFromPurchaseOrder] Supplier performance update failed for supplier ${purchaseOrder.supplierId}:`, error);
        // Don't fail the request - supplier performance update can be done later
      });
    } catch (supplierPerfError) {
      console.error('[createMaterialFromPurchaseOrder] Supplier performance update error:', supplierPerfError);
      // Don't fail the request - supplier performance update can be done later
    }
  }

  // Create notifications for CLERK
  // Note: Materials from POs are auto-approved, but clerks are still notified for record-keeping
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
            ? 'Material Entry Automatically Created and Approved'
            : 'New Material Entry Created and Approved',
          message: isAutomatic
            ? `Material entry automatically created and approved from purchase order ${purchaseOrder.purchaseOrderNumber}.`
            : `Material entry created and approved from purchase order ${purchaseOrder.purchaseOrderNumber}.`,
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
            ? 'Bulk Materials Automatically Created and Approved'
            : 'New Bulk Materials Created and Approved',
          message: isAutomatic
            ? `${createdMaterials.length} material entries automatically created and approved from bulk purchase order ${purchaseOrder.purchaseOrderNumber}.`
            : `${createdMaterials.length} material entries created and approved from bulk purchase order ${purchaseOrder.purchaseOrderNumber}.`,
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

  // Convert materialIds to strings for API response
  const materialIdsAsStrings = materialIds.map(id => id.toString());

  return {
    materials: createdMaterials,           // Backward compatibility
    material: createdMaterials.length > 0 ? createdMaterials[0] : null, // Backward compatibility
    createdMaterials: createdMaterials,     // New: for confirm-delivery route and other callers
    materialIds: materialIdsAsStrings,     // New: for confirm-delivery route and other callers
    purchaseOrder: updatedOrder,
  };
}

/**
 * Recalculate floor spending when material/expense is created/updated/deleted
 * @param {string} floorId - Floor ID
 * @returns {Promise<Object>} Updated floor
 */
export async function recalculateFloorSpending(floorId) {
  const db = await getDatabase();
  
  // Get floor
  const floor = await db.collection('floors').findOne({
    _id: new ObjectId(floorId),
  });
  
  if (!floor) {
    throw new Error('Floor not found');
  }
  
  // Calculate actual spending from materials (approved only)
  const materialsSpending = await db.collection('materials').aggregate([
    {
      $match: {
        floor: new ObjectId(floorId),
        deletedAt: null,
        status: { $in: MATERIAL_APPROVED_STATUSES }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalCost' }
      }
    }
  ]).toArray();
  
  // Calculate actual spending from expenses (approved only)
  const expensesSpending = await db.collection('expenses').aggregate([
    {
      $match: {
        floor: new ObjectId(floorId),
        deletedAt: null,
        status: { $in: ['APPROVED', 'PAID'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]).toArray();
  
  const actualCost = (materialsSpending[0]?.total || 0) + (expensesSpending[0]?.total || 0);
  
  // Update floor with actual cost
  const updatedFloor = await db.collection('floors').findOneAndUpdate(
    { _id: new ObjectId(floorId) },
    {
      $set: {
        actualCost: actualCost,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );
  
  return updatedFloor;
}

/**
 * Update material request batch status after materials are created
 * Checks if all material requests in batch have been converted to materials
 * @param {string} batchId - Batch ID
 * @returns {Promise<Object>} Updated batch
 */
export async function updateBatchStatusAfterMaterialCreation(batchId) {
  const db = await getDatabase();
  
  // Get batch
  const batch = await db.collection('material_request_batches').findOne({
    _id: new ObjectId(batchId),
    deletedAt: null
  });
  
  if (!batch) {
    throw new Error('Batch not found');
  }
  
  if (!batch.materialRequestIds || batch.materialRequestIds.length === 0) {
    return batch; // No requests in batch, nothing to update
  }
  
  // Count how many material requests have been converted to materials
  const convertedCount = await db.collection('material_requests').countDocuments({
    _id: { $in: batch.materialRequestIds.map(id => new ObjectId(id)) },
    status: 'converted_to_material',
    deletedAt: null
  });
  
  const totalRequests = batch.materialRequestIds.length;
  
  // Calculate actual cost from materials created from this batch
  const actualCostResult = await db.collection('materials').aggregate([
    {
      $match: {
        materialRequestId: { $in: batch.materialRequestIds.map(id => new ObjectId(id)) },
        deletedAt: null,
        status: { $in: MATERIAL_APPROVED_STATUSES }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalCost' }
      }
    }
  ]).toArray();
  
  const totalActualCost = actualCostResult[0]?.total || 0;
  
  // Determine new batch status
  let newStatus = batch.status;
  if (convertedCount === totalRequests && totalRequests > 0) {
    // All requests converted - batch is fully fulfilled
    newStatus = 'fully_fulfilled';
  } else if (convertedCount > 0) {
    // Some requests converted - batch is partially fulfilled
    newStatus = 'partially_fulfilled';
  }
  
  // Update batch
  const updateData = {
    updatedAt: new Date(),
    ...(newStatus !== batch.status && { status: newStatus }),
    totalActualCost: totalActualCost,
    convertedRequestCount: convertedCount,
    totalRequestCount: totalRequests,
  };
  
  const updatedBatch = await db.collection('material_request_batches').findOneAndUpdate(
    { _id: new ObjectId(batchId) },
    { $set: updateData },
    { returnDocument: 'after' }
  );
  
  return updatedBatch;
}


