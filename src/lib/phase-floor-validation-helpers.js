/**
 * Phase-Floor Validation Helpers
 * Validates that floors are applicable to phases based on construction phase rules
 */

import { getDatabase } from '@/lib/mongodb/connection';
import { ObjectId } from 'mongodb';

/**
 * Get target floors for a phase based on phase code
 * @param {string} phaseCode - Phase code (PHASE-01, PHASE-02, etc.)
 * @param {Array} allFloors - Array of all floors for the project
 * @returns {Array} Filtered array of floors applicable to the phase
 */
export function getTargetFloorsForPhase(phaseCode, allFloors) {
  if (phaseCode === 'PHASE-01') {
    // Basement phase: Only basement floors
    return allFloors.filter(f => f.floorNumber < 0);
  } else if (phaseCode === 'PHASE-02') {
    // Superstructure: Ground + Upper floors (not basement, not rooftop if separate)
    return allFloors.filter(f => f.floorNumber >= 0);
  } else if (phaseCode === 'PHASE-03' || phaseCode === 'PHASE-04') {
    // Finishing/Final: All floors
    return allFloors;
  }
  return [];
}

/**
 * Check if a floor is applicable to a phase
 * @param {Object} floor - Floor object with floorNumber
 * @param {string} phaseCode - Phase code (PHASE-01, PHASE-02, etc.)
 * @returns {boolean} True if floor is applicable to phase
 */
export function isFloorApplicableToPhase(floor, phaseCode) {
  if (!floor || !phaseCode) {
    return false;
  }

  const floorNumber = floor.floorNumber;

  if (phaseCode === 'PHASE-01') {
    // Basement phase: Only basement floors (floorNumber < 0)
    return floorNumber < 0;
  } else if (phaseCode === 'PHASE-02') {
    // Superstructure: Ground + Upper floors (floorNumber >= 0)
    return floorNumber >= 0;
  } else if (phaseCode === 'PHASE-03' || phaseCode === 'PHASE-04') {
    // Finishing/Final: All floors
    return true;
  }

  return false;
}

/**
 * Validate that a floor is applicable to a phase
 * @param {string} phaseId - Phase ID
 * @param {string} floorId - Floor ID (optional - if null, validation passes)
 * @param {string} projectId - Project ID (optional, for additional validation)
 * @returns {Promise<{isValid: boolean, error?: string, phase?: Object, floor?: Object, phaseCode?: string}>}
 */
export async function validatePhaseFloorApplicability(phaseId, floorId, projectId = null) {
  const db = await getDatabase();

  // If floorId is not provided, validation passes (floor is optional)
  if (!floorId || !ObjectId.isValid(floorId)) {
    return { isValid: true };
  }

  // Validate phaseId
  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return {
      isValid: false,
      error: 'Invalid phase ID'
    };
  }

  try {
    // Fetch phase
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(phaseId),
      deletedAt: null
    });

    if (!phase) {
      return {
        isValid: false,
        error: 'Phase not found'
      };
    }

    // Fetch floor
    const floor = await db.collection('floors').findOne({
      _id: new ObjectId(floorId),
      deletedAt: null
    });

    if (!floor) {
      return {
        isValid: false,
        error: 'Floor not found'
      };
    }

    // Additional validation: Check if floor belongs to same project as phase
    if (projectId && ObjectId.isValid(projectId)) {
      const phaseProjectId = phase.projectId?.toString();
      const floorProjectId = floor.projectId?.toString();
      const providedProjectId = projectId.toString();

      if (phaseProjectId !== providedProjectId || floorProjectId !== providedProjectId) {
        return {
          isValid: false,
          error: 'Phase and floor must belong to the same project',
          phase,
          floor
        };
      }
    }

    // Check phase-floor applicability
    const phaseCode = phase.phaseCode;
    const isApplicable = isFloorApplicableToPhase(floor, phaseCode);

    if (!isApplicable) {
      // Generate helpful error message
      const floorDisplay = floor.name || 
        (floor.floorNumber < 0 ? `Basement ${Math.abs(floor.floorNumber)}` :
         floor.floorNumber === 0 ? 'Ground Floor' :
         `Floor ${floor.floorNumber}`);
      
      const phaseName = phase.phaseName || phase.phaseCode;
      
      let errorMessage = `Floor '${floorDisplay}' is not applicable to phase '${phaseName}'. `;
      
      if (phaseCode === 'PHASE-01') {
        errorMessage += 'PHASE-01 (Basement/Substructure) only applies to basement floors. Please select a basement floor or remove floor assignment.';
      } else if (phaseCode === 'PHASE-02') {
        errorMessage += 'PHASE-02 (Superstructure) only applies to ground and upper floors. Please select a ground or upper floor, or remove floor assignment.';
      } else {
        errorMessage += 'Please verify the phase-floor combination is correct.';
      }

      return {
        isValid: false,
        error: errorMessage,
        phase,
        floor,
        phaseCode
      };
    }

    return {
      isValid: true,
      phase,
      floor,
      phaseCode
    };
  } catch (error) {
    console.error('Error validating phase-floor applicability:', error);
    return {
      isValid: false,
      error: `Validation error: ${error.message}`
    };
  }
}

/**
 * Get applicable floors for a phase
 * @param {string} phaseId - Phase ID
 * @param {string} projectId - Project ID (optional, will fetch from phase if not provided)
 * @returns {Promise<{success: boolean, floors?: Array, error?: string}>}
 */
export async function getApplicableFloorsForPhase(phaseId, projectId = null) {
  const db = await getDatabase();

  if (!phaseId || !ObjectId.isValid(phaseId)) {
    return {
      success: false,
      error: 'Invalid phase ID'
    };
  }

  try {
    // Fetch phase
    const phase = await db.collection('phases').findOne({
      _id: new ObjectId(phaseId),
      deletedAt: null
    });

    if (!phase) {
      return {
        success: false,
        error: 'Phase not found'
      };
    }

    const targetProjectId = projectId || phase.projectId;
    if (!targetProjectId) {
      return {
        success: false,
        error: 'Project ID not found'
      };
    }

    // Fetch all floors for the project
    const allFloors = await db.collection('floors').find({
      projectId: new ObjectId(targetProjectId),
      deletedAt: null
    }).sort({ floorNumber: 1 }).toArray();

    // Filter floors applicable to this phase
    const applicableFloors = getTargetFloorsForPhase(phase.phaseCode, allFloors);

    return {
      success: true,
      floors: applicableFloors,
      phaseCode: phase.phaseCode,
      phaseName: phase.phaseName || phase.phaseCode
    };
  } catch (error) {
    console.error('Error getting applicable floors for phase:', error);
    return {
      success: false,
      error: `Error: ${error.message}`
    };
  }
}
