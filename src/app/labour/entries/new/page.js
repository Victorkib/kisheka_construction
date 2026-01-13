/**
 * New Labour Entry Page
 * Form for creating a new labour entry
 * 
 * Route: /labour/entries/new
 */

'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton, LoadingSelect } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast/toast-container';
import { VALID_WORKER_TYPES, VALID_WORKER_ROLES, VALID_SKILL_TYPES } from '@/lib/constants/labour-constants';

function NewLabourEntryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [floors, setFloors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [workItems, setWorkItems] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [budgetInfo, setBudgetInfo] = useState(null);
  const [validatingBudget, setValidatingBudget] = useState(false);

  const [formData, setFormData] = useState({
    projectId: '',
    phaseId: '',
    isIndirectLabour: false, // NEW: Whether this is indirect labour
    floorId: '',
    categoryId: '',
    workItemId: '',
    workerId: '',
    workerName: '',
    workerType: 'internal',
    workerRole: 'skilled',
    skillType: 'general_worker',
    entryDate: new Date().toISOString().split('T')[0],
    clockInTime: '',
    clockOutTime: '',
    breakDuration: 0,
    totalHours: 8,
    overtimeHours: 0,
    taskDescription: '',
    quantityCompleted: '',
    unitOfMeasure: '',
    unitRate: '',
    hourlyRate: '',
    dailyRate: '',
    serviceType: '',
    visitPurpose: '',
    deliverables: [],
    qualityRating: '',
    productivityRating: '',
    notes: '',
    equipmentId: '',
    subcontractorId: '',
  });

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
    fetchCategories();
    fetchWorkers();
  }, []);

  // Handle projectId, workerId, phaseId, and workItemId from URL
  useEffect(() => {
    const projectIdFromUrl = searchParams.get('projectId');
    const workerIdFromUrl = searchParams.get('workerId');
    const phaseIdFromUrl = searchParams.get('phaseId');
    const workItemIdFromUrl = searchParams.get('workItemId');
    
    if (projectIdFromUrl) {
      setFormData((prev) => ({ ...prev, projectId: projectIdFromUrl }));
    }
    
    if (phaseIdFromUrl) {
      setFormData((prev) => ({ ...prev, phaseId: phaseIdFromUrl }));
    }
    
    if (workerIdFromUrl) {
      setFormData((prev) => ({ ...prev, workerId: workerIdFromUrl }));
    }
    
    if (workItemIdFromUrl) {
      setFormData((prev) => ({ ...prev, workItemId: workItemIdFromUrl }));
    }
  }, [searchParams]);

  // Fetch phases and floors when projectId changes
  useEffect(() => {
    if (formData.projectId) {
      fetchPhases(formData.projectId);
      fetchFloors(formData.projectId);
      fetchWorkItems(formData.projectId);
    } else {
      setPhases([]);
      setFloors([]);
      setWorkItems([]);
      setFormData((prev) => ({ ...prev, phaseId: '', floorId: '', workItemId: '' }));
    }
  }, [formData.projectId]);

  // Fetch work items when phaseId changes
  useEffect(() => {
    if (formData.projectId && formData.phaseId) {
      fetchWorkItems(formData.projectId, formData.phaseId);
    }
  }, [formData.phaseId]);

  // State for work item details and assigned worker suggestion
  const [workItemDetails, setWorkItemDetails] = useState(null);
  const [suggestedWorker, setSuggestedWorker] = useState(null);

  // Fetch work item details when workItemId is provided from URL
  useEffect(() => {
    const workItemIdFromUrl = searchParams.get('workItemId');
    if (workItemIdFromUrl) {
      // Fetch work item to get projectId, phaseId, and assigned workers
      fetch(`/api/work-items/${workItemIdFromUrl}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            const workItem = data.data;
            setWorkItemDetails(workItem);
            
            // Pre-populate projectId and phaseId from work item
            if (workItem.projectId && !formData.projectId) {
              setFormData(prev => ({ ...prev, projectId: workItem.projectId.toString() }));
            }
            if (workItem.phaseId && !formData.phaseId) {
              setFormData(prev => ({ ...prev, phaseId: workItem.phaseId.toString() }));
            }
            
            // Pre-fill workerId from assigned workers (suggest first assigned worker)
            if (workItem.assignedWorkers && workItem.assignedWorkers.length > 0 && !formData.workerId) {
              const firstAssignedWorker = workItem.assignedWorkers[0];
              const workerId = firstAssignedWorker._id?.toString() || firstAssignedWorker.userId?.toString();
              if (workerId) {
                setSuggestedWorker(firstAssignedWorker);
                setFormData(prev => ({ ...prev, workerId: workerId }));
              }
            }
          }
        })
        .catch(err => {
          console.error('Error fetching work item:', err);
        });
    } else {
      setWorkItemDetails(null);
      setSuggestedWorker(null);
    }
  }, [searchParams]);

  // Track previous values to prevent unnecessary updates
  const prevOvertimeHoursRef = useRef(0);
  const prevBudgetParamsRef = useRef(null);

  // Memoize validateBudget to prevent recreation on every render
  const validateBudget = useCallback(async () => {
    if (!formData.phaseId || !formData.totalHours || !formData.hourlyRate) {
      setBudgetInfo(null);
      return;
    }

    setValidatingBudget(true);
    try {
      // Use schema calculation logic
      const totalHours = parseFloat(formData.totalHours) || 0;
      const hourlyRate = parseFloat(formData.hourlyRate) || 0;
      const calculatedOvertimeHours = Math.max(0, totalHours - 8);
      const finalOvertimeHours = (parseFloat(formData.overtimeHours) || 0) > 0 
        ? parseFloat(formData.overtimeHours) 
        : calculatedOvertimeHours;
      const finalRegularHours = totalHours - finalOvertimeHours;
      const overtimeRate = hourlyRate * 1.5;
      const totalCost = finalRegularHours * hourlyRate + finalOvertimeHours * overtimeRate;

      const response = await fetch(
        `/api/labour/financial/validate?phaseId=${formData.phaseId}&labourCost=${totalCost}`
      );
      const data = await response.json();
      if (data.success) {
        setBudgetInfo(data.data);
      }
    } catch (err) {
      console.error('Error validating budget:', err);
    } finally {
      setValidatingBudget(false);
    }
  }, [formData.phaseId, formData.totalHours, formData.hourlyRate]);

  // Auto-calculate overtimeHours when totalHours changes (using schema logic)
  useEffect(() => {
    if (formData.totalHours) {
      const totalHours = parseFloat(formData.totalHours) || 0;
      const calculatedOvertimeHours = Math.max(0, totalHours - 8);
      
      // Only auto-set if user hasn't manually set overtimeHours
      // If overtimeHours is 0 or not set, use calculated value
      const currentOvertimeHours = parseFloat(formData.overtimeHours) || 0;
      const shouldAutoSet = currentOvertimeHours === 0 || !formData.overtimeHours;
      
      if (shouldAutoSet && prevOvertimeHoursRef.current !== calculatedOvertimeHours) {
        prevOvertimeHoursRef.current = calculatedOvertimeHours;
        setFormData((prev) => ({ ...prev, overtimeHours: calculatedOvertimeHours }));
      }
    }
  }, [formData.totalHours, formData.overtimeHours]);

  // Validate budget when cost changes
  useEffect(() => {
    if (formData.phaseId && formData.totalHours && formData.hourlyRate) {
      const currentParams = `${formData.phaseId}-${formData.totalHours}-${formData.hourlyRate}`;
      // Only validate if parameters actually changed
      if (prevBudgetParamsRef.current !== currentParams) {
        prevBudgetParamsRef.current = currentParams;
        validateBudget();
      }
    }
  }, [formData.phaseId, formData.totalHours, formData.hourlyRate, validateBudget]);

  // Track previous workerId to prevent unnecessary auto-fills
  const prevWorkerIdRef = useRef(null);

  // Auto-fill worker info when workerId changes
  useEffect(() => {
    if (formData.workerId && formData.workerId !== prevWorkerIdRef.current) {
      prevWorkerIdRef.current = formData.workerId;
      const worker = workers.find((w) => w._id === formData.workerId || w.userId === formData.workerId);
      if (worker) {
        setFormData((prev) => ({
          ...prev,
          workerName: worker.workerName || prev.workerName,
          hourlyRate: worker.defaultHourlyRate?.toString() || prev.hourlyRate,
          workerType: worker.workerType || prev.workerType,
          skillType: worker.skillTypes?.[0] || prev.skillType,
        }));
      }
    }
  }, [formData.workerId, workers]);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch('/api/projects/accessible');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      toast.showError('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchPhases = async (projectId) => {
    if (!projectId) return;
    setLoadingPhases(true);
    try {
      const response = await fetch(`/api/phases?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
    } finally {
      setLoadingPhases(false);
    }
  };

  const fetchFloors = async (projectId) => {
    if (!projectId) return;
    setLoadingFloors(true);
    try {
      const response = await fetch(`/api/floors?projectId=${projectId}`);
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

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchWorkers = async () => {
    try {
      const response = await fetch('/api/labour/workers?status=active');
      const data = await response.json();
      if (data.success) {
        setWorkers(data.data?.workers || []);
      }
    } catch (err) {
      console.error('Error fetching workers:', err);
    }
  };

  const fetchWorkItems = async (projectId, phaseId = null) => {
    if (!projectId) return;
    try {
      let url = `/api/work-items?projectId=${projectId}`;
      if (phaseId) {
        url += `&phaseId=${phaseId}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setWorkItems(data.data?.workItems || []);
      }
    } catch (err) {
      console.error('Error fetching work items:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validation
      if (!formData.projectId || !formData.phaseId) {
        throw new Error('Project and Phase are required');
      }
      
      if (!formData.workerName || formData.workerName.trim().length < 2) {
        throw new Error('Worker name is required and must be at least 2 characters');
      }
      
      if (!formData.hourlyRate || parseFloat(formData.hourlyRate) < 0) {
        throw new Error('Hourly rate is required and must be >= 0');
      }
      
      if (!formData.totalHours || parseFloat(formData.totalHours) <= 0) {
        throw new Error('Total hours is required and must be > 0');
      }
      
      const breakDuration = parseFloat(formData.breakDuration) || 0;
      if (breakDuration < 0 || breakDuration > 480) {
        throw new Error('Break duration must be between 0 and 480 minutes (8 hours)');
      }
      
      // Validate clock times if both provided
      if (formData.clockInTime && formData.clockOutTime) {
        const clockIn = new Date(`${formData.entryDate}T${formData.clockInTime}`);
        const clockOut = new Date(`${formData.entryDate}T${formData.clockOutTime}`);
        if (clockOut <= clockIn) {
          throw new Error('Clock out time must be after clock in time');
        }
      }

      // Use schema calculation logic - don't send calculated fields
      const totalHours = parseFloat(formData.totalHours) || 0;
      const hourlyRate = parseFloat(formData.hourlyRate) || 0;
      // Let schema calculate overtimeHours if not provided
      const overtimeHours = parseFloat(formData.overtimeHours) || 0;

      const response = await fetch('/api/labour/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          totalHours,
          overtimeHours: overtimeHours > 0 ? overtimeHours : 0, // Schema will calculate if 0
          hourlyRate,
          breakDuration: breakDuration,
          quantityCompleted: formData.quantityCompleted ? parseFloat(formData.quantityCompleted) : null,
          unitRate: formData.unitRate ? parseFloat(formData.unitRate) : null,
          dailyRate: formData.dailyRate ? parseFloat(formData.dailyRate) : null,
          serviceType: formData.serviceType || null,
          visitPurpose: formData.visitPurpose || null,
          deliverables: Array.isArray(formData.deliverables) ? formData.deliverables : (formData.deliverables ? [formData.deliverables] : []),
          qualityRating: (formData.qualityRating && 
            (typeof formData.qualityRating === 'string' ? formData.qualityRating.trim() !== '' : formData.qualityRating !== '') &&
            !isNaN(parseFloat(formData.qualityRating))) 
            ? parseFloat(formData.qualityRating) 
            : null,
          productivityRating: (formData.productivityRating && 
            (typeof formData.productivityRating === 'string' ? formData.productivityRating.trim() !== '' : formData.productivityRating !== '') &&
            !isNaN(parseFloat(formData.productivityRating))) 
            ? parseFloat(formData.productivityRating) 
            : null,
          clockInTime: formData.clockInTime ? new Date(`${formData.entryDate}T${formData.clockInTime}`).toISOString() : null,
          clockOutTime: formData.clockOutTime ? new Date(`${formData.entryDate}T${formData.clockOutTime}`).toISOString() : null,
          entryDate: formData.entryDate,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create labour entry');
      }

      // Show success message with worker profile creation info
      if (data.data?.workerProfileCreated && data.data?.createdWorkerProfile) {
        toast.showSuccess(
          `Labour entry created successfully! Worker profile created for ${data.data.createdWorkerProfile.workerName} (${data.data.createdWorkerProfile.employeeId}).`
        );
      } else {
        toast.showSuccess('Labour entry created and approved successfully!');
      }
      router.push(`/labour/entries/${data.data.entry._id}`);
    } catch (err) {
      setError(err.message);
      toast.showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate costs for display using schema logic (matches what will be saved)
  const totalHours = parseFloat(formData.totalHours) || 0;
  const hourlyRate = parseFloat(formData.hourlyRate) || 0;
  const calculatedOvertimeHours = Math.max(0, totalHours - 8);
  const finalOvertimeHours = (parseFloat(formData.overtimeHours) || 0) > 0 
    ? parseFloat(formData.overtimeHours) 
    : calculatedOvertimeHours;
  const finalRegularHours = totalHours - finalOvertimeHours;
  const overtimeRate = hourlyRate * 1.5;
  const regularCost = finalRegularHours * hourlyRate;
  const overtimeCost = finalOvertimeHours * overtimeRate;
  const totalCost = regularCost + overtimeCost;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/labour"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to Labour
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">New Labour Entry</h1>
          <p className="text-gray-600 mt-1">Create a new labour entry for tracking work and costs</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
          <div className="space-y-6">
            {/* Project & Phase Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project <span className="text-red-500">*</span>
                </label>
                <LoadingSelect
                  name="projectId"
                  value={formData.projectId}
                  onChange={handleChange}
                  required
                  loading={loadingProjects}
                  loadingText="Loading projects..."
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Project</option>
                  {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.projectName} ({project.projectCode})
                    </option>
                  ))}
                </LoadingSelect>
              </div>

              {/* Phase Selection - Only required for direct labour */}
              {!formData.isIndirectLabour && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phase <span className="text-red-500">*</span>
                  </label>
                  <LoadingSelect
                    name="phaseId"
                    value={formData.phaseId}
                    onChange={handleChange}
                    required
                    loading={loadingPhases}
                    loadingText="Loading phases..."
                    disabled={!formData.projectId}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Phase</option>
                    {phases.map((phase) => (
                      <option key={phase._id} value={phase._id}>
                        {phase.phaseName} ({phase.phaseCode})
                      </option>
                    ))}
                  </LoadingSelect>
                </div>
              )}
            </div>

            {/* Indirect Labour Option */}
            <div className="border-t pt-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="isIndirectLabour"
                  name="isIndirectLabour"
                  checked={formData.isIndirectLabour}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      isIndirectLabour: e.target.checked,
                      phaseId: e.target.checked ? '' : prev.phaseId, // Clear phase if indirect
                    }));
                  }}
                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <label htmlFor="isIndirectLabour" className="block text-sm font-medium text-gray-700 mb-1">
                    This is Indirect Labour
                  </label>
                  <p className="text-xs text-gray-600">
                    Indirect labour (site management, security, general site office staff) is charged to the project-level indirect costs budget, not the phase budget. Phase selection is not required for indirect labour.
                  </p>
                </div>
              </div>
            </div>

            {/* Floor & Category (Optional) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Floor (Optional)
                </label>
                <LoadingSelect
                  name="floorId"
                  value={formData.floorId}
                  onChange={handleChange}
                  loading={loadingFloors}
                  loadingText="Loading floors..."
                  disabled={!formData.projectId}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Floor</option>
                  {floors.map((floor) => (
                    <option key={floor._id} value={floor._id}>
                      {floor.name} (Floor {floor.floorNumber})
                    </option>
                  ))}
                </LoadingSelect>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category (Optional)
                </label>
                <select
                  name="categoryId"
                  value={formData.categoryId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Category</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Worker Information */}
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Worker Information</h2>
              
              {/* Assigned Worker Suggestion */}
              {suggestedWorker && workItemDetails && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">
                        This work item is assigned to <strong>{suggestedWorker.workerName}</strong>
                        {workItemDetails.assignedWorkersCount > 1 && (
                          <span className="text-blue-700"> and {workItemDetails.assignedWorkersCount - 1} other worker(s)</span>
                        )}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Worker has been pre-selected. You can change it if needed.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Worker <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="workerId"
                    value={formData.workerId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Worker (or enter name below)</option>
                    {workItemDetails?.assignedWorkers && workItemDetails.assignedWorkers.length > 0 && (
                      <optgroup label="✨ Assigned Workers">
                        {workItemDetails.assignedWorkers.map((worker) => (
                          <option key={worker._id?.toString()} value={worker._id?.toString() || worker.userId?.toString()}>
                            {worker.workerName} ({worker.employeeId || 'N/A'}) - Assigned
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {workers.map((worker) => {
                      const isAssigned = workItemDetails?.assignedWorkers?.some(
                        aw => (aw._id?.toString() || aw.userId?.toString()) === (worker.userId || worker._id)?.toString()
                      );
                      if (isAssigned) return null; // Already shown in assigned group
                      return (
                        <option key={worker._id} value={worker.userId || worker._id}>
                          {worker.workerName} ({worker.employeeId})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Worker Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="workerName"
                    value={formData.workerName}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                    placeholder="Enter worker name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Worker Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="workerType"
                    value={formData.workerType}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {VALID_WORKER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Worker Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="workerRole"
                    value={formData.workerRole}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {VALID_WORKER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Skill Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="skillType"
                    value={formData.skillType}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {VALID_SKILL_TYPES.map((skill) => (
                      <option key={skill} value={skill}>
                        {skill.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Time Tracking */}
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Time Tracking</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entry Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="entryDate"
                    value={formData.entryDate}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Hours <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="totalHours"
                    value={formData.totalHours}
                    onChange={handleChange}
                    required
                    min="0"
                    max="24"
                    step="0.5"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Clock In Time (Optional)
                  </label>
                  <input
                    type="time"
                    name="clockInTime"
                    value={formData.clockInTime}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Clock Out Time (Optional)
                  </label>
                  <input
                    type="time"
                    name="clockOutTime"
                    value={formData.clockOutTime}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Break Duration (minutes)
                  </label>
                  <input
                    type="number"
                    name="breakDuration"
                    value={formData.breakDuration}
                    onChange={handleChange}
                    min="0"
                    max="480"
                    step="1"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum 8 hours (480 minutes)</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  Regular Hours: {finalRegularHours.toFixed(2)} hrs | Overtime: {finalOvertimeHours.toFixed(2)} hrs
                </p>
              </div>
            </div>

            {/* Cost Information */}
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hourly Rate (KES) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="hourlyRate"
                    value={formData.hourlyRate}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily Rate (KES) - Optional
                  </label>
                  <input
                    type="number"
                    name="dailyRate"
                    value={formData.dailyRate}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                    placeholder="For daily-rate workers"
                  />
                </div>
              </div>

              {/* Cost Summary */}
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Cost Calculation</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-900">Regular Hours ({finalRegularHours.toFixed(2)} hrs × {hourlyRate.toLocaleString()}):</span>
                    <span className="font-medium text-gray-900">{regularCost.toLocaleString()} KES</span>
                  </div>
                  {finalOvertimeHours > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-900">Overtime Hours ({finalOvertimeHours.toFixed(2)} hrs × {(hourlyRate * 1.5).toLocaleString()}):</span>
                      <span className="font-medium text-gray-900">{overtimeCost.toLocaleString()} KES</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-blue-200">
                    <span className="font-semibold text-gray-900">Total Cost:</span>
                    <span className="font-bold text-gray-900">{totalCost.toLocaleString()} KES</span>
                  </div>
                </div>n 

                {/* Budget Validation */}
                {validatingBudget && (
                  <div className="mt-3 p-3 rounded bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-2">
                      <LoadingSpinner size="sm" color="blue-600" />
                      <p className="text-sm font-medium text-blue-800">Validating budget...</p>
                    </div>
                  </div>
                )}
                {budgetInfo && !validatingBudget && (
                  <div className={`mt-3 p-3 rounded ${budgetInfo.isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <p className={`text-sm font-medium ${budgetInfo.isValid ? 'text-green-800' : 'text-red-800'}`}>
                      {budgetInfo.isValid ? '✅' : '⚠️'} {budgetInfo.message}
                    </p>
                    {budgetInfo.budget && (
                      <p className="text-xs text-gray-600 mt-1">
                        Budget: {budgetInfo.budget.toLocaleString()} KES | 
                        Available: {budgetInfo.available.toLocaleString()} KES | 
                        Current: {budgetInfo.currentSpending.toLocaleString()} KES
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Professional Services Fields (Conditional) */}
            {formData.workerType === 'professional' && (
              <div className="border-t pt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Professional Service Details</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Service Type
                    </label>
                    <select
                      name="serviceType"
                      value={formData.serviceType}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Service Type</option>
                      <option value="consultation">Consultation</option>
                      <option value="inspection">Inspection</option>
                      <option value="design">Design</option>
                      <option value="approval">Approval</option>
                      <option value="testing">Testing</option>
                      <option value="review">Review</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Visit Purpose
                    </label>
                    <input
                      type="text"
                      name="visitPurpose"
                      value={formData.visitPurpose}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                      placeholder="Purpose of visit/service"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deliverables
                  </label>
                  <textarea
                    name="deliverables"
                    value={formData.deliverables?.join(', ') || ''}
                    onChange={(e) => {
                      const deliverables = e.target.value.split(',').map((d) => d.trim()).filter(Boolean);
                      setFormData((prev) => ({ ...prev, deliverables }));
                    }}
                    rows="3"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                    placeholder="Enter deliverables separated by commas (e.g., Site plan, Structural drawings, Inspection report)"
                  />
                  <p className="text-xs text-gray-500 mt-1">Separate multiple deliverables with commas</p>
                </div>
              </div>
            )}

            {/* Task Information */}
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Task Information</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Task Description
                </label>
                <textarea
                  name="taskDescription"
                  value={formData.taskDescription}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  placeholder="Describe the work performed..."
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Item (Optional)
                </label>
                <LoadingSelect
                  name="workItemId"
                  value={formData.workItemId}
                  onChange={handleChange}
                  disabled={!formData.phaseId}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Work Item</option>
                  {workItems.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name} ({item.category})
                    </option>
                  ))}
                </LoadingSelect>
              </div>
            </div>

            {/* Performance Ratings (Optional) */}
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Ratings (Optional)</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quality Rating
                    <span className="text-gray-500 text-xs font-normal ml-1">(1-5, Optional)</span>
                  </label>
                  <input
                    type="number"
                    name="qualityRating"
                    value={formData.qualityRating}
                    onChange={handleChange}
                    min="1"
                    max="5"
                    step="1"
                    placeholder="1-5"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                  <p className="text-xs text-gray-500 mt-1">Rate the quality of work (1 = Poor, 5 = Excellent)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Productivity Rating
                    <span className="text-gray-500 text-xs font-normal ml-1">(1-5, Optional)</span>
                  </label>
                  <input
                    type="number"
                    name="productivityRating"
                    value={formData.productivityRating}
                    onChange={handleChange}
                    min="1"
                    max="5"
                    step="1"
                    placeholder="1-5"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                  <p className="text-xs text-gray-500 mt-1">Rate the productivity/efficiency (1 = Low, 5 = High)</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="border-t pt-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                placeholder="Additional notes..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4 pt-6 border-t">
              <Link
                href="/labour"
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
              <LoadingButton
                type="submit"
                loading={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
              >
                Create & Approve Entry
              </LoadingButton>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewLabourEntryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewLabourEntryPageContent />
    </Suspense>
  );
}

