/**
 * Labour Entry Auto-Population Hook
 * Handles URL parameter parsing and form auto-population
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { URL_PARAM_MAPPING, detectEntryMode, getEntryModeConfig } from '@/lib/constants/labour-entry-modes';

/**
 * Hook to auto-populate labour entry form from URL parameters
 * @param {Object} options - Hook options
 * @param {function} options.onPopulate - Callback when form is populated
 * @param {function} options.onModeChange - Callback when entry mode changes
 * @returns {Object} Auto-population state and handlers
 */
export function useLabourEntryAutoPopulate({
  onPopulate,
  onModeChange,
} = {}) {
  const searchParams = useSearchParams();
  const [entryMode, setEntryMode] = useState('general');
  const [autoPopulatedFields, setAutoPopulatedFields] = useState({});
  const [contextData, setContextData] = useState({
    equipment: null,
    worker: null,
    workItem: null,
    project: null,
    phase: null,
    floor: null,
    subcontractor: null,
  });
  const [loading, setLoading] = useState(true);

  /**
   * Parse URL parameters and map to form fields
   */
  const parseURLParams = useCallback(() => {
    const params = Object.fromEntries(searchParams.entries());
    const mappedFields = {};
    const contextIds = {};

    // Map URL parameters to form fields
    Object.entries(URL_PARAM_MAPPING).forEach(([param, field]) => {
      if (params[param]) {
        mappedFields[field] = params[param];
      }
    });

    // Extract context IDs for data fetching
    if (mappedFields.equipmentId) contextIds.equipmentId = mappedFields.equipmentId;
    if (mappedFields.workerId) contextIds.workerId = mappedFields.workerId;
    if (mappedFields.workItemId) contextIds.workItemId = mappedFields.workItemId;
    if (mappedFields.projectId) contextIds.projectId = mappedFields.projectId;
    if (mappedFields.phaseId) contextIds.phaseId = mappedFields.phaseId;
    if (mappedFields.floorId) contextIds.floorId = mappedFields.floorId;
    if (mappedFields.subcontractorId) contextIds.subcontractorId = mappedFields.subcontractorId;

    return { mappedFields, contextIds, params };
  }, [searchParams]);

  /**
   * Fetch context data (equipment, worker, work item details)
   */
  const fetchContextData = useCallback(async (contextIds, currentMappedFields) => {
    const context = {};
    const updatedMappedFields = { ...currentMappedFields };

    try {
      // Fetch equipment details
      if (contextIds.equipmentId) {
        try {
          const response = await fetch(`/api/equipment/${contextIds.equipmentId}`, {
            cache: 'no-store',
          });
          const data = await response.json();
          if (data.success) {
            context.equipment = data.data;
            // Auto-populate project/phase/floor from equipment
            if (data.data.projectId && !updatedMappedFields.projectId) {
              updatedMappedFields.projectId = data.data.projectId;
            }
            if (data.data.phaseId && !updatedMappedFields.phaseId) {
              updatedMappedFields.phaseId = data.data.phaseId;
            }
            if (data.data.floorId && !updatedMappedFields.floorId) {
              updatedMappedFields.floorId = data.data.floorId;
            }
          }
        } catch (err) {
          console.error('Error fetching equipment:', err);
        }
      }

      // Fetch worker details
      if (contextIds.workerId) {
        try {
          const response = await fetch(`/api/labour/workers/${contextIds.workerId}`, {
            cache: 'no-store',
          });
          const data = await response.json();
          if (data.success) {
            context.worker = data.data;
          }
        } catch (err) {
          console.error('Error fetching worker:', err);
        }
      }

      // Fetch work item details
      if (contextIds.workItemId) {
        try {
          const response = await fetch(`/api/work-items/${contextIds.workItemId}`, {
            cache: 'no-store',
          });
          const data = await response.json();
          if (data.success) {
            context.workItem = data.data;
            // Auto-fill phase and project from work item
            if (data.data.phaseId) updatedMappedFields.phaseId = data.data.phaseId;
            if (data.data.projectId) updatedMappedFields.projectId = data.data.projectId;
          }
        } catch (err) {
          console.error('Error fetching work item:', err);
        }
      }

      // Fetch project details
      if (contextIds.projectId) {
        try {
          const response = await fetch(`/api/projects/${contextIds.projectId}`, {
            cache: 'no-store',
          });
          const data = await response.json();
          if (data.success) {
            context.project = data.data;
          }
        } catch (err) {
          console.error('Error fetching project:', err);
        }
      }

      // Fetch phase details
      if (contextIds.phaseId) {
        try {
          const response = await fetch(`/api/phases/${contextIds.phaseId}`, {
            cache: 'no-store',
          });
          const data = await response.json();
          if (data.success) {
            context.phase = data.data;
          }
        } catch (err) {
          console.error('Error fetching phase:', err);
        }
      }

      setContextData(context);
    } catch (err) {
      console.error('Error fetching context data:', err);
    } finally {
      setLoading(false);
    }

    return { context, updatedMappedFields };
  }, []);

  /**
   * Main auto-population effect
   */
  useEffect(() => {
    const runAutoPopulation = async () => {
      setLoading(true);

      // Parse URL parameters
      const { mappedFields, contextIds, params } = parseURLParams();

      // Detect entry mode
      const detectedMode = detectEntryMode(searchParams);
      setEntryMode(detectedMode);

      // Fetch context data
      const { context, updatedMappedFields } = await fetchContextData(contextIds, mappedFields);

      // Build auto-populated form data
      const autoPopulate = { ...updatedMappedFields };

      // Enhance with context-based auto-fill
      if (detectedMode === 'equipment_operator') {
        // Auto-fill from equipment and assignment
        if (context.equipment) {
          if (!autoPopulate.hourlyRate && context.equipment.dailyRate) {
            // Calculate hourly rate from equipment daily rate
            autoPopulate.hourlyRate = (context.equipment.dailyRate / 8).toFixed(2);
          }
          if (!autoPopulate.taskDescription) {
            autoPopulate.taskDescription = `Operating ${context.equipment.equipmentName}`;
          }
        }
        if (context.worker && !autoPopulate.hourlyRate) {
          // Use worker's default rate
          autoPopulate.hourlyRate = context.worker.defaultHourlyRate?.toString() || '';
        }
      }

      if (detectedMode === 'work_item' && context.workItem) {
        // Auto-fill phase and project from work item
        if (context.workItem.phaseId) autoPopulate.phaseId = context.workItem.phaseId;
        if (context.workItem.projectId) autoPopulate.projectId = context.workItem.projectId;
      }

      if (detectedMode === 'professional' && context.worker) {
        // Use professional's default rate
        if (!autoPopulate.hourlyRate && context.worker.defaultHourlyRate) {
          autoPopulate.hourlyRate = (context.worker.defaultHourlyRate * 1.5).toFixed(2); // Professionals charge more
        }
      }

      // Always ensure we have workerName if context has it
      if (context.worker && !autoPopulate.workerName) {
        autoPopulate.workerName = context.worker.workerName || context.worker.name || '';
      }

      // Set auto-populated fields
      setAutoPopulatedFields(autoPopulate);

      // Callbacks
      if (onPopulate) {
        onPopulate(autoPopulate, context, detectedMode);
      }

      if (onModeChange) {
        onModeChange(detectedMode, context);
      }

      setLoading(false);
    };

    runAutoPopulation();
  }, [searchParams, onPopulate, onModeChange, parseURLParams, fetchContextData]);

  return {
    entryMode,
    autoPopulatedFields,
    contextData,
    loading,
    config: getEntryModeConfig(entryMode),
  };
}

