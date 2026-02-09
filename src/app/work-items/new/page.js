/**
 * New Work Item Page
 * Form to create a new work item
 * 
 * Route: /work-items/new
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { WORK_ITEM_STATUSES, WORK_ITEM_CATEGORIES, WORK_ITEM_PRIORITIES } from '@/lib/constants/work-item-constants';
import { MultiWorkerSelector } from '@/components/work-items/multi-worker-selector';

function NewWorkItemPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { canAccess } = usePermissions();
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  
  const projectIdFromUrl = searchParams.get('projectId');
  const phaseIdFromUrl = searchParams.get('phaseId');
  const workerIdFromUrl = searchParams.get('workerId'); // Support workerId from URL
  
  const [formData, setFormData] = useState({
    projectId: projectIdFromUrl || '',
    phaseId: phaseIdFromUrl || '',
    name: '',
    description: '',
    category: '',
    categoryId: '',
    status: 'not_started',
    assignedTo: [], // Array of worker IDs
    estimatedHours: '',
    actualHours: '',
    estimatedCost: '',
    actualCost: '',
    startDate: '',
    plannedEndDate: '',
    dependencies: [],
    priority: 3,
    notes: ''
  });

  useEffect(() => {
    fetchProjects();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (formData.projectId) {
      fetchPhases(formData.projectId);
    } else {
      setPhases([]);
    }
  }, [formData.projectId]);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      // Use /api/projects/accessible to respect project-based organization and user memberships
      const response = await fetch('/api/projects/accessible', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        // API returns projects array directly in data.data
        const projectsList = Array.isArray(data.data) ? data.data : [];
        setProjects(projectsList);
        // Auto-select first project if only one exists and no projectId from query params
        if (projectsList.length === 1 && !formData.projectId) {
          setFormData(prev => ({ ...prev, projectId: projectsList[0]._id }));
        }
      } else {
        console.error('Failed to fetch accessible projects:', data.error);
        setProjects([]);
        toast.showError('Failed to load projects. Please refresh the page.');
      }
    } catch (err) {
      console.error('Error fetching accessible projects:', err);
      setProjects([]);
      toast.showError('Error loading projects. Please try again.');
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await fetch('/api/categories?type=work_items', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setCategories(data.data || []);
      } else {
        setCategories([]);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchPhases = async (projectId) => {
    try {
      setLoadingPhases(true);
      const response = await fetch(`/api/phases?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        // API returns phases array directly in data.data
        const phasesList = Array.isArray(data.data) ? data.data : [];
        setPhases(phasesList);
        // Auto-select first phase if only one exists and no phaseId from query params
        if (phasesList.length === 1 && !formData.phaseId) {
          setFormData(prev => ({ ...prev, phaseId: phasesList[0]._id }));
        }
      } else {
        console.error('Failed to fetch phases:', data.error);
        setPhases([]);
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
      setPhases([]);
    } finally {
      setLoadingPhases(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const createResponse = await fetch('/api/work-items', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          ...formData,
          assignedTo: Array.isArray(formData.assignedTo) ? formData.assignedTo : (formData.assignedTo ? [formData.assignedTo] : []),
          estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : 0,
          actualHours: formData.actualHours ? parseFloat(formData.actualHours) : 0,
          estimatedCost: formData.estimatedCost ? parseFloat(formData.estimatedCost) : 0,
          actualCost: formData.actualCost ? parseFloat(formData.actualCost) : 0,
        }),
      });

      const data = await createResponse.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create work item');
      }

      toast.showSuccess('Work item created successfully');
      router.push(`/work-items/${data.data._id}`);
    } catch (err) {
      setError(err.message);
      toast.showError(err.message || 'Failed to create work item');
      console.error('Create work item error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const categoryOptions = categories.length > 0
    ? categories.map((category) => ({
        value: category._id?.toString(),
        label: category.name,
      }))
    : WORK_ITEM_CATEGORIES.map((category) => ({
        value: category,
        label: category,
      }));

  const usesLegacyCategories = categories.length === 0;

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    if (usesLegacyCategories) {
      setFormData((prev) => ({
        ...prev,
        category: value,
        categoryId: '',
      }));
      return;
    }

    const selected = categories.find((category) => category._id?.toString() === value);
    setFormData((prev) => ({
      ...prev,
      categoryId: value,
      category: selected?.name || '',
    }));
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/work-items" className="text-blue-600 hover:text-blue-800 mb-4 inline-block font-medium">
            ← Back to Work Items
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">New Work Item</h1>
          <p className="text-gray-600 mt-1">Create a new work item for a phase</p>
        </div>

        {/* Information Card */}
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 rounded-xl border-2 border-blue-200 p-4 sm:p-6 mb-6 shadow-lg transition-all duration-300">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Creating a Work Item</h3>
                <button
                  onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                  className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-white/80 hover:bg-white border border-blue-300 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label={isInfoExpanded ? 'Collapse information' : 'Expand information'}
                  aria-expanded={isInfoExpanded}
                >
                  <svg 
                    className={`w-5 h-5 sm:w-6 sm:h-6 text-blue-600 transition-transform duration-300 ${isInfoExpanded ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              
              {isInfoExpanded ? (
                <div className="space-y-3 animate-fadeIn">
                  <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                    Work items break down construction phases into specific, trackable tasks. Each work item represents a concrete activity like "Pour Foundation Concrete" or "Install Electrical Wiring" that needs to be completed, with estimated time, costs, and dependencies.
                  </p>
                  <div className="bg-white/70 rounded-lg p-3 border border-blue-200">
                    <p className="text-xs text-gray-600">
                      <strong className="text-gray-900">Tip:</strong> Be specific with work item names and include all relevant details. Set realistic time and cost estimates, and define dependencies if this task must wait for others to complete.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-gray-500 italic mt-1 animate-fadeIn">
                  Click to expand for more information
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Project & Phase Selection Section */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Project & Phase Selection
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Project Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Project <span className="text-red-600">*</span>
                  </label>
                  {loadingProjects ? (
                    <div className="w-full px-4 py-2.5 bg-gray-100 border-2 border-gray-300 rounded-lg text-gray-500">
                      Loading projects...
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="w-full px-4 py-2.5 bg-yellow-50 border-2 border-yellow-300 rounded-lg text-yellow-800">
                      No projects available
                    </div>
                  ) : (
                    <select
                      name="projectId"
                      value={formData.projectId}
                      onChange={handleChange}
                      required
                      disabled={loadingProjects}
                      className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
                    >
                      <option value="" className="text-gray-500">Select Project</option>
                      {projects.map((project) => (
                        <option key={project._id} value={project._id} className="text-gray-900">
                          {project.projectName || project.projectCode || 'Unnamed Project'}
                        </option>
                      ))}
                    </select>
                  )}
                  {projects.length > 0 && !formData.projectId && (
                    <p className="text-xs text-gray-600 mt-1.5">Please select a project to continue</p>
                  )}
                </div>

                {/* Phase Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Phase <span className="text-red-600">*</span>
                  </label>
                  {loadingPhases ? (
                    <div className="w-full px-4 py-2.5 bg-gray-100 border-2 border-gray-300 rounded-lg text-gray-500">
                      Loading phases...
                    </div>
                  ) : !formData.projectId ? (
                    <div className="w-full px-4 py-2.5 bg-gray-100 border-2 border-gray-300 rounded-lg text-gray-500">
                      Select Project First
                    </div>
                  ) : phases.length === 0 ? (
                    <div className="w-full px-4 py-2.5 bg-yellow-50 border-2 border-yellow-300 rounded-lg text-yellow-800">
                      No phases available for this project
                    </div>
                  ) : (
                    <select
                      name="phaseId"
                      value={formData.phaseId}
                      onChange={handleChange}
                      required
                      disabled={loadingPhases || !formData.projectId}
                      className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
                    >
                      <option value="" className="text-gray-500">Select Phase</option>
                      {phases.map((phase) => (
                        <option key={phase._id} value={phase._id} className="text-gray-900">
                          {phase.phaseName || phase.name} {phase.phaseCode ? `(${phase.phaseCode})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {formData.projectId && phases.length > 0 && !formData.phaseId && (
                    <p className="text-xs text-gray-600 mt-1.5">Please select a phase</p>
                  )}
                </div>
              </div>
            </div>

            {/* Work Item Details Section */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Work Item Details
              </h2>
              
              {/* Work Item Name */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Work Item Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  minLength={2}
                  placeholder="e.g., Pour Foundation Concrete"
                  className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all duration-200 font-medium"
                />
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Description <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Describe the work item, requirements, and any important details..."
                  className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all duration-200 font-medium resize-y"
                />
              </div>

              {/* Category, Priority, and Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Category <span className="text-red-600">*</span>
                  </label>
                  {loadingCategories ? (
                    <div className="w-full px-4 py-2.5 bg-gray-100 border-2 border-gray-300 rounded-lg text-gray-500">
                      Loading categories...
                    </div>
                  ) : (
                    <select
                      name={usesLegacyCategories ? 'category' : 'categoryId'}
                      value={usesLegacyCategories ? formData.category : formData.categoryId}
                      onChange={handleCategoryChange}
                      required
                      className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
                    >
                      <option value="" className="text-gray-500">Select Category</option>
                      {categoryOptions.map((category) => (
                        <option key={category.value} value={category.value} className="text-gray-900">
                          {category.label.replace(/\b\w/g, (letter) => letter.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  )}
                  {usesLegacyCategories && !loadingCategories && (
                    <p className="text-xs text-gray-600 mt-1.5">
                      Using default categories. Create categories under Categories for a custom list.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Priority
                  </label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
                  >
                    {WORK_ITEM_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority} className="text-gray-900">
                        {priority} - {priority === 1 ? 'Critical' : priority === 2 ? 'High' : priority === 3 ? 'Medium' : priority === 4 ? 'Low' : 'Very Low'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
                  >
                    {WORK_ITEM_STATUSES.map((status) => (
                      <option key={status} value={status} className="text-gray-900">
                        {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Worker Assignment */}
              <div className="mt-6">
                <MultiWorkerSelector
                  value={formData.assignedTo || []}
                  onChange={(workerIds) => setFormData(prev => ({ ...prev, assignedTo: workerIds }))}
                  projectId={formData.projectId}
                  phaseId={formData.phaseId}
                  category={formData.category}
                />
              </div>
            </div>

            {/* Time & Cost Estimates Section */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Time & Cost Estimates
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Estimated Hours <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">hrs</span>
                    <input
                      type="number"
                      name="estimatedHours"
                      value={formData.estimatedHours}
                      onChange={handleChange}
                      min="0"
                      step="0.1"
                      placeholder="0"
                      className="w-full px-4 pr-16 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all duration-200 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Estimated Cost (KES) <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">KES</span>
                    <input
                      type="number"
                      name="estimatedCost"
                      value={formData.estimatedCost}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all duration-200 font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule Section */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Schedule
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Start Date <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Planned End Date <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    name="plannedEndDate"
                    value={formData.plannedEndDate}
                    onChange={handleChange}
                    min={formData.startDate}
                    className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Additional Information Section */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Additional Information
              </h2>
              
              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Notes <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Additional notes about this work item, special requirements, or important details..."
                  className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all duration-200 font-medium resize-y"
                />
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
              <Link
                href="/work-items"
                className="px-6 py-2.5 border-2 border-gray-300 rounded-lg text-gray-900 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
              >
                Cancel
              </Link>
              <LoadingButton
                type="submit"
                loading={saving}
                className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {saving ? 'Creating...' : 'Create Work Item'}
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}

export default function NewWorkItemPage() {
  return (
    <Suspense fallback={null}>
      <NewWorkItemPageContent />
    </Suspense>
  );
}
