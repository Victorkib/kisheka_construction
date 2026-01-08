/**
 * Batch Helper Functions
 * Utility functions for material request batch operations
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { generateBatchNumber } from '@/lib/generators/batch-number-generator';
import { generateRequestNumber } from '@/lib/generators/request-number-generator';
import { VALID_URGENCY_LEVELS } from '@/lib/schemas/material-request-schema';
import { ObjectId } from 'mongodb';
import { withTransaction } from '@/lib/mongodb/transaction-helpers';

/**
 * Generate unique batch number
 * @returns {Promise<string>} Unique batch number
 */
export async function generateBatchNumberHelper() {
  return await generateBatchNumber();
}

/**
 * Calculate batch totals from material requests
 * @param {Array} materialRequests - Array of material request documents
 * @returns {Object} { totalMaterials: number, totalEstimatedCost: number }
 */
export function calculateBatchTotals(materialRequests) {
  if (!Array.isArray(materialRequests) || materialRequests.length === 0) {
    return {
      totalMaterials: 0,
      totalEstimatedCost: 0,
    };
  }

  const totalMaterials = materialRequests.length;
  const totalEstimatedCost = materialRequests.reduce((sum, request) => {
    const cost = request.estimatedCost || 0;
    return sum + cost;
  }, 0);

  return {
    totalMaterials,
    totalEstimatedCost,
  };
}

/**
 * Create individual material requests from materials array
 * @param {Array} materials - Array of material objects
 * @param {Object} settings - Default settings (projectId, floorId, categoryId, urgency, reason)
 * @param {Object} userProfile - User profile creating the requests
 * @param {Object} options - Options object
 * @param {Object} options.session - MongoDB session for transaction support
 * @param {Object} options.db - Database instance (if provided, uses this instead of getting new one)
 * @returns {Promise<Array>} Array of created material request IDs
 */
