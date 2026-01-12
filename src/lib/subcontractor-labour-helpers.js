/**
 * Subcontractor Labour Helper Functions
 * Handles separation of direct labour vs subcontractor labour
 */

import { getDatabase } from './mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Get direct labour summary (labour entries without subcontractorId)
 * @param {string} projectId - Project ID (optional)
 * @param {string} phaseId - Phase ID (optional)
 * @param {Date} [dateFrom] - Start date (optional)
 * @param {Date} [dateTo] - End date (optional)
 * @returns {Promise<Object>} Direct labour summary
 */
export async function getDirectLabourSummary(projectId = null, phaseId = null, dateFrom = null, dateTo = null) {
  const db = await getDatabase();

  const matchCriteria = {
    subcontractorId: null,
    status: { $in: ['approved', 'paid'] },
    deletedAt: null,
  };

  if (projectId && ObjectId.isValid(projectId)) {
    matchCriteria.projectId = new ObjectId(projectId);
  }

  if (phaseId && ObjectId.isValid(phaseId)) {
    matchCriteria.phaseId = new ObjectId(phaseId);
  }

  if (dateFrom || dateTo) {
    matchCriteria.entryDate = {};
    if (dateFrom) {
      matchCriteria.entryDate.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      matchCriteria.entryDate.$lte = new Date(dateTo);
    }
  }

  const summary = await db.collection('labour_entries').aggregate([
    { $match: matchCriteria },
    {
      $group: {
        _id: null,
        totalHours: { $sum: '$totalHours' },
        totalCost: { $sum: '$totalCost' },
        regularHours: { $sum: { $subtract: ['$totalHours', { $ifNull: ['$overtimeHours', 0] }] } },
        overtimeHours: { $sum: { $ifNull: ['$overtimeHours', 0] } },
        regularCost: { $sum: '$regularCost' },
        overtimeCost: { $sum: '$overtimeCost' },
        entryCount: { $sum: 1 },
        uniqueWorkers: { $addToSet: '$workerName' },
      },
    },
  ]).toArray();

  return summary[0] || {
    totalHours: 0,
    totalCost: 0,
    regularHours: 0,
    overtimeHours: 0,
    regularCost: 0,
    overtimeCost: 0,
    entryCount: 0,
    uniqueWorkers: [],
  };
}

/**
 * Get subcontractor labour summary (labour entries with subcontractorId)
 * @param {string} projectId - Project ID (optional)
 * @param {string} phaseId - Phase ID (optional)
 * @param {string} subcontractorId - Subcontractor ID (optional)
 * @param {Date} [dateFrom] - Start date (optional)
 * @param {Date} [dateTo] - End date (optional)
 * @returns {Promise<Object>} Subcontractor labour summary
 */
export async function getSubcontractorLabourSummary(
  projectId = null,
  phaseId = null,
  subcontractorId = null,
  dateFrom = null,
  dateTo = null
) {
  const db = await getDatabase();

  const matchCriteria = {
    subcontractorId: { $ne: null },
    status: { $in: ['approved', 'paid'] },
    deletedAt: null,
  };

  if (projectId && ObjectId.isValid(projectId)) {
    matchCriteria.projectId = new ObjectId(projectId);
  }

  if (phaseId && ObjectId.isValid(phaseId)) {
    matchCriteria.phaseId = new ObjectId(phaseId);
  }

  if (subcontractorId && ObjectId.isValid(subcontractorId)) {
    matchCriteria.subcontractorId = new ObjectId(subcontractorId);
  }

  if (dateFrom || dateTo) {
    matchCriteria.entryDate = {};
    if (dateFrom) {
      matchCriteria.entryDate.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      matchCriteria.entryDate.$lte = new Date(dateTo);
    }
  }

  // Get summary
  const summary = await db.collection('labour_entries').aggregate([
    { $match: matchCriteria },
    {
      $group: {
        _id: null,
        totalHours: { $sum: '$totalHours' },
        totalCost: { $sum: '$totalCost' },
        regularHours: { $sum: { $subtract: ['$totalHours', { $ifNull: ['$overtimeHours', 0] }] } },
        overtimeHours: { $sum: { $ifNull: ['$overtimeHours', 0] } },
        regularCost: { $sum: '$regularCost' },
        overtimeCost: { $sum: '$overtimeCost' },
        entryCount: { $sum: 1 },
        uniqueWorkers: { $addToSet: '$workerName' },
        uniqueSubcontractors: { $addToSet: '$subcontractorId' },
      },
    },
  ]).toArray();

  // Get breakdown by subcontractor
  const bySubcontractor = await db.collection('labour_entries').aggregate([
    { $match: matchCriteria },
    {
      $group: {
        _id: '$subcontractorId',
        totalHours: { $sum: '$totalHours' },
        totalCost: { $sum: '$totalCost' },
        entryCount: { $sum: 1 },
        uniqueWorkers: { $addToSet: '$workerName' },
      },
    },
    {
      $lookup: {
        from: 'subcontractors',
        localField: '_id',
        foreignField: '_id',
        as: 'subcontractor',
      },
    },
    {
      $unwind: {
        path: '$subcontractor',
        preserveNullAndEmptyArrays: true,
      },
    },
    { $sort: { totalCost: -1 } },
  ]).toArray();

  return {
    summary: summary[0] || {
      totalHours: 0,
      totalCost: 0,
      regularHours: 0,
      overtimeHours: 0,
      regularCost: 0,
      overtimeCost: 0,
      entryCount: 0,
      uniqueWorkers: [],
      uniqueSubcontractors: [],
    },
    bySubcontractor: bySubcontractor.map((item) => ({
      subcontractorId: item._id?.toString(),
      subcontractorName: item.subcontractor?.subcontractorName || 'Unknown',
      totalHours: item.totalHours,
      totalCost: item.totalCost,
      entryCount: item.entryCount,
      workerCount: item.uniqueWorkers?.length || 0,
    })),
  };
}

