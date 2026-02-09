/**
 * Step 1: Project & Professional Service Component
 * Form for selecting project and professional service for bulk activities
 */

'use client';

import { useState, useEffect } from 'react';

export function Step1ProjectSettings({ wizardData, onUpdate, onValidationChange }) {
  const [projects, setProjects] = useState([]);
  const [professionalServices, setProfessionalServices] = useState([]);
  const [phases, setPhases] = useState([]);
  const [floors, setFloors] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Fetch professional services when project changes
  useEffect(() => {
    if (wizardData.projectId) {
      fetchProfessionalServices(wizardData.projectId);
      fetchPhases(wizardData.projectId);
      fetchFloors(wizardData.projectId);
    } else {
      setProfessionalServices([]);
      setPhases([]);
      setFloors([]);
    }
  }, [wizardData.projectId]);

  // Validate and notify parent
  useEffect(() => {
    const isValid = !!wizardData.projectId && !!wizardData.professionalServiceId;
    onValidationChange(isValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.projectId, wizardData.professionalServiceId]);

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

  const fetchProfessionalServices = async (projectId) => {
    if (!projectId) {
      setProfessionalServices([]);
      return;
    }
    setLoadingServices(true);
    try {
      const response = await fetch(`/api/professional-services?projectId=${projectId}&status=active`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProfessionalServices(data.data.assignments || []);
        // Clear service selection if current service is not in the new list
        if (wizardData.professionalServiceId) {
          const serviceExists = (data.data.assignments || []).some(
            (s) => s._id === wizardData.professionalServiceId
          );
          if (!serviceExists) {
            onUpdate({ professionalServiceId: '' });
          }
        }
      }
    } catch (err) {
      console.error('Error fetching professional services:', err);
      setProfessionalServices([]);
    } finally {
      setLoadingServices(false);
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

  const handleChange = (field, value) => {
    onUpdate({ [field]: value });
  };

  const selectedService = professionalServices.find(
    (s) => s._id === wizardData.professionalServiceId
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Project & Professional Service</h2>
        <p className="text-sm text-gray-600 mb-6">
          Select the project and professional service for bulk activity entry. Default phase and floor can be set for all activities.
        </p>
      </div>

      <div className="space-y-4">
        {/* Project Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Project <span className="text-red-500">*</span>
          </label>
          {loadingProjects ? (
            <div className="px-3 py-2 bg-gray-100 rounded-lg animate-pulse">Loading projects...</div>
          ) : (
            <select
              value={wizardData.projectId}
              onChange={(e) => handleChange('projectId', e.target.value)}
              required
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Project</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.projectName}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Professional Service Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Professional Service <span className="text-red-500">*</span>
          </label>
          {loadingServices ? (
            <div className="px-3 py-2 bg-gray-100 rounded-lg animate-pulse">Loading services...</div>
          ) : !wizardData.projectId ? (
            <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-500">
              Please select a project first
            </div>
          ) : professionalServices.length === 0 ? (
            <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
              No active professional services found for this project
            </div>
          ) : (
            <>
              <select
                value={wizardData.professionalServiceId}
                onChange={(e) => handleChange('professionalServiceId', e.target.value)}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Professional Service</option>
                {professionalServices.map((service) => (
                  <option key={service._id} value={service._id}>
                    {service.library?.name || 'N/A'} ({service.type === 'architect' ? 'Architect' : 'Engineer'})
                  </option>
                ))}
              </select>
              {selectedService && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {selectedService.library?.name || 'N/A'} ({selectedService.type === 'architect' ? 'Architect' : 'Engineer'})
                    </div>
                    <div className="text-gray-600 mt-1">
                      Contract: {selectedService.contractType || 'N/A'} | Status: {selectedService.status || 'N/A'}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Default Phase (Optional) */}
        {wizardData.projectId && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Default Phase (Optional)
            </label>
            {loadingPhases ? (
              <div className="px-3 py-2 bg-gray-100 rounded-lg animate-pulse">Loading phases...</div>
            ) : phases.length === 0 ? (
              <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-500">
                No phases available for this project
              </div>
            ) : (
              <select
                value={wizardData.defaultPhaseId}
                onChange={(e) => handleChange('defaultPhaseId', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No Default Phase</option>
                {phases.map((phase) => (
                  <option key={phase._id} value={phase._id}>
                    {phase.phaseName} ({phase.phaseCode})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Default Floor (Optional) */}
        {wizardData.projectId && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Default Floor (Optional)
            </label>
            {loadingFloors ? (
              <div className="px-3 py-2 bg-gray-100 rounded-lg animate-pulse">Loading floors...</div>
            ) : floors.length === 0 ? (
              <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-500">
                No floors available for this project
              </div>
            ) : (
              <select
                value={wizardData.defaultFloorId}
                onChange={(e) => handleChange('defaultFloorId', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No Default Floor</option>
                {floors.map((floor) => (
                  <option key={floor._id} value={floor._id}>
                    {floor.floorName} (Floor {floor.floorNumber})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}





