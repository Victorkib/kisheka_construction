/**
 * Phase Dependency Helper Functions
 * Utilities for managing phase dependencies and sequencing
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Validate phase dependencies (no circular dependencies, all exist, belong to same project)
 * @param {string|null} phaseId - Phase ID (null for new phases)
 * @param {Array<string>} dependsOn - Array of phase IDs this phase depends on
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} { isValid: boolean, errors: string[] }
 */
export async function validatePhaseDependencies(phaseId, dependsOn, projectId) {
  const db = await getDatabase();
  const errors = [];

  if (!dependsOn || dependsOn.length === 0) {
    return { isValid: true, errors: [] };
  }

  if (!projectId || !ObjectId.isValid(projectId)) {
    errors.push('Valid projectId is required for dependency validation');
    return { isValid: false, errors };
  }

  // Check all dependencies exist and belong to same project
  for (const depId of dependsOn) {
    if (!ObjectId.isValid(depId)) {
      errors.push(`Invalid dependency phase ID format: ${depId}`);
      continue;
    }

    const depPhase = await db.collection('phases').findOne({
      _id: new ObjectId(depId),
      projectId: new ObjectId(projectId),
      deletedAt: null
    });

    if (!depPhase) {
      errors.push(`Dependency phase ${depId} not found or does not belong to this project`);
    }

    // Check for self-dependency
    if (phaseId && depId === phaseId.toString()) {
      errors.push('Phase cannot depend on itself');
    }
  }

  // Check for circular dependencies (only if phaseId is provided)
  if (phaseId && ObjectId.isValid(phaseId)) {
    const hasCircular = await checkCircularDependencies(phaseId, dependsOn, projectId);
    if (hasCircular) {
      errors.push('Circular dependency detected: This phase would create a dependency cycle');
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Check for circular dependencies
 * Uses depth-first search to detect cycles in the dependency graph
 * @param {string} phaseId - Phase ID to check
 * @param {Array<string>} dependsOn - Array of phase IDs this phase depends on
 * @param {string} projectId - Project ID
 * @returns {Promise<boolean>} True if circular dependency exists
 */
async function checkCircularDependencies(phaseId, dependsOn, projectId) {
  const db = await getDatabase();
  const visited = new Set();
  const recursionStack = new Set();

  /**
   * Recursive function to check if a path exists from currentPhase to targetPhase
   * @param {string} currentPhaseId - Current phase being checked
   * @param {string} targetPhaseId - Phase we're trying to reach (the one that would create a cycle)
   * @returns {Promise<boolean>} True if path exists (cycle detected)
   */
  async function hasPathTo(currentPhaseId, targetPhaseId) {
    const currentIdStr = currentPhaseId.toString();
    const targetIdStr = targetPhaseId.toString();

    // If we've reached the target, cycle detected
    if (currentIdStr === targetIdStr) {
      return true;
    }

    // If we're in the recursion stack, we've found a cycle
    if (recursionStack.has(currentIdStr)) {
      return true;
    }

    // If we've already visited this node in a different path, no cycle from here
    if (visited.has(currentIdStr)) {
      return false;
    }

    // Mark as visited and add to recursion stack
    visited.add(currentIdStr);
    recursionStack.add(currentIdStr);

    try {
      // Get current phase's dependencies
      const phase = await db.collection('phases').findOne({
        _id: new ObjectId(currentPhaseId),
        projectId: new ObjectId(projectId),
        deletedAt: null
      });

      if (!phase || !phase.dependsOn || phase.dependsOn.length === 0) {
        recursionStack.delete(currentIdStr);
        return false;
      }

      // Check each dependency recursively
      for (const depId of phase.dependsOn) {
        const depIdStr = depId.toString();
        if (await hasPathTo(depIdStr, targetPhaseId)) {
          return true; // Cycle found
        }
      }

      recursionStack.delete(currentIdStr);
      return false;
    } catch (error) {
      console.error('Error checking circular dependencies:', error);
      recursionStack.delete(currentIdStr);
      return false;
    }
  }

  // Check if any of the new dependencies would create a path back to this phase
  for (const depId of dependsOn) {
    if (!ObjectId.isValid(depId)) {
      continue;
    }

    // Reset visited set for each dependency check
    visited.clear();
    recursionStack.clear();

    // Check if this dependency (or any of its dependencies) leads back to phaseId
    if (await hasPathTo(depId, phaseId)) {
      return true; // Circular dependency found
    }
  }

  return false; // No circular dependencies
}

/**
 * Calculate earliest start date based on dependencies
 * Returns the latest end date among all dependency phases
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Date|null>} Earliest start date or null if no dependencies
 */
export async function calculatePhaseStartDate(phaseId) {
  const db = await getDatabase();

  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return null;
  }

  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null
  });

  if (!phase || !phase.dependsOn || phase.dependsOn.length === 0) {
    return null;
  }

  // Get all dependency phases
  const dependencyIds = phase.dependsOn
    .filter(id => ObjectId.isValid(id))
    .map(id => new ObjectId(id));

  if (dependencyIds.length === 0) {
    return null;
  }

  const dependencies = await db.collection('phases').find({
    _id: { $in: dependencyIds },
    deletedAt: null
  }).toArray();

  // Find latest end date among dependencies
  let latestEndDate = null;

  for (const dep of dependencies) {
    // Priority: actualEndDate > plannedEndDate
    const endDate = dep.actualEndDate || dep.plannedEndDate;
    if (endDate) {
      const date = new Date(endDate);
      if (!latestEndDate || date > latestEndDate) {
        latestEndDate = date;
      }
    }
  }

  return latestEndDate;
}

