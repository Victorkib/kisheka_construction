/**
 * Phase Validation Helper Functions
 * Centralized validation utilities for phase-related operations
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Validate phase ID format
 * @param {string|ObjectId} phaseId - Phase ID to validate
 * @returns {boolean} True if valid format
 */
export function isValidPhaseId(phaseId) {
  if (!phaseId) return false;
  
  if (typeof phaseId === 'string') {
    return /^[0-9a-fA-F]{24}$/.test(phaseId);
  }
  
  if (typeof phaseId === 'object' && phaseId.toString) {
    return /^[0-9a-fA-F]{24}$/.test(phaseId.toString());
  }
  
  return false;
}

/**
 * Validate phase exists and belongs to project
 * @param {string|ObjectId} phaseId - Phase ID
 * @param {string|ObjectId} projectId - Project ID (optional, for project validation)
 * @param {Object} options - Validation options
 * @param {boolean} options.requireActive - Require phase to be active (not deleted) - default: true
 * @param {boolean} options.requireProjectMatch - Require phase to belong to project - default: true
 * @returns {Promise<Object>} { isValid: boolean, phase: Object|null, error: string|null }
 */
export async function validatePhase(phaseId, projectId = null, options = {}) {
  const {
    requireActive = true,
    requireProjectMatch = true
  } = options;

  // Validate phaseId format
  if (!isValidPhaseId(phaseId)) {
    return {
      isValid: false,
      phase: null,
      error: 'Invalid phaseId format. phaseId must be a valid ObjectId'
    };
  }

  // Validate projectId format if provided
  if (projectId && !isValidPhaseId(projectId)) {
    return {
      isValid: false,
      phase: null,
      error: 'Invalid projectId format. projectId must be a valid ObjectId'
    };
  }

  const db = await getDatabase();

  // Build query
  const query = {
    _id: new ObjectId(phaseId)
  };

  if (requireActive) {
    query.deletedAt = null;
  }

  if (requireProjectMatch && projectId) {
    query.projectId = new ObjectId(projectId);
  }

  // Find phase
  const phase = await db.collection('phases').findOne(query);

  if (!phase) {
    if (requireActive && requireProjectMatch && projectId) {
      return {
        isValid: false,
        phase: null,
        error: 'Phase not found, has been deleted, or does not belong to the specified project'
      };
    } else if (requireActive) {
      return {
        isValid: false,
        phase: null,
        error: 'Phase not found or has been deleted'
      };
    } else {
      return {
        isValid: false,
        phase: null,
        error: 'Phase not found'
      };
    }
  }

  // Additional validation: Check project match if projectId provided but not in query
  if (requireProjectMatch && projectId && phase.projectId.toString() !== new ObjectId(projectId).toString()) {
    return {
      isValid: false,
      phase: null,
      error: 'Phase does not belong to the specified project'
    };
  }

  return {
    isValid: true,
    phase,
    error: null
  };
}

/**
 * Validate phase for material request
 * @param {string|ObjectId} phaseId - Phase ID
 * @param {string|ObjectId} projectId - Project ID
 * @returns {Promise<Object>} { isValid: boolean, phase: Object|null, error: string|null }
 */
export async function validatePhaseForMaterialRequest(phaseId, projectId) {
  if (!phaseId) {
    return {
      isValid: false,
      phase: null,
      error: 'Phase selection is required for phase tracking and financial management. Please select a phase for this material request.'
    };
  }

  return validatePhase(phaseId, projectId, {
    requireActive: true,
    requireProjectMatch: true
  });
}

/**
 * Validate phase for expense
 * @param {string|ObjectId} phaseId - Phase ID
 * @param {string|ObjectId} projectId - Project ID
 * @returns {Promise<Object>} { isValid: boolean, phase: Object|null, error: string|null }
 */
export async function validatePhaseForExpense(phaseId, projectId) {
  if (!phaseId) {
    return {
      isValid: false,
      phase: null,
      error: 'Phase selection is required for phase tracking and financial management. Please select a phase for this expense.'
    };
  }

  return validatePhase(phaseId, projectId, {
    requireActive: true,
    requireProjectMatch: true
  });
}

/**
 * Validate phase for purchase order
 * @param {string|ObjectId} phaseId - Phase ID
 * @param {string|ObjectId} projectId - Project ID
 * @returns {Promise<Object>} { isValid: boolean, phase: Object|null, error: string|null }
 */
export async function validatePhaseForPurchaseOrder(phaseId, projectId) {
  if (!phaseId) {
    return {
      isValid: false,
      phase: null,
      error: 'Phase selection is required. Please select a phase for this purchase order.'
    };
  }

  return validatePhase(phaseId, projectId, {
    requireActive: true,
    requireProjectMatch: true
  });
}

/**
 * Validate phase for work item
 * @param {string|ObjectId} phaseId - Phase ID
 * @param {string|ObjectId} projectId - Project ID
 * @returns {Promise<Object>} { isValid: boolean, phase: Object|null, error: string|null }
 */
export async function validatePhaseForWorkItem(phaseId, projectId) {
  if (!phaseId) {
    return {
      isValid: false,
      phase: null,
      error: 'Phase selection is required for work items. Please select a phase.'
    };
  }

  return validatePhase(phaseId, projectId, {
    requireActive: true,
    requireProjectMatch: true
  });
}

/**
 * Validate phase for equipment
 * @param {string|ObjectId} phaseId - Phase ID
 * @param {string|ObjectId} projectId - Project ID
 * @returns {Promise<Object>} { isValid: boolean, phase: Object|null, error: string|null }
 */
export async function validatePhaseForEquipment(phaseId, projectId) {
  if (!phaseId) {
    return {
      isValid: false,
      phase: null,
      error: 'Phase selection is required for equipment. Please select a phase.'
    };
  }

  return validatePhase(phaseId, projectId, {
    requireActive: true,
    requireProjectMatch: true
  });
}

/**
 * Validate phase for subcontractor
 * @param {string|ObjectId} phaseId - Phase ID
 * @param {string|ObjectId} projectId - Project ID
 * @returns {Promise<Object>} { isValid: boolean, phase: Object|null, error: string|null }
 */
export async function validatePhaseForSubcontractor(phaseId, projectId) {
  if (!phaseId) {
    return {
      isValid: false,
      phase: null,
      error: 'Phase selection is required for subcontractors. Please select a phase.'
    };
  }

  return validatePhase(phaseId, projectId, {
    requireActive: true,
    requireProjectMatch: true
  });
}