export async function createMaterialRequestsFromBatch(materials, settings, userProfile, options = {}) {
  const { session, db: providedDb } = options;
  const db = providedDb || await getDatabase();
  const requestIds = [];
  const createdRequests = [];

  // Generate all request numbers upfront to avoid race conditions
  // Pass session and db to ensure atomic operations within transaction
  // This ensures uniqueness even when creating multiple requests in parallel
  const requestNumbers = [];
  for (let i = 0; i < materials.length; i++) {
    const requestNumber = await generateRequestNumber({ session, db });
    requestNumbers.push(requestNumber);
  }

  for (let i = 0; i < materials.length; i++) {
    const material = materials[i];
    // Use pre-generated request number
    const requestNumber = requestNumbers[i];

    // Use material-specific values or fall back to defaults
    const floorId = material.floorId && ObjectId.isValid(material.floorId)
      ? new ObjectId(material.floorId)
      : (settings.defaultFloorId && ObjectId.isValid(settings.defaultFloorId)
          ? new ObjectId(settings.defaultFloorId)
          : null);

    const categoryId = material.categoryId && ObjectId.isValid(material.categoryId)
      ? new ObjectId(material.categoryId)
      : (settings.defaultCategoryId && ObjectId.isValid(settings.defaultCategoryId)
          ? new ObjectId(settings.defaultCategoryId)
          : null);

    const category = material.category || settings.defaultCategory || '';

    // Phase Enforcement: PhaseId is now required
    // Use material-specific phaseId or fall back to defaultPhaseId
    let phaseId = null;
    
    if (material.phaseId && ObjectId.isValid(material.phaseId)) {
      phaseId = new ObjectId(material.phaseId);
    } else if (settings.defaultPhaseId && ObjectId.isValid(settings.defaultPhaseId)) {
      phaseId = new ObjectId(settings.defaultPhaseId);
    }
    
    // Validate phaseId exists (should have been validated in API, but double-check for safety)
    if (!phaseId) {
      throw new Error(
        `Material "${material.name || material.materialName || 'Unknown'}" (index ${i}) does not have a phaseId. ` +
        `Either provide defaultPhaseId in batch settings or specify phaseId for each material.`
      );
    }

    const urgency = material.urgency || settings.defaultUrgency || 'medium';
    const reason = material.reason || settings.defaultReason || '';

    // Calculate estimated cost if not provided
    let estimatedCost = material.estimatedCost;
    if (estimatedCost === undefined && material.estimatedUnitCost && material.quantityNeeded) {
      estimatedCost = material.estimatedUnitCost * material.quantityNeeded;
    }

    // Validate required fields
    const materialName = (material.name || material.materialName || '').trim();
    const quantityNeeded = parseFloat(material.quantityNeeded || material.quantity || 0);
    const unit = (material.unit || '').trim();

    if (!materialName || materialName.length < 2) {
      throw new Error(`Material name is required and must be at least 2 characters. Material: ${JSON.stringify(material)}`);
    }

    if (isNaN(quantityNeeded) || quantityNeeded <= 0) {
      throw new Error(`Valid quantity is required (must be > 0). Material: ${JSON.stringify(material)}`);
    }

    if (!unit || unit.length === 0) {
      throw new Error(`Unit is required. Material: ${JSON.stringify(material)}`);
    }

    // Build material request document
    const materialRequest = {
      requestNumber,
      requestedBy: new ObjectId(userProfile._id),
      requestedByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
      projectId: new ObjectId(settings.projectId),
      ...(floorId && { floorId }),
      ...(categoryId && { categoryId }),
      ...(category && { category: category.trim() }),
      phaseId: phaseId, // Required - validated above
      materialName,
      description: material.description?.trim() || '',
      quantityNeeded,
      unit,
      urgency,
      ...(estimatedCost !== undefined && estimatedCost > 0 && { estimatedCost: parseFloat(estimatedCost) }),
      ...(material.estimatedUnitCost !== undefined && { estimatedUnitCost: parseFloat(material.estimatedUnitCost) }),
      reason: reason.trim(),
      status: 'pending_approval', // Default status for batch requests
      submittedAt: new Date(),
      notes: material.notes?.trim() || '',
      // Batch information
      batchId: null, // Will be set after batch creation
      batchNumber: null, // Will be set after batch creation
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    // Insert material request (with session if provided for transaction)
    const insertOptions = session ? { session } : {};
    const result = await db.collection('material_requests').insertOne(materialRequest, insertOptions);
    requestIds.push(result.insertedId);
    createdRequests.push({ ...materialRequest, _id: result.insertedId });

    // Increment library usage if libraryMaterialId provided (outside transaction - idempotent operation)
    if (material.libraryMaterialId && ObjectId.isValid(material.libraryMaterialId)) {
      const { incrementLibraryUsage } = await import('@/lib/helpers/material-library-helpers');
      // Library usage increment is idempotent, can happen outside transaction
      await incrementLibraryUsage(material.libraryMaterialId, userProfile._id.toString());
    }
  }

  return { requestIds, createdRequests };
}

/**
 * Create batch from materials array
 * @param {Array} materials - Array of material objects
 * @param {Object} settings - Batch settings
 * @param {Object} userProfile - User profile creating the batch
 * @param {string} status - Initial batch status (default: 'draft')
 * @param {Object} options - Options object
 * @param {Object} options.session - MongoDB session for transaction support
 * @param {Object} options.db - Database instance (if provided, uses this instead of getting new one)
 * @returns {Promise<Object>} Created batch document
 */
export async function createBatch(materials, settings, userProfile, status = 'draft', options = {}) {
  const { session, db: providedDb } = options;
  const db = providedDb || await getDatabase();

  // Validate required fields
  if (!settings.projectId || !ObjectId.isValid(settings.projectId)) {
    throw new Error('Valid projectId is required');
  }

  if (!materials || !Array.isArray(materials) || materials.length === 0) {
    throw new Error('At least one material is required');
  }

  // Generate batch number
  const batchNumber = await generateBatchNumber();

  // Create material requests first (with session if provided for transaction)
  const { requestIds, createdRequests } = await createMaterialRequestsFromBatch(
    materials,
    settings,
    userProfile,
    { session, db }
  );

  // Calculate totals
  const totals = calculateBatchTotals(createdRequests);

  // Build batch document
  const batch = {
    batchNumber,
    batchName: settings.batchName?.trim() || null,
    projectId: new ObjectId(settings.projectId),
    ...(settings.defaultFloorId && ObjectId.isValid(settings.defaultFloorId) && {
      defaultFloorId: new ObjectId(settings.defaultFloorId),
    }),
    ...(settings.defaultCategoryId && ObjectId.isValid(settings.defaultCategoryId) && {
      defaultCategoryId: new ObjectId(settings.defaultCategoryId),
    }),
    defaultUrgency: settings.defaultUrgency || 'medium',
    ...(settings.defaultReason && { defaultReason: settings.defaultReason.trim() }),
    createdBy: new ObjectId(userProfile._id),
    createdByName: `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.email,
    status,
    materialRequestIds: requestIds,
    approvedBy: null,
    approvedAt: null,
    approvalNotes: null,
    supplierAssignmentMode: null,
    assignedSuppliers: [],
    purchaseOrderIds: [],
    totalMaterials: totals.totalMaterials,
    totalEstimatedCost: totals.totalEstimatedCost,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  // Insert batch (with session if provided for transaction)
  const insertOptions = session ? { session } : {};
  const batchResult = await db.collection('material_request_batches').insertOne(batch, insertOptions);

  // Update material requests with batch information (with session if provided for transaction)
  const updateOptions = session ? { session } : {};
  await db.collection('material_requests').updateMany(
    { _id: { $in: requestIds } },
    {
      $set: {
        batchId: batchResult.insertedId,
        batchNumber: batchNumber,
        updatedAt: new Date(),
      },
    },
    updateOptions
  );

  return { ...batch, _id: batchResult.insertedId };
}

/**
 * Update batch status
 * @param {string} batchId - Batch ID
 * @param {string} newStatus - New status
 * @param {Object} userProfile - User making the change
 * @param {Object} additionalData - Additional data to update (e.g., approvedBy, approvalNotes)
 * @returns {Promise<Object>} Updated batch
 */
export async function updateBatchStatus(batchId, newStatus, userProfile, additionalData = {}) {
  const db = await getDatabase();

  const updateData = {
    status: newStatus,
    updatedAt: new Date(),
    ...additionalData,
  };

  const result = await db.collection('material_request_batches').findOneAndUpdate(
    { _id: new ObjectId(batchId) },
    { $set: updateData },
    { returnDocument: 'after' }
  );

  if (!result.value) {
    throw new Error('Batch not found');
  }

  return result.value;
}

/**
 * Get batch with all material requests populated
 * @param {string} batchId - Batch ID
 * @returns {Promise<Object>} Batch with populated material requests
 */
export async function getBatchWithRequests(batchId) {
  const db = await getDatabase();

  const batch = await db.collection('material_request_batches').findOne({
    _id: new ObjectId(batchId),
    deletedAt: null,
  });

  if (!batch) {
    return null;
  }

  // Fetch all material requests
  const materialRequests = await db.collection('material_requests')
    .find({
      _id: { $in: batch.materialRequestIds },
      deletedAt: null,
    })
    .toArray();

  // Populate project information
  const project = await db.collection('projects').findOne({
    _id: batch.projectId,
  });

  // Calculate current totals
  const totals = calculateBatchTotals(materialRequests);

  return {
    ...batch,
    materialRequests,
    project: project ? {
      _id: project._id.toString(),
      projectCode: project.projectCode,
      projectName: project.projectName,
    } : null,
    totals,
  };
}

/**
 * Get batches with filtering and pagination
 * @param {Object} filters - Filter criteria
 * @param {Object} pagination - Pagination options
 * @returns {Promise<Object>} Batches with pagination info
 */
export async function getBatches(filters = {}, pagination = { page: 1, limit: 20 }) {
  const db = await getDatabase();

  const query = { deletedAt: null };

  if (filters.projectId && ObjectId.isValid(filters.projectId)) {
    query.projectId = new ObjectId(filters.projectId);
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.createdBy && ObjectId.isValid(filters.createdBy)) {
    query.createdBy = new ObjectId(filters.createdBy);
  }

  if (filters.search) {
    query.$or = [
      { batchNumber: { $regex: filters.search, $options: 'i' } },
      { batchName: { $regex: filters.search, $options: 'i' } },
    ];
  }

  const skip = (pagination.page - 1) * pagination.limit;
  const sort = { createdAt: -1 };

  const batches = await db.collection('material_request_batches')
    .find(query)
    .sort(sort)
    .skip(skip)
    .limit(pagination.limit)
    .toArray();

  const total = await db.collection('material_request_batches').countDocuments(query);

  return {
    batches,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      pages: Math.ceil(total / pagination.limit),
    },
  };
}

