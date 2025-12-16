/**
 * Material Library Helper Functions
 * Utility functions for material library operations
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Increment usage count when material used in request
 * @param {string} materialLibraryId - Material library ID
 * @param {string} userId - User ID who used it
 */
export async function incrementLibraryUsage(materialLibraryId, userId) {
  if (!materialLibraryId || !ObjectId.isValid(materialLibraryId)) {
    return;
  }

  const db = await getDatabase();
  
  await db.collection('material_library').updateOne(
    { _id: new ObjectId(materialLibraryId) },
    {
      $inc: { usageCount: 1 },
      $set: {
        lastUsedAt: new Date(),
        lastUsedBy: userId ? new ObjectId(userId) : null,
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * Get commonly used materials
 * @param {number} limit - Maximum number of materials to return
 * @returns {Promise<Array>} Array of common materials
 */
export async function getCommonMaterials(limit = 20) {
  const db = await getDatabase();
  
  return await db.collection('material_library')
    .find({
      isCommon: true,
      isActive: true,
      deletedAt: null,
    })
    .sort({ usageCount: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Search materials by name/description
 * @param {string} query - Search query
 * @param {Object} filters - Additional filters
 * @param {boolean} filters.isActive - Filter by active status
 * @param {string} filters.categoryId - Filter by category ID
 * @param {boolean} filters.isCommon - Filter by common status
 * @param {Object} filters.sortBy - Sort criteria
 * @param {number} filters.limit - Maximum results
 * @returns {Promise<Array>} Array of matching materials
 */
export async function searchLibraryMaterials(query, filters = {}) {
  const db = await getDatabase();
  
  const searchQuery = {
    deletedAt: null,
    ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    ...(filters.categoryId && ObjectId.isValid(filters.categoryId) && { categoryId: new ObjectId(filters.categoryId) }),
    ...(filters.isCommon && { isCommon: true }),
  };

  if (query && query.trim()) {
    searchQuery.$or = [
      { name: { $regex: query.trim(), $options: 'i' } },
      { description: { $regex: query.trim(), $options: 'i' } },
      { materialCode: { $regex: query.trim(), $options: 'i' } },
      { brand: { $regex: query.trim(), $options: 'i' } },
    ];
  }

  const sort = filters.sortBy || { usageCount: -1 };
  const limit = filters.limit || 50;

  return await db.collection('material_library')
    .find(searchQuery)
    .sort(sort)
    .limit(limit)
    .toArray();
}

/**
 * Get material by ID with category details
 * @param {string} materialLibraryId - Material library ID
 * @returns {Promise<Object|null>} Material with category details or null
 */
export async function getLibraryMaterialWithDetails(materialLibraryId) {
  if (!materialLibraryId || !ObjectId.isValid(materialLibraryId)) {
    return null;
  }

  const db = await getDatabase();
  
  const material = await db.collection('material_library').findOne({
    _id: new ObjectId(materialLibraryId),
    deletedAt: null,
  });

  if (!material) return null;

  // Populate category if categoryId exists
  if (material.categoryId) {
    const category = await db.collection('categories').findOne({
      _id: material.categoryId,
    });
    if (category) {
      material.categoryDetails = {
        _id: category._id.toString(),
        name: category.name,
        description: category.description,
      };
    }
  }

  return material;
}

/**
 * Get materials by category
 * @param {string} categoryId - Category ID
 * @param {Object} options - Query options
 * @param {boolean} options.activeOnly - Only return active materials
 * @param {number} options.limit - Maximum results
 * @returns {Promise<Array>} Array of materials
 */
export async function getMaterialsByCategory(categoryId, options = {}) {
  if (!categoryId || !ObjectId.isValid(categoryId)) {
    return [];
  }

  const db = await getDatabase();
  
  const query = {
    categoryId: new ObjectId(categoryId),
    deletedAt: null,
    ...(options.activeOnly && { isActive: true }),
  };

  return await db.collection('material_library')
    .find(query)
    .sort({ name: 1 })
    .limit(options.limit || 100)
    .toArray();
}

/**
 * Check if material name exists in library
 * @param {string} name - Material name
 * @param {string} excludeId - Material ID to exclude from check
 * @returns {Promise<boolean>} True if exists
 */
export async function materialNameExists(name, excludeId = null) {
  if (!name || name.trim().length < 2) {
    return false;
  }

  const db = await getDatabase();
  
  const query = {
    name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    deletedAt: null,
  };

  if (excludeId && ObjectId.isValid(excludeId)) {
    query._id = { $ne: new ObjectId(excludeId) };
  }

  const count = await db.collection('material_library').countDocuments(query);
  return count > 0;
}

