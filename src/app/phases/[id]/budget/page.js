/**
 * Phase Budget Management Page
 * Allows managing budget allocation for a specific phase
 * 
 * Route: /phases/[id]/budget
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';

function PhaseBudgetPageContent() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const phaseId = params?.id;
  
  const [phase, setPhase] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  
  const [formData, setFormData] = useState({
    total: 0,
    materials: 0,
    labour: 0,
    equipment: 0,
    subcontractors: 0
    // contingency removed - tracked at project level, not phase level
  });

  useEffect(() => {
    if (phaseId) {
      fetchUser();
      fetchPhase();
    }
  }, [phaseId]);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        const role = data.data.role?.toLowerCase();
        setCanEdit(['owner', 'pm', 'project_manager', 'accountant'].includes(role));
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

  const fetchPhase = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/phases/${phaseId}?includeFinancials=true`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch phase');
      }

      const phaseData = data.data;
      setPhase(phaseData);

      // Populate form with current budget allocation
      setFormData({
        total: phaseData.budgetAllocation?.total || 0,
        materials: phaseData.budgetAllocation?.materials || 0,
        labour: phaseData.budgetAllocation?.labour || 0,
        equipment: phaseData.budgetAllocation?.equipment || 0,
        subcontractors: phaseData.budgetAllocation?.subcontractors || 0,
        contingency: 0  // Contingency NOT allocated to phases - stays at project level
      });

      // Fetch project for context
      if (phaseData.projectId) {
        const response = await fetch(`/api/projects/${phaseData.projectId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const projectData = await projectResponse.json();
        if (projectData.success) {
          setProject(projectData.data);
        }
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch phase error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Validation
    if (formData.total < 0) {
      setError('Total budget cannot be negative');
      setSaving(false);
      return;
    }

    if (formData.total < (phase?.actualSpending?.total || 0)) {
      setError(`Total budget cannot be less than actual spending (${(phase?.actualSpending?.total || 0).toLocaleString()} KES)`);
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/phases/${phaseId}/budget`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update phase budget');
      }

      toast.showSuccess('Phase budget updated successfully');
      router.push(`/phases/${phaseId}`);
    } catch (err) {
      setError(err.message);
      console.error('Update budget error:', err);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  if (error && !phase) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
          <Link href="/phases" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Phases
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (!canEdit) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to manage phase budgets. Only PM, OWNER, and ACCOUNTANT can manage phase budgets.</p>
          </div>
          <Link href={`/phases/${phaseId}`} className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Phase
          </Link>
        </div>
      </AppLayout>
    );
  }

  const financialSummary = phase?.financialSummary || {
    budgetTotal: phase?.budgetAllocation?.total || 0,
    actualTotal: phase?.actualSpending?.total || 0,
    remaining: phase?.financialStates?.remaining || 0
  };

  const availableProjectBudget = project ? (project.budget?.total || 0) - (project.metadata?.totalPhaseBudgets || 0) + (phase?.budgetAllocation?.total || 0) : 0;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/phases/${phaseId}`} className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Phase
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Manage Phase Budget</h1>
          <p className="text-gray-600 mt-1">
            {phase?.phaseName} ({phase?.phaseCode})
          </p>
          {project && (
            <Link 
              href={`/projects/${project._id}`}
              className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
            >
              Project: {project.projectName}
            </Link>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Current Budget Summary */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Budget Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Budget Allocated</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {formatCurrency(financialSummary.budgetTotal)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Actual Spending</p>
              <p className="text-xl font-bold text-blue-600 mt-1">
                {formatCurrency(financialSummary.actualTotal)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Remaining</p>
              <p className={`text-xl font-bold mt-1 ${
                financialSummary.remaining < 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatCurrency(financialSummary.remaining)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Available (Project)</p>
              <p className="text-xl font-bold text-gray-700 mt-1">
                {formatCurrency(availableProjectBudget)}
              </p>
            </div>
          </div>
        </div>

        {/* Budget Allocation Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget Allocation</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Budget <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="total"
                value={formData.total}
                onChange={handleChange}
                min={phase?.actualSpending?.total || 0}
                step="0.01"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum: {formatCurrency(phase?.actualSpending?.total || 0)} (actual spending)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Materials
              </label>
              <input
                type="number"
                name="materials"
                value={formData.materials}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Labour
              </label>
              <input
                type="number"
                name="labour"
                value={formData.labour}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Equipment
              </label>
              <input
                type="number"
                name="equipment"
                value={formData.equipment}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subcontractors
              </label>
              <input
                type="number"
                name="subcontractors"
                value={formData.subcontractors}
                onChange={handleChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Contingency removed - tracked at project level, not phase level */}
          </div>

          {/* Budget Breakdown Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Breakdown Total</p>
            <p className={`text-lg font-bold ${
              (formData.materials + formData.labour + formData.equipment + formData.subcontractors) === formData.total
                ? 'text-green-600'
                : 'text-yellow-600'
            }`}>
              {formatCurrency(
                formData.materials + formData.labour + formData.equipment + 
                formData.subcontractors
              )}
            </p>
            {(formData.materials + formData.labour + formData.equipment + formData.subcontractors) !== formData.total && (
              <p className="text-xs text-yellow-600 mt-1">
                Breakdown total doesn't match total budget. This is allowed but may cause confusion.
              </p>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Link
              href={`/phases/${phaseId}`}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <LoadingButton
              type="submit"
              loading={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Update Budget
            </LoadingButton>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function PhaseBudgetPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    }>
      <PhaseBudgetPageContent />
    </Suspense>
  );
}



