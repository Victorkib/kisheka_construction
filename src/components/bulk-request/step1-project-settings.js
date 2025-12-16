/**
 * Step 1: Project & Settings Component
 * Form for selecting project and default settings for bulk request
 */

'use client';

import { useState, useEffect } from 'react';

export function Step1ProjectSettings({ wizardData, onUpdate, onValidationChange }) {
  const [projects, setProjects] = useState([]);
  const [floors, setFloors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
    fetchCategories();
  }, []);

  // Fetch floors when project changes
  useEffect(() => {
    if (wizardData.projectId) {
      fetchFloors(wizardData.projectId);
    } else {
      setFloors([]);
    }
  }, [wizardData.projectId]);

  // Validate and notify parent
  // Only depend on the actual value, not the callback function
  useEffect(() => {
    const isValid = !!wizardData.projectId;
    onValidationChange(isValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardData.projectId]); // onValidationChange is stable (memoized in parent)

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch('/api/projects');
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
      const response = await fetch(`/api/floors?projectId=${projectId}`);
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

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const response = await fetch('/api/categories');
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

  const handleChange = (field, value) => {
    onUpdate({ [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Project & Default Settings</h2>
        <p className="text-sm text-gray-600 mb-6">
          Select the project and set default values that will apply to all materials in this bulk request.
          You can override these defaults for individual materials in later steps.
        </p>
      </div>

      <div className="space-y-4">
        {/* Project Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Project <span className="text-red-500">*</span>
          </label>
          {loadingProjects ? (
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500">
              Loading projects...
            </div>
          ) : (
            <select
              value={wizardData.projectId || ''}
              onChange={(e) => handleChange('projectId', e.target.value)}
              required
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="" className="text-gray-900">Select a project</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id} className="text-gray-900">
                  {project.projectCode} - {project.projectName}
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-sm text-gray-600">Select the project for this bulk material request</p>
        </div>

        {/* Batch Name (Optional) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Batch Name (Optional)
          </label>
          <input
            type="text"
            value={wizardData.batchName || ''}
            onChange={(e) => handleChange('batchName', e.target.value)}
            placeholder="e.g., Foundation Materials, Roofing Supplies"
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
          />
          <p className="mt-1 text-sm text-gray-600">Give this batch a descriptive name for easy identification</p>
        </div>

        {/* Default Floor */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Default Floor (Optional)
          </label>
          {loadingFloors ? (
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500">
              Loading floors...
            </div>
          ) : floors.length === 0 && wizardData.projectId ? (
            <div className="px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-700">
              No floors found for this project
            </div>
          ) : (
            <select
              value={wizardData.defaultFloorId || ''}
              onChange={(e) => handleChange('defaultFloorId', e.target.value)}
              disabled={!wizardData.projectId || floors.length === 0}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              <option value="" className="text-gray-900">No default floor</option>
              {floors.map((floor) => {
                const getFloorDisplay = (floorNumber, name) => {
                  if (name) return name;
                  if (floorNumber === undefined || floorNumber === null) return 'N/A';
                  if (floorNumber < 0) return `Basement ${Math.abs(floorNumber)}`;
                  if (floorNumber === 0) return 'Ground Floor';
                  return `Floor ${floorNumber}`;
                };
                return (
                  <option key={floor._id} value={floor._id} className="text-gray-900">
                    {getFloorDisplay(floor.floorNumber, floor.floorName || floor.name)}
                  </option>
                );
              })}
            </select>
          )}
          <p className="mt-1 text-sm text-gray-600">Default floor for all materials (can be overridden per material)</p>
        </div>

        {/* Default Category */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Default Category (Optional)
          </label>
          {loadingCategories ? (
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500">
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
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="" className="text-gray-900">No default category</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id} className="text-gray-900">
                  {category.name}
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-sm text-gray-600">Default category for all materials (can be overridden per material)</p>
        </div>

        {/* Default Urgency */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Default Urgency <span className="text-red-500">*</span>
          </label>
          <select
            value={wizardData.defaultUrgency || 'medium'}
            onChange={(e) => handleChange('defaultUrgency', e.target.value)}
            required
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="low" className="text-gray-900">Low</option>
            <option value="medium" className="text-gray-900">Medium</option>
            <option value="high" className="text-gray-900">High</option>
            <option value="critical" className="text-gray-900">Critical</option>
          </select>
          <p className="mt-1 text-sm text-gray-600">Default urgency level for all materials</p>
        </div>

        {/* Default Reason */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Default Reason (Optional)
          </label>
          <textarea
            value={wizardData.defaultReason || ''}
            onChange={(e) => handleChange('defaultReason', e.target.value)}
            placeholder="e.g., Foundation construction, Roofing installation"
            rows={3}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
          />
          <p className="mt-1 text-sm text-gray-600">Default reason for requesting these materials</p>
        </div>
      </div>
    </div>
  );
}

