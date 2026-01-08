/**
 * Bulk Purchase Order Helper Functions
 * Helper functions for creating purchase orders from bulk assignments
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { generatePurchaseOrderNumber } from '@/lib/generators/purchase-order-number-generator';
import { generateResponseToken, getTokenExpirationDate } from '@/lib/generators/response-token-generator';
import { validateCapitalAvailability } from '@/lib/financial-helpers';
import { groupRequestsBySupplier } from './supplier-grouping';

/**
 * Validate bulk PO creation
 * @param {string} batchId - Batch ID
 * @param {Array<Object>} assignments - Array of supplier assignments
 * @returns {Promise<{isValid: boolean, errors: Array<string>}>}
 */
export async function validateBulkPOCreation(batchId, assignments) {
  const errors = [];
  const db = await getDatabase();

  // Validate batch exists and is approved
  const batch = await db.collection('material_request_batches').findOne({
    _id: new ObjectId(batchId),
    deletedAt: null,
  });

  if (!batch) {
    errors.push('Batch not found');
    return { isValid: false, errors };
  }

  if (batch.status !== 'approved') {
    errors.push(`Batch must be approved. Current status: ${batch.status}`);
  }

  // Validate assignments
  if (!Array.isArray(assignments) || assignments.length === 0) {
    errors.push('At least one supplier assignment is required');
    return { isValid: false, errors };
  }

  // Get all material request IDs from assignments
  const allRequestIds = assignments.flatMap((a) => a.materialRequestIds || []).map((id) => new ObjectId(id));

  // Validate all material requests exist, are approved, and belong to batch
  const materialRequests = await db
    .collection('material_requests')
    .find({
      _id: { $in: allRequestIds },
      batchId: new ObjectId(batchId),
      deletedAt: null,
    })
    .toArray();

  if (materialRequests.length !== allRequestIds.length) {
    errors.push('Some material requests not found or do not belong to this batch');
  }

  const unapprovedRequests = materialRequests.filter((req) => req.status !== 'approved');
  if (unapprovedRequests.length > 0) {
    errors.push(`${unapprovedRequests.length} material request(s) are not approved`);
  }

  // Validate suppliers exist and are active
  const supplierIds = assignments.map((a) => new ObjectId(a.supplierId));
  const suppliers = await db
    .collection('suppliers')
    .find({
      _id: { $in: supplierIds },
      status: 'active',
    })
    .toArray();

  if (suppliers.length !== supplierIds.length) {
    errors.push('Some suppliers not found or are not active');
  }

  // Validate delivery dates
  assignments.forEach((assignment, index) => {
    if (!assignment.deliveryDate) {
      errors.push(`Assignment ${index + 1}: Delivery date is required`);
    } else {
      const deliveryDate = new Date(assignment.deliveryDate);
      if (isNaN(deliveryDate.getTime())) {
        errors.push(`Assignment ${index + 1}: Invalid delivery date`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create purchase order from supplier group
 * @param {Object} supplierGroup - Supplier group with material requests
 * @param {string} batchId - Batch ID
 * @param {Object} userProfile - User profile creating the PO
 * @param {Object} options - Options object
 * @param {Object} options.session - MongoDB session for transaction support
 * @param {Object} options.db - Database instance (if provided, uses this instead of getting new one)
 * @returns {Promise<Object>} Created purchase order
 */
export async function createPOFromSupplierGroup(supplierGroup, batchId, userProfile, options = {}) {
  const { session, db: providedDb } = options;
  const db = providedDb || await getDatabase();

  // Get supplier details
  const supplier = await db.collection('suppliers').findOne({
    _id: new ObjectId(supplierGroup.supplierId),
  });

  if (!supplier) {
    throw new Error('Supplier not found');
  }

  // Get material requests
  const materialRequestIds = supplierGroup.materialRequestIds.map((id) => new ObjectId(id));
  const materialRequests = await db
    .collection('material_requests')
    .find({
      _id: { $in: materialRequestIds },
    })
    .toArray();

  if (materialRequests.length === 0) {
    throw new Error('No material requests found');
  }

  // Get batch for project info
  const batch = await db.collection('material_request_batches').findOne({
    _id: new ObjectId(batchId),
  });

  if (!batch) {
    throw new Error('Batch not found');
  }

  // Calculate totals
  let totalCost = 0;
  const materials = materialRequests.map((req) => {
    // Check for override in materialOverrides
    const override = supplierGroup.materialOverrides?.find(
      (o) => o.materialRequestId?.toString() === req._id.toString()
    );

    const unitCost = override?.unitCost !== undefined ? parseFloat(override.unitCost) : parseFloat(req.estimatedUnitCost || 0);
    const quantity = parseFloat(req.quantityNeeded);
    const materialCost = unitCost * quantity;

    totalCost += materialCost;

    return {
      materialRequestId: req._id,
      materialName: req.materialName,
      description: req.description || '',
      quantity: quantity,
      unit: req.unit,
      unitCost: unitCost,
      totalCost: materialCost,
      notes: override?.notes || '',
    };
  });

  // Validate capital availability
  const capitalValidation = await validateCapitalAvailability(batch.projectId.toString(), totalCost);
  
  // Safety check: ensure validation object has expected structure
  if (!capitalValidation || typeof capitalValidation.isValid !== 'boolean') {
    throw new Error('Capital validation failed: Invalid validation response');
  }
  
  if (!capitalValidation.isValid) {
    throw new Error(
      capitalValidation.message || `Insufficient capital available for this purchase order. Available: ${capitalValidation.available?.toLocaleString() || 0}, Required: ${totalCost.toLocaleString()}`
    );
  }

  // Generate PO number (with session support for transaction)
  const purchaseOrderNumber = await generatePurchaseOrderNumber({
    session,
    db: providedDb || db,
  });

  // Generate response token
  const responseToken = generateResponseToken();
  const tokenExpirationDate = getTokenExpirationDate(
    parseInt(process.env.PO_RESPONSE_TOKEN_EXPIRY_DAYS || '7', 10)
  );

  // Build purchase order document
  // For bulk orders, we store multiple material requests
  const purchaseOrder = {
    purchaseOrderNumber,
    // Support both single and multiple material requests
    materialRequestId: materialRequestIds[0], // First one for backward compatibility
    materialRequestIds: materialRequestIds, // Array for bulk orders
    batchId: new ObjectId(batchId),
    batchNumber: batch.batchNumber,
    isBulkOrder: true,
    supplierId: new ObjectId(supplierGroup.supplierId),
    supplierName: supplier.name,
    supplierEmail: supplier.email,
    supplierPhone: supplier.phone,
    projectId: batch.projectId,
    // Phase Management: Inherit phaseId from first material request (bulk orders typically have same phase)
    ...(materialRequests[0].phaseId && ObjectId.isValid(materialRequests[0].phaseId) && { 
      phaseId: typeof materialRequests[0].phaseId === 'string' 
        ? new ObjectId(materialRequests[0].phaseId) 
        : materialRequests[0].phaseId 
    }),
    // Use first material request's common fields (they should be similar for batch)
    ...(materialRequests[0].floorId && { floorId: materialRequests[0].floorId }),
    ...(materialRequests[0].categoryId && { categoryId: materialRequests[0].categoryId }),
    ...(materialRequests[0].category && { category: materialRequests[0].category }),
    // For bulk orders, material name is a summary
    materialName: materialRequests.length === 1 ? materialRequests[0].materialName : `${materialRequests.length} Materials`,
    description: materialRequests.map((r) => r.materialName).join(', '),
    // Store materials array for bulk orders
    materials: materials,
    // Total quantities and costs
    quantityOrdered: materials.reduce((sum, m) => sum + m.quantity, 0),
    unit: 'mixed', // Multiple units in bulk order
    unitCost: 0, // Not applicable for bulk
    totalCost: totalCost,
    deliveryDate: new Date(supplierGroup.deliveryDate),
    terms: supplierGroup.terms || '',
    notes: supplierGroup.notes || '',
    status: 'order_sent',
    sentAt: new Date(),
    financialStatus: 'not_committed',
    responseToken,
    responseTokenExpiresAt: tokenExpirationDate,
    responseTokenGeneratedAt: new Date(),
    communications: [],
    autoConfirmed: false,
    autoConfirmedAt: null,
    autoConfirmationMethod: null,
    // Material-level response tracking for bulk orders
    supportsPartialResponse: true, // Bulk orders support partial responses
    materialResponses: [], // Initialize empty - will be populated when supplier responds
    createdBy: new ObjectId(userProfile._id),
    createdByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  // Insert purchase order (with session if provided for transaction)
  const insertOptions = session ? { session } : {};
  const result = await db.collection('purchase_orders').insertOne(purchaseOrder, insertOptions);

  // Update material request statuses (with session if provided for transaction)
  // Only update requests that are not already converted to prevent overwriting
  const updateOptions = session ? { session } : {};
  await db.collection('material_requests').updateMany(
    { 
      _id: { $in: materialRequestIds },
      status: { $ne: 'converted_to_order' }, // Only update if not already converted
    },
    {
      $set: {
        status: 'converted_to_order',
        linkedPurchaseOrderId: result.insertedId, // Link to PO
        updatedAt: new Date(),
      },
    },
    updateOptions
  );

  return {
    ...purchaseOrder,
    _id: result.insertedId,
  };
}

/**
 * Group material requests by supplier for PO creation
 * @param {Array<Object>} assignments - Array of assignment objects
 * @returns {Object} Grouped assignments by supplier
 */
export { groupRequestsBySupplier };

