/**
 * Work Item Constants
 * Client-safe constants for work items (no MongoDB dependencies)
 * These constants can be safely imported in client components
 */

/**
 * Valid work item statuses
 */
export const WORK_ITEM_STATUSES = ['not_started', 'in_progress', 'completed', 'blocked'];

/**
 * Valid work item priorities (1 = highest, 5 = lowest)
 */
export const WORK_ITEM_PRIORITIES = [1, 2, 3, 4, 5];

/**
 * Common work item categories
 */
export const WORK_ITEM_CATEGORIES = [
  'excavation',
  'foundation',
  'concrete',
  'steel',
  'masonry',
  'roofing',
  'electrical',
  'plumbing',
  'hvac',
  'painting',
  'tiling',
  'carpentry',
  'finishing',
  'inspection',
  'documentation',
  'other'
];

/**
 * Get priority label
 * @param {number} priority - Priority level (1-5)
 * @returns {string} Priority label
 */
export function getPriorityLabel(priority) {
  const labels = {
    1: 'Critical',
    2: 'High',
    3: 'Medium',
    4: 'Low',
    5: 'Very Low'
  };
  return labels[priority] || 'Medium';
}

/**
 * Get priority color
 * @param {number} priority - Priority level (1-5)
 * @returns {string} CSS color class
 */
export function getPriorityColor(priority) {
  const colors = {
    1: 'bg-red-100 text-red-800',
    2: 'bg-orange-100 text-orange-800',
    3: 'bg-yellow-100 text-yellow-800',
    4: 'bg-blue-100 text-blue-800',
    5: 'bg-gray-100 text-gray-800'
  };
  return colors[priority] || 'bg-gray-100 text-gray-800';
}

/**
 * Get status color
 * @param {string} status - Work item status
 * @returns {string} CSS color class
 */
export function getStatusColor(status) {
  const colors = {
    'not_started': 'bg-gray-100 text-gray-800',
    'in_progress': 'bg-blue-100 text-blue-800',
    'completed': 'bg-green-100 text-green-800',
    'blocked': 'bg-red-100 text-red-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}


