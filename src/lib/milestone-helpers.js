/**
 * Milestone Helper Functions
 * Utilities for milestone management and calculations
 */

import { ObjectId } from 'mongodb';
// Import constants for use in validation functions (server-side only)
import { MILESTONE_STATUSES, calculateMilestoneStatus, updateMilestoneStatuses, getMilestoneStatistics } from '@/lib/constants/milestone-constants';

// Re-export constants and client-safe functions from constants file for backward compatibility
export { MILESTONE_STATUSES, calculateMilestoneStatus, updateMilestoneStatuses, getMilestoneStatistics };

/**
 * Create milestone object
 * @param {Object} input - Milestone input data
 * @returns {Object} Milestone object
 */
export function createMilestone(input) {
  const {
    name,
    description,
    targetDate,
    actualDate,
    completionCriteria = [],
    signOffRequired = false,
    signOffBy,
    signOffDate,
    signOffNotes
  } = input;

  const milestone = {
    milestoneId: new ObjectId(),
    name: name?.trim() || '',
    description: description?.trim() || '',
    targetDate: targetDate ? new Date(targetDate) : null,
    actualDate: actualDate ? new Date(actualDate) : null,
    status: 'pending', // Will be calculated
    completionCriteria: Array.isArray(completionCriteria) ? completionCriteria : [],
    signOffRequired: signOffRequired === true,
    signOffBy: signOffBy && ObjectId.isValid(signOffBy) ? new ObjectId(signOffBy) : null,
    signOffDate: signOffDate ? new Date(signOffDate) : null,
    signOffNotes: signOffNotes?.trim() || '',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Calculate status
  milestone.status = calculateMilestoneStatus(milestone);

  return milestone;
}

// calculateMilestoneStatus is now exported from constants file
// It doesn't use MongoDB, so it's safe to re-export

/**
 * Validate milestone data
 * @param {Object} data - Milestone data to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateMilestone(data) {
  const errors = [];

  if (!data.name || data.name.trim().length < 2) {
    errors.push('Milestone name is required and must be at least 2 characters');
  }

  if (!data.targetDate) {
    errors.push('Target date is required');
  }

  if (data.completionCriteria && !Array.isArray(data.completionCriteria)) {
    errors.push('Completion criteria must be an array');
  }

  if (data.signOffBy && !ObjectId.isValid(data.signOffBy)) {
    errors.push('Invalid signOffBy user ID');
  }

  return { isValid: errors.length === 0, errors };
}

// updateMilestoneStatuses is now exported from constants file
// It doesn't use MongoDB, so it's safe to re-export

// getMilestoneStatistics is now exported from constants file
// It doesn't use MongoDB, so it's safe to re-export

export default {
  MILESTONE_STATUSES,
  createMilestone,
  calculateMilestoneStatus,
  validateMilestone,
  updateMilestoneStatuses,
  getMilestoneStatistics
};

