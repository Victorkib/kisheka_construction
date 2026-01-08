/**
 * Create Material Request Page
 * Form for creating new material requests
 * 
 * Route: /material-requests/new
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton, LoadingOverlay } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { WorkflowGuide } from '@/components/workflow/WorkflowGuide';
import { HelpIcon, FieldHelp } from '@/components/help/HelpTooltip';

function NewMaterialRequestPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [floors, setFloors] = useState([]);
  const [phases, setPhases] = useState([]);
  const [categories, setCategories] = useState([]);
  const [availableCapital, setAvailableCapital] = useState(null);
  const [loadingCapital, setLoadingCapital] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [prerequisites, setPrerequisites] = useState(null);
  const [loadingPrerequisites, setLoadingPrerequisites] = useState(false);

  const [formData, setFormData] = useState({
    projectId: '',
    floorId: '',
    phaseId: '',
    categoryId: '',
    category: '',
    materialName: '',
    description: '',
    quantityNeeded: '',
    unit: 'piece',
    customUnit: '',
    urgency: 'medium',
    estimatedCost: '',
    estimatedUnitCost: '',
    reason: '',
    notes: '',
  });

  // Predefined unit options
  const unitOptions = [
    'piece',
    'bag',
    'kg',
    'ton',
    'liter',
    'gallon',
    'meter',
    'square meter',
    'cubic meter',
    'roll',
    'sheet',
    'box',
    'carton',
    'pack',
    'set',
    'pair',
    'dozen',
    'others'
  ];

  // Fetch data on mount
  useEffect(() => {
    fetchProjects();
    fetchCategories();
  }, []);

  // Handle URL parameters
  useEffect(() => {
    const projectIdFromUrl = searchParams.get('projectId');
    const floorIdFromUrl = searchParams.get('floorId');
    const phaseIdFromUrl = searchParams.get('phaseId');
    const materialIdFromUrl = searchParams.get('materialId');
    const quantityFromUrl = searchParams.get('quantity');
    const quantityNeededFromUrl = searchParams.get('quantityNeeded');
    const materialNameFromUrl = searchParams.get('materialName');
    const categoryFromUrl = searchParams.get('category');
    const categoryIdFromUrl = searchParams.get('categoryId');
    const urgencyFromUrl = searchParams.get('urgency');
    const unitFromUrl = searchParams.get('unit');

    if (projectIdFromUrl) {
      setFormData((prev) => ({ ...prev, projectId: projectIdFromUrl }));
    }
    if (floorIdFromUrl) {
      setFormData((prev) => ({ ...prev, floorId: floorIdFromUrl }));
    }
    if (phaseIdFromUrl) {
      setFormData((prev) => ({ ...prev, phaseId: phaseIdFromUrl }));
    }
    if (quantityFromUrl || quantityNeededFromUrl) {
      setFormData((prev) => ({ ...prev, quantityNeeded: quantityNeededFromUrl || quantityFromUrl }));
    }
    if (materialNameFromUrl) {
      setFormData((prev) => ({ ...prev, materialName: materialNameFromUrl }));
    }
    if (categoryFromUrl) {
      setFormData((prev) => ({ ...prev, category: categoryFromUrl }));
    }
    if (categoryIdFromUrl) {
      setFormData((prev) => ({ ...prev, categoryId: categoryIdFromUrl }));
    }
    if (urgencyFromUrl) {
      setFormData((prev) => ({ ...prev, urgency: urgencyFromUrl }));
    }
    if (unitFromUrl) {
      setFormData((prev) => ({ ...prev, unit: unitFromUrl }));
    }
    if (materialIdFromUrl) {
      fetchMaterialDetails(materialIdFromUrl);
    }
  }, [searchParams]);

  // Fetch floors and phases when projectId changes
  useEffect(() => {
    if (formData.projectId) {
      fetchFloors(formData.projectId);
      fetchPhases(formData.projectId);
      fetchAvailableCapital(formData.projectId);
      fetchPrerequisites(formData.projectId);
    } else {
      setFloors([]);
      setPhases([]);
      setAvailableCapital(null);
      setPrerequisites(null);
    }
  }, [formData.projectId]);

  // Fetch available capital when estimated cost changes
  useEffect(() => {
    if (formData.projectId && formData.estimatedCost) {
      fetchAvailableCapital(formData.projectId);
    }
  }, [formData.estimatedCost, formData.projectId]);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
        // Auto-select first project if only one exists and not set from URL
        if (data.data && data.data.length === 1 && !formData.projectId) {
          setFormData((prev) => ({ ...prev, projectId: data.data[0]._id }));
        }
      } else {
        console.error('Failed to fetch projects:', data.error);
        setProjects([]);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setProjects([]);
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

  const fetchPhases = async (projectId) => {
    if (!projectId) {
      setPhases([]);
      return;
    }
    setLoadingPhases(true);
    try {
      const response = await fetch(`/api/phases?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
        // Clear phase selection if current phase is not in the new list
        setFormData((prev) => {
          const currentPhaseId = prev.phaseId;
          const phaseExists = data.data.some(p => p._id === currentPhaseId);
          return {
            ...prev,
            phaseId: phaseExists ? currentPhaseId : ''
          };
        });
      } else {
        setPhases([]);
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
      const response = await fetch('/api/categories');
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

  const fetchMaterialDetails = async (materialId) => {
    try {
      const response = await fetch(`/api/materials/${materialId}`);
      const data = await response.json();
      if (data.success && data.data) {
        const material = data.data;
        setFormData((prev) => ({
          ...prev,
          materialName: material.name || material.materialName || '',
          description: material.description || '',
          unit: material.unit || 'piece',
          categoryId: material.categoryId || '',
          category: material.category || '',
          projectId: material.projectId || prev.projectId,
          floorId: material.floor || prev.floorId,
        }));
      }
    } catch (err) {
      console.error('Error fetching material details:', err);
    }
  };

  const fetchAvailableCapital = async (projectId) => {
    if (!canAccess('view_financing')) return; // Only show if user has permission

    try {
      setLoadingCapital(true);
      const response = await fetch(`/api/project-finances?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setAvailableCapital(data.data.availableCapital || data.data.capitalBalance || 0);
      }
    } catch (err) {
      console.error('Error fetching available capital:', err);
    } finally {
      setLoadingCapital(false);
    }
  };

  const fetchPrerequisites = async (projectId) => {
    if (!projectId) {
      setPrerequisites(null);
      return;
    }

    try {
      setLoadingPrerequisites(true);
      const response = await fetch(`/api/projects/${projectId}/prerequisites`);
      const data = await response.json();
      if (data.success) {
        setPrerequisites(data.data);
      } else {
        setPrerequisites(null);
      }
    } catch (err) {
      console.error('Error fetching prerequisites:', err);
      setPrerequisites(null);
    } finally {
      setLoadingPrerequisites(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Clear floor and phase selection when project changes
      if (name === 'projectId') {
        updated.floorId = '';
        updated.phaseId = '';
      }
      // Handle category selection
      if (name === 'categoryId') {
        const selectedCategory = categories.find((cat) => cat._id === value);
        updated.category = selectedCategory ? selectedCategory.name : '';
      }
      // Handle unit selection - clear custom unit if not "others"
      if (name === 'unit') {
        if (value !== 'others') {
          updated.customUnit = '';
        }
      }
      return updated;
    });
  };

  // Calculate estimated cost when quantity or unit cost changes
  useEffect(() => {
    if (formData.estimatedUnitCost && formData.quantityNeeded) {
      const unitCost = parseFloat(formData.estimatedUnitCost);
      const quantity = parseFloat(formData.quantityNeeded);
      if (!isNaN(unitCost) && !isNaN(quantity) && unitCost >= 0 && quantity > 0) {
        const cost = unitCost * quantity;
        setFormData((prev) => ({ ...prev, estimatedCost: cost.toFixed(2) }));
      }
    } else if (formData.estimatedCost && formData.quantityNeeded) {
      // If total cost is provided, calculate unit cost
      const totalCost = parseFloat(formData.estimatedCost);
      const quantity = parseFloat(formData.quantityNeeded);
      if (!isNaN(totalCost) && !isNaN(quantity) && totalCost >= 0 && quantity > 0) {
        const unitCost = totalCost / quantity;
        setFormData((prev) => ({ ...prev, estimatedUnitCost: unitCost.toFixed(2) }));
      }
    }
  }, [formData.estimatedUnitCost, formData.quantityNeeded, formData.estimatedCost]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.projectId) {
      setError('Project is required');
      return;
    }

    // Check prerequisites
    if (prerequisites && !prerequisites.readiness.readyForMaterials) {
      const missingRequired = Object.entries(prerequisites.prerequisites)
        .filter(([_, item]) => item.required && !item.completed)
        .map(([key, _]) => key);
      
      if (missingRequired.length > 0) {
        setError(`Project setup incomplete. Please complete: ${missingRequired.join(', ')}. See checklist below.`);
        return;
      }
    }

    if (!formData.materialName || formData.materialName.trim().length < 2) {
      setError('Material name is required and must be at least 2 characters');
      return;
    }
    if (!formData.quantityNeeded || parseFloat(formData.quantityNeeded) <= 0) {
      setError('Quantity needed must be greater than 0');
      return;
    }
    // Validate unit - if "others" is selected, customUnit must be provided
    if (!formData.unit || formData.unit.trim().length === 0) {
      setError('Unit is required');
      return;
    }
    if (formData.unit === 'others' && (!formData.customUnit || formData.customUnit.trim().length === 0)) {
      setError('Please enter a custom unit name');
      return;
    }
    if (!formData.urgency) {
      setError('Urgency is required');
      return;
    }

    // Check financial warning if estimated cost exceeds available capital
    if (formData.estimatedCost && availableCapital !== null) {
      const estimatedCostNum = parseFloat(formData.estimatedCost);
      if (estimatedCostNum > availableCapital) {
        const proceed = confirm(
          `Warning: Estimated cost (KES ${estimatedCostNum.toLocaleString()}) exceeds available capital (KES ${availableCapital.toLocaleString()}). Do you want to proceed?`
        );
        if (!proceed) {
          return;
        }
      }
    }

    setLoading(true);
    try {
      const payload = {
        projectId: formData.projectId,
        materialName: formData.materialName.trim(),
        description: formData.description?.trim() || '',
        quantityNeeded: parseFloat(formData.quantityNeeded),
        unit: formData.unit === 'others' ? formData.customUnit.trim() : formData.unit.trim(),
        urgency: formData.urgency,
        reason: formData.reason?.trim() || '',
        notes: formData.notes?.trim() || '',
        ...(formData.floorId && { floorId: formData.floorId }),
        ...(formData.phaseId && { phaseId: formData.phaseId }),
        ...(formData.categoryId && { categoryId: formData.categoryId }),
        ...(formData.category && { category: formData.category }),
        ...(formData.estimatedCost && { estimatedCost: parseFloat(formData.estimatedCost) }),
        ...(formData.estimatedUnitCost && { estimatedUnitCost: parseFloat(formData.estimatedUnitCost) }),
      };

      const response = await fetch('/api/material-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        // Show capital warning if present
        if (data.data.capitalWarning) {
          if (data.data.capitalWarning.type === 'info') {
            toast.showInfo(data.data.capitalWarning.message, { duration: 8000 });
          } else {
            toast.showWarning(
              `Material request created but capital insufficient: ${data.data.capitalWarning.message}`,
              { duration: 10000 }
            );
          }
        } else {
          toast.showSuccess('Material request created successfully!');
        }
        router.push(`/material-requests/${data.data._id}`);
      } else {
        setError(data.error || 'Failed to create material request');
        toast.showError(data.error || 'Failed to create material request');
      }
    } catch (err) {
      setError(err.message || 'Failed to create material request');
      toast.showError(err.message || 'Failed to create material request');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return '0.00';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Loading Overlay */}
        <LoadingOverlay 
          isLoading={loading} 
          message="Creating material request..." 
          fullScreen={false} 
        />
        {/* Header */}
        <div className="mb-8">
          <Breadcrumbs 
            items={[
              { label: 'Material Requests', href: '/material-requests' },
              { label: 'Create Request', href: '/material-requests/new', current: true },
            ]}
          />
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Create Material Request</h1>
          <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Request materials needed for your project</p>
        </div>

        {/* Financial Warning */}
        {formData.estimatedCost && availableCapital !== null && parseFloat(formData.estimatedCost) > availableCapital && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">⚠️ Financial Warning</p>
            <p className="text-sm mt-1">
              Estimated cost ({formatCurrency(parseFloat(formData.estimatedCost))}) exceeds available capital ({formatCurrency(availableCapital)}).
              This is just an estimate and will not block approval, but please review carefully.
            </p>
          </div>
        )}

        {/* Available Capital Display */}
        {formData.projectId && availableCapital !== null && canAccess('view_financing') && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6">
            <p className="text-sm">
              <span className="font-semibold">Available Capital:</span> {formatCurrency(availableCapital)}
            </p>
          </div>
        )}

        {/* Prerequisites Warning */}
        {formData.projectId && prerequisites && !prerequisites.readiness.readyForMaterials && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-2">Project Setup Incomplete</h3>
                <p className="text-sm text-yellow-800 mb-3">
                  This project is missing required setup items. Please complete them before creating material requests.
                </p>
                <div className="space-y-2">
                  {Object.entries(prerequisites.prerequisites)
                    .filter(([_, item]) => item.required && !item.completed)
                    .map(([key, item]) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-yellow-800">{item.message}</span>
                        {item.actionUrl && (
                          <Link
                            href={item.actionUrl}
                            className="ml-auto text-yellow-700 hover:text-yellow-900 underline text-xs font-medium"
                          >
                            {item.actionLabel} →
                          </Link>
                        )}
                      </div>
                    ))}
                </div>
                <Link
                  href={`/projects/${formData.projectId}`}
                  className="mt-3 inline-block text-sm font-medium text-yellow-700 hover:text-yellow-900 underline"
                >
                  View full project setup checklist →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Workflow Guide */}
        <WorkflowGuide projectId={formData.projectId} compact={true} />

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
          <div className="space-y-6">
            {/* Project Selection */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Project <span className="text-red-500">*</span>
                <HelpIcon 
                  content="Select the project for which you're requesting materials. The project must have a budget and capital allocated."
                  position="right"
                />
              </label>
              <FieldHelp>
                Choose the project that needs these materials. Ensure the project has been set up with budget and capital.
              </FieldHelp>
              <select
                name="projectId"
                value={formData.projectId}
                onChange={handleChange}
                required
                disabled={loadingProjects || loading}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingProjects ? (
                  <option>Loading projects...</option>
                ) : (
                  <>
                    <option value="" className="text-gray-900">Select a project</option>
                    {projects.map((project) => (
                      <option key={project._id} value={project._id} className="text-gray-900">
                        {project.projectName} {project.projectCode && `(${project.projectCode})`}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Floor Selection (Optional) */}
            {formData.projectId && floors.length > 0 && (
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Floor (Optional)
                  <HelpIcon 
                    content="Select the specific floor if this material is for a particular floor. This helps with organization and tracking."
                    position="right"
                  />
                </label>
                <FieldHelp>
                  Optional: Specify which floor these materials are for. Helps organize materials by location.
                </FieldHelp>
                <select
                  name="floorId"
                  value={formData.floorId}
                  onChange={handleChange}
                  disabled={loadingFloors || loading || !formData.projectId}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingFloors ? (
                    <option>Loading floors...</option>
                  ) : (
                    <>
                      <option value="" className="text-gray-900">Select a floor</option>
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
                            {getFloorDisplay(floor.floorNumber, floor.name)}
                          </option>
                        );
                      })}
                    </>
                  )}
                </select>
              </div>
            )}

            {/* Phase Selection (Optional) */}
            {formData.projectId && (
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Construction Phase (Optional)
                  <HelpIcon 
                    content="Select the construction phase if this material is for a specific phase. This helps with phase-based budget tracking and financial management."
                    position="right"
                  />
                </label>
                <FieldHelp>
                  Optional: Specify which construction phase these materials are for. Helps track phase-based spending and budget allocation.
                </FieldHelp>
                {!formData.projectId ? (
                  <div className="px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-700 text-sm">
                    Please select a project first to see available phases
                  </div>
                ) : phases.length === 0 ? (
                  <div className="space-y-2">
                    <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600 text-sm">
                      No phases available for this project. Phases can be created in the project phases section.
                    </div>
                    <Link
                      href={`/phases?projectId=${formData.projectId}`}
                      className="text-sm text-blue-600 hover:underline"
                      target="_blank"
                    >
                      Manage phases for this project →
                    </Link>
                  </div>
                ) : (
                  <select
                    name="phaseId"
                    value={formData.phaseId}
                    onChange={handleChange}
                    disabled={loadingPhases || loading || !formData.projectId}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingPhases ? (
                      <option>Loading phases...</option>
                    ) : (
                      <>
                        <option value="" className="text-gray-900">Select phase (optional)</option>
                        {phases.map((phase) => (
                          <option key={phase._id} value={phase._id} className="text-gray-900">
                            {phase.phaseName || phase.name} {phase.status ? `(${phase.status.replace('_', ' ')})` : ''}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                )}
              </div>
            )}

            {/* Category Selection (Optional) */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Category (Optional)
              </label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                disabled={loadingCategories || loading}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingCategories ? (
                  <option>Loading categories...</option>
                ) : (
                  <>
                    <option value="" className="text-gray-900">Select a category</option>
                    {categories.map((category) => (
                      <option key={category._id} value={category._id} className="text-gray-900">
                        {category.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Material Name */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Material Name <span className="text-red-500">*</span>
                <HelpIcon 
                  content="Enter the name of the material you need. Be specific and clear (e.g., 'Portland Cement Grade 42.5' instead of just 'Cement')."
                  position="right"
                />
              </label>
              <FieldHelp>
                The name of the material you're requesting. Use clear, descriptive names.
              </FieldHelp>
              <input
                type="text"
                name="materialName"
                value={formData.materialName}
                onChange={handleChange}
                required
                minLength={2}
                placeholder="e.g., Cement, Steel Bars, etc."
                disabled={loading}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Description (Optional)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Additional details about the material..."
                disabled={loading}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Quantity and Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Quantity Needed <span className="text-red-500">*</span>
                  <HelpIcon 
                    content="Enter the total quantity needed. This should match the unit you select (e.g., if unit is 'bags', enter number of bags)."
                    position="right"
                  />
                </label>
                <FieldHelp>
                  Total quantity required. Must match the selected unit.
                </FieldHelp>
                <input
                  type="number"
                  name="quantityNeeded"
                  value={formData.quantityNeeded}
                  onChange={handleChange}
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Unit <span className="text-red-500">*</span>
                  <HelpIcon 
                    content="Select the unit of measurement. Choose from common units or select 'Others' to enter a custom unit name."
                    position="right"
                  />
                </label>
                <FieldHelp>
                  Unit of measurement for the quantity. Select 'Others' if your unit isn't listed.
                </FieldHelp>
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {unitOptions.map((option) => (
                    <option key={option} value={option} className="text-gray-900">
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
                {formData.unit === 'others' && (
                  <input
                    type="text"
                    name="customUnit"
                    value={formData.customUnit}
                    onChange={handleChange}
                    required
                    placeholder="Enter custom unit name"
                    className="w-full mt-2 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                )}
              </div>
            </div>

            {/* Urgency */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Urgency <span className="text-red-500">*</span>
                <HelpIcon 
                  content="Select how urgent this material request is. High urgency requests are prioritized for approval and procurement."
                  position="right"
                />
              </label>
              <FieldHelp>
                How urgent is this request? High urgency items are processed first.
              </FieldHelp>
              <select
                name="urgency"
                value={formData.urgency}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="low" className="text-gray-900">Low</option>
                <option value="medium" className="text-gray-900">Medium</option>
                <option value="high" className="text-gray-900">High</option>
                <option value="critical" className="text-gray-900">Critical</option>
              </select>
            </div>

            {/* Estimated Cost (Optional) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Estimated Unit Cost (Optional)
                  <HelpIcon 
                    content="Enter the estimated cost per unit. The total estimated cost will be calculated automatically (Quantity × Unit Cost)."
                    position="right"
                  />
                </label>
                <FieldHelp>
                  Cost per unit. Total cost is calculated automatically.
                </FieldHelp>
                <input
                  type="number"
                  name="estimatedUnitCost"
                  value={formData.estimatedUnitCost}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Estimated Total Cost (Optional)
                  <HelpIcon 
                    content="Enter the total estimated cost. If you enter this, the unit cost will be calculated automatically (Total Cost ÷ Quantity)."
                    position="right"
                  />
                </label>
                <FieldHelp>
                  Total estimated cost. Unit cost will be calculated automatically.
                </FieldHelp>
                <input
                  type="number"
                  name="estimatedCost"
                  value={formData.estimatedCost}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Reason for Request (Optional)
                <HelpIcon 
                  content="Explain why this material is needed. This helps approvers understand the context and make informed decisions."
                  position="right"
                />
              </label>
              <FieldHelp>
                Optional: Explain why this material is needed. Helps with approval decisions.
              </FieldHelp>
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                rows={3}
                placeholder="Why is this material needed?"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Additional Notes (Optional)
                <HelpIcon 
                  content="Add any additional information, specifications, or special requirements for this material request."
                  position="right"
                />
              </label>
              <FieldHelp>
                Optional: Add any additional information, specifications, or special requirements.
              </FieldHelp>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Any additional information..."
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
              <Link
                href="/material-requests"
                className="px-6 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition"
              >
                Cancel
              </Link>
              <LoadingButton
                type="submit"
                isLoading={loading}
                loadingText="Creating Request..."
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
              >
                Create Request
              </LoadingButton>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewMaterialRequestPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    }>
      <NewMaterialRequestPageContent />
    </Suspense>
  );
}


