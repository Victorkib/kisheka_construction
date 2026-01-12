/**
 * Equipment Operator Helper Functions
 * Handles updating equipment utilization when operator labour entries are approved
 */

import { getDatabase } from './mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Recalculate equipment operator hours from all approved labour entries
 * @param {string} equipmentId - Equipment ID
 * @param {Object} [session] - MongoDB session for transaction
 * @returns {Promise<Object>} Updated equipment with recalculated utilization
 */
export async function recalculateEquipmentOperatorHours(equipmentId, session = null) {
  const db = await getDatabase();

  if (!equipmentId || !ObjectId.isValid(equipmentId)) {
    throw new Error('Invalid equipment ID');
  }

  // Get all approved labour entries for this equipment
  const labourEntries = await db.collection('labour_entries').aggregate(
    [
      {
        $match: {
          equipmentId: new ObjectId(equipmentId),
          status: { $in: ['approved', 'paid'] },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$totalHours' },
          totalCost: { $sum: '$totalCost' },
          entryCount: { $sum: 1 },
          uniqueOperators: { $addToSet: '$workerName' },
        },
      },
    ],
    session ? { session } : {}
  ).toArray();

  const summary = labourEntries[0] || {
    totalHours: 0,
    totalCost: 0,
    entryCount: 0,
    uniqueOperators: [],
  };

  // Get equipment to calculate utilization percentage
  const equipment = await db.collection('equipment').findOne({
    _id: new ObjectId(equipmentId),
    deletedAt: null,
  });

  if (!equipment) {
    throw new Error('Equipment not found');
  }

  const estimatedHours = equipment.utilization?.estimatedHours || 0;
  const utilizationPercentage =
    estimatedHours > 0 ? (summary.totalHours / estimatedHours) * 100 : 0;

  // Update equipment utilization
  const updateOptions = session ? { session } : {};

  const updatedEquipment = await db.collection('equipment').findOneAndUpdate(
    { _id: new ObjectId(equipmentId) },
    {
      $set: {
        'utilization.actualHours': summary.totalHours,
        'utilization.utilizationPercentage': Math.min(100, Math.max(0, utilizationPercentage)),
        updatedAt: new Date(),
      },
    },
    {
      ...updateOptions,
      returnDocument: 'after',
    }
  );

  if (!updatedEquipment) {
    throw new Error('Equipment not found');
  }

  return {
    equipment: updatedEquipment,
    operatorSummary: {
      totalHours: summary.totalHours,
      totalCost: summary.totalCost,
      entryCount: summary.entryCount,
      uniqueOperators: summary.uniqueOperators?.length || 0,
      utilizationPercentage: Math.min(100, Math.max(0, utilizationPercentage)),
    },
  };
}

/**
 * Update equipment operator hours when a labour entry is approved
 * @param {string} equipmentId - Equipment ID
 * @param {number} hours - Hours to add/subtract
 * @param {string} operation - 'add' | 'subtract'
 * @param {Object} [session] - MongoDB session for transaction
 * @returns {Promise<Object>} Updated equipment
 */
export async function updateEquipmentOperatorHours(
  equipmentId,
  hours,
  operation = 'add',
  session = null
) {
  const db = await getDatabase();

  if (!equipmentId || !ObjectId.isValid(equipmentId)) {
    throw new Error('Invalid equipment ID');
  }

  const hoursAmount = operation === 'add' ? hours : -hours;

  const updateOptions = session ? { session } : {};

  // Get current equipment state
  const equipment = await db.collection('equipment').findOne(
    { _id: new ObjectId(equipmentId) },
    updateOptions
  );

  if (!equipment) {
    throw new Error('Equipment not found');
  }

  const currentHours = equipment.utilization?.actualHours || 0;
  const newHours = Math.max(0, currentHours + hoursAmount);
  const estimatedHours = equipment.utilization?.estimatedHours || 0;
  const utilizationPercentage = estimatedHours > 0 ? (newHours / estimatedHours) * 100 : 0;

  // Update equipment
  const updatedEquipment = await db.collection('equipment').findOneAndUpdate(
    { _id: new ObjectId(equipmentId) },
    {
      $set: {
        'utilization.actualHours': newHours,
        'utilization.utilizationPercentage': Math.min(100, Math.max(0, utilizationPercentage)),
        updatedAt: new Date(),
      },
    },
    {
      ...updateOptions,
      returnDocument: 'after',
    }
  );

  if (!updatedEquipment) {
    throw new Error('Equipment not found');
  }

  return updatedEquipment;
}

