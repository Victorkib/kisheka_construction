/**
 * Project Budget Management Page
 * Dedicated page for managing project budgets, adjustments, and transfers
 * 
 * Route: /projects/[id]/budget
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { SmartBudgetInput } from '@/components/budget/SmartBudgetInput';
import { BudgetWizard } from '@/components/budget/BudgetWizard';
import { BudgetManagementDrawer } from '@/components/budget/BudgetManagementDrawer';
import { FinancialScenarioBanners } from '@/components/budget/FinancialScenarioBanners';
import { BudgetAdjustmentForm } from '@/components/budget/BudgetAdjustmentForm';
import { BudgetTransferForm } from '@/components/budget/BudgetTransferForm';
import { PreBudgetSpendingSummary } from '@/components/budget/PreBudgetSpendingSummary';
import { AllocationPreview } from '@/components/budget/AllocationPreview';
import { useToast } from '@/components/toast';
import { useProjectContext } from '@/contexts/ProjectContext';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

function BudgetManagementContent() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;
  const toast = useToast();
  const { currentProject } = useProjectContext();

  const [project, setProject] = useState(null);
  const [financialOverview, setFinancialOverview] = useState(null);
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false); // Budget management drawer
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [allocatingFloors, setAllocatingFloors] = useState(false);
  const [budgetData, setBudgetData] = useState(null);
  const [preBudgetSummary, setPreBudgetSummary] = useState(null);
  const [budgetValidationWarnings, setBudgetValidationWarnings] = useState([]);

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch project data
      const projectResponse = await fetch(`/api/projects/${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const projectResult = await projectResponse.json();
      if (!projectResult.success) {
        throw new Error(projectResult.error || 'Failed to fetch project');
      }
      setProject(projectResult.data);
      setBudgetData(projectResult.data.budget);

      // Fetch financial overview
      const overviewResponse = await fetch(`/api/projects/${projectId}/financial-overview`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const overviewResult = await overviewResponse.json();
      if (overviewResult.success) {
        setFinancialOverview(overviewResult.data);
      }

      // Fetch phases
      const phasesResponse = await fetch(`/api/phases?projectId=${projectId}&includeFinancials=true`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const phasesResult = await phasesResponse.json();
      if (phasesResult.success) {
        setPhases(phasesResult.data || []);
      }

      // Fetch pre-budget summary if budget is zero
      const currentBudget = projectResult.data.budget || {};
      const currentBudgetTotal = currentBudget.total || currentBudget.directConstructionCosts || 0;
      
      if (currentBudgetTotal === 0) {
        try {
          const summaryResponse = await fetch(`/api/projects/${projectId}/pre-budget-summary`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
          });
          const summaryResult = await summaryResponse.json();
          if (summaryResult.success) {
            setPreBudgetSummary(summaryResult.data);
          }
        } catch (summaryError) {
          console.error('Error fetching pre-budget summary:', summaryError);
          // Don't fail the page load if summary fails
        }
      }
    } catch (err) {
      console.error('Fetch budget data error:', err);
      setError(err.message || 'Failed to load budget data');
    } finally {
      setLoading(false);
    }
  };

  const handleDrawerSave = async (budgetData) => {
    setIsSaving(true);
    try {
      // Extract allocation preferences if present (from wizard)
      const allocationPrefs = budgetData.allocationPrefs || {};
      const dccBreakdown = budgetData.dccBreakdown || {};
      
      // Clean payload for API - include allocation preferences
      const apiPayload = {
        budget: {
          total: budgetData.total,
          directConstructionCosts: budgetData.directConstructionCosts,
          preConstructionCosts: budgetData.preConstructionCosts,
          indirectCosts: budgetData.indirectCosts,
          contingencyReserve: budgetData.contingencyReserve,
          _detailedBreakdown: budgetData._detailedBreakdown
        },
        // Support allocation preferences from wizard
        reallocatePhases: allocationPrefs.autoAllocateToPhases || false,
        autoAllocatePhases: allocationPrefs.autoAllocateToPhases || false,
        // Floor allocation preferences
        floorAllocationStrategy: allocationPrefs.floorAllocationStrategy || 'weighted',
        autoAllocateFloors: allocationPrefs.autoAllocateToFloors || false
      };

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify(apiPayload),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to update budget');
      }

      setBudgetData(budgetData);
      toast.showSuccess('Budget updated successfully!');
      setShowDrawer(false);
      
      // Refresh data to show updated budget
      await fetchData();
    } catch (error) {
      toast.showError(error.message || 'Failed to update budget');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkFloorAllocation = async () => {
    if (!projectId) {
      toast.showError('Project ID not found');
      return;
    }

    setAllocatingFloors(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/floors/budget`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          strategy: 'weighted', // Use weighted distribution by default
          onlyZeroBudgets: true // Only allocate to floors with zero budgets
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to allocate floor budgets');
      }

      let successMessage = result.message || 'Floor budgets allocated successfully';
      if (result.data?.warnings && result.data.warnings.length > 0) {
        successMessage += ` ${result.data.warnings.length} warning(s) generated.`;
        // Show first warning
        if (result.data.warnings[0]?.message) {
          toast.showWarning(result.data.warnings[0].message);
        }
      }
      if (result.data?.errors && result.data.errors.length > 0) {
        successMessage += ` ${result.data.errors.length} error(s) occurred.`;
        console.error('Floor allocation errors:', result.data.errors);
      }

      toast.showSuccess(successMessage);
      await fetchData(); // Refresh data
    } catch (err) {
      toast.showError(err.message || 'Failed to allocate floor budgets');
      console.error('Bulk floor allocation error:', err);
    } finally {
      setAllocatingFloors(false);
    }
  };

  const handleUseRecommendedBudget = (recommendations) => {
    if (recommendations) {
      const recommendedBudget = {
        total: recommendations.total || 0,
        directConstructionCosts: recommendations.dcc || 0,
        preConstructionCosts: recommendations.preConstruction || 0,
        indirectCosts: recommendations.indirect || 0,
        contingencyReserve: recommendations.contingency || 0,
        // Keep detailed breakdowns for backward compatibility
        _detailedBreakdown: budgetData?._detailedBreakdown || {
          materials: { total: 0, structural: 0, finishing: 0, mep: 0, specialty: 0 },
          labour: { total: 0, skilled: 0, unskilled: 0, supervisory: 0, specialized: 0 },
          equipment: { total: 0, rental: 0, purchase: 0, maintenance: 0 },
          subcontractors: { total: 0, specializedTrades: 0, professionalServices: 0 },
          preConstruction: {
            total: 0,
            landAcquisition: 0,
            legalRegulatory: 0,
            permitsApprovals: 0,
            sitePreparation: 0,
          },
          indirect: {
            total: 0,
            siteOverhead: 0,
            transportation: 0,
            utilities: 0,
            safetyCompliance: 0,
          },
          contingency: {
            total: 0,
            designContingency: 0,
            constructionContingency: 0,
            ownersReserve: 0,
          },
        }
      };
      setBudgetData(recommendedBudget);
      toast.showSuccess('Recommended budget applied');
    }
  };

  // Helper functions for data formatting
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 ds-text-secondary">Loading budget management...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="ds-bg-surface rounded-lg shadow p-6">
            <p className="ds-text-secondary">Project not found.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const budget = project.budget || {};
  const budgetTotal = budget.total || 0;
  const dcc = budget.directConstructionCosts || 0;
  const preConstruction = budget.preConstructionCosts || 0;
  const indirect = budget.indirectCosts || 0;
  const contingency = budget.contingencyReserve || (budget.contingency?.total || 0);

  // Get activation information
  const budgetActivation = project.budgetActivation;
  const capitalActivation = financialOverview?.financing?.activation;

  // Calculate phase budget totals
  const totalPhaseBudgets = phases.reduce((sum, phase) => {
    return sum + (phase.budgetAllocation?.total || 0);
  }, 0);
  const unallocatedDCC = Math.max(0, dcc - totalPhaseBudgets);

  // Prepare chart data
  const budgetBreakdownData = [
    { name: 'DCC', value: dcc, color: '#3b82f6' },
    { name: 'Pre-Construction', value: preConstruction, color: '#10b981' },
    { name: 'Indirect', value: indirect, color: '#f59e0b' },
    { name: 'Contingency', value: contingency, color: '#ef4444' },
  ].filter(item => item.value > 0);

  const phaseBudgetData = phases.map((phase) => ({
    name: phase.phaseName || phase.phaseCode,
    allocated: phase.budgetAllocation?.total || 0,
    spent: phase.actualSpending?.total || 0,
    remaining: Math.max(0, (phase.budgetAllocation?.total || 0) - (phase.actualSpending?.total || 0)),
  }));

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-4">
              <li>
                <Link href="/projects" className="ds-text-muted hover:ds-text-muted">
                  Projects
                </Link>
              </li>
              <li>
                <span className="ds-text-muted">/</span>
              </li>
              <li>
                <Link href={`/projects/${projectId}`} className="ds-text-muted hover:ds-text-muted">
                  {project.projectName || 'Project'}
                </Link>
              </li>
              <li>
                <span className="ds-text-muted">/</span>
              </li>
              <li>
                <span className="ds-text-primary font-medium">Budget Management</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold ds-text-primary">Budget Management</h1>
              <p className="mt-2 ds-text-secondary">
                {project.projectName} ({project.projectCode})
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href={`/projects/${projectId}`}
                className="px-4 py-2 ds-bg-surface-muted ds-text-secondary rounded-lg hover:ds-bg-surface-muted transition text-sm font-medium"
              >
                Back to Project
              </Link>
              <Link
                href={`/projects/${projectId}/finances`}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm font-medium"
              >
                Financial Overview
              </Link>
            </div>
          </div>
        </div>

        {/* Pre-Budget Spending Summary (shown when budget is zero) */}
        {budgetTotal === 0 && preBudgetSummary && (
          <div className="mb-6">
            <PreBudgetSpendingSummary 
              projectId={projectId}
              onRecommendationClick={handleUseRecommendedBudget}
            />
          </div>
        )}

        {/* Budget Validation Warnings */}
        {budgetValidationWarnings.length > 0 && (
          <div className="mb-6 bg-yellow-50 border border-yellow-400/60 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-yellow-900 mb-2">Budget Validation Warnings</h3>
                <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                  {budgetValidationWarnings.map((warning, index) => (
                    <li key={index}>
                      {warning.message}
                      {warning.recommended && (
                        <button
                          onClick={() => {
                            if (warning.category === 'DCC') {
                              setBudgetData(prev => ({ ...prev, directConstructionCosts: warning.recommended }));
                            } else if (warning.category === 'Pre-Construction') {
                              setBudgetData(prev => ({ ...prev, preConstructionCosts: warning.recommended }));
                            } else if (warning.category === 'Indirect') {
                              setBudgetData(prev => ({ ...prev, indirectCosts: warning.recommended }));
                            }
                            setBudgetValidationWarnings([]);
                          }}
                          className="ml-2 text-yellow-600 hover:text-yellow-800 underline text-xs"
                        >
                          Use Recommended
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Activation Banner */}
        {budgetActivation?.activatedAt && (
          <div className="mb-6 bg-blue-50 border border-blue-400/60 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-blue-800">Budget Activation Information</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    <strong>Budget set on:</strong> {formatDate(budgetActivation.activatedAt)}
                  </p>
                  {budgetActivation.preBudgetSpending && (
                    <p className="mt-1">
                      <strong>Pre-budget spending:</strong>{' '}
                      {formatCurrency(budgetActivation.preBudgetSpending.total)} (DCC:{' '}
                      {formatCurrency(budgetActivation.preBudgetSpending.dcc)}, Pre-Construction:{' '}
                      {formatCurrency(budgetActivation.preBudgetSpending.preConstruction)}, Indirect:{' '}
                      {formatCurrency(budgetActivation.preBudgetSpending.indirect)})
                    </p>
                  )}
                  <p className="mt-1 text-xs">
                    Historical spending before budget activation is excluded from budget validation. Budget governs future operations only.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Capital Activation Banner */}
        {capitalActivation?.activatedAt && (
          <div className="mb-6 bg-green-50 border border-green-400/60 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8.433 7.418c.195-.195.457-.282.716-.282h.005c.26 0 .521.087.716.282l3.149 3.149c.195.195.282.457.282.716 0 .26-.087.521-.282.716l-3.149 3.149c-.195.195-.457.282-.716.282h-.005c-.26 0-.521-.087-.716-.282L5.282 12.433c-.195-.195-.282-.457-.282-.716 0-.26.087-.521.282-.716l3.149-3.149z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-green-800">Capital Activation Information</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>
                    <strong>Capital injected on:</strong> {formatDate(capitalActivation.activatedAt)}
                  </p>
                  {capitalActivation.spendingBeforeCapital !== undefined && (
                    <p className="mt-1">
                      <strong>Spending before capital:</strong>{' '}
                      {formatCurrency(capitalActivation.spendingBeforeCapital)} (Used:{' '}
                      {formatCurrency(capitalActivation.preCapitalUsed)}, Committed:{' '}
                      {formatCurrency(capitalActivation.preCapitalCommitted)})
                    </p>
                  )}
                  <div className="mt-3">
                    <Link
                      href={`/investors?projectId=${projectId}`}
                      className="text-xs font-medium text-green-800 hover:text-green-900 underline"
                    >
                      Manage Capital Allocations →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Budget Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="ds-bg-surface rounded-lg shadow-sm border ds-border-subtle p-4">
            <p className="text-sm ds-text-secondary mb-1">Total Budget</p>
            <p className="text-2xl font-bold ds-text-primary">{formatCurrency(budgetTotal)}</p>
          </div>
          <div className="ds-bg-surface rounded-lg shadow-sm border ds-border-subtle p-4">
            <p className="text-sm ds-text-secondary mb-1">DCC</p>
            <p className="text-2xl font-bold ds-text-accent-primary">{formatCurrency(dcc)}</p>
          </div>
          <div className="ds-bg-surface rounded-lg shadow-sm border ds-border-subtle p-4">
            <p className="text-sm ds-text-secondary mb-1">Pre-Construction</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(preConstruction)}</p>
          </div>
          <div className="ds-bg-surface rounded-lg shadow-sm border ds-border-subtle p-4">
            <p className="text-sm ds-text-secondary mb-1">Indirect</p>
            <p className="text-2xl font-bold text-yellow-600">{formatCurrency(indirect)}</p>
          </div>
          <div className="ds-bg-surface rounded-lg shadow-sm border ds-border-subtle p-4">
            <p className="text-sm ds-text-secondary mb-1">Contingency</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(contingency)}</p>
          </div>
        </div>

        {/* Scenario-Based Guidance Banner */}
        <FinancialScenarioBanners
          projectId={projectId}
          budget={budgetData}
          capital={financialOverview?.capital}
          spending={financialOverview?.actual}
        />

        {/* Budget Breakdown Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Pie Chart */}
          <div className="ds-bg-surface rounded-lg shadow-sm border ds-border-subtle p-6">
            <h2 className="text-lg font-semibold ds-text-primary mb-4">Budget Breakdown</h2>
            {budgetBreakdownData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={budgetBreakdownData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {budgetBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 ds-text-muted">
                <p>No budget data available</p>
                <p className="text-sm mt-2">Set a budget to see breakdown</p>
              </div>
            )}
          </div>

          {/* Phase Budgets Bar Chart */}
          <div className="ds-bg-surface rounded-lg shadow-sm border ds-border-subtle p-6">
            <h2 className="text-lg font-semibold ds-text-primary mb-4">Phase Budget Allocation</h2>
            {phaseBudgetData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={phaseBudgetData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="allocated" fill="#3b82f6" name="Allocated" />
                  <Bar dataKey="spent" fill="#10b981" name="Spent" />
                  <Bar dataKey="remaining" fill="#f59e0b" name="Remaining" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 ds-text-muted">
                <p>No phases with budgets</p>
                <p className="text-sm mt-2">Allocate budgets to phases to see breakdown</p>
              </div>
            )}
          </div>
        </div>

        {/* Budget Management Actions */}
        <div className="ds-bg-surface rounded-lg shadow-sm border ds-border-subtle p-6 mb-8">
          <h2 className="text-lg font-semibold ds-text-primary mb-4">Budget Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setShowDrawer(true);
              }}
              className="px-4 py-2 ds-bg-accent-primary bg-blue-600 text-white rounded-lg hover:ds-bg-accent-hover transition text-sm font-medium"
              title="Smart budget management with Quick Edit & Wizard modes"
            >
              🗄️ Manage Budget
            </button>
            
            <button
              onClick={() => setShowAdjustmentForm(!showAdjustmentForm)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
              title="Create budget adjustments for changes"
            >
              {showAdjustmentForm ? 'Cancel Adjustment' : 'Create Adjustment'}
            </button>
            
            <button
              onClick={() => setShowTransferForm(!showTransferForm)}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm font-medium"
              title="Transfer budget between categories"
            >
              {showTransferForm ? 'Cancel Transfer' : 'Transfer Budget'}
            </button>
            
            <Link
              href={`/investors?projectId=${projectId}`}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
              title="Manage capital and investor relations"
            >
              Manage Capital
            </Link>
          </div>

          {/* Budget Adjustment Form */}
          {showAdjustmentForm && (
            <div className="mt-6 border-t ds-border-subtle pt-6">
              <BudgetAdjustmentForm
                projectId={projectId}
                onClose={() => setShowAdjustmentForm(false)}
                onSuccess={() => {
                  setShowAdjustmentForm(false);
                  fetchData();
                }}
              />
            </div>
          )}

          {/* Budget Transfer Form */}
          {showTransferForm && (
            <div className="mt-6 border-t ds-border-subtle pt-6">
              <BudgetTransferForm
                projectId={projectId}
                onClose={() => setShowTransferForm(false)}
                onSuccess={() => {
                  setShowTransferForm(false);
                  fetchData();
                }}
              />
            </div>
          )}
        </div>

        {/* Phase Impact Table */}
        <div className="ds-bg-surface rounded-lg shadow-sm border ds-border-subtle p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold ds-text-primary">Phase Budget Allocation</h2>
            <div className="flex items-center gap-4">
              <div className="text-sm ds-text-secondary">
                Total Allocated: {formatCurrency(totalPhaseBudgets)} / {formatCurrency(dcc)} DCC
                {unallocatedDCC > 0 && (
                  <span className="ml-2 text-green-600">({formatCurrency(unallocatedDCC)} unallocated)</span>
                )}
              </div>
              {phases.length > 0 && phases.some(p => (p.budgetAllocation?.total || 0) > 0) && (
                <button
                  onClick={handleBulkFloorAllocation}
                  disabled={allocatingFloors}
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                  {allocatingFloors ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Allocating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Allocate to Floors
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          {phases.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-ds-border-subtle">
                <thead className="ds-bg-surface-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Phase
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Budget Allocated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      % of DCC
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Spent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Remaining
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                  {phases.map((phase) => {
                    const phaseBudget = phase.budgetAllocation?.total || 0;
                    const phaseSpent = phase.actualSpending?.total || 0;
                    const phaseRemaining = Math.max(0, phaseBudget - phaseSpent);
                    const phasePercentage = dcc > 0 ? ((phaseBudget / dcc) * 100).toFixed(1) : '0.0';
                    const isOverBudget = phaseSpent > phaseBudget;

                    return (
                      <tr key={phase._id} className={isOverBudget ? 'bg-red-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium ds-text-primary">
                            {phase.phaseName || phase.phaseCode}
                          </div>
                          <div className="text-sm ds-text-muted">{phase.phaseCode}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                          {formatCurrency(phaseBudget)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                          {phasePercentage}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                          {formatCurrency(phaseSpent)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`text-sm font-medium ${
                              phaseRemaining < phaseBudget * 0.2
                                ? 'text-red-600'
                                : phaseRemaining < phaseBudget * 0.5
                                ? 'text-yellow-600'
                                : 'text-green-600'
                            }`}
                          >
                            {formatCurrency(phaseRemaining)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link
                            href={`/phases/${phase._id}/budget`}
                            className="ds-text-accent-primary hover:ds-text-accent-hover"
                          >
                            Manage →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 ds-text-muted">
              <p>No phases found for this project</p>
              <Link
                href={`/phases/new?projectId=${projectId}`}
                className="ds-text-accent-primary hover:ds-text-accent-hover text-sm mt-2 inline-block"
              >
                Create phases →
              </Link>
            </div>
          )}
        </div>

        {/* Budget Details Table */}
        <div className="ds-bg-surface rounded-lg shadow-sm border ds-border-subtle p-6">
          <h2 className="text-lg font-semibold ds-text-primary mb-4">Budget Details</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ds-border-subtle">
              <thead className="ds-bg-surface-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Budgeted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Spent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    Remaining
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                    % Used
                  </th>
                </tr>
              </thead>
              <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-primary">
                    Direct Construction Costs (DCC)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {formatCurrency(dcc)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {formatCurrency(financialOverview?.actual?.materials || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {formatCurrency(Math.max(0, dcc - (financialOverview?.actual?.materials || 0)))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {dcc > 0
                      ? `${((((financialOverview?.actual?.materials || 0) / dcc) * 100).toFixed(1))}%`
                      : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-primary">
                    Pre-Construction Costs
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {formatCurrency(preConstruction)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {formatCurrency(financialOverview?.budget?.preConstruction?.spent || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {formatCurrency(financialOverview?.budget?.preConstruction?.remaining || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {preConstruction > 0
                      ? `${(((financialOverview?.budget?.preConstruction?.spent || 0) / preConstruction) * 100).toFixed(1)}%`
                      : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-primary">
                    Indirect Costs
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {formatCurrency(indirect)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {formatCurrency(financialOverview?.budget?.indirectCosts?.spent || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {formatCurrency(financialOverview?.budget?.indirectCosts?.remaining || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {indirect > 0
                      ? `${(((financialOverview?.budget?.indirectCosts?.spent || 0) / indirect) * 100).toFixed(1)}%`
                      : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ds-text-primary">
                    Contingency Reserve
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {formatCurrency(contingency)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {formatCurrency(financialOverview?.contingency?.used || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {formatCurrency(financialOverview?.contingency?.remaining || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-primary">
                    {contingency > 0
                      ? `${(((financialOverview?.contingency?.used || 0) / contingency) * 100).toFixed(1)}%`
                      : 'N/A'}
                  </td>
                </tr>
                <tr className="ds-bg-surface-muted">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold ds-text-primary">Total</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold ds-text-primary">
                    {formatCurrency(budgetTotal)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold ds-text-primary">
                    {formatCurrency(financialOverview?.actual?.total || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold ds-text-primary">
                    {formatCurrency(Math.max(0, budgetTotal - (financialOverview?.actual?.total || 0)))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold ds-text-primary">
                    {budgetTotal > 0
                      ? `${(((financialOverview?.actual?.total || 0) / budgetTotal) * 100).toFixed(1)}%`
                      : 'N/A'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Budget Management Drawer */}
        <BudgetManagementDrawer
          projectId={projectId}
          isOpen={showDrawer}
          onClose={() => setShowDrawer(false)}
          existingBudget={budgetData}
          preBudgetSummary={preBudgetSummary}
          onSave={handleDrawerSave}
        />
      </div>
    </AppLayout>
  );
}

export default function BudgetManagementPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 ds-text-secondary">Loading...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <BudgetManagementContent />
    </Suspense>
  );
}
