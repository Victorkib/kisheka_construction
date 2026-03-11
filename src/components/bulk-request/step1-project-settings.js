/**
 * Step 1: Project & Settings Component
 * Form for selecting project and default settings for bulk request
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function Step1ProjectSettings({ wizardData, onUpdate, onValidationChange }) {
  const [projects, setProjects] = useState([]);
  const [floors, setFloors] = useState([]);
  const [applicableFloors, setApplicableFloors] = useState([]);
  const [nonApplicableFloors, setNonApplicableFloors] = useState([]);
  const [selectedPhaseInfo, setSelectedPhaseInfo] = useState(null);
  const [phases, setPhases] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loadingApplicableFloors, setLoadingApplicableFloors] = useState(false);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
    fetchCategories();
  }, []);

  // Fetch floors and phases when project changes
  useEffect(() => {
    if (wizardData.projectId) {
      fetchFloors(wizardData.projectId);
      fetchPhases(wizardData.projectId);
    } else {
      setFloors([]);
      setPhases([]);
      setApplicableFloors([]);
      setNonApplicableFloors([]);
      setSelectedPhaseInfo(null);
    }
  }, [wizardData.projectId]);

  // Fetch applicable floors when phase changes
  useEffect(() => {
    if (wizardData.projectId && wizardData.defaultPhaseId) {
      fetchApplicableFloors(wizardData.defaultPhaseId, wizardData.projectId);
    } else {
      setApplicableFloors([]);
      setNonApplicableFloors([]);
      setSelectedPhaseInfo(null);
      // Only clear floor if phase is cleared (not if phase is being set)
      if (!wizardData.defaultPhaseId && wizardData.defaultFloorId) {
        // Don't clear floor here - let user decide or validation will catch it
      }
    }
  }, [wizardData.defaultPhaseId, wizardData.projectId]);

  // Validate and notify parent
  // Phase is now required: either defaultPhaseId must be set, or validation will check per-material in Step 3
  // For Step 1, we require defaultPhaseId for simplicity (users can override per-material in Step 3)
  useEffect(() => {
    const isValid = !!wizardData.projectId && !!wizardData.defaultPhaseId;
    onValidationChange(isValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.projectId, wizardData.defaultPhaseId]); // onValidationChange is stable (memoized in parent)

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch('/api/projects', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
        // Auto-select first project if only one exists
        if (data.data && data.data.length === 1 && !wizardData.projectId) {
          onUpdate({ projectId: data.data[0]._id });
        }
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchFloors = async (projectId) => {
    if (!projectId) {
      setFloors([]);
      return;
    }
    setLoadingFloors(true);
    try {
      const response = await fetch(`/api/floors?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setFloors(data.data || []);
        // Clear floor selection if current floor is not in the new list
        if (wizardData.defaultFloorId) {
          const floorExists = data.data.some((f) => f._id === wizardData.defaultFloorId);
          if (!floorExists) {
            onUpdate({ defaultFloorId: '' });
          }
        }
      }
    } catch (err) {
      console.error('Error fetching floors:', err);
      setFloors([]);
    } finally {
      setLoadingFloors(false);
    }
  };

  const fetchPhases = async (projectId) => {
    if (!projectId) {
      setPhases([]);
      return;
    }
    setLoadingPhases(true);
    try {
      const response = await fetch(`/api/phases?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
        // Clear phase selection if current phase is not in the new list
        if (wizardData.defaultPhaseId) {
          const phaseExists = data.data.some((p) => p._id === wizardData.defaultPhaseId);
          if (!phaseExists) {
            onUpdate({ defaultPhaseId: '' });
          }
        }
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
      setPhases([]);
    } finally {
      setLoadingPhases(false);
    }
  };

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const response = await fetch('/api/categories', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchApplicableFloors = async (phaseId, projectId) => {
    if (!phaseId || !projectId) {
      setApplicableFloors([]);
      setNonApplicableFloors([]);
      setSelectedPhaseInfo(null);
      return;
    }
    setLoadingApplicableFloors(true);
    try {
      const response = await fetch(`/api/phases/${phaseId}/applicable-floors?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        const applicable = data.data.applicableFloors || [];
        const allFloors = floors.length > 0 ? floors : (data.data.allFloors || []);
        const applicableIds = new Set(applicable.map(f => {
          const id = f._id?.toString() || f.toString();
          return id;
        }));
        const applicableFloorsList = allFloors.filter(f => {
          const id = f._id?.toString() || f.toString();
          return applicableIds.has(id);
        });
        const nonApplicableFloorsList = allFloors.filter(f => {
          const id = f._id?.toString() || f.toString();
          return !applicableIds.has(id);
        });
        
        setApplicableFloors(applicableFloorsList);
        setNonApplicableFloors(nonApplicableFloorsList);
        setSelectedPhaseInfo({
          phaseCode: data.data.phaseCode,
          phaseName: data.data.phaseName
        });

        // CRITICAL FIX: Only clear floor if it's actually NOT applicable
        // Normalize IDs to strings for comparison
        if (wizardData.defaultFloorId) {
          const currentFloorIdStr = wizardData.defaultFloorId.toString();
          const isCurrentFloorApplicable = applicableFloorsList.some(f => {
            const floorIdStr = f._id?.toString() || f.toString();
            return floorIdStr === currentFloorIdStr;
          });
          // Only clear if floor is NOT applicable AND there are applicable floors available
          if (!isCurrentFloorApplicable && applicableFloorsList.length > 0) {
            onUpdate({ defaultFloorId: '' });
          }
          // If floor IS applicable, keep it - don't clear it
        }
      } else {
        // Fallback: if API doesn't exist yet, use all floors
        setApplicableFloors(floors);
        setNonApplicableFloors([]);
        setSelectedPhaseInfo(null);
      }
    } catch (err) {
      console.error('Error fetching applicable floors:', err);
      // Fallback: use all floors if API call fails
      setApplicableFloors(floors);
      setNonApplicableFloors([]);
      setSelectedPhaseInfo(null);
    } finally {
      setLoadingApplicableFloors(false);
    }
  };

  const handleChange = (field, value) => {
    // Reset dependent defaults when project changes to avoid cross-project leakage.
    if (field === 'projectId') {
      onUpdate({
        projectId: value,
        defaultPhaseId: '',
        defaultFloorId: '',
      });
      return;
    }

    // Enforce hierarchy: clearing phase also clears floor.
    if (field === 'defaultPhaseId' && !value) {
      onUpdate({
        defaultPhaseId: '',
        defaultFloorId: '',
      });
      return;
    }

    onUpdate({ [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold ds-text-primary mb-4">Project & Default Settings</h2>
        <p className="text-sm ds-text-secondary mb-6">
          Select the project and set default values that will apply to all materials in this bulk request.
          You can override these defaults for individual materials in later steps.
        </p>
      </div>

      <div className="space-y-4">
        {/* Project Selection */}
        <div>
          <label className="block text-sm font-semibold ds-text-secondary mb-1">
            Project <span className="text-red-500">*</span>
          </label>
          {loadingProjects ? (
            <div className="px-3 py-2 ds-bg-surface-muted border ds-border-subtle rounded-lg ds-text-muted">
              Loading projects...
            </div>
          ) : (
            <select
              value={wizardData.projectId || ''}
              onChange={(e) => handleChange('projectId', e.target.value)}
              required
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="" className="ds-text-primary">Select a project</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id} className="ds-text-primary">
                  {project.projectCode} - {project.projectName}
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-sm ds-text-secondary">Select the project for this bulk material request</p>
        </div>

        {/* Batch Name (Optional) */}
        <div>
          <label className="block text-sm font-semibold ds-text-secondary mb-1">
            Batch Name (Optional)
          </label>
          <input
            type="text"
            value={wizardData.batchName || ''}
            onChange={(e) => handleChange('batchName', e.target.value)}
            placeholder="e.g., Foundation Materials, Roofing Supplies"
            className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted"
          />
          <p className="mt-1 text-sm ds-text-secondary">Give this batch a descriptive name for easy identification</p>
        </div>

        {/* Default Phase - REQUIRED */}
        <div>
          <label className="block text-sm font-semibold ds-text-secondary mb-1">
            Default Construction Phase <span className="text-red-500">*</span>
          </label>
          {loadingPhases ? (
            <div className="px-3 py-2 ds-bg-surface-muted border ds-border-subtle rounded-lg ds-text-muted">
              Loading phases...
            </div>
          ) : phases.length === 0 && wizardData.projectId ? (
            <div className="space-y-2">
              <div className="px-3 py-2 bg-yellow-50 border border-yellow-400/60 rounded-lg text-yellow-700">
                No phases found for this project
              </div>
              <Link
                href={`/phases?projectId=${wizardData.projectId}`}
                className="text-sm text-blue-600 hover:underline"
                target="_blank"
              >
                Manage phases for this project →
              </Link>
            </div>
          ) : (
            <select
              value={wizardData.defaultPhaseId || ''}
              onChange={(e) => handleChange('defaultPhaseId', e.target.value)}
              required
              disabled={!wizardData.projectId || phases.length === 0}
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:ds-bg-surface-muted disabled:ds-text-muted disabled:cursor-not-allowed"
            >
              <option value="" className="ds-text-primary">Select phase (required)</option>
              {phases.map((phase) => (
                <option key={phase._id} value={phase._id} className="ds-text-primary">
                  {phase.phaseName || phase.name} {phase.status ? `(${phase.status.replace('_', ' ')})` : ''}
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-sm ds-text-secondary">
            <span className="font-medium text-red-600">Required:</span> Default construction phase for all materials. 
            You can override this for individual materials in Step 3 if needed.
          </p>
        </div>

        {/* Default Floor */}
        <div>
          <label className="block text-sm font-semibold ds-text-secondary mb-1">
            Default Floor (Optional)
          </label>
          {loadingFloors || loadingApplicableFloors ? (
            <div className="px-3 py-2 ds-bg-surface-muted border ds-border-subtle rounded-lg ds-text-muted">
              Loading floors...
            </div>
          ) : floors.length === 0 && wizardData.projectId ? (
            <div className="px-3 py-2 bg-yellow-50 border border-yellow-400/60 rounded-lg text-yellow-700">
              No floors found for this project
            </div>
          ) : (
            <select
              value={wizardData.defaultFloorId || ''}
              onChange={(e) => handleChange('defaultFloorId', e.target.value)}
              disabled={!wizardData.projectId || !wizardData.defaultPhaseId || floors.length === 0 || loadingApplicableFloors}
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:ds-bg-surface-muted disabled:ds-text-muted disabled:cursor-not-allowed"
            >
              <option value="" className="ds-text-primary">
                {wizardData.defaultPhaseId ? 'No default floor' : 'Select phase first'}
              </option>
              {applicableFloors.map((floor) => {
                const getFloorDisplay = (floorNumber, name) => {
                  if (name) return name;
                  if (floorNumber === undefined || floorNumber === null) return 'N/A';
                  if (floorNumber < 0) return `Basement ${Math.abs(floorNumber)}`;
                  if (floorNumber === 0) return 'Ground Floor';
                  return `Floor ${floorNumber}`;
                };
                return (
                  <option key={floor._id} value={floor._id} className="ds-text-primary">
                    {getFloorDisplay(floor.floorNumber, floor.floorName || floor.name)} ✓
                  </option>
                );
              })}
              {wizardData.defaultPhaseId && nonApplicableFloors.length > 0 && (
                <optgroup label={`Not applicable to ${selectedPhaseInfo?.phaseName || 'selected phase'}`} className="ds-text-muted">
                  {nonApplicableFloors.map((floor) => {
                    const getFloorDisplay = (floorNumber, name) => {
                      if (name) return name;
                      if (floorNumber === undefined || floorNumber === null) return 'N/A';
                      if (floorNumber < 0) return `Basement ${Math.abs(floorNumber)}`;
                      if (floorNumber === 0) return 'Ground Floor';
                      return `Floor ${floorNumber}`;
                    };
                    return (
                      <option key={floor._id} value={floor._id} disabled className="ds-text-muted italic">
                        {getFloorDisplay(floor.floorNumber, floor.floorName || floor.name)} ✗
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </select>
          )}
          <p className="mt-1 text-sm ds-text-secondary">
            Default floor for all materials (can be overridden per material).
            <span className="block mt-1 text-xs">
              Select a phase first to filter floors by phase applicability.
            </span>
            {wizardData.defaultPhaseId && selectedPhaseInfo && (
              <span className="block mt-1 text-xs text-blue-600">
                {applicableFloors.length > 0
                  ? `✓ ${applicableFloors.length} floor(s) applicable to ${selectedPhaseInfo.phaseName}`
                  : 'No floors are applicable to this phase. Floor assignment is optional.'}
              </span>
            )}
          </p>
        </div>

        {/* Default Category */}
        <div>
          <label className="block text-sm font-semibold ds-text-secondary mb-1">
            Default Category (Optional)
          </label>
          {loadingCategories ? (
            <div className="px-3 py-2 ds-bg-surface-muted border ds-border-subtle rounded-lg ds-text-muted">
              Loading categories...
            </div>
          ) : (
            <select
              value={wizardData.defaultCategoryId || ''}
              onChange={(e) => {
                const selectedCategory = categories.find((cat) => cat._id === e.target.value);
                handleChange('defaultCategoryId', e.target.value);
                if (selectedCategory) {
                  handleChange('defaultCategory', selectedCategory.name);
                }
              }}
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="" className="ds-text-primary">No default category</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id} className="ds-text-primary">
                  {category.name}
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-sm ds-text-secondary">Default category for all materials (can be overridden per material)</p>
        </div>

        {/* Default Urgency */}
        <div>
          <label className="block text-sm font-semibold ds-text-secondary mb-1">
            Default Urgency <span className="text-red-500">*</span>
          </label>
          <select
            value={wizardData.defaultUrgency || 'medium'}
            onChange={(e) => handleChange('defaultUrgency', e.target.value)}
            required
            className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="low" className="ds-text-primary">Low</option>
            <option value="medium" className="ds-text-primary">Medium</option>
            <option value="high" className="ds-text-primary">High</option>
            <option value="critical" className="ds-text-primary">Critical</option>
          </select>
          <p className="mt-1 text-sm ds-text-secondary">Default urgency level for all materials</p>
        </div>

        {/* Default Reason */}
        <div>
          <label className="block text-sm font-semibold ds-text-secondary mb-1">
            Default Reason (Optional)
          </label>
          <textarea
            value={wizardData.defaultReason || ''}
            onChange={(e) => handleChange('defaultReason', e.target.value)}
            placeholder="e.g., Foundation construction, Roofing installation"
            rows={3}
            className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted"
          />
          <p className="mt-1 text-sm ds-text-secondary">Default reason for requesting these materials</p>
        </div>
      </div>
    </div>
  );
}

