/**
 * New Equipment Page - ENHANCED with Budget/Capital Validation
 * Form to create a new equipment assignment with full UI components
 *
 * Route: /equipment/new
 */

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingButton, LoadingSpinner } from '@/components/loading';
import { BaseModal } from '@/components/modals';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import {
  EQUIPMENT_TYPES,
  ACQUISITION_TYPES,
} from '@/lib/constants/equipment-constants';
import { EquipmentScopeSelector } from '@/components/equipment/EquipmentScopeSelector';
import { MultiPhasePicker } from '@/components/equipment/MultiPhasePicker';
import { BudgetImpactPreview } from '@/components/equipment/BudgetImpactPreview';
import { EquipmentImageGallery } from '@/components/equipment/EquipmentImageGallery';
import { EquipmentDocumentsManager } from '@/components/equipment/EquipmentDocumentsManager';
import { EquipmentSpecificationsForm } from '@/components/equipment/EquipmentSpecificationsForm';
import { OperatorRequirementSelector } from '@/components/equipment/OperatorRequirementSelector';

function NewEquipmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { canAccess } = usePermissions();

  // State
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [floors, setFloors] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [validation, setValidation] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Multi-phase state
  const [selectedPhaseIds, setSelectedPhaseIds] = useState([]);
  const [costSplit, setCostSplit] = useState({
    type: 'equal',
    percentages: {},
  });

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
    equipmentScope: 'phase_specific',
    supplierId: '',
    startDate: '',
    endDate: '',
    dailyRate: '',
    estimatedHours: '',
    status: 'assigned',
    notes: '',
    // New fields
    serialNumber: '',
    assetTag: '',
    images: [],
    documents: [],
    specifications: null,
    operatorRequired: null,
    operatorType: null,
    operatorNotes: '',
  });

  // Fetch initial data
  useEffect(() => {
    fetchProjects();
    fetchSuppliers();
  }, []);

  // Fetch phases and floors when project changes
  useEffect(() => {
    if (formData.projectId) {
      fetchPhases(formData.projectId);
      fetchFloors(formData.projectId);
    } else {
      setPhases([]);
      setFloors([]);
    }
  }, [formData.projectId]);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await fetch('/api/projects/accessible', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        const projectsList = Array.isArray(data.data) ? data.data : [];
        setProjects(projectsList);
        if (projectsList.length === 1 && !formData.projectId) {
          setFormData((prev) => ({ ...prev, projectId: projectsList[0]._id }));
        }
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
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
          Pragma: 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        const phasesList = Array.isArray(data.data) ? data.data : [];
        setPhases(phasesList);
        if (phasesList.length === 1 && !formData.phaseId) {
          setFormData((prev) => ({ ...prev, phaseId: phasesList[0]._id }));
        }
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
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
          Pragma: 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setFloors(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching floors:', err);
    } finally {
      setLoadingFloors(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      const response = await fetch('/api/suppliers?status=active&limit=100', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const nextFormData = {
        ...prev,
        [name]: value,
      };

      if (name === 'equipmentScope') {
        nextFormData.phaseId =
          value === 'site_wide' ? '' : nextFormData.phaseId;
        nextFormData.floorId =
          value === 'floor_specific' ? nextFormData.floorId : '';
      }

      return nextFormData;
    });
  };

  const handleScopeChange = (scope) => {
    setFormData((prev) => ({
      ...prev,
      equipmentScope: scope,
      phaseId: scope === 'site_wide' ? '' : prev.phaseId,
      floorId: scope === 'floor_specific' ? prev.floorId : '',
    }));
  };

  const handleMultiPhaseChange = ({ phaseIds, costSplit: newCostSplit }) => {
    setSelectedPhaseIds(phaseIds);
    setCostSplit(newCostSplit);
  };

  const calculateTotalCost = () => {
    if (!formData.startDate || !formData.dailyRate) return 0;
    const start = new Date(formData.startDate);
    const end = formData.endDate ? new Date(formData.endDate) : new Date();
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    return days * (parseFloat(formData.dailyRate) || 0);
  };

  const handlePreview = async () => {
    // Validate form before showing preview
    if (formData.equipmentScope === 'phase_specific' && !formData.phaseId) {
      setError('Phase selection is required for phase-specific equipment');
      return;
    }
    if (
      formData.equipmentScope === 'multi_phase' &&
      selectedPhaseIds.length < 2
    ) {
      setError('Select at least 2 phases for multi-phase equipment');
      return;
    }
    if (formData.equipmentScope === 'floor_specific' && !formData.floorId) {
      setError('Floor selection is required for floor-specific equipment');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      // Call validation API endpoint
      const equipmentData = {
        ...formData,
        phaseIds:
          formData.equipmentScope === 'multi_phase' ? selectedPhaseIds : [],
        costSplit: formData.equipmentScope === 'multi_phase' ? costSplit : null,
        totalCost: calculateTotalCost(),
      };

      const response = await fetch('/api/equipment/validate', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        body: JSON.stringify(equipmentData),
      });

      const data = await response.json();

      if (data.success) {
        setValidation(data.data);
        setShowPreview(true);
      } else {
        setError(data.error || 'Validation failed');
      }
    } catch (err) {
      setError(err.message || 'Validation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);

    try {
      const equipmentData = {
        ...formData,
        phaseIds:
          formData.equipmentScope === 'multi_phase' ? selectedPhaseIds : [],
        costSplit: formData.equipmentScope === 'multi_phase' ? costSplit : null,
        // Convert empty strings to null for optional fields
        supplierId: formData.supplierId?.trim() || null,
        estimatedHours: formData.estimatedHours?.trim() ? parseFloat(formData.estimatedHours) : null,
        notes: formData.notes?.trim() || null
      };

      const response = await fetch('/api/equipment', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        body: JSON.stringify(equipmentData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create equipment');
      }

      toast.showSuccess('Equipment created successfully!');
      router.push(`/equipment/${data.data.equipment._id}`);
    } catch (err) {
      setError(err.message);
      toast.showError(err.message || 'Failed to create equipment');
    } finally {
      setSaving(false);
      setShowPreview(false);
    }
  };

  const totalCost = calculateTotalCost();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <Link
          href="/equipment"
          className="ds-text-accent-primary hover:ds-text-accent-hover mb-4 inline-block font-medium"
        >
          ← Back to Equipment
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold ds-text-primary">
          New Equipment Assignment
        </h1>
        <p className="text-sm ds-text-secondary mt-1">
          Create equipment with budget/capital validation
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6 space-y-8">
        {/* Equipment Scope Selection */}
        <section>
          <h2 className="text-lg font-bold ds-text-primary mb-4">
            Equipment Scope
          </h2>
          <EquipmentScopeSelector
            value={formData.equipmentScope}
            onChange={handleScopeChange}
            projectId={formData.projectId}
            phaseId={formData.phaseId}
            floorId={formData.floorId}
            phases={phases}
            floors={floors}
          />
        </section>

        {/* Multi-Phase Picker (shown when multi_phase selected) */}
        {formData.equipmentScope === 'multi_phase' && (
          <section className="ds-bg-surface-muted rounded-xl p-6 border ds-border-subtle">
            <h2 className="text-lg font-bold ds-text-primary mb-4">
              🔄 Multi-Phase Configuration
            </h2>
            <MultiPhasePicker
              phases={phases}
              selectedPhaseIds={selectedPhaseIds}
              costSplit={costSplit}
              onChange={handleMultiPhaseChange}
            />
          </section>
        )}

        {/* Basic Equipment Details */}
        <section className="ds-bg-surface-muted rounded-xl p-6 border ds-border-subtle">
          <h2 className="text-lg font-bold ds-text-primary mb-4">
            Equipment Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Project Selection */}
            <div>
              <label className="block text-sm font-semibold ds-text-primary mb-2">
                Project <span className="text-red-500">*</span>
              </label>
              {loadingProjects ? (
                <div className="px-4 py-2.5 ds-bg-surface-muted rounded-lg ds-text-muted">
                  Loading...
                </div>
              ) : (
                <select
                  name="projectId"
                  value={formData.projectId}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
                >
                  <option value="">Select Project</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.projectName || project.projectCode}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Phase Selection (for phase_specific and floor_specific) */}
            {(formData.equipmentScope === 'phase_specific' ||
              formData.equipmentScope === 'floor_specific') && (
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Phase <span className="text-red-500">*</span>
                </label>
                {loadingPhases ? (
                  <div className="px-4 py-2.5 ds-bg-surface-muted rounded-lg ds-text-muted">
                    Loading...
                  </div>
                ) : !formData.projectId ? (
                  <div className="px-4 py-2.5 bg-gray-50 text-gray-500 rounded-lg">
                    Select project first
                  </div>
                ) : phases.length === 0 ? (
                  <div className="px-4 py-2.5 bg-amber-50 text-amber-700 rounded-lg">
                    No phases available for this project
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      name="phaseId"
                      value={formData.phaseId}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus appearance-none cursor-pointer"
                      style={{
                        backgroundImage:
                          "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
                        backgroundPosition: 'right 0.5rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5em 1.5em',
                        paddingRight: '2.5rem',
                      }}
                    >
                      <option value="" className="ds-text-muted">
                        Select Phase
                      </option>
                      {phases.map((phase) => (
                        <option
                          key={phase._id}
                          value={phase._id}
                          className="ds-text-primary"
                        >
                          {phase.phaseName || phase.phaseCode}
                        </option>
                      ))}
                    </select>
                    {formData.phaseId && (
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-green-600">✓</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Floor Selection (for floor_specific) */}
            {formData.equipmentScope === 'floor_specific' && (
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Floor <span className="text-red-500">*</span>
                </label>
                {loadingFloors ? (
                  <div className="px-4 py-2.5 ds-bg-surface-muted rounded-lg ds-text-muted">
                    Loading...
                  </div>
                ) : !formData.projectId ? (
                  <div className="px-4 py-2.5 bg-gray-50 text-gray-500 rounded-lg">
                    Select project first
                  </div>
                ) : floors.length === 0 ? (
                  <div className="px-4 py-2.5 bg-amber-50 text-amber-700 rounded-lg">
                    No floors available for this project
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      name="floorId"
                      value={formData.floorId}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus appearance-none cursor-pointer"
                      style={{
                        backgroundImage:
                          "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
                        backgroundPosition: 'right 0.5rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5em 1.5em',
                        paddingRight: '2.5rem',
                      }}
                    >
                      <option value="" className="ds-text-muted">
                        Select Floor
                      </option>
                      {floors.map((floor) => (
                        <option
                          key={floor._id}
                          value={floor._id}
                          className="ds-text-primary"
                        >
                          {floor.name || `Floor ${floor.floorNumber}`}
                        </option>
                      ))}
                    </select>
                    {formData.floorId && (
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <span className="text-green-600">✓</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Equipment Name and Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
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
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold ds-text-primary mb-2">
                Equipment Type <span className="text-red-500">*</span>
              </label>
              <select
                name="equipmentType"
                value={formData.equipmentType}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
              >
                <option value="">Select Type</option>
                {EQUIPMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type
                      .replace('_', ' ')
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Acquisition Type */}
          <div className="mt-6">
            <label className="block text-sm font-semibold ds-text-primary mb-2">
              Acquisition Type <span className="text-red-500">*</span>
            </label>
            <select
              name="acquisitionType"
              value={formData.acquisitionType}
              onChange={handleChange}
              required
              className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
            >
              {ACQUISITION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type
                    .replace('_', ' ')
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Duration and Costs */}
        <section className="ds-bg-surface-muted rounded-xl p-6 border ds-border-subtle">
          <h2 className="text-lg font-bold ds-text-primary mb-4">
            Duration & Costs
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold ds-text-primary mb-2">
                Start Date
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
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
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold ds-text-primary mb-2">
                Daily Rate (KES)
              </label>
              <input
                type="number"
                name="dailyRate"
                value={formData.dailyRate}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
              />
            </div>

            {totalCost > 0 && (
              <div className="md:col-span-1">
                <label className="block text-sm font-semibold ds-text-secondary mb-2">
                  Estimated Total Cost
                </label>
                <div className="text-2xl font-bold ds-text-accent-primary">
                  {new Intl.NumberFormat('en-KE', {
                    style: 'currency',
                    currency: 'KES',
                    minimumFractionDigits: 0,
                  }).format(totalCost)}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Equipment Identification */}
        <section className="ds-bg-surface-muted rounded-xl p-6 border ds-border-subtle">
          <h2 className="text-lg font-bold ds-text-primary mb-4">
            Equipment Identification
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Serial Number */}
            <div>
              <label className="block text-sm font-semibold ds-text-primary mb-2">
                Serial Number
              </label>
              <input
                type="text"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                placeholder="e.g., CAT-320-2023-001"
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
              />
            </div>

            {/* Asset Tag */}
            <div>
              <label className="block text-sm font-semibold ds-text-primary mb-2">
                Asset Tag
              </label>
              <input
                type="text"
                name="assetTag"
                value={formData.assetTag}
                onChange={(e) => setFormData(prev => ({ ...prev, assetTag: e.target.value }))}
                placeholder="e.g., EQ-EXC-001"
                className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
              />
            </div>
          </div>

          <p className="text-xs ds-text-secondary mt-3">
            Optional: Add identification numbers for tracking and inventory management
          </p>
        </section>

        {/* Technical Specifications */}
        <section>
          <EquipmentSpecificationsForm
            specifications={formData.specifications}
            onChange={(specs) => setFormData(prev => ({ ...prev, specifications: specs }))}
          />
        </section>

        {/* Operator Requirements */}
        <section className="ds-bg-surface-muted rounded-xl p-6 border ds-border-subtle">
          <OperatorRequirementSelector
            operatorRequired={formData.operatorRequired}
            operatorType={formData.operatorType}
            operatorNotes={formData.operatorNotes}
            onChange={({ operatorRequired, operatorType, operatorNotes }) => 
              setFormData(prev => ({ ...prev, operatorRequired, operatorType, operatorNotes }))
            }
          />
        </section>

        {/* Equipment Images */}
        <section className="ds-bg-surface-muted rounded-xl p-6 border ds-border-subtle">
          <EquipmentImageGallery
            projectId={formData.projectId}
            images={formData.images}
            onImagesChange={(images) => setFormData(prev => ({ ...prev, images }))}
          />
        </section>

        {/* Equipment Documents */}
        <section className="ds-bg-surface-muted rounded-xl p-6 border ds-border-subtle">
          <EquipmentDocumentsManager
            projectId={formData.projectId}
            documents={formData.documents}
            onDocumentsChange={(documents) => setFormData(prev => ({ ...prev, documents }))}
          />
        </section>

        {/* Notes */}
        <section className="ds-bg-surface-muted rounded-xl p-6 border ds-border-subtle">
          <h2 className="text-lg font-bold ds-text-primary mb-4">
            Additional Notes
          </h2>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            placeholder="Add any additional information about this equipment..."
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          />
        </section>

        {/* Form Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t ds-border-subtle">
          <Link
            href="/equipment"
            className="flex-1 px-6 py-3 ds-bg-surface-muted ds-text-primary font-bold rounded-lg hover:ds-bg-surface transition-colors text-center"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handlePreview}
            disabled={saving || loadingProjects}
            className="flex-1 px-6 py-3 ds-bg-accent-primary text-white font-bold rounded-lg hover:ds-bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {saving ? 'Validating...' : 'Review & Create'}
          </button>
        </div>
      </div>

      {/* Budget Impact Preview Modal */}
      <BaseModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="📋 Budget Impact Preview"
        maxWidth="max-w-2xl"
      >
        <BudgetImpactPreview
          equipmentData={{
            ...formData,
            totalCost,
            phaseIds:
              formData.equipmentScope === 'multi_phase' ? selectedPhaseIds : [],
            costSplit:
              formData.equipmentScope === 'multi_phase' ? costSplit : null,
          }}
          validation={validation}
          onConfirm={handleConfirm}
          onCancel={() => setShowPreview(false)}
          isLoading={saving}
        />
      </BaseModal>
    </div>
  );
}

export default function NewEquipmentPage() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="max-w-5xl mx-auto px-4 py-8">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        <NewEquipmentPageContent />
      </Suspense>
    </AppLayout>
  );
}