/**
 * Check if phase can be started (all dependencies completed)
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Object>} { canStart: boolean, reason: string, blockingPhases: Array }
 */
export async function canPhaseStart(phaseId) {
  const db = await getDatabase();

  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return {
      canStart: false,
      reason: 'Invalid phase ID',
      blockingPhases: []
    };
  }

  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null
  });

  if (!phase) {
    return {
      canStart: false,
      reason: 'Phase not found',
      blockingPhases: []
    };
  }

  // If no dependencies, phase can start
  if (!phase.dependsOn || phase.dependsOn.length === 0) {
    return {
      canStart: true,
      reason: 'No dependencies',
      blockingPhases: []
    };
  }

  // Get all dependency phases
  const dependencyIds = phase.dependsOn
    .filter(id => ObjectId.isValid(id))
    .map(id => new ObjectId(id));

  if (dependencyIds.length === 0) {
    return {
      canStart: true,
      reason: 'No valid dependencies',
      blockingPhases: []
    };
  }

  const dependencies = await db.collection('phases').find({
    _id: { $in: dependencyIds },
    deletedAt: null
  }).toArray();

  // Check if all dependencies are completed
  const blockingPhases = [];
  for (const dep of dependencies) {
    if (dep.status !== 'completed') {
      blockingPhases.push({
        phaseId: dep._id.toString(),
        phaseName: dep.phaseName || dep.name || 'Unknown',
        phaseCode: dep.phaseCode || '',
        status: dep.status,
        completionPercentage: dep.completionPercentage || 0
      });
    }
  }

  if (blockingPhases.length > 0) {
    const phaseNames = blockingPhases.map(p => p.phaseName).join(', ');
    return {
      canStart: false,
      reason: `Cannot start: ${blockingPhases.length} prerequisite phase(s) not completed: ${phaseNames}`,
      blockingPhases
    };
  }

  // All dependencies completed, but check canStartAfter date
  const canStartAfter = await calculatePhaseStartDate(phaseId);
  if (canStartAfter && new Date() < canStartAfter) {
    return {
      canStart: false,
      reason: `Cannot start before ${canStartAfter.toLocaleDateString()}: Waiting for dependency phases to complete`,
      blockingPhases: [],
      canStartAfter
    };
  }

  return {
    canStart: true,
    reason: 'All dependencies completed',
    blockingPhases: []
  };
}

/**
 * Get all phases that depend on a given phase
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Array>} Array of phases that depend on this phase
 */
export async function getDependentPhases(phaseId) {
  const db = await getDatabase();

  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return [];
  }

  // Find phases where dependsOn array contains this phaseId
  const dependentPhases = await db.collection('phases').find({
    dependsOn: { $in: [new ObjectId(phaseId)] },
    deletedAt: null
  }).toArray();

  return dependentPhases.map(phase => ({
    phaseId: phase._id.toString(),
    phaseName: phase.phaseName || phase.name || 'Unknown',
    phaseCode: phase.phaseCode || '',
    status: phase.status,
    canStartAfter: phase.canStartAfter
  }));
}

/**
 * Get all prerequisite phases for a given phase
 * @param {string} phaseId - Phase ID
 * @returns {Promise<Array>} Array of prerequisite phases
 */
export async function getPrerequisitePhases(phaseId) {
  const db = await getDatabase();

  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return [];
  }

  const phase = await db.collection('phases').findOne({
    _id: new ObjectId(phaseId),
    deletedAt: null
  });

  if (!phase || !phase.dependsOn || phase.dependsOn.length === 0) {
    return [];
  }

  const prerequisiteIds = phase.dependsOn
    .filter(id => ObjectId.isValid(id))
    .map(id => new ObjectId(id));

  if (prerequisiteIds.length === 0) {
    return [];
  }

  const prerequisites = await db.collection('phases').find({
    _id: { $in: prerequisiteIds },
    deletedAt: null
  }).toArray();

  return prerequisites.map(phase => ({
    phaseId: phase._id.toString(),
    phaseName: phase.phaseName || phase.name || 'Unknown',
    phaseCode: phase.phaseCode || '',
    status: phase.status,
    completionPercentage: phase.completionPercentage || 0,
    actualEndDate: phase.actualEndDate,
    plannedEndDate: phase.plannedEndDate
  }));
}

