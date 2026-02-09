/**
 * Create Budget Reallocation Page
 * Form for creating new budget reallocation requests
 * 
 * Route: /budget-reallocations/new
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingOverlay, LoadingButton, LoadingSpinner } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';

function NewBudgetReallocationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [phases, setPhases] = useState([]);
  const [loadingPhases, setLoadingPhases] = useState(false);

  const [formData, setFormData] = useState({
    projectId: searchParams.get('projectId') || '',
    reallocationType: 'phase_to_phase',
    fromPhaseId: '',
    toPhaseId: '',
    amount: '',
    reason: '',
  });

  useEffect(() => {
    fetchProjects();
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
      const response = await fetch('/api/projects', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setProjects(data.data?.projects || data.data || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
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
      setPhases([]);
    } finally {
      setLoadingPhases(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Clear phase selections when type changes
      if (name === 'reallocationType') {
        updated.fromPhaseId = '';
        updated.toPhaseId = '';
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!formData.projectId) {
      setError('Project is required');
      setLoading(false);
      return;
    }

    // Pre-validation: Check if project has phases
    try {
      const response = await fetch(`/api/phases?projectId=${formData.projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const phasesData = await phasesResponse.json();
      if (phasesData.success) {
        const projectPhases = phasesData.data || [];
        if (projectPhases.length === 0) {
          setError('This project has no phases configured. Please initialize phases first before creating a budget reallocation.');
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Error checking phases:', err);
      // Continue with submission - API will handle validation
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Amount must be greater than 0');
      setLoading(false);
      return;
    }

    if (!formData.reason || formData.reason.trim().length === 0) {
      setError('Reason is required');
      setLoading(false);
      return;
    }

    if (formData.reallocationType === 'phase_to_phase') {
      if (!formData.fromPhaseId || !formData.toPhaseId) {
        setError('Both source and target phases are required for phase-to-phase reallocation');
        setLoading(false);
        return;
      }
      if (formData.fromPhaseId === formData.toPhaseId) {
        setError('Source and target phases cannot be the same');
        setLoading(false);
        return;
      }
    } else if (formData.reallocationType === 'project_to_phase') {
      if (!formData.toPhaseId) {
        setError('Target phase is required for project-to-phase reallocation');
        setLoading(false);
        return;
      }
    } else if (formData.reallocationType === 'phase_to_project') {
      if (!formData.fromPhaseId) {
        setError('Source phase is required for phase-to-project reallocation');
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/budget-reallocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          fromPhaseId: formData.fromPhaseId || null,
          toPhaseId: formData.toPhaseId || null,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create budget reallocation request');
      }

      toast.showSuccess('Budget reallocation request created successfully');
      router.push(`/budget-reallocations/${data.data._id}`);
    } catch (err) {
      setError(err.message);
      console.error('Create reallocation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <LoadingOverlay isLoading={loading} message="Creating reallocation request..." fullScreen={false} />
        
        {/* Header */}
        <div className="mb-8">
          <Link href="/budget-reallocations" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Budget Reallocations
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">Create Budget Reallocation Request</h1>
          <p className="text-gray-600 mt-2">Request a budget transfer between phases or project budget</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Project Selection */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
              Project <span className="text-red-500">*</span>
            </label>
            <select
              name="projectId"
              value={formData.projectId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.projectName || project.projectCode}
                </option>
              ))}
            </select>
          </div>

          {/* Reallocation Type */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
              Reallocation Type <span className="text-red-500">*</span>
            </label>
            <select
              name="reallocationType"
              value={formData.reallocationType}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="phase_to_phase">Phase to Phase</option>
              <option value="project_to_phase">Project Budget to Phase</option>
              <option value="phase_to_project">Phase to Project Budget</option>
            </select>
            <p className="text-sm text-gray-600 mt-1">
              {formData.reallocationType === 'phase_to_phase' && 'Transfer budget from one phase to another'}
              {formData.reallocationType === 'project_to_phase' && 'Allocate unallocated project budget to a phase'}
              {formData.reallocationType === 'phase_to_project' && 'Return phase budget to project unallocated pool'}
            </p>
          </div>

          {/* Source Phase (if applicable) */}
          {(formData.reallocationType === 'phase_to_phase' || formData.reallocationType === 'phase_to_project') && (
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Source Phase <span className="text-red-500">*</span>
              </label>
              {!formData.projectId ? (
                <div className="px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-700 text-sm">
                  Please select a project first
                </div>
              ) : loadingPhases ? (
                <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600 text-sm">
                  Loading phases...
                </div>
              ) : phases.length === 0 ? (
                <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600 text-sm">
                  No phases available for this project
                </div>
              ) : (
                <select
                  name="fromPhaseId"
                  value={formData.fromPhaseId}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select source phase</option>
                  {phases.map((phase) => (
                    <option key={phase._id} value={phase._id}>
                      {phase.phaseName || phase.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Target Phase (if applicable) */}
          {(formData.reallocationType === 'phase_to_phase' || formData.reallocationType === 'project_to_phase') && (
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Target Phase <span className="text-red-500">*</span>
              </label>
              {!formData.projectId ? (
                <div className="px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-700 text-sm">
                  Please select a project first
                </div>
              ) : loadingPhases ? (
                <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600 text-sm">
                  Loading phases...
                </div>
              ) : phases.length === 0 ? (
                <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600 text-sm">
                  No phases available for this project
                </div>
              ) : (
                <select
                  name="toPhaseId"
                  value={formData.toPhaseId}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select target phase</option>
                  {phases
                    .filter(phase => phase._id !== formData.fromPhaseId)
                    .map((phase) => (
                      <option key={phase._id} value={phase._id}>
                        {phase.phaseName || phase.name}
                      </option>
                    ))}
                </select>
              )}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
              Amount (KES) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              step="0.01"
              required
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              rows={4}
              placeholder="Explain why this budget reallocation is needed..."
              required
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <LoadingButton
              type="submit"
              loading={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition"
            >
              Create Request
            </LoadingButton>
            <Link
              href="/budget-reallocations"
              className="px-6 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg transition"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewBudgetReallocationPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    }>
      <NewBudgetReallocationPageContent />
    </Suspense>
  );
}

