/**
 * Subcontractor Constants
 * Client-safe constants for subcontractors (no MongoDB dependencies)
 * These constants can be safely imported in client components
 */

/**
 * Valid subcontractor types
 */
export const SUBCONTRACTOR_TYPES = [
  'electrical',
  'plumbing',
  'roofing',
  'hvac',
  'painting',
  'tiling',
  'carpentry',
  'concrete',
  'steel',
  'masonry',
  'excavation',
  'landscaping',
  'other'
];

/**
 * Valid contract types
 */
export const CONTRACT_TYPES = ['fixed_price', 'time_material', 'cost_plus'];

/**
 * Valid subcontractor statuses
 */
export const SUBCONTRACTOR_STATUSES = ['pending', 'active', 'completed', 'terminated'];

/**
 * Get subcontractor type label
 * @param {string} type - Subcontractor type
 * @returns {string} Formatted label
 */
export function getSubcontractorTypeLabel(type) {
  const labels = {
    'electrical': 'Electrical',
    'plumbing': 'Plumbing',
    'roofing': 'Roofing',
    'hvac': 'HVAC',
    'painting': 'Painting',
    'tiling': 'Tiling',
    'carpentry': 'Carpentry',
    'concrete': 'Concrete',
    'steel': 'Steel',
    'masonry': 'Masonry',
    'excavation': 'Excavation',
    'landscaping': 'Landscaping',
    'other': 'Other'
  };
  return labels[type] || type;
}

/**
 * Get contract type label
 * @param {string} type - Contract type
 * @returns {string} Formatted label
 */
export function getContractTypeLabel(type) {
  const labels = {
    'fixed_price': 'Fixed Price',
    'time_material': 'Time & Material',
    'cost_plus': 'Cost Plus'
  };
  return labels[type] || type;
}

/**
 * Get status color
 * @param {string} status - Subcontractor status
 * @returns {string} CSS color class
 */
export function getStatusColor(status) {
  const colors = {
    'pending': 'bg-yellow-100 text-yellow-800',
    'active': 'bg-green-100 text-green-800',
    'completed': 'bg-blue-100 text-blue-800',
    'terminated': 'bg-red-100 text-red-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Calculate total paid from payment schedule
 * Client-safe version (doesn't use MongoDB)
 * @param {Array} paymentSchedule - Payment schedule array
 * @returns {number} Total paid amount
 */
export function calculateTotalPaid(paymentSchedule) {
  if (!Array.isArray(paymentSchedule)) return 0;
  return paymentSchedule
    .filter(payment => payment.paid === true)
    .reduce((total, payment) => total + (parseFloat(payment.amount) || 0), 0);
}

/**
 * Calculate total unpaid from payment schedule
 * Client-safe version (doesn't use MongoDB)
 * @param {Array} paymentSchedule - Payment schedule array
 * @returns {number} Total unpaid amount
 */
export function calculateTotalUnpaid(paymentSchedule) {
  if (!Array.isArray(paymentSchedule)) return 0;
  return paymentSchedule
    .filter(payment => payment.paid !== true)
    .reduce((total, payment) => total + (parseFloat(payment.amount) || 0), 0);
}


