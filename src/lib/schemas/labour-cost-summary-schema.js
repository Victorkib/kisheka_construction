/**
 * Labour Cost Summary Schema Definition
 * Defines aggregated labour cost summaries for projects/phases
 */

import { ObjectId } from 'mongodb';

/**
 * Labour Cost Summary Schema
 * @typedef {Object} LabourCostSummarySchema
 * @property {ObjectId} _id - Summary ID
 * @property {ObjectId} projectId - Project ID (required, indexed)
 * @property {ObjectId} [phaseId] - Phase ID (optional, indexed)
 * @property {ObjectId} [floorId] - Floor ID (optional, indexed)
 * @property {ObjectId} [categoryId] - Category ID (optional, indexed)
 * @property {string} periodType - 'daily' | 'weekly' | 'monthly' | 'project_total' | 'phase_total' (required)
 * @property {Date} periodStart - Period start date (required, indexed)
 * @property {Date} periodEnd - Period end date (required, indexed)
 * @property {Object} costs - Cost breakdown by role
 * @property {Object} costs.skilled - Skilled labour costs
 * @property {Object} costs.unskilled - Unskilled labour costs
 * @property {Object} costs.supervisory - Supervisory labour costs
 * @property {Object} costs.specialized - Specialized/professional labour costs
 * @property {Object} costs.total - Total costs
 * @property {Object} [direct] - Direct labour costs (non-subcontractor)
 * @property {Object} [subcontractor] - Subcontractor labour costs
 * @property {Object} [bySkillType] - Breakdown by skill type
 * @property {number} uniqueWorkers - Number of unique workers
 * @property {number} averageWorkersPerDay - Average workers per day
 * @property {number} totalEntries - Total labour entries
 * @property {Date} calculatedAt - When summary was calculated
 * @property {Date} updatedAt - Last update timestamp
 */

export const LABOUR_COST_SUMMARY_SCHEMA = {
  projectId: 'ObjectId', // Required, indexed
  phaseId: 'ObjectId', // Optional, indexed
  floorId: 'ObjectId', // Optional, indexed
  categoryId: 'ObjectId', // Optional, indexed
  periodType: String, // Required: 'daily' | 'weekly' | 'monthly' | 'project_total' | 'phase_total'
  periodStart: Date, // Required, indexed
  periodEnd: Date, // Required, indexed
  costs: {
    skilled: {
      hours: Number,
      cost: Number,
      entries: Number,
    },
    unskilled: {
      hours: Number,
      cost: Number,
      entries: Number,
    },
    supervisory: {
      hours: Number,
      cost: Number,
      entries: Number,
    },
    specialized: {
      hours: Number,
      cost: Number,
      entries: Number,
    },
    total: {
      hours: Number,
      cost: Number,
      entries: Number,
    },
  },
  direct: {
    hours: Number,
    cost: Number,
    entries: Number,
  },
  subcontractor: {
    hours: Number,
    cost: Number,
    entries: Number,
    subcontractorCount: Number,
  },
  bySkillType: {
    // Dynamic skill types
  },
  uniqueWorkers: Number,
  averageWorkersPerDay: Number,
  totalEntries: Number,
  calculatedAt: Date,
  updatedAt: Date,
};

/**
 * Create labour cost summary object
 * @param {Object} input - Summary input data
 * @param {ObjectId} projectId - Project ID
 * @param {ObjectId} [phaseId] - Phase ID (optional)
 * @returns {Object} Labour cost summary object
 */
export function createLabourCostSummary(input, projectId, phaseId = null) {
  const {
    periodType,
    periodStart,
    periodEnd,
    costs,
    direct,
    subcontractor,
    bySkillType,
    uniqueWorkers,
    averageWorkersPerDay,
    totalEntries,
  } = input;

  return {
    projectId: typeof projectId === 'string' ? new ObjectId(projectId) : projectId,
    phaseId: phaseId ? (typeof phaseId === 'string' ? new ObjectId(phaseId) : phaseId) : null,
    floorId: null,
    categoryId: null,
    periodType: periodType || 'project_total',
    periodStart: periodStart ? new Date(periodStart) : new Date(0),
    periodEnd: periodEnd ? new Date(periodEnd) : new Date(),
    costs: {
      skilled: {
        hours: costs?.skilled?.hours || 0,
        cost: costs?.skilled?.cost || 0,
        entries: costs?.skilled?.entries || 0,
      },
      unskilled: {
        hours: costs?.unskilled?.hours || 0,
        cost: costs?.unskilled?.cost || 0,
        entries: costs?.unskilled?.entries || 0,
      },
      supervisory: {
        hours: costs?.supervisory?.hours || 0,
        cost: costs?.supervisory?.cost || 0,
        entries: costs?.supervisory?.entries || 0,
      },
      specialized: {
        hours: costs?.specialized?.hours || 0,
        cost: costs?.specialized?.cost || 0,
        entries: costs?.specialized?.entries || 0,
      },
      total: {
        hours: costs?.total?.hours || 0,
        cost: costs?.total?.cost || 0,
        entries: costs?.total?.entries || 0,
      },
    },
    direct: direct
      ? {
          hours: direct.hours || 0,
          cost: direct.cost || 0,
          entries: direct.entries || 0,
        }
      : null,
    subcontractor: subcontractor
      ? {
          hours: subcontractor.hours || 0,
          cost: subcontractor.cost || 0,
          entries: subcontractor.entries || 0,
          subcontractorCount: subcontractor.subcontractorCount || 0,
        }
      : null,
    bySkillType: bySkillType || {},
    uniqueWorkers: uniqueWorkers || 0,
    averageWorkersPerDay: averageWorkersPerDay || 0,
    totalEntries: totalEntries || 0,
    calculatedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Validate labour cost summary data
 * @param {Object} data - Summary data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateLabourCostSummary(data) {
  const errors = [];

  if (!data.projectId) {
    errors.push('Project ID is required');
  }

  if (!data.periodType) {
    errors.push('Period type is required');
  } else if (!['daily', 'weekly', 'monthly', 'project_total', 'phase_total'].includes(data.periodType)) {
    errors.push('Invalid period type');
  }

  if (!data.periodStart) {
    errors.push('Period start date is required');
  }

  if (!data.periodEnd) {
    errors.push('Period end date is required');
  }

  if (data.periodStart && data.periodEnd && new Date(data.periodStart) > new Date(data.periodEnd)) {
    errors.push('Period start date must be before period end date');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export default {
  LABOUR_COST_SUMMARY_SCHEMA,
  createLabourCostSummary,
  validateLabourCostSummary,
};

