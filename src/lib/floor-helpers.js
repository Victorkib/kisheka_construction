/**
 * Floor Display Helpers
 * Utility functions for formatting and displaying floor information
 */

/**
 * Get display name for a floor based on floor number
 * @param {number} floorNumber - Floor number (can be negative for basements)
 * @param {string} [customName] - Custom floor name (optional)
 * @returns {string} Formatted floor display name
 */
export function getFloorDisplayName(floorNumber, customName = null) {
  if (customName) {
    return customName;
  }
  
  if (floorNumber === undefined || floorNumber === null) {
    return 'N/A';
  }
  
  if (floorNumber < 0) {
    return `Basement ${Math.abs(floorNumber)}`;
  }
  
  if (floorNumber === 0) {
    return 'Ground Floor';
  }
  
  return `Floor ${floorNumber}`;
}

/**
 * Get floor number with label for display
 * @param {number} floorNumber - Floor number
 * @returns {string} Formatted floor number with label
 */
export function getFloorNumberLabel(floorNumber) {
  if (floorNumber === undefined || floorNumber === null) {
    return 'N/A';
  }
  
  if (floorNumber < 0) {
    return `Basement ${Math.abs(floorNumber)} (${floorNumber})`;
  }
  
  if (floorNumber === 0) {
    return `Ground Floor (${floorNumber})`;
  }
  
  return `Floor ${floorNumber} (${floorNumber})`;
}

/**
 * Get floor type category
 * @param {number} floorNumber - Floor number
 * @returns {string} 'basement', 'ground', or 'above-ground'
 */
export function getFloorType(floorNumber) {
  if (floorNumber === undefined || floorNumber === null) {
    return 'unknown';
  }
  
  if (floorNumber < 0) {
    return 'basement';
  }
  
  if (floorNumber === 0) {
    return 'ground';
  }
  
  return 'above-ground';
}

/**
 * Get color class for floor display based on type
 * @param {number} floorNumber - Floor number
 * @returns {string} Tailwind CSS color class
 */
export function getFloorColorClass(floorNumber) {
  const type = getFloorType(floorNumber);
  
  switch (type) {
    case 'basement':
      return 'text-purple-900';
    case 'ground':
      return 'text-blue-900';
    case 'above-ground':
      return 'text-gray-900';
    default:
      return 'text-gray-500';
  }
}

/**
 * Sort floors by floor number (basements first, then ground, then above-ground)
 * @param {Array} floors - Array of floor objects
 * @returns {Array} Sorted floors
 */
export function sortFloorsByNumber(floors) {
  return [...floors].sort((a, b) => {
    const aNum = a.floorNumber ?? 0;
    const bNum = b.floorNumber ?? 0;
    return aNum - bNum;
  });
}

/**
 * Group floors by type
 * @param {Array} floors - Array of floor objects
 * @returns {Object} Grouped floors: { basements: [], ground: [], aboveGround: [] }
 */
export function groupFloorsByType(floors) {
  return floors.reduce((groups, floor) => {
    const type = getFloorType(floor.floorNumber);
    
    if (type === 'basement') {
      groups.basements.push(floor);
    } else if (type === 'ground') {
      groups.ground.push(floor);
    } else {
      groups.aboveGround.push(floor);
    }
    
    return groups;
  }, { basements: [], ground: [], aboveGround: [] });
}




