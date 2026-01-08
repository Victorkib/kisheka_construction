/**
 * Equipment Helper Functions
 * Utilities for equipment management and calculations
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';
import { calculateEquipmentCost, calculateUtilizationPercentage } from '@/lib/schemas/equipment-schema';

/**
 * Calculate equipment cost for a phase
 * @param {string} phaseId - Phase ID
 * @returns {Promise<number>} Total equipment cost
 */
export async function calculatePhaseEquipmentCost(phaseId) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return 0;
  }
  
  const result = await db.collection('equipment').aggregate([
    {
      $match: {
        phaseId: new ObjectId(phaseId),
        deletedAt: null,
        status: { $in: ['assigned', 'in_use'] } // Only count active equipment
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalCost' }
      }
    }
  ]).toArray();
  
  return result[0]?.total || 0;
}

/**
 * Calculate committed equipment cost for a phase
 * Equipment that is assigned but not yet returned
 * @param {string} phaseId - Phase ID
 * @returns {Promise<number>} Total committed equipment cost
 */
export async function calculatePhaseEquipmentCommittedCost(phaseId) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return 0;
  }
  
  const result = await db.collection('equipment').aggregate([
    {
      $match: {
        phaseId: new ObjectId(phaseId),
        deletedAt: null,
        status: { $in: ['assigned', 'in_use'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalCost' }
      }
    }
  ]).toArray();
  
  return result[0]?.total || 0;
}

/**
 * Update equipment utilization
 * @param {string} equipmentId - Equipment ID
 * @param {number} actualHours - Actual hours used
 * @returns {Promise<Object>} Updated equipment
 */
export async function updateEquipmentUtilization(equipmentId, actualHours) {
  const db = await getDatabase();
  
  if (!equipmentId || !ObjectId.isValid(equipmentId)) {
    throw new Error('Invalid equipment ID');
  }
  
  const equipment = await db.collection('equipment').findOne({
    _id: new ObjectId(equipmentId),
    deletedAt: null
  });
  
  if (!equipment) {
    throw new Error('Equipment not found');
  }
  
  const estimatedHours = equipment.utilization?.estimatedHours || 0;
  const utilizationPercentage = calculateUtilizationPercentage(actualHours, estimatedHours);
  
  const updated = await db.collection('equipment').findOneAndUpdate(
    { _id: new ObjectId(equipmentId) },
    {
      $set: {
        'utilization.actualHours': parseFloat(actualHours) || 0,
        'utilization.utilizationPercentage': utilizationPercentage,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );
  
  return updated.value;
}

/**
 * Recalculate equipment total cost based on dates
 * @param {string} equipmentId - Equipment ID
 * @returns {Promise<Object>} Updated equipment
 */
export async function recalculateEquipmentCost(equipmentId) {
  const db = await getDatabase();
  
  if (!equipmentId || !ObjectId.isValid(equipmentId)) {
    throw new Error('Invalid equipment ID');
  }
  
  const equipment = await db.collection('equipment').findOne({
    _id: new ObjectId(equipmentId),
    deletedAt: null
  });
  
  if (!equipment) {
    throw new Error('Equipment not found');
  }
  
  const totalCost = calculateEquipmentCost(
    equipment.startDate,
    equipment.endDate || new Date(),
    equipment.dailyRate
  );
  
  const updated = await db.collection('equipment').findOneAndUpdate(
    { _id: new ObjectId(equipmentId) },
    {
      $set: {
        totalCost: totalCost,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );
  
  return updated.value;
}

/**
 * Get equipment statistics for a phase
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Object>} Equipment statistics
 */
export async function getPhaseEquipmentStatistics(phaseId) {
  const db = await getDatabase();
  
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return {
      total: 0,
      totalCost: 0,
      byStatus: {},
      byType: {},
      averageUtilization: 0
    };
  }
  
  const equipment = await db.collection('equipment').find({
    phaseId: new ObjectId(phaseId),
    deletedAt: null
  }).toArray();
  
  const stats = {
    total: equipment.length,
    totalCost: equipment.reduce((sum, eq) => sum + (eq.totalCost || 0), 0),
    byStatus: {},
    byType: {},
    totalEstimatedHours: 0,
    totalActualHours: 0,
    averageUtilization: 0
  };
  
  equipment.forEach(eq => {
    // By status
    const status = eq.status || 'unknown';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    
    // By type
    const type = eq.equipmentType || 'other';
    stats.byType[type] = (stats.byType[type] || 0) + 1;
    
    // Utilization
    stats.totalEstimatedHours += eq.utilization?.estimatedHours || 0;
    stats.totalActualHours += eq.utilization?.actualHours || 0;
  });
  
  // Calculate average utilization
  if (stats.totalEstimatedHours > 0) {
    stats.averageUtilization = (stats.totalActualHours / stats.totalEstimatedHours) * 100;
  }
  
  return stats;
}


