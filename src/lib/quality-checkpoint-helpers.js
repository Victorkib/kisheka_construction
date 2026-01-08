/**
 * Quality Checkpoint Helper Functions
 * Utilities for quality checkpoint management
 */

import { ObjectId } from 'mongodb';
// Import constants and client-safe functions for use in validation functions (server-side only)
import { QUALITY_CHECKPOINT_STATUSES, getQualityCheckpointStatistics } from '@/lib/constants/quality-checkpoint-constants';

// Re-export constants and client-safe functions from constants file for backward compatibility
export { QUALITY_CHECKPOINT_STATUSES, getQualityCheckpointStatistics };

/**
 * Create quality checkpoint object
 * @param {Object} input - Quality checkpoint input data
 * @returns {Object} Quality checkpoint object
 */
export function createQualityCheckpoint(input) {
  const {
    name,
    description,
    required = true,
    status = 'pending',
    inspectedBy,
    inspectedAt,
    notes,
    photos = []
  } = input;

  return {
    checkpointId: new ObjectId(),
    name: name?.trim() || '',
    description: description?.trim() || '',
    required: required === true,
    status: status || 'pending',
    inspectedBy: inspectedBy && ObjectId.isValid(inspectedBy) ? new ObjectId(inspectedBy) : null,
    inspectedAt: inspectedAt ? new Date(inspectedAt) : null,
    notes: notes?.trim() || '',
    photos: Array.isArray(photos) ? photos : [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Validate quality checkpoint data
 * @param {Object} data - Quality checkpoint data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateQualityCheckpoint(data) {
  const errors = [];

  if (!data.name || data.name.trim().length < 2) {
    errors.push('Quality checkpoint name is required and must be at least 2 characters');
  }

  if (data.status && !QUALITY_CHECKPOINT_STATUSES.includes(data.status)) {
    errors.push(`Status must be one of: ${QUALITY_CHECKPOINT_STATUSES.join(', ')}`);
  }

  if (data.inspectedBy && !ObjectId.isValid(data.inspectedBy)) {
    errors.push('Invalid inspectedBy user ID');
  }

  if (data.photos && !Array.isArray(data.photos)) {
    errors.push('Photos must be an array');
  }

  return { isValid: errors.length === 0, errors };
}

export default {
  QUALITY_CHECKPOINT_STATUSES,
  createQualityCheckpoint,
  validateQualityCheckpoint,
  getQualityCheckpointStatistics
};

