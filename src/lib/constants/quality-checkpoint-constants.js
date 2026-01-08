/**
 * Quality Checkpoint Constants
 * Client-safe constants for quality checkpoints (no MongoDB dependencies)
 * These constants can be safely imported in client components
 */

/**
 * Quality Checkpoint Statuses
 */
export const QUALITY_CHECKPOINT_STATUSES = ['pending', 'passed', 'failed', 'waived'];

/**
 * Get quality checkpoint statistics
 * Client-safe version (doesn't use MongoDB)
 * @param {Array} checkpoints - Array of quality checkpoint objects
 * @returns {Object} Statistics object
 */
export function getQualityCheckpointStatistics(checkpoints) {
  if (!Array.isArray(checkpoints)) {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      pending: 0,
      waived: 0,
      required: 0,
      optional: 0,
      passRate: 0
    };
  }

  const stats = {
    total: checkpoints.length,
    passed: 0,
    failed: 0,
    pending: 0,
    waived: 0,
    required: 0,
    optional: 0,
    passRate: 0
  };

  checkpoints.forEach(checkpoint => {
    if (checkpoint.status === 'passed') stats.passed++;
    else if (checkpoint.status === 'failed') stats.failed++;
    else if (checkpoint.status === 'waived') stats.waived++;
    else stats.pending++;

    if (checkpoint.required) stats.required++;
    else stats.optional++;
  });

  // Calculate pass rate (passed / (passed + failed))
  const inspected = stats.passed + stats.failed;
  if (inspected > 0) {
    stats.passRate = Math.round((stats.passed / inspected) * 100);
  }

  return stats;
}

/**
 * Get status color
 * @param {string} status - Quality checkpoint status
 * @returns {string} CSS color class
 */
export function getStatusColor(status) {
  const colors = {
    'pending': 'bg-gray-100 text-gray-800',
    'passed': 'bg-green-100 text-green-800',
    'failed': 'bg-red-100 text-red-800',
    'waived': 'bg-yellow-100 text-yellow-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}