/**
 * Get equipment operator statistics
 * @param {string} equipmentId - Equipment ID
 * @returns {Promise<Object>} Operator statistics
 */
export async function getEquipmentOperatorStatistics(equipmentId) {
  const db = await getDatabase();

  if (!equipmentId || !ObjectId.isValid(equipmentId)) {
    return null;
  }

  // Get equipment
  const equipment = await db.collection('equipment').findOne({
    _id: new ObjectId(equipmentId),
    deletedAt: null,
  });

  if (!equipment) {
    return null;
  }

  // Get operator labour entries
  const operatorEntries = await db.collection('labour_entries').aggregate([
    {
      $match: {
        equipmentId: new ObjectId(equipmentId),
        status: { $in: ['approved', 'paid'] },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: '$workerName',
        totalHours: { $sum: '$totalHours' },
        totalCost: { $sum: '$totalCost' },
        entryCount: { $sum: 1 },
        dates: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$entryDate' } } },
      },
    },
    { $sort: { totalHours: -1 } },
  ]).toArray();

  // Get summary
  const summary = await db.collection('labour_entries').aggregate([
    {
      $match: {
        equipmentId: new ObjectId(equipmentId),
        status: { $in: ['approved', 'paid'] },
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: null,
        totalHours: { $sum: '$totalHours' },
        totalCost: { $sum: '$totalCost' },
        entryCount: { $sum: 1 },
        uniqueOperators: { $addToSet: '$workerName' },
        dateRange: {
          $push: '$entryDate',
        },
      },
    },
  ]).toArray();

  const summaryData = summary[0] || {
    totalHours: 0,
    totalCost: 0,
    entryCount: 0,
    uniqueOperators: [],
    dateRange: [],
  };

  const estimatedHours = equipment.utilization?.estimatedHours || 0;
  const utilizationPercentage =
    estimatedHours > 0 ? (summaryData.totalHours / estimatedHours) * 100 : 0;

  return {
    equipment: {
      equipmentId: equipment._id.toString(),
      equipmentName: equipment.equipmentName,
      equipmentType: equipment.equipmentType,
      estimatedHours,
      actualHours: summaryData.totalHours,
      utilizationPercentage: Math.min(100, Math.max(0, utilizationPercentage)),
    },
    summary: {
      totalHours: summaryData.totalHours,
      totalCost: summaryData.totalCost,
      entryCount: summaryData.entryCount,
      uniqueOperators: summaryData.uniqueOperators?.length || 0,
      utilizationPercentage: Math.min(100, Math.max(0, utilizationPercentage)),
      dateRange: summaryData.dateRange.length > 0
        ? {
            start: new Date(Math.min(...summaryData.dateRange.map((d) => new Date(d)))),
            end: new Date(Math.max(...summaryData.dateRange.map((d) => new Date(d)))),
          }
        : null,
    },
    operators: operatorEntries.map((op) => ({
      operatorName: op._id,
      totalHours: op.totalHours,
      totalCost: op.totalCost,
      entryCount: op.entryCount,
      daysWorked: op.dates?.length || 0,
    })),
  };
}

export default {
  recalculateEquipmentOperatorHours,
  updateEquipmentOperatorHours,
  getEquipmentOperatorStatistics,
};

