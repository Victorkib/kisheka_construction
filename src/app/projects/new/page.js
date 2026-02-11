/**
 * Create New Project Page
 * Form for creating a new construction project
 * 
 * Route: /projects/new
 * Auth: PM, OWNER only
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { useToast } from '@/components/toast';
import { EnhancedBudgetInput } from '@/components/budget/EnhancedBudgetInput';
import { useProjectContext } from '@/contexts/ProjectContext';

export default function NewProjectPage() {
  const router = useRouter();
  const toast = useToast();
  const { handleProjectCreated, currentProject, accessibleProjects } = useProjectContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canCreate, setCanCreate] = useState(false);
  // Controls whether user sets up budget now or skips for later
  const [budgetMode, setBudgetMode] = useState('later'); // 'now' | 'later'

  const [formData, setFormData] = useState({
    projectCode: '',
    projectName: '',
    description: '',
    location: '',
    client: '',
    status: 'planning',
    startDate: '',
    plannedEndDate: '',
    budget: {
      total: 0,
      directConstructionCosts: 0,
      preConstructionCosts: 0,
      indirectCosts: 0,
      contingencyReserve: 0,
      directCosts: {
        materials: { total: 0, structural: 0, finishing: 0, mep: 0, specialty: 0 },
        labour: { total: 0, skilled: 0, unskilled: 0, supervisory: 0, specialized: 0 },
        equipment: { total: 0, rental: 0, purchase: 0, maintenance: 0 },
        subcontractors: { total: 0, specializedTrades: 0, professionalServices: 0 }
      },
      preConstruction: {
        total: 0,
        landAcquisition: 0,
        legalRegulatory: 0,
        permitsApprovals: 0,
        sitePreparation: 0
      },
      indirect: {
        total: 0,
        siteOverhead: 0,
        transportation: 0,
        utilities: 0,
        safetyCompliance: 0
      },
      contingency: {
        total: 0,
        designContingency: 0,
        constructionContingency: 0,
        ownersReserve: 0
      }
    },
    siteManager: '',
    teamMembers: [],
    autoCreateFloors: true,
    floorCount: 10,
    includeBasements: false,
    basementCount: 0,
    autoInitializePhases: true, // Default to true for better UX
  });

  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    fetchUser();
    fetchAvailableUsers();
  }, []);

  const fetchAvailableUsers = async () => {
    try {
      setLoadingUsers(true);
      // Fetch users with PM role (site managers)
      const response = await fetch('/api/users?role=pm&status=active&limit=100', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        // API returns { users: [...], pagination: {...}, ... }
        setAvailableUsers(Array.isArray(data.data?.users) ? data.data.users : []);
      } else {
        setAvailableUsers([]);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setAvailableUsers([]); // Ensure it's always an array
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        const role = data.data.role?.toLowerCase();
        const hasPermission = ['owner', 'pm', 'project_manager'].includes(role);
        setCanCreate(hasPermission);
        if (!hasPermission) {
          setError('You do not have permission to create projects. Only Project Managers and Owners can create projects.');
        }
      }
    } catch (err) {
      console.error('Fetch user error:', err);
      setError('Failed to verify permissions');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('budget.')) {
      const budgetField = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        budget: {
          ...prev.budget,
          [budgetField]: value,
        },
      }));
    } else if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleBudgetChange = (budgetData) => {
    setFormData((prev) => ({
      ...prev,
      budget: budgetData,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!formData.projectCode || formData.projectCode.trim().length === 0) {
      setError('Project code is required');
      setLoading(false);
      return;
    }

    if (!formData.projectName || formData.projectName.trim().length === 0) {
      setError('Project name is required');
      setLoading(false);
      return;
    }

    // Budget validation - allow zero budget (optional budgeting)
    const budgetTotal = parseFloat(formData.budget?.total || 0);
    if (isNaN(budgetTotal) || budgetTotal < 0) {
      setError('Project budget must be a valid non-negative number (zero is allowed)');
      setLoading(false);
      return;
    }

    // Phase initialization - allow even with zero budget
    // Phases will be created with zero allocations, budget can be allocated later
    // No blocking - just informational
    if (formData.autoInitializePhases && (budgetTotal === 0 || isNaN(budgetTotal))) {
      // Optional: Show info message (non-blocking)
      // User can proceed - phases will be initialized with zero budget allocations
      console.info('Phases will be initialized with zero budget allocations. Budget can be allocated later.');
    }

    try {
      // Budget is always in enhanced structure
      const budget = formData.budget;

      // Build request body
      const requestBody = {
        projectCode: formData.projectCode.trim(),
        projectName: formData.projectName.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        client: formData.client.trim(),
        status: formData.status,
        startDate: formData.startDate || null,
        plannedEndDate: formData.plannedEndDate || null,
        budget,
        siteManager: formData.siteManager || null,
        teamMembers: formData.teamMembers || [],
        autoCreateFloors: formData.autoCreateFloors,
      };

      // Add floor configuration if auto-create is enabled
      if (formData.autoCreateFloors) {
        requestBody.floorCount = parseInt(formData.floorCount) || 10;
        requestBody.includeBasements = formData.includeBasements;
        requestBody.basementCount = formData.includeBasements ? parseInt(formData.basementCount) || 0 : 0;
      }

      // Add phase initialization option
      requestBody.autoInitializePhases = formData.autoInitializePhases !== false; // Default to true

      const response = await fetch('/api/projects', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create project');
      }

      const newProjectId = data.data._id;
      const newProjectName = data.data.projectName;
      
      // Capture current project info BEFORE handling creation (since it might change)
      const hadCurrentProject = !!currentProject;
      const previousProjectName = currentProject?.projectName;
      const previousProjectCount = accessibleProjects.length;

      // Handle project creation with ProjectContext
      // IMPORTANT:
      // - For the very first project, we want it to become the active project.
      // - For additional projects, it's usually more intuitive to also treat
      //   the newly created one as the "current" context.
      //   Therefore we do NOT preserve the previous selection here.
      const selectionResult = await handleProjectCreated(newProjectId, {
        autoSelectIfOnly: true,
        preserveCurrent: false,
      });

      // Show budget warning if present
      if (data.data.budgetWarning) {
        toast.showWarning(data.data.budgetWarning.message, { duration: 10000 });
      }
      
      // Show capital info if present
      if (data.data.capitalInfo) {
        toast.showInfo(data.data.capitalInfo.message, { duration: 10000 });
      }
      
      // Show floor creation warning if present
      if (data.data.floorCreationWarning) {
        const warning = data.data.floorCreationWarning;
        toast.showWarning(
          warning.details || warning.message,
          { duration: 12000, title: 'Floor Setup Issue' }
        );
      }
      
      // Show phase initialization warning if present
      if (data.data.phaseInitializationWarning) {
        const warning = data.data.phaseInitializationWarning;
        toast.showWarning(
          warning.details || warning.message,
          {
            duration: 15000,
            title: 'Phase Initialization Notice',
            action: warning.canRetry ? {
              label: 'Initialize Phases',
              onClick: () => {
                // Navigate to project detail page where user can initialize phases
                router.push(warning.actionUrl);
              }
            } : undefined
          }
        );
      }
      
      // Show creation summary if available
      if (data.data.creationSummary) {
        const summary = data.data.creationSummary;
        const summaryParts = [];
        if (summary.floorsCreated > 0) {
          summaryParts.push(`${summary.floorsCreated} floor${summary.floorsCreated !== 1 ? 's' : ''}`);
        }
        if (summary.phasesCreated) {
          summaryParts.push('phases initialized');
        }
        if (summaryParts.length > 0) {
          toast.showInfo(
            `Project created with: ${summaryParts.join(', ')}.`,
            { duration: 8000, title: 'Setup Complete' }
          );
        }
      }

      // Show project selection notification
      if (selectionResult.success) {
        const { selectionReason, isOnlyProject, totalProjects } = selectionResult;
        
        if (isOnlyProject) {
          // First project created
          toast.showInfo(
            `Project "${newProjectName}" created and automatically selected! This is your active project.`,
            { 
              duration: 7000,
              title: 'First Project Created'
            }
          );
        } else if (selectionReason === 'preserved_current') {
          // Current project preserved
          toast.showSuccess(
            `Project "${newProjectName}" created successfully! You're still working with "${previousProjectName || 'your current project'}".`,
            { 
              duration: 7000,
              title: 'Project Created'
            }
          );
        } else {
          // New project selected
          toast.showInfo(
            `Project "${newProjectName}" created and selected! This is now your active project.`,
            { 
              duration: 7000,
              title: 'Project Created & Selected'
            }
          );
        }
      } else {
        // Fallback success message
        toast.showSuccess(`Project "${newProjectName}" created successfully!`);
      }

      // Redirect to project detail page
      router.push(`/projects/${newProjectId}`);
    } catch (err) {
      setError(err.message);
      console.error('Create project error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!canCreate && user) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to create projects. Only Project Managers and Owners can create projects.</p>
          </div>
          <Link
            href="/projects"
            className="text-blue-600 hover:text-blue-900 underline"
          >
            ← Back to Projects
          </Link>
        </div>
      </AppLayout>
    );
  }

  // Calculate form completion progress
  const calculateProgress = () => {
    let completed = 0;
    const total = 6;
    if (formData.projectCode) completed++;
    if (formData.projectName) completed++;
    if (formData.location) completed++;
    if (formData.client) completed++;
    const budgetTotal = parseFloat(formData.budget?.total || 0);
    if (budgetTotal > 0) completed++;
    if (formData.startDate && formData.plannedEndDate) completed++;
    return Math.round((completed / total) * 100);
  };

  const progress = calculateProgress();

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
        {/* Header with Gradient */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
            {/* Breadcrumb */}
            <Link
              href="/projects"
              className="inline-flex items-center text-blue-100 hover:text-white text-sm font-medium mb-4 transition-colors group"
            >
              <svg className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Projects
            </Link>
            
            {/* Title Section */}
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 md:p-4">
                <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">Create New Project</h1>
                <p className="text-blue-100 mt-2 text-base md:text-lg">Set up a new construction project with all the essentials</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-100">Form Completion</span>
                <span className="text-sm font-bold text-white">{progress}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-white h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-md p-4 flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-800 text-base">Error</p>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="flex-shrink-0 text-red-500 hover:text-red-700 transition-colors"
                aria-label="Dismiss error"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Basic Information */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 rounded-lg p-2">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Basic Information</h2>
                    <p className="text-sm text-gray-600">Essential project details</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Project Code */}
                  <div className="md:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Project Code <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        name="projectCode"
                        value={formData.projectCode}
                        onChange={handleChange}
                        placeholder="e.g., DOSHAKI-001"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all text-gray-900"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Unique identifier for this project</p>
                  </div>

                  {/* Project Name */}
                  <div className="md:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Project Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        name="projectName"
                        value={formData.projectName}
                        onChange={handleChange}
                        placeholder="e.g., 10-Storey Residential Building"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all text-gray-900"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-semibold text-gray-700">Description</label>
                      <span className={`text-xs font-medium ${formData.description.length > 450 ? 'text-orange-500' : 'text-gray-400'}`}>
                        {formData.description.length} / 500 characters
                      </span>
                    </div>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Provide a detailed description of the project..."
                      rows={4}
                      maxLength={500}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all resize-none text-gray-900"
                    />
                  </div>

                  {/* Location */}
                  <div className="md:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        placeholder="e.g., Nairobi, Kenya"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all text-black"
                      />
                    </div>
                  </div>

                  {/* Client */}
                  <div className="md:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Client</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        name="client"
                        value={formData.client}
                        onChange={handleChange}
                        placeholder="Client name"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Status & Timeline */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-600 rounded-lg p-2">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Status & Timeline</h2>
                    <p className="text-sm text-gray-600">Project status and important dates</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Status */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 appearance-none cursor-pointer transition-all text-gray-900"
                      >
                        <option value="planning">Planning</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="completed">Completed</option>
                        <option value="archived">Archived</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900"
                      />
                    </div>
                  </div>

                  {/* Planned End Date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Planned End Date</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        type="date"
                        name="plannedEndDate"
                        value={formData.plannedEndDate}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Budget */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="bg-green-600 rounded-lg p-2">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Budget & Financials</h2>
                    <p className="text-sm text-gray-600">Set project budget and allocations</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {/* Budget mode selector */}
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-800 mb-2">
                    How do you want to handle the project budget right now?
                  </p>
                  <div className="flex flex-col md:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => setBudgetMode('later')}
                      className={`flex-1 rounded-lg border px-4 py-3 text-left transition-all ${
                        budgetMode === 'later'
                          ? 'border-blue-600 bg-blue-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                          budgetMode === 'later' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                        }`}>
                          1
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          Skip for now (set budget later)
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Recommended if you are still confirming financing. You can still track all spending and add a detailed budget later.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBudgetMode('now')}
                      className={`flex-1 rounded-lg border px-4 py-3 text-left transition-all ${
                        budgetMode === 'now'
                          ? 'border-emerald-600 bg-emerald-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                          budgetMode === 'now' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
                        }`}>
                          2
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          Set initial budget now (recommended for control)
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Ideal if you already have a clear budget. Enables budget validation, phase allocations, and richer financial analytics from day one.
                      </p>
                    </button>
                  </div>
                </div>

                {budgetMode === 'later' ? (
                  <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-4">
                    <div className="flex items-start gap-3">
                      <svg
                        className="h-5 w-5 flex-shrink-0 text-blue-500 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2m6 0c0-1.105-1.343-2-3-2m0 0V7m0 3v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-900">
                          No budget for now – you can still create and operate the project
                        </p>
                        <p className="mt-1 text-sm text-blue-800">
                          The project will start with a zero budget. All material requests, labour, and expenses will still be tracked normally.
                          When you are ready, you can:
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-blue-900">
                          <li>Set the overall project budget from the <strong>Project Finances</strong> page.</li>
                          <li>Allocate Direct Construction Costs (DCC) to phases from the <strong>Phases</strong> pages.</li>
                          <li>Capture pre-construction costs as <strong>Initial Expenses</strong> for better separation.</li>
                        </ul>
                        {formData.autoInitializePhases && (
                          <p className="mt-2 text-xs text-blue-900">
                            Phases will be created with zero budgets. You can allocate DCC to each phase later; all spending will be visible even before budgets are set.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <EnhancedBudgetInput
                      value={formData.budget}
                      onChange={handleBudgetChange}
                      showAdvanced={true}
                    />
                    {/* Budget validation warning and phase preview */}
                    {(() => {
                      const budgetTotal = parseFloat(formData.budget?.total || 0);
                      if (budgetTotal === 0 || isNaN(budgetTotal)) {
                        return (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
                            <div className="flex items-start gap-2">
                              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <div>
                                <p className="text-sm font-medium text-yellow-800">
                                  Zero Budget Warning
                                </p>
                                <p className="text-sm text-yellow-700 mt-1">
                                  Project budget is zero. You can still use the system – all operations will be allowed and spending will be tracked. 
                                  Set a budget later to enable budget validation and better financial control.
                                  {formData.autoInitializePhases && ' Phases will be initialized with zero budget allocations (can be allocated later).'}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      // Show phase budget preview if budget is set and phases will be initialized
                      // CRITICAL: Only allocate DCC to phases (not total budget)
                      if (budgetTotal > 0 && formData.autoInitializePhases) {
                        // Get DCC from budget (enhanced structure) or estimate from legacy
                        const budget = formData.budget || {};
                        const isEnhanced = budget.directCosts !== undefined;
                        let dccBudget = 0;
                        
                        if (isEnhanced) {
                          dccBudget = budget.directConstructionCosts || 0;
                        } else {
                          // Legacy: Estimate DCC (total - estimated pre-construction - indirect - contingency)
                          const estimatedPreConstruction = budgetTotal * 0.05;
                          const estimatedIndirect = budgetTotal * 0.05;
                          const estimatedContingency = budget.contingency || (budgetTotal * 0.05);
                          dccBudget = Math.max(0, budgetTotal - estimatedPreConstruction - estimatedIndirect - estimatedContingency);
                        }
                        
                        // Phase allocations based on DCC only (pre-construction tracked separately via initial_expenses)
                        const phaseAllocations = {
                          basement: dccBudget * 0.15,            // 15% of DCC
                          superstructure: dccBudget * 0.65,      // 65% of DCC
                          finishing: dccBudget * 0.15,           // 15% of DCC
                          finalSystems: dccBudget * 0.05         // 5% of DCC
                          // Total: 100% of DCC (not total budget)
                        };
                        const totalPhaseBudgets = Object.values(phaseAllocations).reduce((sum, val) => sum + val, 0);
                        return (
  <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-blue-500/30 rounded-xl p-6 mt-4 shadow-xl">
    {/* Header */}
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 rounded-lg p-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-blue-400">Phase Budget Preview (Auto-Initialized)</h3>
          <p className="text-xs text-slate-400 mt-1">Standard construction phases with industry-based allocations</p>
        </div>
      </div>
    </div>

    {/* Information Box */}
    <div className="bg-blue-900/30 border-l-4 border-blue-500 rounded-lg p-4 mb-5">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1">
          <p className="text-sm text-blue-200 font-medium mb-2">Why These Phases?</p>
          <p className="text-xs text-slate-300 leading-relaxed mb-3">
            These 4 construction phases represent the standard workflow. Budget allocations are automatically calculated from <strong className="text-blue-300">Direct Construction Costs (DCC)</strong> only. Pre-construction costs are tracked separately via initial expenses.
          </p>
          <ul className="text-xs text-slate-300 space-y-1 mb-3 ml-4 list-disc">
            <li><strong className="text-blue-300">Basement (15% of DCC):</strong> Foundation, basement, and substructure work</li>
            <li><strong className="text-blue-300">Superstructure (65% of DCC):</strong> Main building structure - typically the largest cost component</li>
            <li><strong className="text-blue-300">Finishing (15% of DCC):</strong> Electrical, plumbing, joinery, paintwork, and tiling</li>
            <li><strong className="text-blue-300">Final Systems (5% of DCC):</strong> Lift installation, testing, commissioning, and handover</li>
            <li className="text-slate-400 italic mt-2"><strong className="text-blue-300">Note:</strong> Pre-construction costs (land, permits, approvals) are tracked separately via initial expenses, not as a phase.</li>
          </ul>
          <div className="bg-slate-800/50 rounded-lg p-3 mt-3 border border-slate-700">
            <p className="text-xs text-slate-300">
              <strong className="text-blue-300">💡 Note:</strong> These are <strong>estimates</strong> based on industry standards. You can adjust individual phase budgets after project creation by navigating to each phase's budget management page from the project details or phases list.
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* Budget Breakdown */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-blue-500/50 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Basement</span>
          <span className="text-blue-400 text-xs font-bold">15% of DCC</span>
        </div>
        <div className="font-bold text-white text-lg">{phaseAllocations.basement.toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 })}</div>
        <p className="text-xs text-slate-500 mt-2">Foundation & substructure</p>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-blue-500/50 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Superstructure</span>
          <span className="text-blue-400 text-xs font-bold">65% of DCC</span>
        </div>
        <div className="font-bold text-white text-lg">{phaseAllocations.superstructure.toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 })}</div>
        <p className="text-xs text-slate-500 mt-2">Main building structure</p>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-blue-500/50 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Finishing</span>
          <span className="text-blue-400 text-xs font-bold">15% of DCC</span>
        </div>
        <div className="font-bold text-white text-lg">{phaseAllocations.finishing.toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 })}</div>
        <p className="text-xs text-slate-500 mt-2">Electrical, plumbing & finishes</p>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-blue-500/50 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">Final Systems</span>
          <span className="text-blue-400 text-xs font-bold">5% of DCC</span>
        </div>
        <div className="font-bold text-white text-lg">{phaseAllocations.finalSystems.toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 })}</div>
        <p className="text-xs text-slate-500 mt-2">Lift, testing & handover</p>
      </div>
      <div className="bg-gradient-to-br from-blue-900/50 to-indigo-900/50 rounded-lg p-4 border-2 border-blue-500/50 hover:border-blue-400 transition-all">
        <div className="flex items-center justify-between mb-2">
          <span className="text-blue-300 text-xs font-bold uppercase tracking-wide">Total Allocation</span>
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div className="font-bold text-blue-300 text-xl">{totalPhaseBudgets.toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 })}</div>
        <p className="text-xs text-blue-200/70 mt-2">100% of DCC allocated to phases</p>
        <p className="text-xs text-blue-200/50 mt-1">(Pre-construction, indirect, contingency tracked separately)</p>
      </div>
    </div>

    {/* Update Information */}
    <div className="bg-slate-800/30 border border-slate-600 rounded-lg p-4 mt-4">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <div className="flex-1">
          <p className="text-sm text-green-300 font-semibold mb-2">How to Update Phase Budgets Later</p>
          <p className="text-xs text-slate-300 leading-relaxed mb-2">
            After project creation, you can adjust individual phase budgets to match your specific project requirements:
          </p>
          <ul className="text-xs text-slate-300 space-y-1.5 ml-4 list-disc mb-3">
            <li>Navigate to <strong className="text-green-300">Project Details</strong> page and click on any phase</li>
            <li>Go to the <strong className="text-green-300">Budget</strong> tab within the phase detail page</li>
            <li>Or visit <strong className="text-green-300">Phases List</strong> and select a phase to manage its budget</li>
            <li>Adjust allocations as needed - the system will validate against total project budget</li>
          </ul>
          <div className="bg-slate-700/50 rounded p-2 mt-2 border border-slate-600">
            <p className="text-xs text-slate-400 italic">
              <strong className="text-green-300">Tip:</strong> Phase budgets can be updated at any time. Changes are tracked in the audit log for transparency and accountability.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);
                      }
                      return null;
                    })()}
                  </>
                )}
              </div>
            </div>

            {/* Section 4: Team Assignment */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-600 rounded-lg p-2">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Team Assignment</h2>
                    <p className="text-sm text-gray-600">Assign project team members</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Site Manager */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Site Manager <span className="text-gray-500 font-normal">(Optional)</span>
                    </label>
                    {loadingUsers ? (
                      <div className="px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-600"></div>
                        <span className="text-gray-600">Loading users...</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <select
                          name="siteManager"
                          value={formData.siteManager}
                          onChange={handleChange}
                          className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 appearance-none cursor-pointer transition-all text-gray-900"
                        >
                          <option value="">No site manager assigned</option>
                          {Array.isArray(availableUsers) && availableUsers.length > 0 ? (
                            availableUsers.map((user) => (
                              <option key={user.id || user._id} value={user.id || user._id}>
                                {user.firstName || ''} {user.lastName || ''} {user.email ? `(${user.email})` : ''}
                              </option>
                            ))
                          ) : (
                            <option value="" disabled>No site managers available</option>
                          )}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Assign a site manager to oversee this project. Can be assigned later.
                    </p>
                  </div>

                  {/* Team Members - Info */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Team Members
                    </label>
                    <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Add After Creation</p>
                          <p className="text-xs text-gray-600 mt-1">
                            Team members can be added after project creation from the project team page for better control.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5: Configuration */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 rounded-lg p-2">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Project Configuration</h2>
                    <p className="text-sm text-gray-600">Auto-setup options and preferences</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-6">
                {/* Floor Configuration */}
                <div>
                  <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Floor Configuration
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center h-5">
                        <input
                          type="checkbox"
                          id="autoCreateFloors"
                          name="autoCreateFloors"
                          checked={formData.autoCreateFloors}
                          onChange={handleChange}
                          className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <label htmlFor="autoCreateFloors" className="block text-sm font-semibold text-gray-800 mb-1 cursor-pointer">
                          Auto-create Floors
                        </label>
                        <p className="text-xs text-gray-600">
                          Automatically create floors for this project. You can create floors manually later if disabled.
                        </p>
                      </div>
                    </div>

                    {formData.autoCreateFloors && (
                      <div className="mt-4 ml-9">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Number of Floors
                        </label>
                        <input
                          type="number"
                          name="floorCount"
                          value={formData.floorCount}
                          onChange={handleChange}
                          placeholder="10"
                          min="0"
                          max="50"
                          className="w-full px-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-gray-400 transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Number of floors to create (0-50). Ground floor is included. Default: 10 floors (Ground + 9 floors).
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Phase Configuration */}
                <div>
                  <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Phase Configuration
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center h-5">
                        <input
                          type="checkbox"
                          id="autoInitializePhases"
                          name="autoInitializePhases"
                          checked={formData.autoInitializePhases}
                          onChange={handleChange}
                          className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <label htmlFor="autoInitializePhases" className="block text-sm font-semibold text-gray-800 mb-1 cursor-pointer">
                          Auto-initialize Default Phases <span className="text-indigo-600">(Recommended)</span>
                        </label>
                        <p className="text-xs text-gray-600 mb-3">
                          Automatically create 4 default construction phases (Basement, Superstructure, Finishing, Final Systems) with automatic budget allocation from Direct Construction Costs (DCC). Pre-construction costs are tracked separately via initial expenses. This enables phase-based budget tracking and financial management.
                        </p>
                  {formData.autoInitializePhases && (() => {
                    const budgetTotal = parseFloat(formData.budget?.total || 0);
                    if (budgetTotal === 0 || isNaN(budgetTotal)) {
                      return (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                          <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-yellow-800">
                                Phases Will Be Initialized Without Budget Allocation
                              </p>
                              <p className="text-sm text-yellow-700 mt-1">
                                Phases will be created with zero budget allocations. You can allocate budget to phases later. All spending will still be tracked regardless of budget.
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                        return null;
                      })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="flex flex-col sm:flex-row justify-end gap-4">
                <Link
                  href="/projects"
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 font-medium text-gray-700 transition-all text-center"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md hover:shadow-lg transition-all transform hover:scale-105 disabled:transform-none flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating Project...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Project
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}

