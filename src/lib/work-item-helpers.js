/**
 * Work Item Helper Functions
 * Utilities for work item management and calculations
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Calculate phase completion from work items
 * @param {string} phaseId - Phase ID
 * @returns {Promise<number>} Completion percentage (0-100)
 */
export async function calculatePhaseCompletionFromWorkItems(phaseId) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return 0;
  }
  
  const workItems = await db.collection('work_items').find({
    phaseId: new ObjectId(phaseId),
    deletedAt: null
  }).toArray();
  
  if (workItems.length === 0) {
    return 0;
  }
  
  const completedItems = workItems.filter(item => item.status === 'completed').length;
  const completionPercentage = (completedItems / workItems.length) * 100;
  
  return Math.round(completionPercentage);
}

/**
 * Get work items for a phase
 * @param {string} phaseId - Phase ID
 * @param {Object} options - Options (status, category, etc.)
 * @returns {Promise<Array>} Work items
 */
export async function getPhaseWorkItems(phaseId, options = {}) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return [];
  }
  
  const query = {
    phaseId: new ObjectId(phaseId),
    deletedAt: null
  };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.category) {
    query.category = options.category;
  }
  
  // Handle assignedTo filter - support array queries
  if (options.assignedTo) {
    if (ObjectId.isValid(options.assignedTo)) {
      // Filter work items where this worker is in the assignedTo array
      query.assignedTo = { $in: [new ObjectId(options.assignedTo)] };
    }
  }
  
  const sortOrder = options.sortBy === 'priority' 
    ? { priority: 1, createdAt: 1 }
    : { createdAt: -1 };
  
  return await db.collection('work_items')
    .find(query)
    .sort(sortOrder)
    .toArray();
}

/**
 * Get work item statistics for a phase
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Object>} Work item statistics
 */
export async function getPhaseWorkItemStatistics(phaseId) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return {
      total: 0,
      byStatus: {},
      byCategory: {},
      totalEstimatedHours: 0,
      totalActualHours: 0,
      totalEstimatedCost: 0,
      totalActualCost: 0,
      completionPercentage: 0
    };
  }
  
  const workItems = await db.collection('work_items').find({
    phaseId: new ObjectId(phaseId),
    deletedAt: null
  }).toArray();
  
  const stats = {
    total: workItems.length,
    byStatus: {},
    byCategory: {},
    totalEstimatedHours: 0,
    totalActualHours: 0,
    totalEstimatedCost: 0,
    totalActualCost: 0,
    completionPercentage: 0
  };
  
  workItems.forEach(item => {
    // By status
    const status = item.status || 'not_started';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    
    // By category
    const category = item.category || 'other';
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    
    // Hours and costs
    stats.totalEstimatedHours += item.estimatedHours || 0;
    stats.totalActualHours += item.actualHours || 0;
    stats.totalEstimatedCost += item.estimatedCost || 0;
    stats.totalActualCost += item.actualCost || 0;
  });
  
  // Calculate completion percentage
  if (stats.total > 0) {
    const completedItems = stats.byStatus.completed || 0;
    stats.completionPercentage = Math.round((completedItems / stats.total) * 100);
  }
  
  return stats;
}

/**
 * Validate work item dependencies
 * @param {string} workItemId - Work item ID (null for new items)
 * @param {Array<string>} dependencies - Array of dependency IDs
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Object>} { isValid: boolean, errors: string[] }
 */
export async function validateWorkItemDependencies(workItemId, dependencies, phaseId) {
  const db = await getDatabase();
  const errors = [];
  
  if (!dependencies || dependencies.length === 0) {
    return { isValid: true, errors: [] };
  }
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return { isValid: false, errors: ['Invalid phase ID'] };
  }
  
  // Check all dependencies exist and belong to same phase
  for (const depId of dependencies) {
    if (!ObjectId.isValid(depId)) {
      errors.push(`Invalid dependency work item ID: ${depId}`);
      continue;
    }
    
    const depItem = await db.collection('work_items').findOne({
      _id: new ObjectId(depId),
      phaseId: new ObjectId(phaseId),
      deletedAt: null
    });
    
    if (!depItem) {
      errors.push(`Dependency work item ${depId} not found or does not belong to this phase`);
    }
    
    // Check for self-dependency
    if (workItemId && depId === workItemId) {
      errors.push('Work item cannot depend on itself');
    }
  }
  
  // Check for circular dependencies using DFS
  if (workItemId && dependencies.length > 0) {
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCycle = (itemId) => {
      if (recursionStack.has(itemId)) {
        return true; // Circular dependency found
      }
      if (visited.has(itemId)) {
        return false;
      }
      
      visited.add(itemId);
      recursionStack.add(itemId);
      
      // Get dependencies of this item
      return db.collection('work_items').findOne({
        _id: new ObjectId(itemId),
        deletedAt: null
      }).then(item => {
        if (!item || !item.dependencies || item.dependencies.length === 0) {
          recursionStack.delete(itemId);
          return false;
        }
        
        // Check if any dependency would create a cycle
        for (const depId of item.dependencies) {
          if (depId.toString() === workItemId) {
            recursionStack.delete(itemId);
            return true; // Would create cycle
          }
          if (hasCycle(depId.toString())) {
            recursionStack.delete(itemId);
            return true;
          }
        }
        
        recursionStack.delete(itemId);
        return false;
      });
    };
    
    // Check each dependency for cycles
    for (const depId of dependencies) {
      if (await hasCycle(depId)) {
        errors.push(`Circular dependency detected involving work item ${depId}`);
        break;
      }
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Get work items that depend on a given work item
 * @param {string} workItemId - Work item ID
 * @returns {Promise<Array>} Dependent work items
 */
export async function getDependentWorkItems(workItemId) {
  const db = await getDatabase();
  
  if (!workItemId || !ObjectId.isValid(workItemId)) {
    return [];
  }
  
  return await db.collection('work_items').find({
    dependencies: new ObjectId(workItemId),
    deletedAt: null
  }).toArray();
}

/**
 * Check if a work item can be started (all dependencies completed)
 * @param {string} workItemId - Work item ID
 * @returns {Promise<Object>} { canStart: boolean, reason: string }
 */
export async function canWorkItemStart(workItemId) {
  const db = await getDatabase();
  
  if (!workItemId || !ObjectId.isValid(workItemId)) {
    return { canStart: false, reason: 'Invalid work item ID' };
  }
  
  const workItem = await db.collection('work_items').findOne({
    _id: new ObjectId(workItemId),
    deletedAt: null
  });
  
  if (!workItem) {
    return { canStart: false, reason: 'Work item not found' };
  }
  
  if (!workItem.dependencies || workItem.dependencies.length === 0) {
    return { canStart: true, reason: '' };
  }
  
  // Check all dependencies are completed
  const dependencies = await db.collection('work_items').find({
    _id: { $in: workItem.dependencies },
    deletedAt: null
  }).toArray();
  
  const incompleteDependencies = dependencies.filter(dep => dep.status !== 'completed');
  
  if (incompleteDependencies.length > 0) {
    return {
      canStart: false,
      reason: `Cannot start: ${incompleteDependencies.length} dependent work item(s) not completed`
    };
  }
  
  return { canStart: true, reason: '' };
}


