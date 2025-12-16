/**
 * Auto-Reorder Helper Functions
 * Functions for automated reordering based on stock levels
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { createBatch } from './batch-helpers';

/**
 * Check stock levels and identify low stock items
 * @param {string} projectId - Project ID
 * @param {number} threshold - Threshold percentage (default: 20)
 * @returns {Promise<Array<Object>>} Array of low stock materials
 */
export async function checkLowStock(projectId, threshold = 20) {
  const db = await getDatabase();

  if (!projectId || !ObjectId.isValid(projectId)) {
    throw new Error('Valid project ID is required');
  }

  // Get all materials for the project
  const materials = await db
    .collection('materials')
    .find({
      projectId: new ObjectId(projectId),
      deletedAt: null,
      status: { $in: ['approved', 'received'] },
    })
    .toArray();

  const lowStockItems = [];

  materials.forEach((material) => {
    const purchased = material.quantityPurchased || material.quantity || 0;
    const delivered = material.quantityDelivered || 0;
    const used = material.quantityUsed || 0;
    const remaining = Math.max(0, delivered - used);

    // Calculate stock percentage
    const stockPercentage = purchased > 0 ? (remaining / purchased) * 100 : 0;

    // Check if below threshold
    if (stockPercentage < threshold && stockPercentage > 0) {
      // Calculate reorder quantity (suggest ordering enough to bring back to 100%)
      const reorderQuantity = Math.max(purchased - remaining, purchased * 0.5); // At least 50% of original

      lowStockItems.push({
        materialId: material._id.toString(),
        materialName: material.materialName || material.itemName || 'Unknown',
        category: material.category || '',
        categoryId: material.categoryId || null,
        unit: material.unit || 'piece',
        currentStock: remaining,
        originalQuantity: purchased,
        stockPercentage: Math.round(stockPercentage * 100) / 100,
        suggestedReorderQuantity: Math.ceil(reorderQuantity),
        lastUsedDate: material.dateUsed || material.updatedAt,
        estimatedUnitCost: material.unitCost || null,
      });
    }
  });

  // Sort by stock percentage (lowest first)
  lowStockItems.sort((a, b) => a.stockPercentage - b.stockPercentage);

  return lowStockItems;
}

/**
 * Generate bulk request from low stock items
 * @param {string} projectId - Project ID
 * @param {number} threshold - Threshold percentage
 * @param {Object} defaults - Default settings (urgency, reason, floorId, categoryId)
 * @returns {Promise<Array<Object>>} Array of material objects for bulk request
 */
export async function generateBulkRequestFromLowStock(projectId, threshold, defaults = {}) {
  const lowStockItems = await checkLowStock(projectId, threshold);

  // Convert to material request format
  const materials = lowStockItems.map((item) => ({
    name: item.materialName,
    quantityNeeded: item.suggestedReorderQuantity,
    unit: item.unit,
    categoryId: item.categoryId?.toString() || defaults.categoryId,
    category: item.category,
    estimatedUnitCost: item.estimatedUnitCost,
    estimatedCost: item.estimatedUnitCost
      ? item.estimatedUnitCost * item.suggestedReorderQuantity
      : null,
    description: `Auto-generated reorder: Current stock ${item.currentStock} ${item.unit} (${item.stockPercentage}% remaining)`,
    urgency: defaults.urgency || 'medium',
    reason: defaults.reason || 'Low stock - automated reorder',
    floorId: defaults.floorId,
  }));

  return materials;
}

/**
 * Auto-create batch for low stock (if enabled)
 * @param {string} projectId - Project ID
 * @param {Object} settings - Auto-reorder settings
 * @param {string} userId - User ID creating the batch
 * @returns {Promise<Object>} Created batch or null if no low stock items
 */
export async function autoCreateLowStockBatch(projectId, settings, userId) {
  const {
    enabled = false,
    threshold = 20,
    urgency = 'medium',
    reason = 'Low stock - automated reorder',
    floorId = null,
    categoryId = null,
    autoApprove = false,
  } = settings;

  if (!enabled) {
    return null;
  }

  // Check for low stock items
  const lowStockItems = await checkLowStock(projectId, threshold);

  if (lowStockItems.length === 0) {
    return null;
  }

  // Generate materials for bulk request
  const materials = await generateBulkRequestFromLowStock(projectId, threshold, {
    urgency,
    reason,
    floorId,
    categoryId,
  });

  // Create batch
  const batchSettings = {
    projectId: projectId,
    batchName: `Auto-Reorder - ${new Date().toLocaleDateString('en-KE')}`,
    defaultFloorId: floorId,
    defaultCategoryId: categoryId,
    defaultUrgency: urgency,
    defaultReason: reason,
  };

  const batch = await createBatch(materials, batchSettings, userId, autoApprove);

  return batch;
}

