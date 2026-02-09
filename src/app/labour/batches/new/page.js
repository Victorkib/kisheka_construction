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
import {
  LoadingSpinner,
  LoadingButton,
  LoadingSelect,
} from '@/components/loading';
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
  const [stepValidation, setStepValidation] = useState({
    1: false,
    2: false,
    3: false,
    4: false,
  });
  const [budgetValidation, setBudgetValidation] = useState(null);
  const [preSelectedWorkerId, setPreSelectedWorkerId] = useState(null);
  const [preSelectedWorkerIds, setPreSelectedWorkerIds] = useState([]);

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
    isIndirectLabour: false, // NEW: Whether all entries in this batch are indirect labour
    indirectCostCategory: '', // NEW: Category for indirect costs (empty = must select for indirect)

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
    const workerIdsFromUrl = searchParams.get('workerIds');
    if (workerIdsFromUrl) {
      const parsedIds = workerIdsFromUrl.split(',').map((id) => id.trim()).filter(Boolean);
      setPreSelectedWorkerIds(parsedIds);
    }

    if (workItemIdFromUrl) {
      setWizardData((prev) => ({ ...prev, workItemId: workItemIdFromUrl }));

      // If projectId and phaseId not provided, fetch work item to get them
      if (!projectIdFromUrl || !defaultPhaseIdFromUrl) {
        fetch(`/api/work-items/${workItemIdFromUrl}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.data) {
              const workItem = data.data;
              const assignedWorkers = workItem.assignedWorkers || [];
              const assignedIds = assignedWorkers
                .map((worker) => worker._id?.toString() || worker.userId?.toString())
                .filter(Boolean);

              setWizardData((prev) => ({
                ...prev,
                projectId:
                  projectIdFromUrl ||
                  workItem.projectId?.toString() ||
                  prev.projectId,
                defaultPhaseId:
                  defaultPhaseIdFromUrl ||
                  workItem.phaseId?.toString() ||
                  prev.defaultPhaseId,
                defaultCategoryId: workItem.categoryId?.toString() || prev.defaultCategoryId,
                workItemId: workItemIdFromUrl,
              }));

              if (!workerIdsFromUrl && assignedIds.length > 0) {
                setPreSelectedWorkerIds(assignedIds);
              }
            }
          })
          .catch((err) => {
            console.error('Error fetching work item:', err);
          });
      }
    }

    // Also handle direct projectId and phaseId from URL
    if (projectIdFromUrl) {
      setWizardData((prev) => ({ ...prev, projectId: projectIdFromUrl }));
    }
    if (defaultPhaseIdFromUrl) {
      setWizardData((prev) => ({
        ...prev,
        defaultPhaseId: defaultPhaseIdFromUrl,
      }));
    }
  }, [searchParams]);

  // Check permissions (only once when user is loaded)
  const permissionCheckedRef = useRef(false);
  useEffect(() => {
    // Only check once when user is available
    if (user && !permissionCheckedRef.current) {
      permissionCheckedRef.current = true;
      if (!canAccess('create_labour_batch')) {
        toast.showError(
          'You do not have permission to create bulk labour entries'
        );
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
          wizardData.defaultPhaseId &&
          (wizardData.isIndirectLabour || wizardData.workItemId)
        );
        setStepValidation((prev) => ({ ...prev, 1: step1Valid }));
        return step1Valid;

      case 2:
        // At least one entry required
        const step2Valid =
          wizardData.labourEntries.length > 0 &&
          wizardData.labourEntries.every((entry) => {
            const isIndirect =
              entry.isIndirectLabour || wizardData.isIndirectLabour;
            const hasIndirectCategory = isIndirect
              ? entry.indirectCostCategory || wizardData.indirectCostCategory
              : true;
            const hasWorkItem = isIndirect ? true : (entry.workItemId || wizardData.workItemId);
            return (
              entry.workerName &&
              entry.workerName.trim().length >= 2 &&
              entry.skillType &&
              entry.hourlyRate &&
              parseFloat(entry.hourlyRate) >= 0 &&
              entry.totalHours &&
              parseFloat(entry.totalHours) > 0 &&
              hasIndirectCategory &&
              hasWorkItem
            );
          });
        setStepValidation((prev) => ({ ...prev, 2: step2Valid }));
        return step2Valid;

      case 3:
        // All entries must be valid
        const step3Valid =
          wizardData.labourEntries.length > 0 &&
          wizardData.labourEntries.every((entry) => {
            const isIndirect =
              entry.isIndirectLabour || wizardData.isIndirectLabour;
            const hasIndirectCategory = isIndirect
              ? entry.indirectCostCategory || wizardData.indirectCostCategory
              : true;
            const hasWorkItem = isIndirect ? true : (entry.workItemId || wizardData.workItemId);
            return (
              entry.workerName &&
              entry.skillType &&
              entry.hourlyRate &&
              parseFloat(entry.hourlyRate) >= 0 &&
              entry.totalHours &&
              parseFloat(entry.totalHours) > 0 &&
              hasIndirectCategory &&
              hasWorkItem
            );
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
    const hasInvalidEntries = wizardData.labourEntries.some((entry) => {
      const breakDuration = parseFloat(entry.breakDuration) || 0;
      return breakDuration < 0 || breakDuration > 480;
    });

    if (hasInvalidEntries) {
      toast.showError(
        'Break duration must be between 0 and 480 minutes (8 hours)'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/labour/batches', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          projectId: wizardData.projectId,
          batchName: wizardData.batchName,
          defaultPhaseId: wizardData.defaultPhaseId,
          defaultFloorId: wizardData.defaultFloorId,
          defaultCategoryId: wizardData.defaultCategoryId,
          defaultDate: wizardData.defaultDate,
          defaultWorkerRole: wizardData.defaultWorkerRole,
          isIndirectLabour: wizardData.isIndirectLabour,
          indirectCostCategory: wizardData.indirectCostCategory || 'siteOverhead',
          labourEntries: wizardData.labourEntries.map((entry) => {
            // Remove calculated fields - let schema calculate them
            const {
              regularCost,
              overtimeCost,
              totalCost,
              regularHours,
              ...cleanEntry
            } = entry;
            const entryIsIndirect =
              entry.isIndirectLabour !== undefined
                ? entry.isIndirectLabour
                : wizardData.isIndirectLabour;
            return {
              ...cleanEntry,
              projectId: wizardData.projectId,
              phaseId: entryIsIndirect
                ? null
                : entry.phaseId || wizardData.defaultPhaseId,
              floorId: entry.floorId || wizardData.defaultFloorId,
              categoryId: entry.categoryId || wizardData.defaultCategoryId,
              entryDate: entry.entryDate || wizardData.defaultDate,
              workerRole: entry.workerRole || wizardData.defaultWorkerRole,
              workerType: entry.workerType || 'internal',
              totalHours: parseFloat(entry.totalHours) || 0,
              hourlyRate: parseFloat(entry.hourlyRate) || 0,
              overtimeHours: parseFloat(entry.overtimeHours) || 0,
              breakDuration: parseFloat(entry.breakDuration) || 0,
              // Link to work item if provided at batch level (only for direct labour)
              workItemId: entryIsIndirect
                ? null
                : entry.workItemId || wizardData.workItemId || null,
              isIndirectLabour: entryIsIndirect,
              indirectCostCategory: entryIsIndirect
                ? entry.indirectCostCategory ||
                  wizardData.indirectCostCategory ||
                  'siteOverhead'
                : null,
            };
          }),
          workItemId: !wizardData.isIndirectLabour
            ? wizardData.workItemId || null
            : null, // Batch-level work item ID (only for direct labour)
          autoApprove: true, // Owner auto-approves
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create bulk labour entry');
      }

      // Show success message with worker profile creation info
      const entryCount =
        data.data?.entryCount || wizardData.labourEntries.length;
      const workerProfilesCreated = data.data?.workerProfilesCreated || 0;

      let successMessage = `Bulk labour entry created successfully! ${entryCount} entries created and approved.`;
      if (workerProfilesCreated > 0) {
        successMessage += ` ${workerProfilesCreated} worker profile(s) created.`;
        if (
          data.data?.createdWorkerProfiles &&
          data.data.createdWorkerProfiles.length > 0
        ) {
          const workerNames = data.data.createdWorkerProfiles
            .map((w) => w.workerName)
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
          preSelectedWorkerIds={preSelectedWorkerIds}
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
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            Bulk Labour Entry
          </h1>
          <p className="text-gray-600 mt-1">
            Create multiple labour entries at once
          </p>
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
          canProceed={
            currentStep === 4
              ? stepValidation[currentStep] &&
                (budgetValidation === null ||
                  budgetValidation?.isValid !== false)
              : stepValidation[currentStep] || false
          }
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
      const workItem = workItems.find((wi) => wi._id === wizardData.workItemId);
      setSelectedWorkItem(workItem || null);
    } else {
      setSelectedWorkItem(null);
    }
  }, [wizardData.workItemId, workItems]);

  // Use ref to track previous validation state to prevent unnecessary calls
  const prevValidationRef = useRef(null);

  useEffect(() => {
    const isValid =
      wizardData.projectId &&
      (wizardData.isIndirectLabour
        ? wizardData.indirectCostCategory
        : wizardData.defaultPhaseId);
    // Only call onValidationChange if the validation state actually changed
    if (prevValidationRef.current !== isValid) {
      prevValidationRef.current = isValid;
      onValidationChange(isValid);
    }
  }, [
    wizardData.projectId,
    wizardData.defaultPhaseId,
    wizardData.isIndirectLabour,
    onValidationChange,
  ]);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch('/api/projects/accessible', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
      }
    } catch (err) {
      console.error('Error fetching floors:', err);
    } finally {
      setLoadingFloors(false);
    }
  };

  const fetchCategories = async () => {
    try {
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
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchWorkItems = async (projectId, phaseId) => {
    setLoadingWorkItems(true);
    try {
      const response = await fetch(
        `/api/work-items?projectId=${projectId}&phaseId=${phaseId}`
      );
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
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Project & Settings
        </h2>
        <p className="text-sm text-gray-600">
          Select the project and default settings for all entries in this batch.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project <span className="text-red-500">*</span>
          </label>
          <LoadingSelect
            name="projectId"
            value={wizardData.projectId}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phase{' '}
            {!wizardData.isIndirectLabour && (
              <span className="text-red-500">*</span>
            )}
          </label>
          <LoadingSelect
            name="defaultPhaseId"
            value={wizardData.defaultPhaseId}
            onChange={handleChange}
            required={!wizardData.isIndirectLabour}
            loading={loadingPhases}
            loadingText="Loading phases..."
            disabled={!wizardData.projectId || wizardData.isIndirectLabour}
            className={`w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              wizardData.isIndirectLabour ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <option value="">
              {wizardData.isIndirectLabour
                ? 'Not applicable (Indirect Labour)'
                : 'Select Phase'}
            </option>
            {phases.map((phase) => (
              <option key={phase._id} value={phase._id}>
                {phase.phaseName} ({phase.phaseCode})
              </option>
            ))}
          </LoadingSelect>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Floor (Optional)
          </label>
          <LoadingSelect
            name="defaultFloorId"
            value={wizardData.defaultFloorId}
            onChange={handleChange}
            loading={loadingFloors}
            loadingText="Loading floors..."
            disabled={!wizardData.projectId}
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
            Work Category (Optional)
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
            Work Item {!wizardData.isIndirectLabour && <span className="text-red-600">*</span>}
          </label>
          <LoadingSelect
            name="workItemId"
            value={wizardData.workItemId}
            onChange={handleChange}
            loading={loadingWorkItems}
            loadingText="Loading work items..."
            disabled={!wizardData.defaultPhaseId}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">
              {wizardData.isIndirectLabour ? 'No Work Item (Indirect Labour)' : 'Select Work Item'}
            </option>
            {workItems.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name} ({item.category || 'Other'}) -{' '}
                {item.status || 'not_started'}
              </option>
            ))}
          </LoadingSelect>
          {!wizardData.isIndirectLabour && (
            <p className="mt-1 text-xs text-gray-500">
              Direct labour batches must be linked to a work item.
            </p>
          )}
          {wizardData.workItemId && selectedWorkItem && (
            <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-blue-600 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Selected: {selectedWorkItem.name}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-blue-800">
                    <div>
                      <span className="font-medium">Status:</span>{' '}
                      <span className="capitalize">
                        {selectedWorkItem.status?.replace('_', ' ') ||
                          'Not Started'}
                      </span>
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
                      {(selectedWorkItem.estimatedCost || 0).toLocaleString()}{' '}
                      KES
                    </div>
                  </div>
                  {selectedWorkItem.estimatedHours > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-blue-700 mb-1">
                        <span>Progress</span>
                        <span>
                          {Math.min(
                            100,
                            Math.round(
                              ((selectedWorkItem.actualHours || 0) /
                                selectedWorkItem.estimatedHours) *
                                100
                            )
                          )}
                          %
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              ((selectedWorkItem.actualHours || 0) /
                                selectedWorkItem.estimatedHours) *
                                100
                            )}%`,
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

      {/* Indirect Labour Option - NEW */}
      <div
        className={`border-t pt-6 -mx-6 px-6 py-4 ${
          wizardData.isIndirectLabour
            ? 'bg-amber-50 border-b border-amber-200'
            : 'bg-transparent'
        }`}
      >
        <div className="flex items-start gap-3 mb-4">
          <input
            type="checkbox"
            id="isIndirectLabour"
            name="isIndirectLabour"
            checked={wizardData.isIndirectLabour}
            onChange={(e) => {
              const isIndirect = e.target.checked;
              onUpdate({
                isIndirectLabour: isIndirect,
                defaultPhaseId: isIndirect ? '' : wizardData.defaultPhaseId, // Clear phase if indirect
                indirectCostCategory: isIndirect
                  ? wizardData.indirectCostCategory || 'siteOverhead'
                  : '',
              });
            }}
            className="mt-1 w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
          />
          <div className="flex-1">
            <label
              htmlFor="isIndirectLabour"
              className={`block font-medium mb-2 ${
                wizardData.isIndirectLabour
                  ? 'text-amber-900 text-base'
                  : 'text-gray-700 text-sm'
              }`}
            >
              All Entries in This Batch are Indirect Labour
            </label>
            <p
              className={`${
                wizardData.isIndirectLabour
                  ? 'text-amber-800 text-sm font-medium mb-2'
                  : 'text-xs text-gray-600 mb-2'
              }`}
            >
              {wizardData.isIndirectLabour
                ? '📍 Budget Route: Project-level indirect costs budget (Site overhead, security, management, etc.)'
                : 'Mark this batch as indirect labour if entries are for site management, security, office staff, etc. Entries will be charged to project-level indirect costs budget.'}
            </p>
            <div
              className={`text-xs space-y-1 ${
                wizardData.isIndirectLabour ? 'text-amber-700' : 'text-gray-600'
              }`}
            >
              <p>
                • Phase requirement:{' '}
                {wizardData.isIndirectLabour
                  ? '❌ Not required'
                  : '✅ Required'}
              </p>
              <p>
                • Budget validation:{' '}
                {wizardData.isIndirectLabour
                  ? 'Indirect Costs Budget'
                  : 'Phase Labour Budget'}
              </p>
              <p>
                • Work item linking:{' '}
                {wizardData.isIndirectLabour
                  ? '❌ Not supported'
                  : '✅ Supported'}
              </p>
            </div>
          </div>
        </div>

        {/* Indirect Cost Category Selection - only show when indirect labour is checked */}
        {wizardData.isIndirectLabour && (
          <div className="mt-4 pl-8 border-l-2 border-amber-300">
            <label className="block text-sm font-medium text-amber-900 mb-2">
              Indirect Cost Category <span className="text-red-500">*</span>
            </label>
            <select
              name="indirectCostCategory"
              value={wizardData.indirectCostCategory}
              onChange={(e) =>
                onUpdate({ indirectCostCategory: e.target.value })
              }
              className="w-full md:w-1/2 px-3 py-2 bg-white text-gray-900 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">-- Select Category --</option>
              <option value="siteOverhead">
                Site Overhead (office, management, security)
              </option>
              <option value="utilities">
                Utilities (water, electricity, fuel)
              </option>
              <option value="transportation">
                Transportation (vehicles, logistics)
              </option>
              <option value="safetyCompliance">
                Safety & Compliance (safety equipment, training)
              </option>
            </select>
            <p className="text-xs text-amber-700 mt-2">
              This categorizes the indirect costs for budget tracking and
              reporting.
            </p>
          </div>
        )}
      </div>

      {/* Phase Requirement Notice for Direct Labour */}
      {!wizardData.isIndirectLabour &&
        wizardData.projectId &&
        !wizardData.defaultPhaseId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 -mx-6 px-6 py-4">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Phase Selection Required
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Direct labour entries must be assigned to a phase for budget
                  tracking. Select a phase above to continue.
                </p>
              </div>
            </div>
          </div>
        )}
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
