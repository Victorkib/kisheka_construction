/**
 * New Equipment Page
 * Form to create a new equipment assignment
 * 
 * Route: /equipment/new
 */

'use client';

import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { EQUIPMENT_TYPES, ACQUISITION_TYPES } from '@/lib/constants/equipment-constants';

// Inner component that uses useSearchParams
function NewEquipmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { canAccess } = usePermissions();
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [floors, setFloors] = useState([]);
  const [applicableFloors, setApplicableFloors] = useState([]);
  const [nonApplicableFloors, setNonApplicableFloors] = useState([]);
  const [selectedPhaseInfo, setSelectedPhaseInfo] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loadingApplicableFloors, setLoadingApplicableFloors] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  
  const projectIdFromUrl = searchParams.get('projectId');
  const phaseIdFromUrl = searchParams.get('phaseId');
  const floorIdFromUrl = searchParams.get('floorId');
  
  const [formData, setFormData] = useState({
    projectId: projectIdFromUrl || '',
    phaseId: phaseIdFromUrl || '',
    floorId: floorIdFromUrl || '',
    equipmentName: '',
    equipmentType: '',
    acquisitionType: 'rental',
    equipmentScope: 'phase_specific', // NEW: Equipment scope
    supplierId: '',
    startDate: '',
    endDate: '',
    dailyRate: '',
    estimatedHours: '',
    status: 'assigned',
    notes: ''
  });

  useEffect(() => {
    fetchProjects();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (formData.projectId) {
      fetchPhases(formData.projectId);
      fetchFloors(formData.projectId);
    } else {
      setPhases([]);
      setFloors([]);
      setApplicableFloors([]);
      setNonApplicableFloors([]);
      setSelectedPhaseInfo(null);
    }
  }, [formData.projectId]);

  useEffect(() => {
    if (formData.projectId && formData.phaseId && formData.equipmentScope === 'phase_specific') {
      fetchApplicableFloors(formData.phaseId, formData.projectId);
    } else {
      setApplicableFloors([]);
      setNonApplicableFloors([]);
      setSelectedPhaseInfo(null);
      if (!formData.phaseId && formData.floorId) {
        setFormData((prev) => ({ ...prev, floorId: '' }));
      }
    }
  }, [formData.phaseId, formData.projectId, formData.equipmentScope]);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      // Use /api/projects/accessible to respect project-based organization and user memberships
      // This ensures users only see projects they have access to
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
      } else {
        setFloors([]);
      }
    } catch (err) {
      console.error('Error fetching floors:', err);
      setFloors([]);
    } finally {
      setLoadingFloors(false);
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
        // Normalize IDs to strings for consistent comparison
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
        // Normalize IDs to strings for proper comparison
        if (formData.floorId) {
          const currentFloorIdStr = formData.floorId.toString();
          const isCurrentFloorApplicable = applicableFloorsList.some(f => {
            const floorIdStr = f._id?.toString() || f.toString();
            return floorIdStr === currentFloorIdStr;
          });
          // Only clear if floor is NOT applicable AND there are applicable floors available
          // If floor IS applicable, keep it - don't clear it
          if (!isCurrentFloorApplicable && applicableFloorsList.length > 0) {
            setFormData((prev) => ({ ...prev, floorId: '' }));
            toast.showWarning(`The selected floor is not applicable to ${data.data.phaseName}. Floor selection has been cleared.`);
          }
          // If floor IS applicable, do nothing - keep the selection
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

  const fetchSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      const response = await fetch('/api/suppliers?status=active&limit=100', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setSuppliers(data.data.suppliers || []);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Validation: Phase is required only for phase-specific equipment
    if (formData.equipmentScope === 'phase_specific' && !formData.phaseId) {
      setError('Phase selection is required for phase-specific equipment');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/equipment', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create equipment');
      }

      toast.showSuccess('Equipment created successfully');
      router.push(`/equipment/${data.data._id}`);
    } catch (err) {
      setError(err.message);
      toast.showError(err.message || 'Failed to create equipment');
      console.error('Create equipment error:', err);
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <Link href="/equipment" className="ds-text-accent-primary hover:ds-text-accent-hover active:ds-text-accent-hover mb-4 inline-block font-medium text-sm sm:text-base transition-colors touch-manipulation">
          ← Back to Equipment
        </Link>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary">New Equipment Assignment</h1>
        <p className="text-sm sm:text-base ds-text-secondary mt-1">Create a new equipment assignment for a phase</p>
      </div>

      {/* Information Card */}
      <div className="ds-bg-accent-subtle rounded-xl border-2 ds-border-accent-subtle p-4 sm:p-6 mb-6 shadow-lg transition-all duration-300">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 ds-bg-accent-primary rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-base sm:text-lg font-bold ds-text-primary">Creating an Equipment Assignment</h3>
              <button
                onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 ds-bg-surface/80 hover:ds-bg-surface active:ds-bg-surface border ds-border-accent-subtle rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:ring-offset-2 touch-manipulation"
                aria-label={isInfoExpanded ? 'Collapse information' : 'Expand information'}
                aria-expanded={isInfoExpanded}
              >
                <svg 
                  className={`w-5 h-5 sm:w-6 sm:h-6 ds-text-accent-primary transition-transform duration-300 ${isInfoExpanded ? 'rotate-180' : ''}`} 
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
                <p className="text-xs sm:text-sm ds-text-secondary leading-relaxed">
                  Equipment assignments track machinery, tools, and vehicles used in construction phases. Equipment can be rented from suppliers, purchased, or owned. Track daily rates, utilization hours, suppliers, and ensure proper cost allocation.
                </p>
                <div className="ds-bg-surface/70 rounded-lg p-3 border ds-border-accent-subtle">
                  <p className="text-xs ds-text-secondary">
                    <strong className="ds-text-primary">Tip:</strong> Specify whether equipment is rented, purchased, or owned. For rentals, include supplier details and daily rates. Track estimated and actual utilization hours to monitor efficiency and costs.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs sm:text-sm ds-text-muted italic mt-1 animate-fadeIn">
                Click to expand for more information
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-4 sm:p-6 lg:p-8">
        {error && (
          <div className="bg-red-500/10 border-2 border-red-400/60 text-red-200 px-4 py-3 rounded-lg mb-6 font-medium text-sm sm:text-base">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          {/* Project & Phase Selection Section */}
          <div className="ds-bg-accent-subtle rounded-xl p-4 sm:p-6 border ds-border-accent-subtle">
            <h2 className="text-base sm:text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 ds-text-accent-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Project & Phase Selection
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Project Selection */}
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Project <span className="text-red-500">*</span>
                </label>
                {loadingProjects ? (
                  <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted">
                    Loading projects...
                  </div>
                ) : projects.length === 0 ? (
                  <div className="w-full px-4 py-2.5 bg-amber-500/10 border-2 border-amber-400/60 rounded-lg text-amber-200">
                    No projects available
                  </div>
                ) : (
                  <select
                    name="projectId"
                    value={formData.projectId}
                    onChange={handleChange}
                    required
                    disabled={loadingProjects}
                    className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium touch-manipulation"
                  >
                    <option value="" className="ds-text-muted">Select Project</option>
                    {projects.map((project) => (
                      <option key={project._id} value={project._id} className="ds-text-primary">
                        {project.projectName || project.projectCode || 'Unnamed Project'}
                      </option>
                    ))}
                  </select>
                )}
                {projects.length > 0 && !formData.projectId && (
                  <p className="text-xs ds-text-muted mt-1.5">Please select a project to continue</p>
                )}
              </div>

              {/* Phase Selection - Only required for phase-specific equipment */}
              {formData.equipmentScope === 'phase_specific' && (
                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Phase <span className="text-red-500">*</span>
                  </label>
                  {loadingPhases ? (
                    <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted">
                      Loading phases...
                    </div>
                  ) : !formData.projectId ? (
                    <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted">
                      Select Project First
                    </div>
                  ) : phases.length === 0 ? (
                    <div className="w-full px-4 py-2.5 bg-amber-500/10 border-2 border-amber-400/60 rounded-lg text-amber-200">
                      No phases available for this project
                    </div>
                  ) : (
                    <select
                      name="phaseId"
                      value={formData.phaseId}
                      onChange={handleChange}
                      required
                      disabled={loadingPhases || !formData.projectId}
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium touch-manipulation"
                    >
                      <option value="" className="ds-text-muted">Select Phase</option>
                      {phases.map((phase) => (
                        <option key={phase._id} value={phase._id} className="ds-text-primary">
                          {phase.phaseName || phase.name} {phase.phaseCode ? `(${phase.phaseCode})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {formData.projectId && phases.length > 0 && !formData.phaseId && (
                    <p className="text-xs ds-text-muted mt-1.5">Please select a phase</p>
                  )}
                </div>
              )}
            </div>

            {/* Equipment Scope Selection */}
            <div className="mt-4">
              <label className="block text-sm font-semibold ds-text-primary mb-2">
                Equipment Scope <span className="text-red-500">*</span>
              </label>
              <select
                name="equipmentScope"
                value={formData.equipmentScope}
                onChange={(e) => {
                  const newScope = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    equipmentScope: newScope,
                    phaseId: newScope === 'site_wide' ? '' : prev.phaseId, // Clear phase if site-wide
                  }));
                }}
                required
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus transition-all duration-200 font-medium touch-manipulation"
              >
                <option value="phase_specific">Phase-Specific (DCC)</option>
                <option value="site_wide">Site-Wide (Indirect Cost)</option>
              </select>
              <p className="text-xs ds-text-muted mt-1.5">
                {formData.equipmentScope === 'phase_specific' 
                  ? 'Phase-specific equipment is charged to the phase budget (DCC)'
                  : 'Site-wide equipment is charged to indirect costs (generators, site office equipment, etc.)'}
              </p>
            </div>
          </div>

          {/* Equipment Details Section */}
          <div className="ds-bg-surface-muted rounded-xl p-4 sm:p-6 border ds-border-subtle">
            <h2 className="text-base sm:text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 ds-text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Equipment Details
            </h2>
            
            {/* Equipment Name */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-semibold ds-text-primary mb-2">
                Equipment Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="equipmentName"
                value={formData.equipmentName}
                onChange={handleChange}
                required
                minLength={2}
                placeholder="e.g., Excavator CAT 320"
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted transition-all duration-200 font-medium touch-manipulation"
              />
            </div>

            {/* Equipment Type and Acquisition Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Equipment Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="equipmentType"
                  value={formData.equipmentType}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
                >
                  <option value="" className="ds-text-muted">Select Type</option>
                  {EQUIPMENT_TYPES.map((type) => (
                    <option key={type} value={type} className="ds-text-primary">
                      {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Acquisition Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="acquisitionType"
                  value={formData.acquisitionType}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
                >
                  {ACQUISITION_TYPES.map((type) => (
                    <option key={type} value={type} className="ds-text-primary">
                      {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Supplier & Dates Section */}
          <div className="ds-bg-surface-muted rounded-xl p-4 sm:p-6 border ds-border-subtle">
            <h2 className="text-base sm:text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 ds-text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Supplier & Duration
            </h2>

            {/* Supplier Selection */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-semibold ds-text-primary mb-2">
                Supplier
              </label>
              {loadingSuppliers ? (
                <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted">
                  Loading suppliers...
                </div>
              ) : (
                <select
                  name="supplierId"
                  value={formData.supplierId}
                  onChange={handleChange}
                  disabled={loadingSuppliers}
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
                >
                  <option value="" className="ds-text-muted">Select Supplier (Optional)</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id} className="ds-text-primary">
                      {supplier.supplierName || 'Unnamed Supplier'}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs ds-text-muted mt-1.5">Leave blank if equipment is owned or purchased</p>
            </div>

            {/* Start and End Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus transition-all duration-200 font-medium touch-manipulation"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus transition-all duration-200 font-medium touch-manipulation"
                />
              </div>
            </div>
          </div>

          {/* Costs & Hours Section */}
          <div className="ds-bg-surface-muted rounded-xl p-4 sm:p-6 border ds-border-subtle">
            <h2 className="text-base sm:text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 ds-text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Costs & Hours
            </h2>

            {/* Daily Rate and Estimated Hours */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Daily Rate <span className="ds-text-muted text-xs">(Optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 ds-text-secondary font-medium">$</span>
                  <input
                    type="number"
                    name="dailyRate"
                    value={formData.dailyRate}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full pl-8 pr-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted transition-all duration-200 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Estimated Utilization Hours <span className="ds-text-muted text-xs">(Optional)</span>
                </label>
                <input
                  type="number"
                  name="estimatedHours"
                  value={formData.estimatedHours}
                  onChange={handleChange}
                  placeholder="0"
                  step="0.5"
                  min="0"
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted transition-all duration-200 font-medium touch-manipulation"
                />
              </div>
            </div>
          </div>

          {/* Additional Info Section */}
          <div className="ds-bg-surface-muted rounded-xl p-4 sm:p-6 border ds-border-subtle">
            <h2 className="text-base sm:text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 ds-text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Additional Information
            </h2>

            {/* Status */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-semibold ds-text-primary mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium"
              >
                <option value="assigned" className="ds-text-primary">Assigned</option>
                <option value="pending" className="ds-text-primary">Pending</option>
                <option value="returned" className="ds-text-primary">Returned</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold ds-text-primary mb-2">
                Notes <span className="ds-text-muted text-xs">(Optional)</span>
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Add any additional notes or specifications..."
                rows={4}
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted transition-all duration-200 font-medium resize-none touch-manipulation"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t ds-border-subtle">
            <Link 
              href="/equipment"
              className="flex-1 px-6 py-2.5 ds-bg-surface-muted hover:ds-bg-surface active:ds-bg-surface ds-text-primary font-bold rounded-lg transition-colors duration-200 text-center touch-manipulation"
            >
              Cancel
            </Link>
            <LoadingButton
              type="submit"
              disabled={saving || loadingProjects}
              loading={saving}
              className="flex-1 px-6 py-2.5 ds-bg-accent-primary hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              Create Equipment
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}

// Main component wrapped with Suspense
export default function NewEquipmentPage() {
  return (
    <AppLayout>
      <Suspense fallback={
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center ds-text-muted">Loading equipment form...</div>
        </div>
      }>
        <NewEquipmentPageContent />
      </Suspense>
    </AppLayout>
  );
}
