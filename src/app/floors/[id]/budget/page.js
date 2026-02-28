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
  const [capitalAllocations, setCapitalAllocations] = useState({});
  const [capitalStrategy, setCapitalStrategy] = useState('proportional'); // 'proportional' | 'even' | 'manual'
  const [showCapitalForm, setShowCapitalForm] = useState(false);
  const [savingCapital, setSavingCapital] = useState(false);

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

  const handleCapitalAllocationChange = (phaseCode, value) => {
    setCapitalAllocations(prev => ({
      ...prev,
      [phaseCode]: parseFloat(value) || 0
    }));
  };

  const handleCapitalSubmit = async (e) => {
    e.preventDefault();
    setSavingCapital(true);
    setError(null);

    try {
      // Calculate total capital
      const totalCapital = Object.values(capitalAllocations).reduce((sum, amount) => sum + (amount || 0), 0);

      if (totalCapital <= 0) {
        setError('Total capital allocation must be greater than 0');
        setSavingCapital(false);
        return;
      }

      // Validate against available project capital
      const availableCapital = projectFinances?.capitalBalance || 0;
      const currentCapital = capitalTotal || 0;
      const capitalChange = totalCapital - currentCapital;

      if (capitalChange > 0 && capitalChange > availableCapital) {
        setError(`Insufficient capital. Available: ${availableCapital.toLocaleString()} KES, Additional needed: ${capitalChange.toLocaleString()} KES`);
        setSavingCapital(false);
        return;
      }

      // Build capital allocation with byPhase structure
      const byPhase = {};
      Object.keys(capitalAllocations).forEach(phaseCode => {
        const amount = capitalAllocations[phaseCode] || 0;
        if (amount > 0) {
          byPhase[phaseCode] = amount;
        }
      });

      const response = await fetch(`/api/floors/${floorId}/capital`, {
        method: capitalTotal > 0 ? 'PATCH' : 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          total: totalCapital,
          byPhase: byPhase,
          strategy: capitalStrategy,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update floor capital allocation');
      }

      toast.showSuccess('Floor capital allocation updated successfully!');
      setShowCapitalForm(false);
      // Refresh data
      fetchData();
    } catch (err) {
      setError(err.message);
      toast.showError(err.message || 'Failed to update floor capital allocation');
      console.error('Update capital allocation error:', err);
    } finally {
      setSavingCapital(false);
    }
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
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded-lg">
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
          <div className="bg-yellow-50 border border-yellow-400/60 text-yellow-700 px-4 py-3 rounded-lg">
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
          <h1 className="text-2xl md:text-3xl font-bold ds-text-primary">Manage Floor Budget</h1>
          <p className="ds-text-secondary mt-1">
            {floor?.name} (Floor {floor?.floorNumber})
          </p>
          {project && (
            <Link 
              href={`/projects/${project._id || project.id || ''}`}
              className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
            >
              Project: {project.projectName || project.name || 'Unknown Project'}
            </Link>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Current Budget Summary */}
        <div className="ds-bg-surface rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold ds-text-primary mb-4">Current Budget Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm ds-text-secondary">Total Budget</p>
              <p className="text-xl font-bold ds-text-primary mt-1">
                {formatCurrency(totalBudget)}
              </p>
            </div>
            <div>
              <p className="text-sm ds-text-secondary">Actual Spending</p>
              <p className="text-xl font-bold text-blue-600 mt-1">
                {formatCurrency(actualSpending)}
              </p>
            </div>
            <div>
              <p className="text-sm ds-text-secondary">Committed Costs</p>
              <p className="text-xl font-bold text-yellow-600 mt-1">
                {formatCurrency(committedCosts)}
              </p>
            </div>
            <div>
              <p className="text-sm ds-text-secondary">Remaining</p>
              <p className={`text-xl font-bold mt-1 ${
                remaining < 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>
          {totalBudget < minimumRequired && (
            <div className="mt-4 p-3 bg-red-50 border border-red-400/60 rounded text-red-700 text-sm">
              <strong>Warning:</strong> Total budget ({formatCurrency(totalBudget)}) is less than minimum required ({formatCurrency(minimumRequired)}). 
              Please increase allocations to meet existing spending and committed costs.
            </div>
          )}
        </div>

        {/* Capital Allocation Summary - Always visible */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-400/60 rounded-lg p-6 mb-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold ds-text-primary">Capital Allocation</h2>
              <p className="text-sm ds-text-secondary mt-1">Manage capital allocation for this floor by phase</p>
            </div>
            <div className="flex items-center gap-3">
              {capitalTotal > 0 && (
                <div className="text-sm font-medium ds-text-secondary ds-bg-surface px-3 py-1.5 rounded-lg border border-purple-400/60">
                  {capitalVsBudget.toFixed(1)}% of budget
                </div>
              )}
              {projectAvailableCapital > 0 && (
                <button
                  onClick={() => setShowCapitalForm(!showCapitalForm)}
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition shadow-md hover:shadow-lg"
                >
                  {showCapitalForm ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {capitalTotal > 0 ? 'Edit Capital' : 'Allocate Capital'}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
            {capitalTotal > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm ds-text-secondary">Total Capital</p>
                    <p className="text-xl font-bold text-purple-700 mt-1">
                      {formatCurrency(capitalTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm ds-text-secondary">Used</p>
                    <p className="text-xl font-bold text-blue-600 mt-1">
                      {formatCurrency(capitalUsed)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm ds-text-secondary">Committed</p>
                    <p className="text-xl font-bold text-yellow-600 mt-1">
                      {formatCurrency(capitalCommitted)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm ds-text-secondary">Remaining</p>
                    <p className={`text-xl font-bold mt-1 ${
                      capitalRemaining < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(capitalRemaining)}
                    </p>
                  </div>
                </div>
                {/* Capital vs Budget Comparison */}
                {totalBudget > 0 && (
                  <div className="mt-4 pt-4 border-t border-purple-400/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium ds-text-secondary">Capital Coverage</span>
                      <span className="text-sm ds-text-secondary">
                        {formatCurrency(capitalTotal)} / {formatCurrency(totalBudget)}
                      </span>
                    </div>
                    <div className="w-full ds-bg-surface-muted rounded-full h-3">
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
                      <p className="text-xs ds-text-secondary mt-2">
                        Capital covers {capitalVsBudget.toFixed(1)}% of budget. 
                        {capitalVsBudget < 80 && ' Consider allocating more capital to this floor.'}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-yellow-50 border border-yellow-400/60 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-yellow-800 mb-2">
                      No capital allocated to this floor yet.
                    </p>
                    {projectAvailableCapital > 0 ? (
                      <p className="text-xs text-yellow-700">
                        You have {formatCurrency(projectAvailableCapital)} available capital. Click "Allocate Capital" above to get started.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-yellow-700">
                          ⚠️ No capital available at the project level. Allocate capital to the project first.
                        </p>
                        <Link 
                          href={`/investors?projectId=${project?._id || ''}`}
                          className="inline-block px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded-lg hover:bg-yellow-700 transition"
                        >
                          Go to Investors to Allocate Capital
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {projectFinances && projectAvailableCapital > 0 && (
              <div className="mt-4 pt-4 border-t border-purple-400/60">
                <p className="text-xs ds-text-secondary">
                  Project Available Capital: <span className="font-semibold text-purple-700">{formatCurrency(projectAvailableCapital)}</span>
                </p>
              </div>
            )}
          </div>

          {/* Capital Allocation Form */}
          {showCapitalForm && projectAvailableCapital > 0 && (
            <form onSubmit={handleCapitalSubmit} className="mt-6 pt-6 border-t border-purple-400/60 ds-bg-surface rounded-lg p-4">
              <h3 className="text-md font-semibold ds-text-primary mb-4">Allocate Capital by Phase</h3>
              
              {/* Strategy Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium ds-text-secondary mb-2">
                  Allocation Strategy
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="capitalStrategy"
                      value="proportional"
                      checked={capitalStrategy === 'proportional'}
                      onChange={(e) => setCapitalStrategy(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm ds-text-secondary">Proportional (based on budget)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="capitalStrategy"
                      value="even"
                      checked={capitalStrategy === 'even'}
                      onChange={(e) => setCapitalStrategy(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm ds-text-secondary">Even Distribution</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="capitalStrategy"
                      value="manual"
                      checked={capitalStrategy === 'manual'}
                      onChange={(e) => setCapitalStrategy(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm ds-text-secondary">Manual</span>
                  </label>
                </div>
              </div>

              {/* Phase Capital Allocations */}
              {capitalStrategy === 'manual' && (
                <div className="space-y-4 mb-4">
                  {['PHASE-01', 'PHASE-02', 'PHASE-03', 'PHASE-04'].map(phaseCode => {
                    const phase = phases.find(p => p.phaseCode === phaseCode);
                    const isApplicable = phaseCode === 'PHASE-01' 
                      ? floor?.floorNumber < 0 
                      : phaseCode === 'PHASE-02' 
                      ? floor?.floorNumber >= 0 
                      : true;
                    
                    if (!isApplicable) return null;

                    return (
                      <div key={phaseCode} className="flex items-center gap-4">
                        <label className="w-48 text-sm font-medium ds-text-secondary">
                          {phaseNames[phaseCode]}:
                        </label>
                        <input
                          type="number"
                          value={capitalAllocations[phaseCode] || 0}
                          onChange={(e) => handleCapitalAllocationChange(phaseCode, e.target.value)}
                          min="0"
                          step="0.01"
                          className="flex-1 px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="0"
                        />
                        <span className="text-sm ds-text-muted w-12">KES</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Strategy Info */}
              {capitalStrategy !== 'manual' && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-400/60 rounded-lg">
                  <p className="text-sm text-blue-800">
                    {capitalStrategy === 'proportional' 
                      ? 'Capital will be distributed proportionally based on each phase\'s budget share.'
                      : 'Capital will be distributed evenly across all applicable phases.'}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Total to allocate: <span className="font-semibold">
                      {capitalStrategy === 'proportional' 
                        ? 'Based on budget proportions'
                        : formatCurrency(Math.floor(projectAvailableCapital / (['PHASE-01', 'PHASE-02', 'PHASE-03', 'PHASE-04'].filter(pc => {
                          if (pc === 'PHASE-01') return floor?.floorNumber < 0;
                          if (pc === 'PHASE-02') return floor?.floorNumber >= 0;
                          return true;
                        }).length)))} per phase
                    </span>
                  </p>
                </div>
              )}

              {/* Total Capital Input for Proportional/Even */}
              {capitalStrategy !== 'manual' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium ds-text-secondary mb-2">
                    Total Capital to Allocate
                  </label>
                  <input
                    type="number"
                    value={Object.values(capitalAllocations).reduce((sum, amount) => sum + (amount || 0), 0)}
                    onChange={(e) => {
                      const total = parseFloat(e.target.value) || 0;
                      if (capitalStrategy === 'proportional') {
                        // Distribute proportionally based on budget
                        const totalBudget = Object.values(phaseAllocations).reduce((sum, phase) => sum + (phase.total || 0), 0);
                        if (totalBudget > 0) {
                          const newAllocations = {};
                          ['PHASE-01', 'PHASE-02', 'PHASE-03', 'PHASE-04'].forEach(phaseCode => {
                            const phaseAlloc = phaseAllocations[phaseCode] || { total: 0 };
                            const phaseBudget = phaseAlloc.total || 0;
                            const proportion = phaseBudget / totalBudget;
                            newAllocations[phaseCode] = total * proportion;
                          });
                          setCapitalAllocations(newAllocations);
                        }
                      } else if (capitalStrategy === 'even') {
                        // Distribute evenly
                        const applicablePhases = ['PHASE-01', 'PHASE-02', 'PHASE-03', 'PHASE-04'].filter(pc => {
                          if (pc === 'PHASE-01') return floor?.floorNumber < 0;
                          if (pc === 'PHASE-02') return floor?.floorNumber >= 0;
                          return true;
                        });
                        const perPhase = applicablePhases.length > 0 ? total / applicablePhases.length : 0;
                        const newAllocations = {};
                        applicablePhases.forEach(phaseCode => {
                          newAllocations[phaseCode] = perPhase;
                        });
                        setCapitalAllocations(newAllocations);
                      }
                    }}
                    min="0"
                    max={projectAvailableCapital}
                    step="0.01"
                    className="w-full px-3 py-2 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="0"
                  />
                  <p className="text-xs ds-text-muted mt-1">
                    Available: {formatCurrency(projectAvailableCapital)}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-purple-400/60">
                <button
                  type="button"
                  onClick={() => setShowCapitalForm(false)}
                  className="px-4 py-2 ds-bg-surface-muted ds-text-secondary rounded-lg hover:ds-bg-surface-muted transition text-sm font-medium"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  loading={savingCapital}
                  disabled={Object.values(capitalAllocations).reduce((sum, amount) => sum + (amount || 0), 0) <= 0}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
                >
                  {capitalTotal > 0 ? 'Update Capital Allocation' : 'Allocate Capital'}
                </LoadingButton>
              </div>
            </form>
          )}

        {/* Phase Budget Allocation Form - Always visible and prominent */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-400/60 rounded-lg p-6 mb-6 shadow-lg">
          <div className="mb-4">
            <h2 className="text-2xl font-bold ds-text-primary mb-2">Allocate Budget to Phases</h2>
            <p className="text-sm ds-text-secondary">
              Set budget allocations for each phase on this floor. Enter the total budget and breakdown (materials, labour) for each applicable phase.
            </p>
            {totalBudget === 0 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-400/60 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>No budgets allocated yet.</strong> Enter budget amounts below to get started.
                </p>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="ds-bg-surface rounded-lg shadow-lg border-2 border-blue-400/60 p-6 space-y-6">
          <div className="flex items-center justify-between mb-4 pb-4 border-b ds-border-subtle">
            <h3 className="text-xl font-semibold ds-text-primary">Phase Budget Allocation</h3>
            <div className="text-sm ds-text-secondary">
              Total: <span className="font-semibold text-blue-600">{formatCurrency(totalBudget)}</span>
            </div>
          </div>
          
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
                <div key={phaseCode} className={`border-2 rounded-lg p-5 ${isApplicable ? 'border-blue-400/60 bg-blue-50' : 'ds-border-subtle ds-bg-surface-muted opacity-60'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold ds-text-primary">
                          {phaseNames[phaseCode]}
                        </h3>
                        <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
                          {phaseCode}
                        </span>
                      </div>
                      {phase && phaseBudget > 0 && (
                        <p className="text-sm ds-text-secondary mb-1">
                          <span className="font-medium">Phase Total Budget:</span> {formatCurrency(phaseBudget)}
                        </p>
                      )}
                      {!isApplicable && (
                        <p className="text-xs ds-text-muted mt-1 italic">
                          ⚠️ This phase does not apply to this floor type
                        </p>
                      )}
                      {isApplicable && phaseBudget === 0 && (
                        <p className="text-xs text-yellow-700 mt-1">
                          💡 No phase budget set yet. Allocate budget to the phase first, or enter floor-specific allocation below.
                        </p>
                      )}
                    </div>
                  </div>

                  {isApplicable && (
                    <div className="ds-bg-surface rounded-lg p-4 border border-blue-100">
                      <p className="text-xs ds-text-secondary mb-4 font-medium">
                        Enter budget allocation for this phase on this floor:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold ds-text-secondary mb-2">
                            Total Budget <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={allocation.total || ''}
                            onChange={(e) => handlePhaseAllocationChange(phaseCode, 'total', e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full px-4 py-2.5 border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-medium"
                          />
                          <p className="text-xs ds-text-muted mt-1">Total budget for this phase</p>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold ds-text-secondary mb-2">
                            Materials
                          </label>
                          <input
                            type="number"
                            value={allocation.materials || ''}
                            onChange={(e) => handlePhaseAllocationChange(phaseCode, 'materials', e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full px-4 py-2.5 border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="text-xs ds-text-muted mt-1">Materials cost</p>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold ds-text-secondary mb-2">
                            Labour
                          </label>
                          <input
                            type="number"
                            value={allocation.labour || ''}
                            onChange={(e) => handlePhaseAllocationChange(phaseCode, 'labour', e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full px-4 py-2.5 border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="text-xs ds-text-muted mt-1">Labour cost</p>
                        </div>
                      </div>
                      {allocation.total > 0 && (
                        <div className="mt-3 pt-3 border-t ds-border-subtle">
                          <p className="text-xs ds-text-secondary">
                            <span className="font-medium">Allocated:</span> {formatCurrency(allocation.total)} 
                            {phaseBudget > 0 && (
                              <span className="ml-2">
                                ({((allocation.total / phaseBudget) * 100).toFixed(1)}% of phase budget)
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary and Validation */}
          {totalBudget > 0 && (
            <div className="bg-blue-50 border border-blue-400/60 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-blue-900">Total Floor Budget</span>
                <span className="text-lg font-bold text-blue-700">{formatCurrency(totalBudget)}</span>
              </div>
              {totalBudget < minimumRequired && (
                <div className="mt-2 p-2 bg-red-50 border border-red-400/60 rounded text-red-700 text-sm">
                  <strong>Warning:</strong> Total budget ({formatCurrency(totalBudget)}) is less than minimum required ({formatCurrency(minimumRequired)}). 
                  Please increase allocations to meet existing spending and committed costs.
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center gap-3 pt-4 border-t-2 ds-border-subtle">
            <div className="text-sm ds-text-secondary">
              {totalBudget === 0 ? (
                <span className="text-yellow-700 font-medium">💡 Enter budget amounts above to get started</span>
              ) : (
                <span>Ready to save {formatCurrency(totalBudget)} in budget allocations</span>
              )}
            </div>
            <div className="flex gap-3">
              <Link
                href={`/floors/${floorId}`}
                className="px-5 py-2.5 ds-bg-surface-muted ds-text-secondary rounded-lg hover:ds-bg-surface-muted transition text-sm font-medium"
              >
                Cancel
              </Link>
              <LoadingButton
                type="submit"
                loading={saving}
                disabled={totalBudget < minimumRequired || totalBudget === 0}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-semibold shadow-md hover:shadow-lg"
              >
                {saving ? 'Saving...' : totalBudget === 0 ? 'Enter Budget Amounts First' : 'Save Budget Allocations'}
              </LoadingButton>
            </div>
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