/**
 * Get combined labour summary (direct + subcontractor)
 * @param {string} projectId - Project ID (optional)
 * @param {string} phaseId - Phase ID (optional)
 * @param {Date} [dateFrom] - Start date (optional)
 * @param {Date} [dateTo] - End date (optional)
 * @returns {Promise<Object>} Combined labour summary with separation
 */
export async function getCombinedLabourSummary(projectId = null, phaseId = null, dateFrom = null, dateTo = null) {
  const [directLabour, subcontractorLabour] = await Promise.all([
    getDirectLabourSummary(projectId, phaseId, dateFrom, dateTo),
    getSubcontractorLabourSummary(projectId, phaseId, null, dateFrom, dateTo),
  ]);

  const totalHours = directLabour.totalHours + subcontractorLabour.summary.totalHours;
  const totalCost = directLabour.totalCost + subcontractorLabour.summary.totalCost;

  return {
    total: {
      totalHours,
      totalCost,
      entryCount: directLabour.entryCount + subcontractorLabour.summary.entryCount,
      uniqueWorkers: [
        ...new Set([
          ...(directLabour.uniqueWorkers || []),
          ...(subcontractorLabour.summary.uniqueWorkers || []),
        ]),
      ].length,
    },
    direct: {
      totalHours: directLabour.totalHours,
      totalCost: directLabour.totalCost,
      regularHours: directLabour.regularHours,
      overtimeHours: directLabour.overtimeHours,
      regularCost: directLabour.regularCost,
      overtimeCost: directLabour.overtimeCost,
      entryCount: directLabour.entryCount,
      uniqueWorkers: directLabour.uniqueWorkers?.length || 0,
      percentage: totalCost > 0 ? (directLabour.totalCost / totalCost) * 100 : 0,
    },
    subcontractor: {
      totalHours: subcontractorLabour.summary.totalHours,
      totalCost: subcontractorLabour.summary.totalCost,
      regularHours: subcontractorLabour.summary.regularHours,
      overtimeHours: subcontractorLabour.summary.overtimeHours,
      regularCost: subcontractorLabour.summary.regularCost,
      overtimeCost: subcontractorLabour.summary.overtimeCost,
      entryCount: subcontractorLabour.summary.entryCount,
      uniqueWorkers: subcontractorLabour.summary.uniqueWorkers?.length || 0,
      uniqueSubcontractors: subcontractorLabour.summary.uniqueSubcontractors?.length || 0,
      percentage: totalCost > 0 ? (subcontractorLabour.summary.totalCost / totalCost) * 100 : 0,
      bySubcontractor: subcontractorLabour.bySubcontractor,
    },
  };
}

/**
 * Get subcontractor labour entries
 * @param {string} subcontractorId - Subcontractor ID
 * @param {Date} [dateFrom] - Start date (optional)
 * @param {Date} [dateTo] - End date (optional)
 * @returns {Promise<Array>} Labour entries for subcontractor
 */
export async function getSubcontractorLabourEntries(subcontractorId, dateFrom = null, dateTo = null) {
  const db = await getDatabase();

  if (!subcontractorId || !ObjectId.isValid(subcontractorId)) {
    return [];
  }

  const matchCriteria = {
    subcontractorId: new ObjectId(subcontractorId),
    status: { $in: ['approved', 'paid'] },
    deletedAt: null,
  };

  if (dateFrom || dateTo) {
    matchCriteria.entryDate = {};
    if (dateFrom) {
      matchCriteria.entryDate.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      matchCriteria.entryDate.$lte = new Date(dateTo);
    }
  }

  const entries = await db.collection('labour_entries')
    .find(matchCriteria)
    .sort({ entryDate: -1 })
    .toArray();

  return entries;
}

export default {
  getDirectLabourSummary,
  getSubcontractorLabourSummary,
  getCombinedLabourSummary,
  getSubcontractorLabourEntries,
};