/**
 * Build URL parameters for labour entry navigation
 * @param {Object} context - Context data
 * @param {string} entryMode - Entry mode
 * @returns {string} URL query string
 */
export function buildLabourEntryURL(context, entryMode = 'general') {
  const params = new URLSearchParams();

  // Always add entry mode hint
  params.set('entryMode', entryMode);

  // Add context-specific parameters
  if (context.equipmentId) {
    params.set('equipmentId', context.equipmentId);
    params.set('entryMode', 'equipment_operator');
  }

  if (context.workerId) {
    params.set('workerId', context.workerId);
  }

  if (context.workItemId) {
    params.set('workItemId', context.workItemId);
    params.set('entryMode', 'work_item');
  }

  if (context.projectId) params.set('projectId', context.projectId);
  if (context.phaseId) params.set('phaseId', context.phaseId);
  if (context.floorId) params.set('floorId', context.floorId);
  if (context.subcontractorId) {
    params.set('subcontractorId', context.subcontractorId);
    params.set('entryMode', 'subcontractor');
  }

  // Add rate information if available
  if (context.hourlyRate) params.set('hourlyRate', context.hourlyRate.toString());
  if (context.dailyRate) params.set('dailyRate', context.dailyRate.toString());

  // Add task description
  if (context.taskDescription) {
    params.set('taskDescription', context.taskDescription);
  }

  return params.toString();
}

export default {
  useLabourEntryAutoPopulate,
  buildLabourEntryURL,
};
