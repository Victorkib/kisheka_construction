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
 * @property {ObjectId} [floorId] - Floor ID (optional, for direct floor linkage)
 * @property {string} equipmentName - Equipment name (required)
 * @property {string} equipmentType - Equipment type (required)
 * @property {string} acquisitionType - 'rental' | 'purchase' | 'owned' (required)
 * @property {string} equipmentScope - 'phase_specific' | 'site_wide' | 'floor_specific' | 'multi_phase' (required, default: 'phase_specific')
 * @property {Array} [phaseIds] - Array of phase IDs for multi_phase equipment
 * @property {Object} [costSplit] - Cost splitting configuration for multi_phase equipment
 * @property {ObjectId} [supplierId] - Supplier ID (for rental/purchase)
 * @property {string} [serialNumber] - Serial number/asset tag
 * @property {string} [assetTag] - Asset tag for tracking
 * @property {Array} [images] - Array of Cloudinary image URLs
 * @property {Array} [documents] - Array of document objects (manuals, certificates, insurance)
 * @property {Object} [specifications] - Technical specifications
 * @property {boolean} [operatorRequired] - Whether equipment needs an operator
 * @property {string} [operatorType] - 'hired' | 'owner_employee' | 'included_in_rental' | 'self_operated'
 * @property {string} [operatorNotes] - Additional operator details
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
  phaseId: 'ObjectId', // Required for phase_specific, can be null for site_wide/multi_phase
  floorId: 'ObjectId', // Optional (for floor_specific equipment)
  phaseIds: Array, // Optional (for multi_phase equipment - array of phase IDs)
  equipmentName: String, // Required
  equipmentType: String, // Required
  acquisitionType: String, // Required: 'rental' | 'purchase' | 'owned'
  equipmentScope: String, // Required: 'phase_specific' | 'site_wide' | 'floor_specific' | 'multi_phase' (default: 'phase_specific')
  costSplit: { // Optional (for multi_phase equipment)
    type: String, // 'equal' | 'percentage' | 'usage_based'
    percentages: Object // { phaseId1: 60, phaseId2: 40 }
  },
  supplierId: 'ObjectId', // Optional
  serialNumber: String, // Optional (serial number/asset tag)
  assetTag: String, // Optional (asset tag for tracking)
  images: [String], // Optional (array of Cloudinary URLs)
  documents: [{ // Optional (array of document objects)
    type: String, // 'manual', 'certificate', 'insurance', 'other'
    name: String, // Original file name
    url: String, // Cloudinary URL
    uploadedAt: Date, // Upload timestamp
    uploadedBy: 'ObjectId' // User who uploaded
  }],
  specifications: { // Optional (technical specifications)
    modelYear: Number,
    weight: Number, // in kg or tons
    fuelType: String, // 'diesel', 'electric', 'hybrid', 'gasoline'
    capacity: String, // capacity description
    dimensions: { // l x w x h in meters
      length: Number,
      width: Number,
      height: Number
    }
  },
  operatorRequired: Boolean, // Optional (whether equipment needs an operator)
  operatorType: String, // Optional: 'hired' | 'owner_employee' | 'included_in_rental' | 'self_operated'
  operatorNotes: String, // Optional (additional operator details)
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
    equipmentScope,
    floorId,
    phaseIds,
    costSplit,
    supplierId,
    serialNumber,
    assetTag,
    images,
    documents,
    specifications,
    operatorRequired,
    operatorType,
    operatorNotes,
    startDate,
    endDate,
    dailyRate,
    estimatedHours,
    status,
    notes
  } = input;

  // Determine equipment scope
  const scope = equipmentScope || 'phase_specific';

  // Determine phaseId based on scope
  let finalPhaseId = phaseId || null;
  let finalPhaseIds = phaseIds || [];

  if (scope === 'site_wide') {
    finalPhaseId = null;
    finalPhaseIds = [];
  } else if (scope === 'multi_phase') {
    finalPhaseId = null; // Multi-phase doesn't use single phaseId
    // Ensure phaseIds is a valid array
    if (!Array.isArray(finalPhaseIds) || finalPhaseIds.length === 0) {
      finalPhaseIds = phaseId ? [phaseId] : [];
    }
  } else if (scope === 'floor_specific') {
    // Keep phaseId for floor-specific (floor belongs to a phase)
  }
  // phase_specific uses the provided phaseId

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  const days = end
    ? Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
    : 1; // Default to 1 day if no end date
  const totalCost = days * (parseFloat(dailyRate) || 0);

  // Process costSplit for multi_phase
  let finalCostSplit = null;
  if (scope === 'multi_phase' && costSplit) {
    finalCostSplit = {
      type: costSplit.type || 'equal',
      percentages: costSplit.percentages || {}
    };
  }

  return {
    projectId: typeof projectId === 'string' ? new ObjectId(projectId) : projectId,
    phaseId: finalPhaseId && ObjectId.isValid(finalPhaseId) ? (typeof finalPhaseId === 'string' ? new ObjectId(finalPhaseId) : finalPhaseId) : null,
    floorId: floorId && ObjectId.isValid(floorId) ? (typeof floorId === 'string' ? new ObjectId(floorId) : floorId) : null,
    phaseIds: finalPhaseIds.length > 0 ? finalPhaseIds.map(id =>
      typeof id === 'string' ? new ObjectId(id) : id
    ).filter(id => ObjectId.isValid(id)) : [],
    equipmentName: equipmentName?.trim() || '',
    equipmentType: equipmentType || 'other',
    acquisitionType: acquisitionType || 'rental',
    equipmentScope: scope,
    costSplit: finalCostSplit,
    supplierId: supplierId && ObjectId.isValid(supplierId) ? new ObjectId(supplierId) : null,
    serialNumber: serialNumber?.trim() || null,
    assetTag: assetTag?.trim() || null,
    images: Array.isArray(images) ? images : [],
    documents: Array.isArray(documents) ? documents : [],
    specifications: specifications || null,
    operatorRequired: operatorRequired !== undefined ? operatorRequired : null,
    operatorType: operatorType || null,
    operatorNotes: operatorNotes?.trim() || null,
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

  // Validate equipmentScope
  const validScopes = ['phase_specific', 'site_wide', 'floor_specific', 'multi_phase'];
  if (data.equipmentScope && !validScopes.includes(data.equipmentScope)) {
    errors.push(`Equipment scope must be one of: ${validScopes.join(', ')}`);
  }

  // Phase/floor validation based on scope
  const scope = data.equipmentScope || 'phase_specific';
  
  if (scope === 'phase_specific') {
    if (!data.phaseId || !ObjectId.isValid(data.phaseId)) {
      errors.push('Valid phaseId is required for phase-specific equipment');
    }
  } else if (scope === 'floor_specific') {
    if (!data.phaseId || !ObjectId.isValid(data.phaseId)) {
      errors.push('Valid phaseId is required for floor-specific equipment');
    }
    if (!data.floorId || !ObjectId.isValid(data.floorId)) {
      errors.push('Valid floorId is required for floor-specific equipment');
    }
  } else if (scope === 'multi_phase') {
    // Multi-phase requires phaseIds array
    if (!data.phaseIds || !Array.isArray(data.phaseIds) || data.phaseIds.length === 0) {
      errors.push('phaseIds array is required for multi-phase equipment');
    } else {
      // Validate each phaseId in the array
      data.phaseIds.forEach((pid, index) => {
        if (!pid || !ObjectId.isValid(pid)) {
          errors.push(`Valid phaseId required at index ${index} in phaseIds array`);
        }
      });
    }
    
    // Validate costSplit if provided
    if (data.costSplit) {
      if (data.costSplit.type && !['equal', 'percentage', 'usage_based'].includes(data.costSplit.type)) {
        errors.push('costSplit.type must be "equal", "percentage", or "usage_based"');
      }
      if (data.costSplit.type === 'percentage' && data.costSplit.percentages) {
        const total = Object.values(data.costSplit.percentages).reduce((sum, val) => sum + val, 0);
        if (Math.abs(total - 100) > 0.1) {
          errors.push(`costSplit.percentages must sum to 100 (current: ${total})`);
        }
      }
    }
  }
  // site_wide doesn't require phaseId

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

  // Validate supplier is provided for rental/purchase (only if supplier field has a value)
  // Supplier is OPTIONAL - empty string or null is acceptable
  if ((data.acquisitionType === 'rental' || data.acquisitionType === 'purchase') && 
      data.supplierId && 
      data.supplierId.trim() !== '' && 
      !ObjectId.isValid(data.supplierId)) {
    errors.push('Invalid supplier ID provided');
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

