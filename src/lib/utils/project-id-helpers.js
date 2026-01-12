/**
 * Project ID Helper Utilities
 * 
 * Provides consistent project ID normalization and comparison functions
 * Handles both ObjectId and string formats
 */

/**
 * Normalize a project ID to string format
 * @param {string|ObjectId|any} id - Project ID in any format
 * @returns {string|null} Normalized project ID as string, or null if invalid
 */
export function normalizeProjectId(id) {
  if (!id) return null;
  if (id === null || id === undefined) return null;
  
  // If already a string, return as is
  if (typeof id === 'string') {
    return id.trim() || null;
  }
  
  // If has toString method (ObjectId, etc.), use it
  if (typeof id.toString === 'function') {
    const str = id.toString();
    return str.trim() || null;
  }
  
  // Try to convert to string
  try {
    const str = String(id);
    return str.trim() || null;
  } catch (error) {
    console.error('Error normalizing project ID:', error);
    return null;
  }
}

/**
 * Compare two project IDs for equality
 * @param {string|ObjectId|any} id1 - First project ID
 * @param {string|ObjectId|any} id2 - Second project ID
 * @returns {boolean} True if IDs match
 */
export function projectIdsMatch(id1, id2) {
  const normalized1 = normalizeProjectId(id1);
  const normalized2 = normalizeProjectId(id2);
  
  if (!normalized1 || !normalized2) {
    return false;
  }
  
  return normalized1 === normalized2;
}

/**
 * Check if a project ID is in an array of projects
 * @param {string|ObjectId|any} projectId - Project ID to find
 * @param {Array} projects - Array of project objects
 * @returns {boolean} True if project ID is found in array
 */
export function isProjectInArray(projectId, projects) {
  if (!projectId || !Array.isArray(projects)) {
    return false;
  }
  
  const normalizedId = normalizeProjectId(projectId);
  if (!normalizedId) {
    return false;
  }
  
  return projects.some((project) => {
    const projectIdToCheck = project._id || project.id || project;
    return projectIdsMatch(normalizedId, projectIdToCheck);
  });
}

/**
 * Find a project by ID in an array
 * @param {string|ObjectId|any} projectId - Project ID to find
 * @param {Array} projects - Array of project objects
 * @returns {Object|null} Found project or null
 */
export function findProjectById(projectId, projects) {
  if (!projectId || !Array.isArray(projects)) {
    return null;
  }
  
  const normalizedId = normalizeProjectId(projectId);
  if (!normalizedId) {
    return null;
  }
  
  return projects.find((project) => {
    const projectIdToCheck = project._id || project.id || project;
    return projectIdsMatch(normalizedId, projectIdToCheck);
  }) || null;
}














