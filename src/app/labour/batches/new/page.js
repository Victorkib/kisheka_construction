/**
 * Bulk Labour Entry Builder Page
 * Multi-step wizard for creating bulk labour entries
 * 
 * Route: /labour/batches/new
 */

'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast/toast-container';
import { WizardProgress } from '@/components/bulk-request/wizard-progress';
import { WizardNavigation } from '@/components/bulk-request/wizard-navigation';
import { Step2AddWorkers } from '@/components/bulk-labour/step2-add-workers';
import { Step3EditDetails } from '@/components/bulk-labour/step3-edit-details';
import { Step4Review } from '@/components/bulk-labour/step4-review';

function BulkLabourEntryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess, user } = usePermissions();
  const toast = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stepValidation, setStepValidation] = useState({ 1: false, 2: false, 3: false, 4: false });
  const [budgetValidation, setBudgetValidation] = useState(null);
  const [preSelectedWorkerId, setPreSelectedWorkerId] = useState(null);

  // Wizard data state
  const [wizardData, setWizardData] = useState({
    // Step 1: Project & Settings
    projectId: '',
    defaultPhaseId: '',
    defaultFloorId: '',
    defaultCategoryId: '',
    defaultDate: new Date().toISOString().split('T')[0],
    entryType: 'time_based',
    defaultWorkerRole: 'skilled',
    batchName: '',
    workItemId: '', // Work item ID (optional) - all entries will link to this

    // Step 2: Workers
    labourEntries: [],
  });

  // Handle workerId and workItemId from URL
  useEffect(() => {
    const workerIdFromUrl = searchParams.get('workerId');
    if (workerIdFromUrl) {
      setPreSelectedWorkerId(workerIdFromUrl);
    }
    
    const workItemIdFromUrl = searchParams.get('workItemId');
    const defaultPhaseIdFromUrl = searchParams.get('defaultPhaseId');
    const projectIdFromUrl = searchParams.get('projectId');
    
    if (workItemIdFromUrl) {
      setWizardData(prev => ({ ...prev, workItemId: workItemIdFromUrl }));
      
      // If projectId and phaseId not provided, fetch work item to get them
      if (!projectIdFromUrl || !defaultPhaseIdFromUrl) {
        fetch(`/api/work-items/${workItemIdFromUrl}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.data) {
              const workItem = data.data;
              setWizardData(prev => ({
                ...prev,
                projectId: projectIdFromUrl || workItem.projectId?.toString() || prev.projectId,
                defaultPhaseId: defaultPhaseIdFromUrl || workItem.phaseId?.toString() || prev.defaultPhaseId,
                workItemId: workItemIdFromUrl,
              }));
            }
          })
          .catch(err => {
            console.error('Error fetching work item:', err);
          });
      }
    }
    
    // Also handle direct projectId and phaseId from URL
    if (projectIdFromUrl) {
      setWizardData(prev => ({ ...prev, projectId: projectIdFromUrl }));
    }
    if (defaultPhaseIdFromUrl) {
      setWizardData(prev => ({ ...prev, defaultPhaseId: defaultPhaseIdFromUrl }));
    }
  }, [searchParams]);

  // Check permissions (only once when user is loaded)
  const permissionCheckedRef = useRef(false);
  useEffect(() => {
    // Only check once when user is available
    if (user && !permissionCheckedRef.current) {
      permissionCheckedRef.current = true;
      if (!canAccess('create_labour_batch')) {
        toast.showError('You do not have permission to create bulk labour entries');
        router.push('/labour');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only depend on user, not on callbacks

  const validateStep = (step) => {
    switch (step) {
      case 1:
        // Project and phase required
        const step1Valid = !!(
          wizardData.projectId &&
          wizardData.defaultPhaseId
        );
        setStepValidation((prev) => ({ ...prev, 1: step1Valid }));
        return step1Valid;

      case 2:
        // At least one entry required
        const step2Valid = wizardData.labourEntries.length > 0 &&
          wizardData.labourEntries.every((entry) => {
            return entry.workerName &&
              entry.workerName.trim().length >= 2 &&
              entry.skillType &&
              entry.hourlyRate &&
              parseFloat(entry.hourlyRate) >= 0 &&
              entry.totalHours &&
              parseFloat(entry.totalHours) > 0;
          });
        setStepValidation((prev) => ({ ...prev, 2: step2Valid }));
        return step2Valid;

      case 3:
        // All entries must be valid
        const step3Valid = wizardData.labourEntries.length > 0 &&
          wizardData.labourEntries.every((entry) => {
            return entry.workerName &&
              entry.skillType &&
              entry.hourlyRate &&
              parseFloat(entry.hourlyRate) >= 0 &&
              entry.totalHours &&
              parseFloat(entry.totalHours) > 0;
          });
        setStepValidation((prev) => ({ ...prev, 3: step3Valid }));
        return step3Valid;

      case 4:
        // Final validation
        return validateStep(3);

      default:
        return false;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    } else {
      toast.showError('Please complete all required fields before proceeding');
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleUpdate = useCallback((updates) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Memoized validation change handlers to prevent infinite loops
  const handleValidationChange = useCallback((step, isValid) => {
    setStepValidation((prev) => {
      if (prev[step] === isValid) {
        return prev; // No change, return same object to prevent re-render
      }
      return { ...prev, [step]: isValid };
    });
  }, []);

  const handleSubmit = async () => {
    if (!validateStep(4)) {
      toast.showError('Please complete all required fields');
      return;
    }

    // Additional validation
    const hasInvalidEntries = wizardData.labourEntries.some(entry => {
      const breakDuration = parseFloat(entry.breakDuration) || 0;
      return breakDuration < 0 || breakDuration > 480;
    });
    
    if (hasInvalidEntries) {
      toast.showError('Break duration must be between 0 and 480 minutes (8 hours)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/labour/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: wizardData.projectId,
          batchName: wizardData.batchName || null,
          defaultPhaseId: wizardData.defaultPhaseId || null,
          defaultFloorId: wizardData.defaultFloorId || null,
          defaultCategoryId: wizardData.defaultCategoryId || null,
          defaultDate: wizardData.defaultDate,
          entryType: wizardData.entryType,
          defaultWorkerRole: wizardData.defaultWorkerRole,
          labourEntries: wizardData.labourEntries.map((entry) => {
            // Remove calculated fields - let schema calculate them
            const { regularCost, overtimeCost, totalCost, regularHours, ...cleanEntry } = entry;
            return {
              ...cleanEntry,
              projectId: wizardData.projectId,
              phaseId: entry.phaseId || wizardData.defaultPhaseId,
              floorId: entry.floorId || wizardData.defaultFloorId,
              categoryId: entry.categoryId || wizardData.defaultCategoryId,
              entryDate: entry.entryDate || wizardData.defaultDate,
              workerRole: entry.workerRole || wizardData.defaultWorkerRole,
              workerType: entry.workerType || 'internal',
              totalHours: parseFloat(entry.totalHours) || 0,
              hourlyRate: parseFloat(entry.hourlyRate) || 0,
              overtimeHours: parseFloat(entry.overtimeHours) || 0,
              breakDuration: parseFloat(entry.breakDuration) || 0,
              // Link to work item if provided at batch level
              workItemId: entry.workItemId || wizardData.workItemId || null,
            };
          }),
          workItemId: wizardData.workItemId || null, // Batch-level work item ID
          autoApprove: true, // Owner auto-approves
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create bulk labour entry');
      }

      // Show success message with worker profile creation info
      const entryCount = data.data?.entryCount || wizardData.labourEntries.length;
      const workerProfilesCreated = data.data?.workerProfilesCreated || 0;
      
      let successMessage = `Bulk labour entry created successfully! ${entryCount} entries created and approved.`;
      if (workerProfilesCreated > 0) {
        successMessage += ` ${workerProfilesCreated} worker profile(s) created.`;
        if (data.data?.createdWorkerProfiles && data.data.createdWorkerProfiles.length > 0) {
          const workerNames = data.data.createdWorkerProfiles
            .map(w => w.workerName)
            .join(', ');
          successMessage += ` Workers: ${workerNames}`;
        }
      }
      
      toast.showSuccess(successMessage);

      // Redirect to batch detail page
      router.push(`/labour/batches/${data.data.batch._id}`);
    } catch (err) {
      setError(err.message);
      toast.showError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1ProjectSettings
            wizardData={wizardData}
            onUpdate={handleUpdate}
            onValidationChange={(isValid) => handleValidationChange(1, isValid)}
          />
        );
      case 2:
        return (
          <Step2AddWorkers
            wizardData={wizardData}
            onUpdate={handleUpdate}
            onValidationChange={(isValid) => handleValidationChange(2, isValid)}
            preSelectedWorkerId={preSelectedWorkerId}
          />
        );
      case 3:
        return (
          <Step3EditDetails
            wizardData={wizardData}
            onUpdate={handleUpdate}
            onValidationChange={(isValid) => handleValidationChange(3, isValid)}
          />
        );
      case 4:
        return (
          <Step4Review
            wizardData={wizardData}
            onUpdate={handleUpdate}
            onSubmit={handleSubmit}
            loading={loading}
            onBudgetValidationChange={setBudgetValidation}
          />
        );
      default:
        return null;
    }
  };

  const stepLabels = {
    1: 'Project & Settings',
    2: 'Add Workers',
    3: 'Edit Details',
    4: 'Review & Submit',
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/labour"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to Labour Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Bulk Labour Entry</h1>
          <p className="text-gray-600 mt-1">Create multiple labour entries at once</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Wizard Progress */}
        <WizardProgress
          currentStep={currentStep}
          totalSteps={4}
          stepLabels={stepLabels}
        />

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          {renderStep()}
        </div>

        {/* Navigation */}
        <WizardNavigation
          currentStep={currentStep}
          totalSteps={4}
          onNext={handleNext}
          onPrevious={handlePrevious}
          canProceed={currentStep === 4 
            ? (stepValidation[currentStep] && (budgetValidation === null || budgetValidation?.isValid !== false)) 
            : (stepValidation[currentStep] || false)}
          onSubmit={currentStep === 4 ? handleSubmit : null}
          loading={loading}
          isLastStep={currentStep === 4}
          nextText={currentStep === 4 ? 'Create & Approve Batch' : 'Next'}
        />
      </div>
    </AppLayout>
  );
}

// Step Components (will be created in separate files)
function Step1ProjectSettings({ wizardData, onUpdate, onValidationChange }) {
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [floors, setFloors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [workItems, setWorkItems] = useState([]);
  const [selectedWorkItem, setSelectedWorkItem] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loadingWorkItems, setLoadingWorkItems] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (wizardData.projectId) {
      fetchPhases(wizardData.projectId);
      fetchFloors(wizardData.projectId);
    } else {
      setPhases([]);
      setFloors([]);
      setWorkItems([]);
      setSelectedWorkItem(null);
      onUpdate({ workItemId: '' });
    }
  }, [wizardData.projectId]);

  useEffect(() => {
    if (wizardData.defaultPhaseId && wizardData.projectId) {
      fetchWorkItems(wizardData.projectId, wizardData.defaultPhaseId);
    } else {
      setWorkItems([]);
      setSelectedWorkItem(null);
      onUpdate({ workItemId: '' });
    }
  }, [wizardData.defaultPhaseId, wizardData.projectId]);

  useEffect(() => {
    if (wizardData.workItemId && workItems.length > 0) {
      const workItem = workItems.find(wi => wi._id === wizardData.workItemId);
      setSelectedWorkItem(workItem || null);
    } else {
      setSelectedWorkItem(null);
    }
  }, [wizardData.workItemId, workItems]);

  // Use ref to track previous validation state to prevent unnecessary calls
  const prevValidationRef = useRef(null);

  useEffect(() => {
    const isValid = !!(wizardData.projectId && wizardData.defaultPhaseId);
    // Only call onValidationChange if the validation state actually changed
    if (prevValidationRef.current !== isValid) {
      prevValidationRef.current = isValid;
      onValidationChange(isValid);
    }
  }, [wizardData.projectId, wizardData.defaultPhaseId, onValidationChange]);

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
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchPhases = async (projectId) => {
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

  const fetchWorkItems = async (projectId, phaseId) => {
    setLoadingWorkItems(true);
    try {
      const response = await fetch(`/api/work-items?projectId=${projectId}&phaseId=${phaseId}`);
      const data = await response.json();
      if (data.success) {
        setWorkItems(data.data?.workItems || data.data || []);
      }
    } catch (err) {
      console.error('Error fetching work items:', err);
      setWorkItems([]);
    } finally {
      setLoadingWorkItems(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    onUpdate({ [name]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Project & Settings</h2>
        <p className="text-sm text-gray-600">
          Select the project and default settings for all entries in this batch.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project <span className="text-red-500">*</span>
          </label>
          <select
            name="projectId"
            value={wizardData.projectId}
            onChange={handleChange}
            required
            disabled={loadingProjects}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            <option value="">Select Project</option>
            {projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.projectName} ({project.projectCode})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phase <span className="text-red-500">*</span>
          </label>
          <select
            name="defaultPhaseId"
            value={wizardData.defaultPhaseId}
            onChange={handleChange}
            required
            disabled={!wizardData.projectId || loadingPhases}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            <option value="">Select Phase</option>
            {phases.map((phase) => (
              <option key={phase._id} value={phase._id}>
                {phase.phaseName} ({phase.phaseCode})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Floor (Optional)
          </label>
          <select
            name="defaultFloorId"
            value={wizardData.defaultFloorId}
            onChange={handleChange}
            disabled={!wizardData.projectId || loadingFloors}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            <option value="">Select Floor</option>
            {floors.map((floor) => (
              <option key={floor._id} value={floor._id}>
                {floor.name} (Floor {floor.floorNumber})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category (Optional)
          </label>
          <select
            name="defaultCategoryId"
            value={wizardData.defaultCategoryId}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Entry Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="defaultDate"
            value={wizardData.defaultDate}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Entry Type
          </label>
          <select
            name="entryType"
            value={wizardData.entryType}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="time_based">Time Based</option>
            <option value="task_based">Task Based</option>
            <option value="professional_service">Professional Service</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Worker Role
          </label>
          <select
            name="defaultWorkerRole"
            value={wizardData.defaultWorkerRole}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="skilled">Skilled</option>
            <option value="unskilled">Unskilled</option>
            <option value="supervisory">Supervisory</option>
            <option value="professional">Professional</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Batch Name (Optional)
          </label>
          <input
            type="text"
            name="batchName"
            value={wizardData.batchName}
            onChange={handleChange}
            placeholder="e.g., Monday Morning Crew"
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Work Item (Optional)
          </label>
          <select
            name="workItemId"
            value={wizardData.workItemId}
            onChange={handleChange}
            disabled={!wizardData.defaultPhaseId || loadingWorkItems}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            <option value="">No Work Item (General Labour)</option>
            {workItems.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name} ({item.category || 'Other'}) - {item.status || 'not_started'}
              </option>
            ))}
          </select>
          {wizardData.workItemId && selectedWorkItem && (
            <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Selected: {selectedWorkItem.name}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-blue-800">
                    <div>
                      <span className="font-medium">Status:</span>{' '}
                      <span className="capitalize">{selectedWorkItem.status?.replace('_', ' ') || 'Not Started'}</span>
                    </div>
                    <div>
                      <span className="font-medium">Estimated Hours:</span>{' '}
                      {selectedWorkItem.estimatedHours || 0}h
                    </div>
                    <div>
                      <span className="font-medium">Actual Hours:</span>{' '}
                      {selectedWorkItem.actualHours || 0}h
                    </div>
                    <div>
                      <span className="font-medium">Estimated Cost:</span>{' '}
                      {(selectedWorkItem.estimatedCost || 0).toLocaleString()} KES
                    </div>
                  </div>
                  {selectedWorkItem.estimatedHours > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-blue-700 mb-1">
                        <span>Progress</span>
                        <span>
                          {Math.min(100, Math.round(((selectedWorkItem.actualHours || 0) / selectedWorkItem.estimatedHours) * 100))}%
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, ((selectedWorkItem.actualHours || 0) / selectedWorkItem.estimatedHours) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-blue-700 mt-2">
                    All entries in this batch will be linked to this work item.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



export default function BulkLabourEntryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BulkLabourEntryPageContent />
    </Suspense>
  );
}

