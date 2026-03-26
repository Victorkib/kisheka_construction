/**
 * Enhanced Labour Entry Form
 * Context-aware form that adapts based on entry mode
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLabourEntryAutoPopulate } from '@/hooks/useLabourEntryAutoPopulate';
import { validateLabourEntry } from '@/lib/labour-entry-validation';
import {
  LABOUR_ENTRY_MODES,
  getEntryModeConfig,
} from '@/lib/constants/labour-entry-modes';
import { LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';

// Import form section components
import { BasicInfoSection } from './form-sections/BasicInfoSection';
import { WorkDetailsSection } from './form-sections/WorkDetailsSection';
import { EquipmentSection } from './form-sections/EquipmentSection';
import { TimeAndRatesSection } from './form-sections/TimeAndRatesSection';
import { ProfessionalServicesSection } from './form-sections/ProfessionalServicesSection';
import { AdditionalInfoSection } from './form-sections/AdditionalInfoSection';

export function EnhancedLabourEntryForm() {
  const router = useRouter();
  const toast = useToast();

  // ALL HOOKS AT TOP - NO CONDITIONAL HOOKS!
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [floors, setFloors] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [workItems, setWorkItems] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [loadingWorkItems, setLoadingWorkItems] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);

  // Refs for preventing infinite loops
  const fetchedProjectsRef = useRef(false);
  const fetchedWorkersRef = useRef(false);
  const fetchedPhasesForProjectRef = useRef(null);
  const fetchedFloorsForProjectRef = useRef(null);
  const fetchedWorkItemsForPhaseRef = useRef(null);

  const [formData, setFormData] = useState({
    projectId: '',
    phaseId: '',
    floorId: '',
    workerId: '',
    workerName: '',
    workerType: 'internal',
    workerRole: 'skilled',
    skillType: 'general_worker',
    workItemId: '',
    isIndirectLabour: false,
    indirectCostCategory: '',
    equipmentId: '',
    subcontractorId: '',
    entryDate: new Date().toISOString().split('T')[0],
    clockInTime: '',
    clockOutTime: '',
    breakDuration: 0,
    totalHours: 8,
    overtimeHours: 0,
    hourlyRate: '',
    dailyRate: '',
    overtimeRate: '',
    serviceType: '',
    visitPurpose: '',
    deliverables: [],
    taskDescription: '',
    quantityCompleted: '',
    unitOfMeasure: '',
    unitRate: '',
    qualityRating: '',
    productivityRating: '',
    notes: '',
  });

  // Auto-populate from URL
  const {
    entryMode,
    autoPopulatedFields,
    contextData,
    loading: autoPopulateLoading,
    config,
  } = useLabourEntryAutoPopulate({
    onPopulate: useCallback((fields, context, mode) => {
      setFormData((prev) => ({
        ...prev,
        ...fields,
      }));
    }, []),
    onModeChange: useCallback((mode, context) => {
      // Mode changed - can be used for analytics
    }, []),
  });

  // Fetch projects (once)
  useEffect(() => {
    if (!fetchedProjectsRef.current) {
      fetchedProjectsRef.current = true;
      const fetchProjects = async () => {
        try {
          const response = await fetch('/api/projects/accessible', {
            cache: 'no-store',
          });
          const data = await response.json();
          if (data.success) {
            setProjects(Array.isArray(data.data) ? data.data : []);
          }
        } catch (err) {
          console.error('Error fetching projects:', err);
        } finally {
          setLoadingProjects(false);
        }
      };
      fetchProjects();
    }
  }, []);

  // Fetch workers (once)
  useEffect(() => {
    if (!fetchedWorkersRef.current) {
      fetchedWorkersRef.current = true;
      const fetchWorkers = async () => {
        setLoadingWorkers(true);
        try {
          const response = await fetch(
            '/api/users/by-role/worker?status=active&limit=200',
            {
              cache: 'no-store',
            },
          );
          const data = await response.json();
          console.log('Fetched workers data:', data); // Debug log
          if (data.success) {
            setWorkers(
              (data.data.workers || []).map((w) => ({
                _id: w._id,
                workerName: w.workerName,
                employmentType: w.employmentType,
                workerType: w.workerType,
                defaultHourlyRate: w.defaultHourlyRate,
              })),
            );
          }
        } catch (err) {
          console.error('Error fetching workers:', err);
        } finally {
          setLoadingWorkers(false);
        }
      };
      fetchWorkers();
    }
  }, []);

  // Fetch phases when project changes
  useEffect(() => {
    const projectKey = formData.projectId || 'none';
    if (projectKey !== fetchedPhasesForProjectRef.current) {
      fetchedPhasesForProjectRef.current = projectKey;
      if (formData.projectId) {
        setLoadingPhases(true);
        fetch(`/api/phases?projectId=${formData.projectId}`, {
          cache: 'no-store',
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setPhases(Array.isArray(data.data) ? data.data : []);
            }
          })
          .catch((err) => console.error('Error fetching phases:', err))
          .finally(() => setLoadingPhases(false));
      } else {
        setPhases([]);
      }
    }
  }, [formData.projectId]);

  // Fetch floors when project changes
  useEffect(() => {
    const projectKey = formData.projectId || 'none';
    if (projectKey !== fetchedFloorsForProjectRef.current) {
      fetchedFloorsForProjectRef.current = projectKey;
      if (formData.projectId) {
        setLoadingFloors(true);
        fetch(`/api/floors?projectId=${formData.projectId}`, {
          cache: 'no-store',
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setFloors(Array.isArray(data.data) ? data.data : []);
            }
          })
          .catch((err) => console.error('Error fetching floors:', err))
          .finally(() => setLoadingFloors(false));
      } else {
        setFloors([]);
        setLoadingFloors(false);
      }
    }
  }, [formData.projectId]);

  // Fetch work items when phase changes
  useEffect(() => {
    const phaseKey =
      formData.projectId && formData.phaseId
        ? `${formData.projectId}-${formData.phaseId}`
        : 'none';

    if (phaseKey !== fetchedWorkItemsForPhaseRef.current) {
      fetchedWorkItemsForPhaseRef.current = phaseKey;
      if (formData.projectId && formData.phaseId) {
        setLoadingWorkItems(true);
        fetch(
          `/api/work-items?projectId=${formData.projectId}&phaseId=${formData.phaseId}`,
          {
            cache: 'no-store',
          },
        )
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setWorkItems(Array.isArray(data.data) ? data.data : []);
            }
          })
          .catch((err) => console.error('Error fetching work items:', err))
          .finally(() => setLoadingWorkItems(false));
      } else {
        setWorkItems([]);
      }
    }
  }, [formData.projectId, formData.phaseId]);

  // Apply auto-populated fields
  useEffect(() => {
    if (autoPopulatedFields && Object.keys(autoPopulatedFields).length > 0) {
      setFormData((prev) => ({
        ...prev,
        ...autoPopulatedFields,
      }));
    }
  }, [autoPopulatedFields]);

  // Handle field changes
  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
      // Clear validation errors when user types
      if (validationErrors.length > 0) {
        setValidationErrors([]);
      }
    },
    [validationErrors.length],
  );

  // Handle section changes
  const handleSectionChange = useCallback((section, data) => {
    setFormData((prev) => ({
      ...prev,
      ...data,
    }));
  }, []);

  // Validate form
  const validateForm = useCallback(() => {
    const validation = validateLabourEntry(formData, entryMode);
    setValidationErrors(validation.errors || []);
    setValidationWarnings(validation.warnings || []);
    return validation.isValid;
  }, [formData, entryMode]);

  // Submit form
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (!validateForm()) {
        toast.showError('Please fix the validation errors');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setLoading(true);

      try {
        const response = await fetch('/api/labour/entries', {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            entryMode,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to create labour entry');
        }

        toast.showSuccess('Labour entry created successfully!');

        // Redirect based on context
        if (contextData.equipment) {
          router.push(`/equipment/${contextData.equipment._id}`);
        } else if (contextData.workItem) {
          router.push(`/work-items/${contextData.workItem._id}`);
        } else if (contextData.worker) {
          router.push(`/labour/workers/${contextData.worker._id}`);
        } else {
          router.push('/labour/entries');
        }
      } catch (err) {
        toast.showError(err.message || 'Failed to create labour entry');
      } finally {
        setLoading(false);
      }
    },
    [formData, entryMode, validateForm, toast, contextData, router],
  );

  // Show loading while auto-populating
  if (autoPopulateLoading) {
    return (
      <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-8 text-center">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
        </div>
        <p className="ds-text-secondary mt-4">Loading form data...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Entry Mode Banner */}
      <div
        className={`ds-bg-surface rounded-xl shadow-lg border-2 ds-border-accent-subtle p-4 ${
          entryMode === 'equipment_operator'
            ? 'bg-blue-50'
            : entryMode === 'indirect'
              ? 'bg-purple-50'
              : entryMode === 'professional'
                ? 'bg-green-50'
                : 'bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{config.icon}</span>
          <div>
            <h3 className="text-lg font-bold ds-text-primary">
              {config.label}
            </h3>
            <p className="text-sm ds-text-secondary">{config.description}</p>
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="ds-bg-surface rounded-xl shadow-lg border-2 border-red-400/60 p-4">
          <h3 className="text-lg font-bold text-red-800 mb-2">
            ⛔ Validation Errors
          </h3>
          <ul className="space-y-1">
            {validationErrors.map((error, idx) => (
              <li key={idx} className="text-red-700 text-sm">
                • {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Validation Warnings */}
      {validationWarnings.length > 0 && (
        <div className="ds-bg-surface rounded-xl shadow-lg border-2 border-yellow-400/60 p-4">
          <h3 className="text-lg font-bold text-yellow-800 mb-2">
            ⚠️ Warnings
          </h3>
          <ul className="space-y-1">
            {validationWarnings.map((warning, idx) => (
              <li key={idx} className="text-yellow-700 text-sm">
                • {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Form Sections */}
      <BasicInfoSection
        formData={formData}
        onChange={handleChange}
        onSectionChange={handleSectionChange}
        entryMode={entryMode}
        contextData={contextData}
        projects={projects}
        phases={phases}
        floors={floors}
        workers={workers}
        loadingProjects={loadingProjects}
        loadingPhases={loadingPhases}
        loadingFloors={loadingFloors}
        loadingWorkers={loadingWorkers}
      />

      <WorkDetailsSection
        formData={formData}
        onChange={handleChange}
        onSectionChange={handleSectionChange}
        entryMode={entryMode}
        config={config}
        workItems={workItems}
        loadingWorkItems={loadingWorkItems}
      />

      {entryMode === LABOUR_ENTRY_MODES.EQUIPMENT_OPERATOR && (
        <EquipmentSection
          formData={formData}
          onChange={handleChange}
          equipment={contextData.equipment}
        />
      )}

      <TimeAndRatesSection
        formData={formData}
        onChange={handleChange}
        entryMode={entryMode}
      />

      {entryMode === LABOUR_ENTRY_MODES.PROFESSIONAL && (
        <ProfessionalServicesSection
          formData={formData}
          onChange={handleChange}
        />
      )}

      <AdditionalInfoSection formData={formData} onChange={handleChange} />

      {/* Submit Button */}
      <div className="flex justify-end gap-4 pt-6 border-t ds-border-subtle">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 ds-bg-surface-muted ds-text-primary font-bold rounded-lg hover:ds-bg-surface transition-colors"
        >
          Cancel
        </button>
        <LoadingButton
          type="submit"
          loading={loading}
          className="px-6 py-3 ds-bg-accent-primary text-white font-bold rounded-lg hover:ds-bg-accent-hover disabled:opacity-50"
        >
          Create Labour Entry
        </LoadingButton>
      </div>
    </form>
  );
}

export default EnhancedLabourEntryForm;
