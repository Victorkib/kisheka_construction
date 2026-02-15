/**
 * Floor Budget Management Page
 * Allows managing budget allocation for a specific floor by phase
 * 
 * Route: /floors/[id]/budget
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';

function FloorBudgetPageContent() {
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const floorId = params?.id;
  
  const [floor, setFloor] = useState(null);
  const [project, setProject] = useState(null);
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  
  const [phaseAllocations, setPhaseAllocations] = useState({});
  const [floorFinancials, setFloorFinancials] = useState(null);
  const [projectFinances, setProjectFinances] = useState(null);

  useEffect(() => {
    if (floorId) {
      fetchUser();
      fetchData();
    }
  }, [floorId]);

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

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch floor
      const floorResponse = await fetch(`/api/floors/${floorId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const floorData = await floorResponse.json();

      if (!floorData.success) {
        throw new Error(floorData.error || 'Failed to fetch floor');
      }

      const floorInfo = floorData.data;
      setFloor(floorInfo);

      // Fetch project
      if (floorInfo.projectId) {
        const projectResponse = await fetch(`/api/projects/${floorInfo.projectId}`, {
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

      // Fetch phases
      if (floorInfo.projectId) {
        const phasesResponse = await fetch(`/api/phases?projectId=${floorInfo.projectId}&includeFinancials=true`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const phasesData = await phasesResponse.json();
        if (phasesData.success) {
          setPhases(phasesData.data || []);
        }
      }

      // Fetch floor budget details
      const floorBudgetResponse = await fetch(`/api/floors/${floorId}/budget`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const floorBudgetData = await floorBudgetResponse.json();
      if (floorBudgetData.success) {
        setFloorFinancials(floorBudgetData.data);
      }

      // Fetch project finances (for capital context)
      if (floorInfo.projectId) {
        const projectFinancesResponse = await fetch(`/api/project-finances?projectId=${floorInfo.projectId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const projectFinancesData = await projectFinancesResponse.json();
        if (projectFinancesData.success) {
          setProjectFinances(projectFinancesData.data);
        }
      }

      // Initialize phase allocations from floor's budgetAllocation.byPhase
      const budgetAllocation = floorInfo.budgetAllocation || { total: floorInfo.totalBudget || 0, byPhase: {} };
      const byPhase = budgetAllocation.byPhase || {};
      
      // Initialize allocations for all phases
      const initialAllocations = {};
      const phaseCodes = ['PHASE-01', 'PHASE-02', 'PHASE-03', 'PHASE-04'];
      phaseCodes.forEach(phaseCode => {
        initialAllocations[phaseCode] = byPhase[phaseCode] || {
          total: 0,
          materials: 0,
          labour: 0,
          equipment: 0,
          subcontractors: 0,
          contingency: 0
        };
      });
      
      setPhaseAllocations(initialAllocations);

    } catch (err) {
      setError(err.message);
      console.error('Fetch data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePhaseAllocationChange = (phaseCode, field, value) => {
    setPhaseAllocations(prev => ({
      ...prev,
      [phaseCode]: {
        ...prev[phaseCode],
        [field]: parseFloat(value) || 0
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Calculate totals
      const total = Object.values(phaseAllocations).reduce((sum, phase) => sum + (phase.total || 0), 0);
      const materials = Object.values(phaseAllocations).reduce((sum, phase) => sum + (phase.materials || 0), 0);
      const labour = Object.values(phaseAllocations).reduce((sum, phase) => sum + (phase.labour || 0), 0);
      const equipment = Object.values(phaseAllocations).reduce((sum, phase) => sum + (phase.equipment || 0), 0);
      const subcontractors = Object.values(phaseAllocations).reduce((sum, phase) => sum + (phase.subcontractors || 0), 0);
      const contingency = Object.values(phaseAllocations).reduce((sum, phase) => sum + (phase.contingency || 0), 0);

      // Validate against existing spending
      const actualSpending = floorFinancials?.actualSpending?.total || 0;
      const committedCosts = floorFinancials?.committedCosts?.total || 0;
      const minimumRequired = actualSpending + committedCosts;

      if (total < minimumRequired) {
        setError(`Total budget (${total.toLocaleString()}) cannot be less than existing spending and committed costs (${minimumRequired.toLocaleString()})`);
        setSaving(false);
        return;
      }

      // Build budget allocation with byPhase structure
      const budgetAllocation = {
        total,
        byPhase: phaseAllocations,
        materials,
        labour,
        equipment,
        subcontractors,
        contingency
      };

      const response = await fetch(`/api/floors/${floorId}/budget`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify(budgetAllocation),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update floor budget');
      }

      toast.showSuccess('Floor budget updated successfully!');
      router.push(`/floors/${floorId}`);
    } catch (err) {
      setError(err.message);
      toast.showError(err.message || 'Failed to update floor budget');
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  if (error && !floor) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
          <Link href="/floors" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Floors
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (!canEdit) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to manage floor budgets. Only PM, OWNER, and ACCOUNTANT can manage floor budgets.</p>
          </div>
          <Link href={`/floors/${floorId}`} className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Floor
          </Link>
        </div>
      </AppLayout>
    );
  }

  const totalBudget = Object.values(phaseAllocations).reduce((sum, phase) => sum + (phase.total || 0), 0);
  const actualSpending = floorFinancials?.actualSpending?.total || 0;
  const committedCosts = floorFinancials?.committedCosts?.total || 0;
  const remaining = totalBudget - actualSpending - committedCosts;
  const minimumRequired = actualSpending + committedCosts;
  
  // Capital allocation data
  const capitalAllocation = floor?.capitalAllocation || { total: 0, used: 0, committed: 0, remaining: 0 };
  const capitalTotal = capitalAllocation.total || 0;
  const capitalUsed = capitalAllocation.used || 0;
  const capitalCommitted = capitalAllocation.committed || 0;
  const capitalRemaining = capitalAllocation.remaining || 0;
  const capitalVsBudget = capitalTotal > 0 && totalBudget > 0 ? (capitalTotal / totalBudget) * 100 : 0;
  const projectAvailableCapital = projectFinances?.capitalBalance || 0;

  const phaseNames = {
    'PHASE-01': 'Basement/Substructure',
    'PHASE-02': 'Superstructure',
    'PHASE-03': 'Finishing Works',
    'PHASE-04': 'Final Systems'
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/floors/${floorId}`} className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Floor
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Manage Floor Budget</h1>
          <p className="text-gray-600 mt-1">
            {floor?.name} (Floor {floor?.floorNumber})
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
              <p className="text-sm text-gray-600">Total Budget</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {formatCurrency(totalBudget)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Actual Spending</p>
              <p className="text-xl font-bold text-blue-600 mt-1">
                {formatCurrency(actualSpending)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Committed Costs</p>
              <p className="text-xl font-bold text-yellow-600 mt-1">
                {formatCurrency(committedCosts)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Remaining</p>
              <p className={`text-xl font-bold mt-1 ${
                remaining < 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>
          {totalBudget < minimumRequired && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              <strong>Warning:</strong> Total budget ({formatCurrency(totalBudget)}) is less than minimum required ({formatCurrency(minimumRequired)}). 
              Please increase allocations to meet existing spending and committed costs.
            </div>
          )}
        </div>

        {/* Capital Allocation Summary */}
        {capitalTotal > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Capital Allocation</h2>
              <div className="text-sm text-gray-600">
                {capitalVsBudget.toFixed(1)}% of budget
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Total Capital</p>
                <p className="text-xl font-bold text-purple-700 mt-1">
                  {formatCurrency(capitalTotal)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Used</p>
                <p className="text-xl font-bold text-blue-600 mt-1">
                  {formatCurrency(capitalUsed)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Committed</p>
                <p className="text-xl font-bold text-yellow-600 mt-1">
                  {formatCurrency(capitalCommitted)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Remaining</p>
                <p className={`text-xl font-bold mt-1 ${
                  capitalRemaining < 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {formatCurrency(capitalRemaining)}
                </p>
              </div>
            </div>
            {/* Capital vs Budget Comparison */}
            <div className="mt-4 pt-4 border-t border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Capital Coverage</span>
                <span className="text-sm text-gray-600">
                  {formatCurrency(capitalTotal)} / {formatCurrency(totalBudget)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    capitalVsBudget >= 100
                      ? 'bg-green-500'
                      : capitalVsBudget >= 80
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(capitalVsBudget, 100)}%` }}
                />
              </div>
              {capitalVsBudget < 100 && (
                <p className="text-xs text-gray-600 mt-2">
                  Capital covers {capitalVsBudget.toFixed(1)}% of budget. 
                  {capitalVsBudget < 80 && ' Consider allocating more capital to this floor.'}
                </p>
              )}
            </div>
            {projectFinances && (
              <div className="mt-4 pt-4 border-t border-purple-200">
                <p className="text-xs text-gray-600">
                  Project Available Capital: <span className="font-semibold">{formatCurrency(projectAvailableCapital)}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Phase Budget Allocation Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget Allocation by Phase</h2>
          
          <div className="space-y-6">
            {['PHASE-01', 'PHASE-02', 'PHASE-03', 'PHASE-04'].map(phaseCode => {
              const phase = phases.find(p => p.phaseCode === phaseCode);
              const allocation = phaseAllocations[phaseCode] || {
                total: 0,
                materials: 0,
                labour: 0,
                equipment: 0,
                subcontractors: 0,
                contingency: 0
              };
              const phaseBudget = phase?.budgetAllocation?.total || 0;
              const isApplicable = phaseCode === 'PHASE-01' 
                ? floor?.floorNumber < 0 
                : phaseCode === 'PHASE-02' 
                ? floor?.floorNumber >= 0 
                : true; // PHASE-03 and PHASE-04 apply to all floors

              return (
                <div key={phaseCode} className={`border rounded-lg p-4 ${isApplicable ? 'border-gray-200' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-md font-semibold text-gray-900">
                        {phaseNames[phaseCode]} ({phaseCode})
                      </h3>
                      {phase && (
                        <p className="text-sm text-gray-600">
                          Phase Budget: {formatCurrency(phaseBudget)}
                        </p>
                      )}
                      {!isApplicable && (
                        <p className="text-xs text-gray-500 mt-1">
                          This phase does not apply to this floor type
                        </p>
                      )}
                    </div>
                  </div>

                  {isApplicable && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Total Budget
                        </label>
                        <input
                          type="number"
                          value={allocation.total}
                          onChange={(e) => handlePhaseAllocationChange(phaseCode, 'total', e.target.value)}
                          min="0"
                          step="0.01"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Materials
                        </label>
                        <input
                          type="number"
                          value={allocation.materials}
                          onChange={(e) => handlePhaseAllocationChange(phaseCode, 'materials', e.target.value)}
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
                          value={allocation.labour}
                          onChange={(e) => handlePhaseAllocationChange(phaseCode, 'labour', e.target.value)}
                          min="0"
                          step="0.01"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Link
              href={`/floors/${floorId}`}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
            >
              Cancel
            </Link>
            <LoadingButton
              type="submit"
              loading={saving}
              disabled={totalBudget < minimumRequired}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
            >
              Save Budget Allocations
            </LoadingButton>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function FloorBudgetPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner />
        </div>
      </AppLayout>
    }>
      <FloorBudgetPageContent />
    </Suspense>
  );
}
