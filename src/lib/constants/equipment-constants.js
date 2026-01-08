/**
 * Equipment Constants
 * Client-safe constants for equipment (no MongoDB dependencies)
 * These constants can be safely imported in client components
 */

/**
 * Valid equipment types
 */
export const EQUIPMENT_TYPES = [
  'excavator',
  'crane',
  'concrete_mixer',
  'concrete_pump',
  'scaffolding',
  'compactor',
  'loader',
  'bulldozer',
  'generator',
  'welding_equipment',
  'drilling_equipment',
  'lifting_equipment',
  'transport_vehicle',
  'other'
];

/**
 * Valid acquisition types
 */
export const ACQUISITION_TYPES = ['rental', 'purchase', 'owned'];

/**
 * Valid equipment statuses
 */
export const EQUIPMENT_STATUSES = ['assigned', 'in_use', 'returned', 'maintenance'];

/**
 * Get equipment type label
 * @param {string} type - Equipment type
 * @returns {string} Formatted label
 */
export function getEquipmentTypeLabel(type) {
  const labels = {
    'excavator': 'Excavator',
    'crane': 'Crane',
    'concrete_mixer': 'Concrete Mixer',
    'concrete_pump': 'Concrete Pump',
    'scaffolding': 'Scaffolding',
    'compactor': 'Compactor',
    'loader': 'Loader',
    'bulldozer': 'Bulldozer',
    'generator': 'Generator',
    'welding_equipment': 'Welding Equipment',
    'drilling_equipment': 'Drilling Equipment',
    'lifting_equipment': 'Lifting Equipment',
    'transport_vehicle': 'Transport Vehicle',
    'other': 'Other'
  };
  return labels[type] || type;
}

/**
 * Get acquisition type label
 * @param {string} type - Acquisition type
 * @returns {string} Formatted label
 */
export function getAcquisitionTypeLabel(type) {
  const labels = {
    'rental': 'Rental',
    'purchase': 'Purchase',
    'owned': 'Owned'
  };
  return labels[type] || type;
}

/**
 * Get status color
 * @param {string} status - Equipment status
 * @returns {string} CSS color class
 */
export function getStatusColor(status) {
  const colors = {
    'assigned': 'bg-blue-100 text-blue-800',
    'in_use': 'bg-green-100 text-green-800',
    'returned': 'bg-gray-100 text-gray-800',
    'maintenance': 'bg-yellow-100 text-yellow-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}


