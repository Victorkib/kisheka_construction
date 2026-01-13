/**
 * New Equipment Page
 * Form to create a new equipment assignment
 * 
 * Route: /equipment/new
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { EQUIPMENT_TYPES, ACQUISITION_TYPES } from '@/lib/constants/equipment-constants';

export default function NewEquipmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { canAccess } = usePermissions();
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  
  const projectIdFromUrl = searchParams.get('projectId');
  const phaseIdFromUrl = searchParams.get('phaseId');
  
  const [formData, setFormData] = useState({
    projectId: projectIdFromUrl || '',
    phaseId: phaseIdFromUrl || '',
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
    } else {
      setPhases([]);
    }
  }, [formData.projectId]);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      // Use /api/projects/accessible to respect project-based organization and user memberships
      // This ensures users only see projects they have access to
      const response = await fetch('/api/projects/accessible');
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
      const response = await fetch(`/api/phases?projectId=${projectId}`);
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

  const fetchSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      const response = await fetch('/api/suppliers?status=active&limit=100');
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          phaseId: formData.equipmentScope === 'site_wide' ? null : formData.phaseId,
        }),
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
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/equipment" className="text-blue-600 hover:text-blue-800 mb-4 inline-block font-medium">
            ← Back to Equipment
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">New Equipment Assignment</h1>
          <p className="text-gray-600 mt-1">Create a new equipment assignment for a phase</p>
        </div>

        {/* Information Card */}
        <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 rounded-xl border-2 border-green-200 p-4 sm:p-6 mb-6 shadow-lg transition-all duration-300">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Creating an Equipment Assignment</h3>
                <button
                  onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                  className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-white/80 hover:bg-white border border-green-300 rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  aria-label={isInfoExpanded ? 'Collapse information' : 'Expand information'}
                  aria-expanded={isInfoExpanded}
                >
                  <svg 
                    className={`w-5 h-5 sm:w-6 sm:h-6 text-green-600 transition-transform duration-300 ${isInfoExpanded ? 'rotate-180' : ''}`} 
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
                    Equipment assignments track machinery, tools, and vehicles used in construction phases. Equipment can be rented from suppliers, purchased, or owned. Track daily rates, utilization hours, suppliers, and ensure proper cost allocation.
                  </p>
                  <div className="bg-white/70 rounded-lg p-3 border border-green-200">
                    <p className="text-xs text-gray-600">
                      <strong className="text-gray-900">Tip:</strong> Specify whether equipment is rented, purchased, or owned. For rentals, include supplier details and daily rates. Track estimated and actual utilization hours to monitor efficiency and costs.
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

                {/* Phase Selection - Only required for phase-specific equipment */}
                {formData.equipmentScope === 'phase_specific' && (
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
                )}
              </div>

              {/* Equipment Scope Selection */}
              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Equipment Scope <span className="text-red-600">*</span>
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
                  className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                >
                  <option value="phase_specific">Phase-Specific (DCC)</option>
                  <option value="site_wide">Site-Wide (Indirect Cost)</option>
                </select>
                <p className="text-xs text-gray-600 mt-1.5">
                  {formData.equipmentScope === 'phase_specific' 
                    ? 'Phase-specific equipment is charged to the phase budget (DCC)'
                    : 'Site-wide equipment is charged to indirect costs (generators, site office equipment, etc.)'}
                </p>
              </div>
            </div>

            {/* Equipment Details Section */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Equipment Details
              </h2>
              
              {/* Equipment Name */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Equipment Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="equipmentName"
                  value={formData.equipmentName}
                  onChange={handleChange}
                  required
                  minLength={2}
                  placeholder="e.g., Excavator CAT 320"
                  className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all duration-200 font-medium"
                />
              </div>

              {/* Equipment Type and Acquisition Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Equipment Type <span className="text-red-600">*</span>
                  </label>
                  <select
                    name="equipmentType"
                    value={formData.equipmentType}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
                  >
                    <option value="" className="text-gray-500">Select Type</option>
                    {EQUIPMENT_TYPES.map((type) => (
                      <option key={type} value={type} className="text-gray-900">
                        {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Acquisition Type <span className="text-red-600">*</span>
                  </label>
                  <select
                    name="acquisitionType"
                    value={formData.acquisitionType}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
                  >
                    {ACQUISITION_TYPES.map((type) => (
                      <option key={type} value={type} className="text-gray-900">
                        {type.replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Supplier & Dates Section */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Supplier & Schedule
              </h2>
              
              {/* Supplier (if rental or purchase) */}
              {(formData.acquisitionType === 'rental' || formData.acquisitionType === 'purchase') && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Supplier <span className="text-red-600">*</span>
                  </label>
                  {loadingSuppliers ? (
                    <div className="w-full px-4 py-2.5 bg-gray-100 border-2 border-gray-300 rounded-lg text-gray-500">
                      Loading suppliers...
                    </div>
                  ) : suppliers.length === 0 ? (
                    <div className="w-full px-4 py-2.5 bg-yellow-50 border-2 border-yellow-300 rounded-lg text-yellow-800">
                      No suppliers available
                    </div>
                  ) : (
                    <select
                      name="supplierId"
                      value={formData.supplierId}
                      onChange={handleChange}
                      required
                      disabled={loadingSuppliers}
                      className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium [&>option]:bg-white [&>option]:text-gray-900 [&>option]:font-medium"
                    >
                      <option value="" className="text-gray-500">Select Supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier._id} value={supplier._id} className="text-gray-900">
                          {supplier.supplierName || supplier.name || 'Unnamed Supplier'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Start Date <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    End Date <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleChange}
                    min={formData.startDate}
                    className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Financial Details Section */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Financial Details
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Daily Rate (KES) <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">KES</span>
                    <input
                      type="number"
                      name="dailyRate"
                      value={formData.dailyRate}
                      onChange={handleChange}
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all duration-200 font-medium"
                    />
                  </div>
                </div>

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
              </div>
            </div>

            {/* Additional Information Section */}
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Additional Information
              </h2>
              
              <div className="space-y-6">
                {/* Status */}
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
                    <option value="assigned" className="text-gray-900">Assigned</option>
                    <option value="in_use" className="text-gray-900">In Use</option>
                    <option value="returned" className="text-gray-900">Returned</option>
                    <option value="maintenance" className="text-gray-900">Maintenance</option>
                  </select>
                </div>

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
                    placeholder="Additional notes about this equipment assignment..."
                    className="w-full px-4 py-2.5 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 transition-all duration-200 font-medium resize-y"
                  />
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
              <Link
                href="/equipment"
                className="px-6 py-2.5 border-2 border-gray-300 rounded-lg text-gray-900 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
              >
                Cancel
              </Link>
              <LoadingButton
                type="submit"
                isLoading={saving}
                className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {saving ? 'Creating...' : 'Create Equipment'}
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}

