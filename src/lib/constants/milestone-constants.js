/**
 * Milestone Constants
 * Client-safe constants and functions for milestones (no MongoDB dependencies)
 * These constants and functions can be safely imported in client components
 */

/**
 * Milestone Statuses
 */
export const MILESTONE_STATUSES = ['pending', 'completed', 'overdue'];

/**
 * Calculate milestone status based on dates and completion
 * Client-safe version (doesn't use MongoDB)
 * @param {Object} milestone - Milestone object
 * @returns {string} Status: 'pending' | 'completed' | 'overdue'
 */
export function calculateMilestoneStatus(milestone) {
  if (milestone.actualDate) {
    return 'completed';
  }

  if (milestone.targetDate && new Date(milestone.targetDate) < new Date()) {
    return 'overdue';
  }

  return 'pending';
}

/**
 * Update milestone status for all milestones in a phase
 * Client-safe version (doesn't use MongoDB)
 * @param {Array} milestones - Array of milestone objects
 * @returns {Array} Updated milestones with calculated statuses
 */
export function updateMilestoneStatuses(milestones) {
  if (!Array.isArray(milestones)) {
    return [];
  }

  return milestones.map(milestone => ({
    ...milestone,
    status: calculateMilestoneStatus(milestone)
  }));
}

/**
 * Get milestone statistics
 * Client-safe version (doesn't use MongoDB)
 * @param {Array} milestones - Array of milestone objects
 * @returns {Object} Statistics object
 */
export function getMilestoneStatistics(milestones) {
  if (!Array.isArray(milestones)) {
    return {
      total: 0,
      completed: 0,
      pending: 0,
      overdue: 0,
      completionPercentage: 0
    };
  }

  const stats = {
    total: milestones.length,
    completed: 0,
    pending: 0,
    overdue: 0,
    completionPercentage: 0
  };

  milestones.forEach(milestone => {
    const status = calculateMilestoneStatus(milestone);
    if (status === 'completed') stats.completed++;
    else if (status === 'overdue') stats.overdue++;
    else stats.pending++;
  });

  if (stats.total > 0) {
    stats.completionPercentage = Math.round((stats.completed / stats.total) * 100);
  }

  return stats;
}

/**
 * Get status color
 * @param {string} status - Milestone status
 * @returns {string} CSS color class
 */
export function getStatusColor(status) {
  const colors = {
    'pending': 'bg-gray-100 text-gray-800',
    'completed': 'bg-green-100 text-green-800',
    'overdue': 'bg-red-100 text-red-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}


