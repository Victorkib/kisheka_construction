/**
 * New Work Item Page
 * Form to create a new work item
 *
 * Route: /work-items/new
 */

'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';
import { usePermissions } from '@/hooks/use-permissions';
import {
  WORK_ITEM_STATUSES,
  WORK_ITEM_CATEGORIES,
  WORK_ITEM_PRIORITIES,
} from '@/lib/constants/work-item-constants';
import { FINISHING_EXECUTION_MODELS } from '@/lib/constants/finishing-work-constants';
import { MultiWorkerSelector } from '@/components/work-items/multi-worker-selector';

// Ensure useCallback is properly available by defining it explicitly
const useCallbackWrapper = useCallback;

function NewWorkItemPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { canAccess } = usePermissions();
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [floors, setFloors] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);
  const [existingWorkItems, setExistingWorkItems] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loadingSubcontractors, setLoadingSubcontractors] = useState(false);
  const [loadingWorkItems, setLoadingWorkItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const projectIdFromUrl = searchParams.get('projectId');
  const phaseIdFromUrl = searchParams.get('phaseId');
  const workerIdFromUrl = searchParams.get('workerId'); // Support workerId from URL

  const [formData, setFormData] = useState({
    scope: 'phase', // Default to phase for backward compatibility
    projectId: projectIdFromUrl || '',
    phaseId: phaseIdFromUrl || '',
    floorId: '',
    phaseIds: [],
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
    notes: '',
    executionModel: '',
    subcontractorId: '',
  });

  // Wrap fetch functions in useCallback to fix "Cannot access before initialization" error.
  // This allows them to be safely referenced in useEffect dependency arrays.
  const fetchProjects = useCallback(async () => {
    try {
      setLoadingProjects(true);
      // Use /api/projects/accessible to respect project-based organization and user memberships
      const response = await fetch('/api/projects/accessible', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        // API returns projects array directly in data.data
        const projectsList = Array.isArray(data.data) ? data.data : [];
        setProjects(projectsList);
        // Auto-select first project if only one exists and no projectId from query params
        if (projectsList.length === 1 && !projectIdFromUrl) {
          setFormData((prev) => ({ ...prev, projectId: projectsList[0]._id }));
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
  }, [toast, projectIdFromUrl]);

  const fetchCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const response = await fetch('/api/categories?type=work_items', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
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
  }, []);

  const fetchPhases = useCallback(
    async (projectId) => {
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
          // API returns phases array directly in data.data
          const phasesList = Array.isArray(data.data) ? data.data : [];
          setPhases(phasesList);
          // Auto-select first phase if only one exists and no phaseId from query params
          if (phasesList.length === 1 && !phaseIdFromUrl) {
            setFormData((prev) => ({ ...prev, phaseId: phasesList[0]._id }));
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
    },
    [phaseIdFromUrl],
  );

  const fetchFloorsAndSubcontractors = useCallback(async (phaseId) => {
    try {
      setLoadingFloors(true);
      setLoadingSubcontractors(true);

      const phaseResponse = await fetch(`/api/phases/${phaseId}`, {
        cache: 'no-store',
      });
      const phaseData = await phaseResponse.json();

      // Extract projectId from phase data
      const projectId = phaseData?.data?.projectId;
      if (!projectId) {
        setFloors([]);
        setSubcontractors([]);
        return;
      }

      const floorsResponse = await fetch(`/api/floors?projectId=${projectId}`, {
        cache: 'no-store',
      });
      const floorsData = await floorsResponse.json();
      const allProjectFloors =
        floorsData.success && Array.isArray(floorsData.data)
          ? floorsData.data
          : [];

      if (phaseData.success) {
        const curPhase = phaseData.data;
        const applicableFloors = filterFloorsForPhase(
          curPhase,
          allProjectFloors,
        );
        setFloors(applicableFloors);

        // Keep subcontractor options only for finishing (existing business flow)
        if (curPhase.phaseType === 'finishing') {
          const subsResponse = await fetch(
            `/api/subcontractors?projectId=${projectId}&phaseId=${phaseId}&status=active`,
            {
              cache: 'no-store',
            },
          );
          const subsData = await subsResponse.json();
          if (subsData.success) {
            setSubcontractors(
              Array.isArray(subsData.data) ? subsData.data : [],
            );
          } else {
            setSubcontractors([]);
          }
        } else {
          setSubcontractors([]);
        }
      } else {
        setFloors([]);
        setSubcontractors([]);
      }
    } catch (err) {
      console.error('Error fetching floors/subcontractors:', err);
      setFloors([]);
      setSubcontractors([]);
    } finally {
      setLoadingFloors(false);
      setLoadingSubcontractors(false);
    }
  }, []);

  const fetchExistingWorkItems = useCallback(async (phaseId) => {
    try {
      setLoadingWorkItems(true);
      const response = await fetch(
        `/api/work-items?phaseId=${phaseId}&limit=100`,
        {
          cache: 'no-store',
        },
      );
      const data = await response.json();
      if (data.success) {
        // Filter out work items that are completed or deleted
        const availableWorkItems = (data.data.workItems || []).filter(
          (wi) => wi.status !== 'completed' && !wi.deletedAt,
        );
        setExistingWorkItems(availableWorkItems);
      } else {
        setExistingWorkItems([]);
      }
    } catch (err) {
      console.error('Error fetching work items:', err);
      setExistingWorkItems([]);
    } finally {
      setLoadingWorkItems(false);
    }
  }, []);

  // Now that fetch functions are defined, setup effects safely
  useEffect(() => {
    fetchProjects();
    fetchCategories();
  }, [fetchProjects, fetchCategories]);

  useEffect(() => {
    if (formData.projectId) {
      fetchPhases(formData.projectId);
    } else {
      setPhases([]);
    }
  }, [formData.projectId, fetchPhases]);

  // Fetch floors when phase or scope changes (especially for floor scope items)
  useEffect(() => {
    if (formData.phaseId) {
      fetchFloorsAndSubcontractors(formData.phaseId);
      fetchExistingWorkItems(formData.phaseId);
    } else {
      setFloors([]);
      setSubcontractors([]);
      setExistingWorkItems([]);
    }
  }, [
    formData.phaseId,
    formData.scope,
    fetchFloorsAndSubcontractors,
    fetchExistingWorkItems,
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Local scope validation
    if (!formData.projectId) {
      setError('A project must be selected');
      setSaving(false);
      return;
    }

    if (formData.scope === 'phase' && !formData.phaseId) {
      setError('A phase must be selected for phase-level work items');
      setSaving(false);
      return;
    }

    if (formData.scope === 'floor') {
      if (!formData.phaseId) {
        setError('A phase must be selected for floor-level work items');
        setSaving(false);
        return;
      }
      if (!formData.floorId) {
        setError('A floor must be selected for floor-level work items');
        setSaving(false);
        return;
      }
    }

    // For finishing phases, floorId is required regardless of scope
    if (isFinishingPhase && !formData.floorId) {
      setError('For finishing phases, a floor must be selected');
      setSaving(false);
      return;
    }

    if (
      formData.scope === 'multi_phase' &&
      (!formData.phaseIds || formData.phaseIds.length === 0)
    ) {
      setError(
        'At least one phase must be selected for multi-phase work items',
      );
      setSaving(false);
      return;
    }

    try {
      const createResponse = await fetch('/api/work-items', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        body: JSON.stringify({
          ...formData,
          assignedTo: Array.isArray(formData.assignedTo)
            ? formData.assignedTo
            : formData.assignedTo
              ? [formData.assignedTo]
              : [],
          estimatedHours: formData.estimatedHours
            ? parseFloat(formData.estimatedHours)
            : 0,
          actualHours: formData.actualHours
            ? parseFloat(formData.actualHours)
            : 0,
          estimatedCost: formData.estimatedCost
            ? parseFloat(formData.estimatedCost)
            : 0,
          actualCost: formData.actualCost ? parseFloat(formData.actualCost) : 0,
          floorId: formData.floorId || null,
          executionModel: formData.executionModel || null,
          subcontractorId: formData.subcontractorId || null,
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
    setFormData((prev) => {
      if (name === 'projectId') {
        return {
          ...prev,
          projectId: value,
          phaseId: '',
          phaseIds: [],
          floorId: '',
          executionModel: '',
          subcontractorId: '',
        };
      }

      if (name === 'phaseId') {
        return {
          ...prev,
          phaseId: value,
          floorId: '',
          executionModel: '',
          subcontractorId: '',
        };
      }

      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const categoryOptions =
    categories.length > 0
      ? categories.map((category) => ({
          value: category._id?.toString(),
          label: category.name,
        }))
      : WORK_ITEM_CATEGORIES.map((category) => ({
          value: category,
          label: category,
        }));

  const usesLegacyCategories = categories.length === 0;

  const selectedPhase = phases.find((phase) => phase._id === formData.phaseId);
  const isFinishingPhase = selectedPhase?.phaseType === 'finishing';
  const isBasementPhase =
    selectedPhase?.applicableFloors === 'basement' ||
    /basement/i.test(selectedPhase?.phaseName || '');
  const isSuperstructurePhase =
    selectedPhase?.phaseCode === 'PHASE-02' ||
    /superstructure/i.test(selectedPhase?.phaseName || '') ||
    (selectedPhase?.phaseType === 'construction' && !isBasementPhase);
  const showFloorSection =
    formData.scope === 'floor' ||  // Always show for floor scope
    isFinishingPhase ||
    isBasementPhase ||
    isSuperstructurePhase;
  const phaseIsRequired =
    formData.scope === 'phase' || formData.scope === 'floor';
  const multiPhaseSelected = formData.scope === 'multi_phase';

  const filterFloorsForPhase = (phase, floorsList) => {
    if (!phase || !Array.isArray(floorsList)) return [];

    if (
      !phase.applicableFloors ||
      phase.applicableFloors === 'all' ||
      phase.phaseType === 'finishing'
    ) {
      if (phase.phaseType === 'finishing') return floorsList;

      // For construction/superstructure phases: exclude basements by default
      if (isBasementPhase) {
        return floorsList.filter((floor) => {
          const floorNumber = Number(floor.floorNumber);
          return !Number.isNaN(floorNumber)
            ? floorNumber <= 0
            : /basement/i.test(floor.name || '');
        });
      }
      return floorsList.filter((floor) => {
        const floorNumber = Number(floor.floorNumber);
        if (!Number.isNaN(floorNumber)) {
          // Superstructure should show above-ground floors, basement should be excluded
          return floorNumber > 0;
        }
        return !/basement/i.test(floor.name || '');
      });
    }

    if (phase.applicableFloors === 'basement') {
      return floorsList.filter((floor) => {
        const floorNumber = Number(floor.floorNumber);
        return !Number.isNaN(floorNumber)
          ? floorNumber <= 0
          : /basement/i.test(floor.name || '');
      });
    }

    if (Array.isArray(phase.applicableFloors)) {
      return floorsList.filter((floor) =>
        phase.applicableFloors.includes(floor.floorNumber),
      );
    }

    return floorsList;
  };

  const visibleFloors = filterFloorsForPhase(selectedPhase, floors);

  const handleScopeChange = (newScope) => {
    setFormData((prev) => {
      const resetBase = {
        ...prev,
        scope: newScope,
        phaseIds: [],
      };
      switch (newScope) {
        case 'project':
          return {
            ...resetBase,
            phaseId: '',
            floorId: '',
            executionModel: '',
            subcontractorId: '',
          };
        case 'phase':
          return {
            ...resetBase,
            floorId: '',
            executionModel: '',
            subcontractorId: '',
          };
        case 'floor':
          return {
            ...resetBase,
            executionModel: '',
            subcontractorId: '',
          };
        case 'multi_phase':
          return {
            ...resetBase,
            phaseId: '',
            floorId: '',
            executionModel: '',
            subcontractorId: '',
          };
        default:
          return resetBase;
      }
    });
  };

  const togglePhaseSelection = (phaseId) => {
    setFormData((prev) => {
      const phaseIdsSet = new Set(prev.phaseIds || []);
      if (phaseIdsSet.has(phaseId)) {
        phaseIdsSet.delete(phaseId);
      } else {
        phaseIdsSet.add(phaseId);
      }
      return {
        ...prev,
        phaseIds: Array.from(phaseIdsSet),
      };
    });
  };

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

    const selected = categories.find(
      (category) => category._id?.toString() === value,
    );
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
        <div className="mb-6 sm:mb-8">
          <Link
            href="/work-items"
            className="ds-text-accent-primary hover:ds-text-accent-hover active:ds-text-accent-hover mb-4 inline-block font-medium text-sm sm:text-base transition-colors touch-manipulation"
          >
            ← Back to Work Items
          </Link>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary">
            New Work Item
          </h1>
          <p className="text-sm sm:text-base ds-text-secondary mt-1">
            Create a new work item for a phase
          </p>
        </div>

        {/* Information Card */}
        <div className="ds-bg-accent-subtle rounded-xl border-2 ds-border-accent-subtle p-4 sm:p-6 mb-6 shadow-lg transition-all duration-300">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 ds-bg-accent-primary rounded-lg flex items-center justify-center shadow-md">
                <svg
                  className="w-6 h-6 sm:w-7 sm:h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-base sm:text-lg font-bold ds-text-primary">
                  Creating a Work Item
                </h3>
                <button
                  onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                  className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 ds-bg-surface/80 hover:ds-bg-surface active:ds-bg-surface border ds-border-accent-subtle rounded-lg flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:ring-offset-2 touch-manipulation"
                  aria-label={
                    isInfoExpanded
                      ? 'Collapse information'
                      : 'Expand information'
                  }
                  aria-expanded={isInfoExpanded}
                >
                  <svg
                    className={`w-5 h-5 sm:w-6 sm:h-6 ds-text-accent-primary transition-transform duration-300 ${isInfoExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>

              {isInfoExpanded ? (
                <div className="space-y-3 animate-fadeIn">
                  <p className="text-xs sm:text-sm ds-text-secondary leading-relaxed">
                    Work items break down construction phases into specific,
                    trackable tasks. Each work item represents a concrete
                    activity like "Pour Foundation Concrete" or "Install
                    Electrical Wiring" that needs to be completed, with
                    estimated time, costs, and dependencies.
                  </p>
                  <div className="ds-bg-surface/70 rounded-lg p-3 border ds-border-accent-subtle">
                    <p className="text-xs ds-text-secondary">
                      <strong className="ds-text-primary">Tip:</strong> Be
                      specific with work item names and include all relevant
                      details. Set realistic time and cost estimates, and define
                      dependencies if this task must wait for others to
                      complete.
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
            {/* Work Item Scope Selection */}
            <div className="ds-bg-surface-muted rounded-xl p-4 sm:p-6 border-2 ds-border-accent-subtle">
              <h2 className="text-base sm:text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-purple-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Work Item Scope
              </h2>
              <p className="text-xs sm:text-sm ds-text-secondary mb-4">
                Select the scope level for this work item. This determines where
                and how the work item is tracked.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Project Scope */}
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.scope === 'project'
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-ds-border-subtle ds-bg-surface hover:border-ds-border-strong'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    value="project"
                    checked={formData.scope === 'project'}
                    onChange={() => handleScopeChange('project')}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <div>
                    <p className="text-sm font-semibold ds-text-primary">
                      Project
                    </p>
                    <p className="text-xs ds-text-secondary">Site-wide work</p>
                  </div>
                </label>

                {/* Phase Scope */}
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.scope === 'phase'
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-ds-border-subtle ds-bg-surface hover:border-ds-border-strong'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    value="phase"
                    checked={formData.scope === 'phase'}
                    onChange={() => handleScopeChange('phase')}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <div>
                    <p className="text-sm font-semibold ds-text-primary">
                      Phase
                    </p>
                    <p className="text-xs ds-text-secondary">
                      Phase-specific work
                    </p>
                  </div>
                </label>

                {/* Floor Scope */}
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.scope === 'floor'
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-ds-border-subtle ds-bg-surface hover:border-ds-border-strong'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    value="floor"
                    checked={formData.scope === 'floor'}
                    onChange={() => handleScopeChange('floor')}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <div>
                    <p className="text-sm font-semibold ds-text-primary">
                      Floor
                    </p>
                    <p className="text-xs ds-text-secondary">
                      Floor-specific work
                    </p>
                  </div>
                </label>

                {/* Multi-Phase Scope */}
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.scope === 'multi_phase'
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-ds-border-subtle ds-bg-surface hover:border-ds-border-strong'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    value="multi_phase"
                    checked={formData.scope === 'multi_phase'}
                    onChange={() => handleScopeChange('multi_phase')}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <div>
                    <p className="text-sm font-semibold ds-text-primary">
                      Multi-Phase
                    </p>
                    <p className="text-xs ds-text-secondary">
                      Spans multiple phases
                    </p>
                  </div>
                </label>
              </div>

              {/* Scope Info */}
              <div className="mt-4 p-3 bg-purple-50 border border-purple-400/60 rounded-lg">
                <p className="text-xs sm:text-sm font-medium text-purple-800">
                  {formData.scope === 'project' &&
                    '✓ Project-level work items apply to the entire project (e.g., Site Security, Site Clearing)'}
                  {formData.scope === 'phase' &&
                    '✓ Phase-level work items belong to a specific phase (e.g., Foundation Excavation)'}
                  {formData.scope === 'floor' &&
                    '✓ Floor-level work items are for specific floors (e.g., Ground Floor Tiling) - Common for finishing works'}
                  {formData.scope === 'multi_phase' &&
                    '✓ Multi-phase work items span multiple phases (e.g., Concrete Testing across Substructure + Superstructure)'}
                </p>
              </div>
            </div>

            {/* Project & Phase Selection Section */}
            <div className="ds-bg-accent-subtle rounded-xl p-4 sm:p-6 border ds-border-accent-subtle">
              <h2 className="text-base sm:text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 ds-text-accent-primary flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
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
                    <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted text-sm sm:text-base">
                      Loading projects...
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="w-full px-4 py-2.5 bg-amber-500/10 border-2 border-amber-400/60 rounded-lg text-amber-200 text-sm sm:text-base">
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
                      <option value="" className="ds-text-muted">
                        Select Project
                      </option>
                      {projects.map((project) => (
                        <option
                          key={project._id}
                          value={project._id}
                          className="ds-text-primary"
                        >
                          {project.projectName ||
                            project.projectCode ||
                            'Unnamed Project'}
                        </option>
                      ))}
                    </select>
                  )}
                  {projects.length > 0 && !formData.projectId && (
                    <p className="text-xs ds-text-muted mt-1.5">
                      Please select a project to continue
                    </p>
                  )}
                </div>

                {/* Phase Selection */}
                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Phase{' '}
                    {phaseIsRequired ? (
                      <span className="text-red-500">*</span>
                    ) : (
                      <span className="text-xs ds-text-muted">
                        (Optional for project scope)
                      </span>
                    )}
                  </label>

                  {formData.scope === 'project' ? (
                    <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted text-sm sm:text-base">
                      Project scope does not require a phase. Work item will
                      apply to the whole project.
                    </div>
                  ) : formData.scope === 'multi_phase' ? (
                    loadingPhases ? (
                      <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted text-sm sm:text-base">
                        Loading phases...
                      </div>
                    ) : !formData.projectId ? (
                      <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted text-sm sm:text-base">
                        Select Project First
                      </div>
                    ) : phases.length === 0 ? (
                      <div className="w-full px-4 py-2.5 bg-amber-500/10 border-2 border-amber-400/60 rounded-lg text-amber-200 text-sm sm:text-base">
                        No phases available for this project
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto p-2 border-2 ds-border-subtle rounded-lg">
                        {phases.map((phase) => (
                          <label
                            key={phase._id}
                            className="flex items-center gap-2 text-sm ds-text-primary"
                          >
                            <input
                              type="checkbox"
                              checked={formData.phaseIds.includes(phase._id)}
                              onChange={() => togglePhaseSelection(phase._id)}
                              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                            />
                            {phase.phaseName || phase.name}{' '}
                            {phase.phaseCode ? `(${phase.phaseCode})` : ''}
                          </label>
                        ))}
                      </div>
                    )
                  ) : loadingPhases ? (
                    <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted text-sm sm:text-base">
                      Loading phases...
                    </div>
                  ) : !formData.projectId ? (
                    <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted text-sm sm:text-base">
                      Select Project First
                    </div>
                  ) : phases.length === 0 ? (
                    <div className="w-full px-4 py-2.5 bg-amber-500/10 border-2 border-amber-400/60 rounded-lg text-amber-200 text-sm sm:text-base">
                      No phases available for this project
                    </div>
                  ) : (
                    <select
                      name="phaseId"
                      value={formData.phaseId}
                      onChange={handleChange}
                      required={phaseIsRequired}
                      disabled={loadingPhases || !formData.projectId}
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium touch-manipulation"
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
                          {phase.phaseName || phase.name}{' '}
                          {phase.phaseCode ? `(${phase.phaseCode})` : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {formData.scope !== 'project' &&
                    formData.projectId &&
                    phases.length > 0 &&
                    !formData.phaseId &&
                    !multiPhaseSelected && (
                      <p className="text-xs ds-text-muted mt-1.5">
                        Please select a phase
                      </p>
                    )}

                  {multiPhaseSelected &&
                    formData.projectId &&
                    phases.length > 0 &&
                    formData.phaseIds.length === 0 && (
                      <p className="text-xs ds-text-muted mt-1.5">
                        Please select at least one phase for multi-phase scope.
                      </p>
                    )}
                </div>
              </div>
            </div>

            {/* Floor Selection - phase-aware; placed next to project/phase since this is location grouping */}
            {showFloorSection && (
              <div className="ds-bg-accent-subtle rounded-xl p-4 sm:p-6 border ds-border-accent-subtle mt-6">
                <h2 className="text-base sm:text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-sky-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  Floor Selection
                </h2>

                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Floor{' '}
                    {formData.scope === 'floor' ? (
                      <span className="text-red-500">*</span>
                    ) : (
                      <span className="text-xs ds-text-muted">
                        (optional for other phases)
                      </span>
                    )}
                  </label>

                  {formData.scope === 'floor' && !formData.phaseId ? (
                    <div className="w-full px-4 py-2.5 bg-blue-500/10 border-2 border-blue-400/60 rounded-lg text-blue-200 text-sm sm:text-base">
                      For floor-level work items, please select a phase first, then select a floor.
                    </div>
                  ) : loadingFloors ? (
                    <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted text-sm sm:text-base">
                      Loading floors...
                    </div>
                  ) : visibleFloors.length === 0 ? (
                    <div className="w-full px-4 py-2.5 bg-amber-500/10 border-2 border-amber-400/60 rounded-lg text-amber-200 text-sm sm:text-base">
                      No floors available for this phase
                    </div>
                  ) : (
                    <select
                      name="floorId"
                      value={formData.floorId}
                      onChange={handleChange}
                      required={formData.scope === 'floor' || isFinishingPhase}
                      disabled={loadingFloors}
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium touch-manipulation"
                    >
                      <option value="" className="ds-text-muted">
                        Select Floor
                      </option>
                      {visibleFloors.map((floor) => (
                        <option
                          key={floor._id}
                          value={floor._id}
                          className="ds-text-primary"
                        >
                          {floor.name || `Floor ${floor.floorNumber}`}
                        </option>
                      ))}
                    </select>
                  )}

                  {visibleFloors.length > 0 &&
                    !formData.floorId &&
                    (formData.scope === 'floor' || isFinishingPhase) && (
                      <p className="text-xs ds-text-muted mt-1.5">
                        Please select a floor for this work item
                      </p>
                    )}
                </div>

                <p className="text-xs ds-text-muted mt-3">
                  Phase floor rules:
                  {isBasementPhase && ' basement only, '}
                  {isSuperstructurePhase &&
                    ' superstructure (above ground) only, '}
                  {isFinishingPhase && ' all floors available'}
                </p>
              </div>
            )}

            {/* Work Item Details Section */}
            <div className="ds-bg-surface-muted rounded-xl p-4 sm:p-6 border ds-border-subtle">
              <h2 className="text-base sm:text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 ds-text-secondary flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Work Item Details
              </h2>

              {/* Work Item Name */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Work Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  minLength={2}
                  placeholder="e.g., Pour Foundation Concrete"
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted transition-all duration-200 font-medium touch-manipulation"
                />
              </div>

              {/* Description */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Description{' '}
                  <span className="ds-text-muted text-xs font-normal">
                    (Optional)
                  </span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Describe the work item, requirements, and any important details..."
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted transition-all duration-200 font-medium resize-y touch-manipulation"
                />
              </div>

              {/* Category, Priority, and Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  {loadingCategories ? (
                    <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted text-sm sm:text-base">
                      Loading categories...
                    </div>
                  ) : (
                    <select
                      name={usesLegacyCategories ? 'category' : 'categoryId'}
                      value={
                        usesLegacyCategories
                          ? formData.category
                          : formData.categoryId
                      }
                      onChange={handleCategoryChange}
                      required
                      className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium touch-manipulation"
                    >
                      <option value="" className="ds-text-muted">
                        Select Category
                      </option>
                      {categoryOptions.map((category) => (
                        <option
                          key={category.value}
                          value={category.value}
                          className="ds-text-primary"
                        >
                          {category.label.replace(/\b\w/g, (letter) =>
                            letter.toUpperCase(),
                          )}
                        </option>
                      ))}
                    </select>
                  )}
                  {usesLegacyCategories && !loadingCategories && (
                    <p className="text-xs ds-text-muted mt-1.5">
                      Using default categories. Create categories under
                      Categories for a custom list.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Priority
                  </label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium touch-manipulation"
                  >
                    {WORK_ITEM_PRIORITIES.map((priority) => (
                      <option
                        key={priority}
                        value={priority}
                        className="ds-text-primary"
                      >
                        {priority} -{' '}
                        {priority === 1
                          ? 'Critical'
                          : priority === 2
                            ? 'High'
                            : priority === 3
                              ? 'Medium'
                              : priority === 4
                                ? 'Low'
                                : 'Very Low'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium touch-manipulation"
                  >
                    {WORK_ITEM_STATUSES.map((status) => (
                      <option
                        key={status}
                        value={status}
                        className="ds-text-primary"
                      >
                        {status
                          .replace('_', ' ')
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Worker Assignment */}
              <div className="mt-4 sm:mt-6">
                <MultiWorkerSelector
                  value={formData.assignedTo || []}
                  onChange={(workerIds) =>
                    setFormData((prev) => ({ ...prev, assignedTo: workerIds }))
                  }
                  projectId={formData.projectId}
                  phaseId={formData.phaseId}
                  category={formData.category}
                />
              </div>
            </div>

            {/* Time & Cost Estimates Section */}
            <div className="ds-bg-accent-subtle rounded-xl p-4 sm:p-6 border ds-border-accent-subtle">
              <h2 className="text-base sm:text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-emerald-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Time & Cost Estimates
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Estimated Hours{' '}
                    <span className="ds-text-muted text-xs font-normal">
                      (Optional)
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute right-4 top-1/2 transform -translate-y-1/2 ds-text-secondary font-medium text-sm sm:text-base">
                      hrs
                    </span>
                    <input
                      type="number"
                      name="estimatedHours"
                      value={formData.estimatedHours}
                      onChange={handleChange}
                      min="0"
                      step="0.1"
                      placeholder="0"
                      className="w-full px-4 pr-16 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted transition-all duration-200 font-medium touch-manipulation"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Estimated Cost (KES){' '}
                    <span className="ds-text-muted text-xs font-normal">
                      (Optional)
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 ds-text-secondary font-medium text-sm sm:text-base">
                      KES
                    </span>
                    <input
                      type="number"
                      name="estimatedCost"
                      value={formData.estimatedCost}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full pl-12 pr-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted transition-all duration-200 font-medium touch-manipulation"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Finishing Works Details (execution model + subcontractor only) */}
            {isFinishingPhase && (
              <div className="ds-bg-accent-subtle rounded-xl p-4 sm:p-6 border-2 border-ds-accent-subtle">
                <h2 className="text-base sm:text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-purple-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  Finishing Works Details
                </h2>
                <div className="space-y-4 sm:space-y-6">
                  {/* Execution Model */}
                  {isFinishingPhase && (
                    <div>
                      <label className="block text-sm font-semibold ds-text-primary mb-2">
                        Execution Model <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="executionModel"
                        value={formData.executionModel}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium touch-manipulation"
                      >
                        <option value="" className="ds-text-muted">
                          Select Execution Model
                        </option>
                        {FINISHING_EXECUTION_MODELS.map((model) => (
                          <option
                            key={model}
                            value={model}
                            className="ds-text-primary"
                          >
                            {model
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </option>
                        ))}
                      </select>
                      {!formData.executionModel && (
                        <p className="text-xs ds-text-muted mt-1.5">
                          Select how this work will be executed
                        </p>
                      )}
                    </div>
                  )}

                  {/* Subcontractor Selection (for contract-based) */}
                  {formData.executionModel === 'contract_based' && (
                    <div>
                      <label className="block text-sm font-semibold ds-text-primary mb-2">
                        Subcontractor <span className="text-red-500">*</span>
                      </label>
                      {loadingSubcontractors ? (
                        <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted text-sm sm:text-base">
                          Loading subcontractors...
                        </div>
                      ) : subcontractors.length === 0 ? (
                        <div className="w-full px-4 py-2.5 bg-amber-500/10 border-2 border-amber-400/60 rounded-lg text-amber-200 text-sm sm:text-base">
                          No subcontractors available for this floor
                        </div>
                      ) : (
                        <select
                          name="subcontractorId"
                          value={formData.subcontractorId}
                          onChange={handleChange}
                          required
                          disabled={loadingSubcontractors}
                          className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium [&>option]:ds-bg-surface [&>option]:ds-text-primary [&>option]:font-medium touch-manipulation"
                        >
                          <option value="" className="ds-text-muted">
                            Select Subcontractor
                          </option>
                          {subcontractors.map((sub) => (
                            <option
                              key={sub._id}
                              value={sub._id}
                              className="ds-text-primary"
                            >
                              {sub.companyName || sub.contactName}
                            </option>
                          ))}
                        </select>
                      )}
                      {subcontractors.length > 0 &&
                        !formData.subcontractorId && (
                          <p className="text-xs ds-text-muted mt-1.5">
                            Please select a subcontractor for this
                            contract-based work
                          </p>
                        )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Schedule Section */}
            <div className="ds-bg-surface-muted rounded-xl p-4 sm:p-6 border ds-border-subtle">
              <h2 className="text-base sm:text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 ds-text-secondary flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Schedule
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-semibold ds-text-primary mb-2">
                    Start Date{' '}
                    <span className="ds-text-muted text-xs font-normal">
                      (Optional)
                    </span>
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
                    Planned End Date{' '}
                    <span className="ds-text-muted text-xs font-normal">
                      (Optional)
                    </span>
                  </label>
                  <input
                    type="date"
                    name="plannedEndDate"
                    value={formData.plannedEndDate}
                    onChange={handleChange}
                    min={formData.startDate}
                    className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus transition-all duration-200 font-medium touch-manipulation"
                  />
                </div>
              </div>
            </div>

            {/* Dependencies Section */}
            <div className="ds-bg-accent-subtle rounded-xl p-4 sm:p-6 border-2 ds-border-accent-subtle">
              <h2 className="text-base sm:text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-orange-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                Dependencies
              </h2>
              <p className="text-xs sm:text-sm ds-text-secondary mb-4">
                Select work items that must be completed before this one can
                start.
              </p>

              {loadingWorkItems ? (
                <div className="w-full px-4 py-2.5 ds-bg-surface-muted border-2 ds-border-subtle rounded-lg ds-text-muted text-sm sm:text-base">
                  Loading work items...
                </div>
              ) : existingWorkItems.length === 0 ? (
                <div className="w-full px-4 py-2.5 bg-amber-500/10 border-2 border-amber-400/60 rounded-lg text-amber-200 text-sm sm:text-base">
                  No existing work items in this phase to depend on
                </div>
              ) : (
                <div className="space-y-2">
                  {existingWorkItems.map((wi) => (
                    <label
                      key={wi._id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.dependencies.includes(wi._id)
                          ? 'border-orange-400 bg-orange-50'
                          : 'border-ds-border-subtle ds-bg-surface hover:border-ds-border-strong'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.dependencies.includes(wi._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData((prev) => ({
                              ...prev,
                              dependencies: [...prev.dependencies, wi._id],
                            }));
                          } else {
                            setFormData((prev) => ({
                              ...prev,
                              dependencies: prev.dependencies.filter(
                                (id) => id !== wi._id,
                              ),
                            }));
                          }
                        }}
                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold ds-text-primary">
                          {wi.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              wi.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : wi.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {wi.status?.replace('_', ' ')}
                          </span>
                          {wi.category && (
                            <span className="ds-text-muted">{wi.category}</span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {formData.dependencies.length > 0 && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-400/60 rounded-lg">
                  <p className="text-xs sm:text-sm font-medium text-orange-800">
                    ✓ This work item will depend on{' '}
                    <span className="font-bold">
                      {formData.dependencies.length}
                    </span>{' '}
                    work item(s).
                  </p>
                </div>
              )}
            </div>

            {/* Additional Information Section */}
            <div className="ds-bg-surface-muted rounded-xl p-4 sm:p-6 border ds-border-subtle">
              <h2 className="text-base sm:text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 ds-text-secondary flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Additional Information
              </h2>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold ds-text-primary mb-2">
                  Notes{' '}
                  <span className="ds-text-muted text-xs font-normal">
                    (Optional)
                  </span>
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Additional notes about this work item, special requirements, or important details..."
                  className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted transition-all duration-200 font-medium resize-y touch-manipulation"
                />
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-4 sm:pt-6 border-t ds-border-subtle">
              <Link
                href="/work-items"
                className="w-full sm:w-auto px-6 py-2.5 border-2 ds-border-subtle rounded-lg ds-text-primary font-semibold hover:ds-bg-surface-muted active:ds-bg-surface hover:ds-border-strong transition-all duration-200 text-center touch-manipulation"
              >
                Cancel
              </Link>
              <LoadingButton
                type="submit"
                loading={saving}
                className="w-full sm:w-auto px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 active:from-blue-800 active:to-blue-900 focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:ring-offset-2 shadow-lg hover:shadow-xl transition-all duration-200 touch-manipulation"
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
