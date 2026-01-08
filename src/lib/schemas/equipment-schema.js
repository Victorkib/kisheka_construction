/**
 * Equipment Schema Definition
 * Defines equipment tracking and management structure
 */

import { ObjectId } from 'mongodb';
// Import constants for use in validation functions (server-side only)
import { EQUIPMENT_TYPES, EQUIPMENT_STATUSES, ACQUISITION_TYPES } from '@/lib/constants/equipment-constants';

/**
 * Equipment Schema
 * @typedef {Object} EquipmentSchema
 * @property {ObjectId} _id - Equipment ID
 * @property {ObjectId} projectId - Project ID (required, indexed)
 * @property {ObjectId} phaseId - Phase ID (required, indexed)
 * @property {string} equipmentName - Equipment name (required)
 * @property {string} equipmentType - Equipment type (required)
 * @property {string} acquisitionType - 'rental' | 'purchase' | 'owned' (required)
 * @property {ObjectId} [supplierId] - Supplier ID (for rental/purchase)
 * @property {Date} startDate - Assignment start date (required)
 * @property {Date} [endDate] - Assignment end date
 * @property {number} dailyRate - Daily rental/purchase rate (required, >= 0)
 * @property {number} totalCost - Total cost (calculated)
 * @property {Object} utilization - Utilization tracking
 * @property {string} status - 'assigned' | 'in_use' | 'returned' | 'maintenance'
 * @property {string} [notes] - Additional notes
 * @property {ObjectId} createdBy - Creator user ID
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {Date} [deletedAt] - Soft delete timestamp
 */

// Re-export constants from client-safe constants file for backward compatibility
// This allows server-side code to import from schema while keeping client-side code safe
export { EQUIPMENT_TYPES, EQUIPMENT_STATUSES, ACQUISITION_TYPES };

/**
 * Equipment Schema Object
 */
export const EQUIPMENT_SCHEMA = {
  projectId: 'ObjectId', // Required
  phaseId: 'ObjectId', // Required
  equipmentName: String, // Required
  equipmentType: String, // Required
  acquisitionType: String, // Required: 'rental' | 'purchase' | 'owned'
  supplierId: 'ObjectId', // Optional
  startDate: Date, // Required
  endDate: Date, // Optional
  dailyRate: Number, // Required, >= 0
  totalCost: Number, // Calculated
  utilization: {
    estimatedHours: Number, // Default: 0
    actualHours: Number, // Default: 0
    utilizationPercentage: Number // Calculated
  },
  status: String, // Required: 'assigned' | 'in_use' | 'returned' | 'maintenance'
  notes: String, // Optional
  createdBy: 'ObjectId', // Required
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date
};

/**
 * Create equipment object
 * @param {Object} input - Equipment input data
 * @param {ObjectId} projectId - Project ID
 * @param {ObjectId} phaseId - Phase ID
 * @param {ObjectId} createdBy - Creator user ID
 * @returns {Object} Equipment object
 */
export function createEquipment(input, projectId, phaseId, createdBy) {
  const {
    equipmentName,
    equipmentType,
    acquisitionType,
    supplierId,
    startDate,
    endDate,
    dailyRate,
    estimatedHours,
    status,
    notes
  } = input;

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  const days = end 
    ? Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
    : 1; // Default to 1 day if no end date
  const totalCost = days * (parseFloat(dailyRate) || 0);

  return {
    projectId: typeof projectId === 'string' ? new ObjectId(projectId) : projectId,
    phaseId: typeof phaseId === 'string' ? new ObjectId(phaseId) : phaseId,
    equipmentName: equipmentName?.trim() || '',
    equipmentType: equipmentType || 'other',
    acquisitionType: acquisitionType || 'rental',
    supplierId: supplierId && ObjectId.isValid(supplierId) ? new ObjectId(supplierId) : null,
    startDate: start,
    endDate: end,
    dailyRate: parseFloat(dailyRate) || 0,
    totalCost: totalCost,
    utilization: {
      estimatedHours: parseFloat(estimatedHours) || 0,
      actualHours: 0,
      utilizationPercentage: 0
    },
    status: status || 'assigned',
    notes: notes?.trim() || '',
    createdBy: typeof createdBy === 'string' ? new ObjectId(createdBy) : createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  };
}

/**
 * Validate equipment data
 * @param {Object} data - Equipment data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateEquipment(data) {
  const errors = [];
  
  if (!data.projectId || !ObjectId.isValid(data.projectId)) {
    errors.push('Valid projectId is required');
  }
  
  if (!data.phaseId || !ObjectId.isValid(data.phaseId)) {
    errors.push('Valid phaseId is required');
  }
  
  if (!data.equipmentName || data.equipmentName.trim().length < 2) {
    errors.push('Equipment name is required and must be at least 2 characters');
  }
  
  if (!data.equipmentType || !EQUIPMENT_TYPES.includes(data.equipmentType)) {
    errors.push(`Equipment type is required and must be one of: ${EQUIPMENT_TYPES.join(', ')}`);
  }
  
  if (!data.acquisitionType || !ACQUISITION_TYPES.includes(data.acquisitionType)) {
    errors.push(`Acquisition type is required and must be one of: ${ACQUISITION_TYPES.join(', ')}`);
  }
  
  if (!data.startDate) {
    errors.push('Start date is required');
  }
  
  if (data.dailyRate === undefined || data.dailyRate === null || isNaN(data.dailyRate) || data.dailyRate < 0) {
    errors.push('Daily rate is required and must be >= 0');
  }
  
  if (data.status && !EQUIPMENT_STATUSES.includes(data.status)) {
    errors.push(`Status must be one of: ${EQUIPMENT_STATUSES.join(', ')}`);
  }
  
  // Validate end date is after start date
  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (end <= start) {
      errors.push('End date must be after start date');
    }
  }
  
  // Validate supplier is provided for rental/purchase
  if ((data.acquisitionType === 'rental' || data.acquisitionType === 'purchase') && !data.supplierId) {
    errors.push('Supplier is required for rental or purchase equipment');
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Calculate equipment total cost
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date (optional)
 * @param {number} dailyRate - Daily rate
 * @returns {number} Total cost
 */
export function calculateEquipmentCost(startDate, endDate, dailyRate) {
  if (!startDate || !dailyRate) return 0;
  
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(); // Use current date if no end date
  const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  
  return days * parseFloat(dailyRate);
}

/**
 * Calculate utilization percentage
 * @param {number} actualHours - Actual hours used
 * @param {number} estimatedHours - Estimated hours
 * @returns {number} Utilization percentage
 */
export function calculateUtilizationPercentage(actualHours, estimatedHours) {
  if (!estimatedHours || estimatedHours === 0) return 0;
  return Math.min(100, (actualHours / estimatedHours) * 100);
}

export default {
  EQUIPMENT_SCHEMA,
  EQUIPMENT_TYPES,
  ACQUISITION_TYPES,
  EQUIPMENT_STATUSES,
  createEquipment,
  validateEquipment,
  calculateEquipmentCost,
  calculateUtilizationPercentage
};

