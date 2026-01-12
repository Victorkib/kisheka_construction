/**
 * Project Detail Page
 * Displays project information, statistics, and allows editing
 * 
 * Route: /projects/[id]
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { ConfirmationModal, EditModal, RestoreModal } from '@/components/modals';
import { ArchiveBadge } from '@/components/badges';
import { useToast } from '@/components/toast';
import { LoadingOverlay } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { ProjectSetupChecklist } from '@/components/project-setup/ProjectSetupChecklist';
import { PostCreationWizard } from '@/components/project-setup/PostCreationWizard';
import { FloorVisualization } from '@/components/floors/FloorVisualization';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { ProjectHealthDashboard } from '@/components/project-health/ProjectHealthDashboard';
import { useTrackPageView } from '@/hooks/use-track-page-view';
import { HierarchicalBudgetDisplay } from '@/components/budget/HierarchicalBudgetDisplay';
import { EnhancedBudgetInput } from '@/components/budget/EnhancedBudgetInput';
import { BudgetVisualization } from '@/components/budget/BudgetVisualization';

// Phases Section Component
function PhasesSection({ projectId, canEdit }) {
  const toast = useToast();
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initializing, setInitializing] = useState(false);
  const [projectBudget, setProjectBudget] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchPhases();
      fetchProjectBudget();
    }
  }, [projectId]);

  const fetchPhases = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/phases?projectId=${projectId}&includeFinancials=true`);
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch phases');
      }
    } catch (err) {
      console.error('Fetch phases error:', err);
      setError('Failed to load phases');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectBudget = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();
      if (data.success && data.data) {
        setProjectBudget(data.data.budget);
      }
    } catch (err) {
      console.error('Fetch project budget error:', err);
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

  const getStatusColor = (status) => {
    const colors = {
      'not_started': 'bg-gray-100 text-gray-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'on_hold': 'bg-yellow-100 text-yellow-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Construction Phases</h2>
        <p className="text-sm text-gray-500">Loading phases...</p>
      </div>
    );
  }

  if (error && phases.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Construction Phases</h2>
        <p className="text-sm text-red-600">{error}</p>
        {canEdit && (
          <button
            onClick={async () => {
              setInitializing(true);
              try {
                const response = await fetch(`/api/projects/${projectId}/phases/initialize`, { method: 'POST' });
                const data = await response.json();
                if (data.success) {
                  toast.showSuccess(`Successfully initialized ${data.data.count} default phases`);
                  fetchPhases();
                } else {
                  toast.showError(data.error || 'Failed to initialize phases');
                }
              } catch (err) {
                toast.showError('Failed to initialize phases');
                console.error('Initialize phases error:', err);
              } finally {
                setInitializing(false);
              }
            }}
            disabled={initializing}
            className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {initializing ? 'Initializing...' : 'Initialize Default Phases'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Construction Phases</h2>
        <div className="flex gap-2">
          <Link
            href={`/phases?projectId=${projectId}`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View All
          </Link>
          {canEdit && (
            <>
              <span className="text-gray-300">|</span>
              <Link
                href={`/phases/new?projectId=${projectId}`}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                + New Phase
              </Link>
            </>
          )}
        </div>
      </div>

      {phases.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-2">No phases defined for this project</p>
          <p className="text-sm text-gray-400 mb-4">
            Initialize default phases to enable phase-based budget tracking and financial management
          </p>
          {canEdit && (
            <button
              onClick={async () => {
                setInitializing(true);
                try {
                  const response = await fetch(`/api/projects/${projectId}/phases/initialize`, { method: 'POST' });
                  const data = await response.json();
                  if (data.success) {
                    toast.showSuccess(`Successfully initialized ${data.data.count} default phases`);
                    fetchPhases();
                  } else {
                    toast.showError(data.error || 'Failed to initialize phases');
                  }
                } catch (err) {
                  toast.showError('Failed to initialize phases');
                  console.error('Initialize phases error:', err);
                } finally {
                  setInitializing(false);
                }
              }}
              disabled={initializing}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {initializing ? 'Initializing...' : 'Initialize Default Phases'}
            </button>
          )}
          {canEdit && (
            <p className="text-xs text-gray-500 mt-3">
              This will create 5 default phases with automatic budget allocation
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Phase Budget Summary */}
          {projectBudget && phases.length > 0 && (() => {
            const totalPhaseBudgets = phases.reduce((sum, phase) => {
              return sum + (phase.budgetAllocation?.total || 0);
            }, 0);
            const projectTotal = projectBudget.total || 0;
            const unallocatedBudget = projectTotal - totalPhaseBudgets;
            const allocationPercentage = projectTotal > 0 ? (totalPhaseBudgets / projectTotal) * 100 : 0;
            
            return (
              <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Phase Budget Summary</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Project Budget</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(projectTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Allocated to Phases</p>
                    <p className="text-sm font-semibold text-blue-600">{formatCurrency(totalPhaseBudgets)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Unallocated</p>
                    <p className={`text-sm font-semibold ${
                      unallocatedBudget < 0 ? 'text-red-600' : unallocatedBudget > 0 ? 'text-yellow-600' : 'text-gray-600'
                    }`}>
                      {formatCurrency(unallocatedBudget)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Allocation</p>
                    <p className="text-sm font-semibold text-gray-900">{allocationPercentage.toFixed(1)}%</p>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          allocationPercentage > 100 ? 'bg-red-600' : 
                          allocationPercentage > 90 ? 'bg-yellow-600' : 'bg-green-600'
                        }`}
                        style={{ width: `${Math.min(100, allocationPercentage)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          
          {phases.slice(0, 5).map((phase) => {
            const financialSummary = phase.financialSummary || {
              budgetTotal: phase.budgetAllocation?.total || 0,
              actualTotal: phase.actualSpending?.total || 0,
              remaining: phase.financialStates?.remaining || 0,
              utilizationPercentage: 0
            };
            
            return (
              <Link
                key={phase._id}
                href={`/phases/${phase._id}`}
                className="block border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{phase.phaseName}</h3>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(phase.status)}`}>
                        {phase.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">{phase.phaseCode}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Budget</p>
                        <p className="font-semibold text-gray-900">{formatCurrency(financialSummary.budgetTotal)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Spent</p>
                        <p className="font-semibold text-blue-600">{formatCurrency(financialSummary.actualTotal)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Remaining</p>
                        <p className={`font-semibold ${
                          financialSummary.remaining < 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatCurrency(financialSummary.remaining)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            financialSummary.utilizationPercentage > 100 
                              ? 'bg-red-600' 
                              : financialSummary.utilizationPercentage > 80 
                              ? 'bg-yellow-600' 
                              : 'bg-green-600'
                          }`}
                          style={{
                            width: `${Math.min(100, financialSummary.utilizationPercentage)}%`
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {financialSummary.utilizationPercentage.toFixed(1)}% utilized • {phase.completionPercentage || 0}% complete
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
          {phases.length > 5 && (
            <Link
              href={`/phases?projectId=${projectId}`}
              className="block text-center text-blue-600 hover:text-blue-800 text-sm font-medium py-2"
            >
              View all {phases.length} phases →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// Budget vs Actual Section Component
function BudgetVsActualSection({ projectId }) {
  const [budgetData, setBudgetData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBudgetVariance();
  }, [projectId]);

  const fetchBudgetVariance = async () => {
    try {
      const response = await fetch(`/api/reports/budget-variance?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setBudgetData(data.data);
      }
    } catch (err) {
      console.error('Fetch budget variance error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'on_budget':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'at_risk':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'over_budget':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'on_budget':
        return 'On Budget';
      case 'at_risk':
        return 'At Risk';
      case 'over_budget':
        return 'Over Budget';
      default:
        return 'Unknown';
    }
  };

  const getVarianceColor = (variance) => {
    if (variance >= 0) return 'text-green-600';
    if (variance < -10) return 'text-red-600';
    return 'text-yellow-600';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget vs Actual</h2>
        <p className="text-sm text-gray-500">Loading budget variance data...</p>
      </div>
    );
  }

  if (!budgetData) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Budget vs Actual</h2>
        <Link
          href={`/dashboard/budget?projectId=${projectId}`}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View Full Report →
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-600 mb-1">Total Budget</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(budgetData.budget.total)}</p>
          <p className="text-xs text-gray-600 mt-2">Actual</p>
          <p className="text-base font-semibold text-gray-900">{formatCurrency(budgetData.actual.total)}</p>
          <div className="mt-2">
            <span className={`text-xs font-medium ${getVarianceColor(budgetData.variance.totalPercentage)}`}>
              {budgetData.variance.total >= 0 ? '+' : ''}
              {formatCurrency(budgetData.variance.total)} ({budgetData.variance.totalPercentage >= 0 ? '+' : ''}
              {budgetData.variance.totalPercentage}%)
            </span>
          </div>
          <div className="mt-2">
            <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(budgetData.status.overall)}`}>
              {getStatusLabel(budgetData.status.overall)}
            </span>
          </div>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-600 mb-1">Materials</p>
          <p className="text-sm text-gray-500">Budget: {formatCurrency(budgetData.budget.materials)}</p>
          <p className="text-sm text-gray-500">Actual: {formatCurrency(budgetData.actual.materials)}</p>
          <div className="mt-2">
            <span className={`text-xs font-medium ${getVarianceColor(budgetData.variance.materialsPercentage)}`}>
              {budgetData.variance.materials >= 0 ? '+' : ''}
              {formatCurrency(budgetData.variance.materials)} ({budgetData.variance.materialsPercentage >= 0 ? '+' : ''}
              {budgetData.variance.materialsPercentage}%)
            </span>
          </div>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-600 mb-1">Labour</p>
          <p className="text-sm text-gray-500">Budget: {formatCurrency(budgetData.budget.labour)}</p>
          <p className="text-sm text-gray-500">Actual: {formatCurrency(budgetData.actual.labour)}</p>
          <div className="mt-2">
            <span className={`text-xs font-medium ${getVarianceColor(budgetData.variance.labourPercentage)}`}>
              {budgetData.variance.labour >= 0 ? '+' : ''}
              {formatCurrency(budgetData.variance.labour)} ({budgetData.variance.labourPercentage >= 0 ? '+' : ''}
              {budgetData.variance.labourPercentage}%)
            </span>
          </div>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <p className="text-xs text-gray-600 mb-1">Contingency</p>
          <p className="text-sm text-gray-500">Budget: {formatCurrency(budgetData.budget.contingency)}</p>
          <p className="text-sm text-gray-500">Used: {formatCurrency(budgetData.actual.contingency)}</p>
          <div className="mt-2">
            <span className={`text-xs font-medium ${getVarianceColor(budgetData.variance.contingencyPercentage)}`}>
              {budgetData.variance.contingency >= 0 ? '+' : ''}
              {formatCurrency(budgetData.variance.contingency)} ({budgetData.variance.contingencyPercentage >= 0 ? '+' : ''}
              {budgetData.variance.contingencyPercentage}%)
            </span>
          </div>
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div className="mt-4 pt-4 border-t">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Budget Utilization</span>
          <span className={`text-sm font-medium ${getVarianceColor(budgetData.variance.totalPercentage)}`}>
            {budgetData.budget.total > 0
              ? `${((budgetData.actual.total / budgetData.budget.total) * 100).toFixed(1)}% used`
              : 'N/A'}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              budgetData.variance.totalPercentage >= 0
                ? 'bg-green-500'
                : budgetData.variance.totalPercentage < -10
                ? 'bg-red-500'
                : 'bg-yellow-500'
            }`}
            style={{
              width: `${Math.min(100, Math.max(0, (budgetData.actual.total / budgetData.budget.total) * 100))}%`,
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}

// Expenses Section Component
function ExpensesSection({ projectId }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    if (projectId) {
      fetchExpenses();
    }
  }, [projectId]);

  const fetchExpenses = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all expenses for the project, we'll filter approved/paid on client side for display
      const response = await fetch(`/api/expenses?projectId=${projectId}&limit=10`);
      const data = await response.json();
      if (data.success) {
        const allExpenses = data.data.expenses || [];
        // Filter to show only approved/paid expenses in the list
        const approvedExpenses = allExpenses.filter(exp => ['APPROVED', 'PAID'].includes(exp.status));
        setExpenses(approvedExpenses);
        // Calculate total from approved/paid expenses
        const total = approvedExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        setTotalAmount(total);
      }
    } catch (err) {
      console.error('Fetch expenses error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'KES') => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      PAID: 'bg-blue-100 text-blue-800',
      ARCHIVED: 'bg-gray-100 text-gray-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Expenses</h2>
        <Link
          href={`/expenses?projectId=${projectId}`}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View All →
        </Link>
      </div>
      <div className="mb-4">
        <p className="text-sm text-gray-600">Total Approved Expenses</p>
        <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(totalAmount)}</p>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : expenses.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-2">No expenses recorded</p>
          <Link
            href={`/expenses/new?projectId=${projectId}`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Add Expense
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.slice(0, 5).map((expense) => (
            <Link
              key={expense._id}
              href={`/expenses/${expense._id}`}
              className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{expense.description || expense.expenseCode}</p>
                  <p className="text-sm text-gray-600 leading-normal">
                    {expense.vendor || 'N/A'} • {expense.category?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatCurrency(expense.amount, expense.currency)}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeColor(expense.status)}`}>
                    {expense.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
          {expenses.length > 5 && (
            <Link
              href={`/expenses?projectId=${projectId}`}
              className="block text-center text-sm text-blue-600 hover:text-blue-800 pt-2"
            >
              View {expenses.length - 5} more...
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// Initial Expenses Section Component
function InitialExpensesSection({ projectId }) {
  const [initialExpenses, setInitialExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    fetchInitialExpenses();
  }, [projectId]);

  const fetchInitialExpenses = async () => {
    try {
      const response = await fetch(`/api/initial-expenses?projectId=${projectId}&limit=5`);
      const data = await response.json();
      if (data.success) {
        setInitialExpenses(data.data.expenses || []);
        setTotalAmount(data.data.totals?.totalAmount || 0);
      }
    } catch (err) {
      console.error('Fetch initial expenses error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Initial Expenses</h2>
        <Link
          href={`/initial-expenses?projectId=${projectId}`}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View All →
        </Link>
      </div>
      <div className="mb-4">
        <p className="text-sm text-gray-600">Total Initial Expenses</p>
        <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(totalAmount)}</p>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : initialExpenses.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-2">No initial expenses recorded</p>
          <Link
            href={`/initial-expenses/new?projectId=${projectId}`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Add Initial Expense
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {initialExpenses.slice(0, 5).map((expense) => (
            <Link
              key={expense._id}
              href={`/initial-expenses/${expense._id}`}
              className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{expense.itemName}</p>
                  <p className="text-sm text-gray-600 leading-normal">{expense.expenseCode}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatCurrency(expense.amount)}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    expense.status === 'approved' ? 'bg-green-100 text-green-800' :
                    expense.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {expense.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </Link>
          ))}
          {initialExpenses.length > 5 && (
            <Link
              href={`/initial-expenses?projectId=${projectId}`}
              className="block text-center text-sm text-blue-600 hover:text-blue-800 pt-2"
            >
              View {initialExpenses.length - 5} more...
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// Project Finances Section Component
function ProjectFinancesSection({ projectId }) {
  const [finances, setFinances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchFinances();
  }, [projectId]);

  const fetchFinances = async (forceRecalculate = false) => {
    try {
      if (forceRecalculate) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      // Add forceRecalculate query param to trigger recalculation on server
      const url = forceRecalculate 
        ? `/api/project-finances?projectId=${projectId}&forceRecalculate=true`
        : `/api/project-finances?projectId=${projectId}`;
      
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setFinances(data.data);
      }
    } catch (err) {
      console.error('Fetch project finances error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Project Finances</h2>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => fetchFinances(true)}
            disabled={refreshing}
            className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh financial data"
          >
            {refreshing ? (
              <span className="flex items-center gap-1">
                <span className="animate-spin">⟳</span> Refreshing...
              </span>
            ) : (
              <span className="flex items-center gap-1">
                ⟳ Refresh
              </span>
            )}
          </button>
          <span className="text-gray-300">|</span>
          <Link
            href={`/projects/${projectId}/finances`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Financial Overview →
          </Link>
          <span className="text-gray-300">|</span>
          <Link
            href={`/financing?projectId=${projectId}`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Financing Details →
          </Link>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : finances ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600">Capital Raised</p>
            <p className="text-xl font-bold text-green-600 mt-1">
              {formatCurrency(finances.totalInvested || 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Capital Used</p>
            <p className="text-xl font-bold text-red-600 mt-1">
              {formatCurrency(finances.totalUsed || 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Remaining Balance</p>
            <p className="text-xl font-bold text-blue-600 mt-1">
              {formatCurrency(finances.capitalBalance || 0)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No financing data available</p>
      )}
    </div>
  );
}

// Progress Section Component
function ProgressSection({ projectId }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, [projectId]);

  const fetchProgress = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/progress`);
      const data = await response.json();
      if (data.success) {
        setProgress(data.data);
      }
    } catch (err) {
      console.error('Fetch progress error:', err);
    } finally {
      setLoading(false);
    }
  };

  const photosCount = progress?.photos?.length || 0;
  const milestonesCount = progress?.milestones?.length || 0;
  const updatesCount = progress?.dailyUpdates?.length || 0;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Progress Documentation</h2>
        <Link
          href={`/projects/${projectId}/progress`}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View Full Progress →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <p className="text-2xl font-bold text-blue-600">{photosCount}</p>
          <p className="text-sm text-gray-600 mt-1">Photos</p>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <p className="text-2xl font-bold text-green-600">{milestonesCount}</p>
          <p className="text-sm text-gray-600 mt-1">Milestones</p>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <p className="text-2xl font-bold text-purple-600">{updatesCount}</p>
          <p className="text-sm text-gray-600 mt-1">Daily Updates</p>
        </div>
      </div>
      <div className="mt-4">
        <Link
          href={`/projects/${projectId}/progress`}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Manage Progress Documentation
        </Link>
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id;
  const toast = useToast();
  const { canAccess } = usePermissions();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  const [fetchingFinancialData, setFetchingFinancialData] = useState(false);
  const [dependencies, setDependencies] = useState(null);
  const [floors, setFloors] = useState([]);

  const [formData, setFormData] = useState({
    projectName: '',
    description: '',
    location: '',
    client: '',
    status: 'planning',
    startDate: '',
    plannedEndDate: '',
    budget: {
      total: 0,
      materials: 0,
      labour: 0,
      contingency: 0,
    },
  });

  // Track page view
  useTrackPageView('project', async (id) => {
    try {
      const response = await fetch(`/api/projects/${id}`);
      const data = await response.json();
      if (data.success) {
        return data.data;
      }
    } catch (err) {
      console.error('Error fetching project for tracking:', err);
    }
    return {};
  });

  useEffect(() => {
    if (projectId) {
      fetchUser();
      fetchProject();
    } else {
      setError('Invalid project ID');
      setLoading(false);
    }
  }, [projectId]);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        const role = data.data.role?.toLowerCase();
        setCanEdit(['owner', 'pm', 'project_manager'].includes(role));
        setCanDelete(role === 'owner');
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

  const fetchProject = async () => {
    if (!projectId) {
      setError('Invalid project ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch project');
      }

      const projectData = data.data;
      setProject(projectData);
      
      // Fetch financial and dependency data for delete/archive modal
      if (canDelete) {
        fetchFinancialData();
      }

      // Populate form data
      const initialFormData = {
        projectName: projectData.projectName || '',
        description: projectData.description || '',
        location: projectData.location || '',
        client: projectData.client || '',
        status: projectData.status || 'planning',
        startDate: projectData.startDate
          ? new Date(projectData.startDate).toISOString().split('T')[0]
          : '',
        plannedEndDate: projectData.plannedEndDate
          ? new Date(projectData.plannedEndDate).toISOString().split('T')[0]
          : '',
        budget: {
          total: projectData.budget?.total || 0,
          materials: projectData.budget?.materials || 0,
          labour: projectData.budget?.labour || 0,
          contingency: projectData.budget?.contingency || 0,
        },
      };
      setFormData(initialFormData);
      setOriginalFormData(initialFormData);
    } catch (err) {
      setError(err.message);
      console.error('Fetch project error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('budget.')) {
      const budgetField = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        budget: {
          ...prev.budget,
          [budgetField]: parseFloat(value) || 0,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleBudgetChange = (budgetData) => {
    setFormData((prev) => ({
      ...prev,
      budget: budgetData,
    }));
  };

  const handleEditClick = () => {
    if (project) {
      const initialFormData = {
        projectName: project.projectName || '',
        description: project.description || '',
        location: project.location || '',
        client: project.client || '',
        status: project.status || 'planning',
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
        plannedEndDate: project.plannedEndDate ? new Date(project.plannedEndDate).toISOString().split('T')[0] : '',
        budget: project.budget || {
          total: 0,
          materials: 0,
          labour: 0,
          contingency: 0,
        },
      };
      setFormData(initialFormData);
      setOriginalFormData(initialFormData);
      setShowEditModal(true);
      setError(null);
    }
  };

  const hasUnsavedChanges = () => {
    if (!originalFormData) return false;
    // Deep compare budget objects
    const budgetChanged = JSON.stringify(formData.budget) !== JSON.stringify(originalFormData.budget);
    return (
      formData.projectName !== originalFormData.projectName ||
      formData.description !== originalFormData.description ||
      formData.location !== originalFormData.location ||
      formData.client !== originalFormData.client ||
      formData.status !== originalFormData.status ||
      formData.startDate !== originalFormData.startDate ||
      formData.plannedEndDate !== originalFormData.plannedEndDate ||
      budgetChanged
    );
  };

  const hasBudgetChange = () => {
    if (!originalFormData) return false;
    // Deep compare budget objects
    return JSON.stringify(formData.budget) !== JSON.stringify(originalFormData.budget);
  };

  const validateForm = () => {
    if (!formData.projectName?.trim()) {
      toast.showError('Project name is required');
      return false;
    }
    
    // Validate budget - support both legacy and enhanced structures
    const budget = formData.budget;
    if (budget.total !== undefined && budget.total < 0) {
      toast.showError('Total budget cannot be negative');
      return false;
    }
    
    // Check legacy structure
    if (budget.materials !== undefined && budget.materials < 0) {
      toast.showError('Materials budget cannot be negative');
      return false;
    }
    if (budget.labour !== undefined && budget.labour < 0) {
      toast.showError('Labour budget cannot be negative');
      return false;
    }
    if (budget.contingency !== undefined && budget.contingency < 0) {
      toast.showError('Contingency budget cannot be negative');
      return false;
    }
    
    // Check enhanced structure
    if (budget.directConstructionCosts !== undefined && budget.directConstructionCosts < 0) {
      toast.showError('Direct construction costs cannot be negative');
      return false;
    }
    if (budget.preConstructionCosts !== undefined && budget.preConstructionCosts < 0) {
      toast.showError('Pre-construction costs cannot be negative');
      return false;
    }
    if (budget.indirectCosts !== undefined && budget.indirectCosts < 0) {
      toast.showError('Indirect costs cannot be negative');
      return false;
    }
    if (budget.contingencyReserve !== undefined && budget.contingencyReserve < 0) {
      toast.showError('Contingency reserve cannot be negative');
      return false;
    }
    
    if (formData.startDate && formData.plannedEndDate && formData.startDate > formData.plannedEndDate) {
      toast.showError('Planned end date must be after start date');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectName: formData.projectName.trim(),
          description: formData.description.trim(),
          location: formData.location.trim(),
          client: formData.client.trim(),
          status: formData.status,
          startDate: formData.startDate || null,
          plannedEndDate: formData.plannedEndDate || null,
          budget: formData.budget,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update project');
      }

      toast.showSuccess('Project updated successfully!');
      setProject(data.data);
      setShowEditModal(false);
      // Refresh to get updated statistics
      await fetchProject();
      setOriginalFormData(null);
    } catch (err) {
      toast.showError(err.message || 'Failed to update project');
      console.error('Update project error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchFinancialData = async () => {
    try {
      setFetchingFinancialData(true);
      // Fetch project finances
      const financesResponse = await fetch(`/api/project-finances?projectId=${projectId}`);
      const financesData = await financesResponse.json();
      
      if (financesData.success && financesData.data) {
        const pf = financesData.data;
        setFinancialData({
          totalUsed: pf.totalUsed || 0,
          totalInvested: pf.totalInvested || 0,
          capitalBalance: pf.capitalBalance || 0,
        });
      }
      
      // Fetch dependency counts (use count queries if available, otherwise estimate from list)
      try {
        const [materialsRes, expensesRes, initialExpensesRes, floorsRes] = await Promise.all([
          fetch(`/api/materials?projectId=${projectId}&limit=1`).catch(() => ({ json: () => ({ data: [] }) })),
          fetch(`/api/expenses?projectId=${projectId}&limit=1`).catch(() => ({ json: () => ({ data: [] }) })),
          fetch(`/api/initial-expenses?projectId=${projectId}&limit=1`).catch(() => ({ json: () => ({ data: [] }) })),
          fetch(`/api/floors?projectId=${projectId}`).catch(() => ({ json: () => ({ data: [] }) })),
        ]);
        
        const materialsData = await materialsRes.json();
        const expensesData = await expensesRes.json();
        const initialExpensesData = await initialExpensesRes.json();
        const floorsData = await floorsRes.json();
        
        // Get allocations count from project data if available
        const allocationsCount = project?.statistics?.investorAllocations || 0;
        
        // Store floors for visualization
        if (floorsData.success && floorsData.data) {
          setFloors(floorsData.data);
        }
        
        setDependencies({
          materials: materialsData.data?.length || 0,
          expenses: expensesData.data?.length || 0,
          initialExpenses: initialExpensesData.data?.length || 0,
          floors: floorsData.data?.length || 0,
          allocations: allocationsCount,
        });
      } catch (err) {
        console.error('Error fetching dependencies:', err);
        setDependencies({
          materials: 0,
          expenses: 0,
          initialExpenses: 0,
          floors: 0,
          allocations: 0,
        });
      }
    } catch (err) {
      console.error('Error fetching financial/dependency data:', err);
    } finally {
      setFetchingFinancialData(false);
    }
  };

  const handleArchiveClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleArchiveConfirm = async () => {
    setArchiving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/archive`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to archive project');
      }

      toast.showSuccess(data.message || 'Project archived successfully!');
      setShowDeleteModal(false);
      await fetchProject();
    } catch (err) {
      toast.showError(err.message || 'Failed to archive project');
      console.error('Archive project error:', err);
    } finally {
      setArchiving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}?force=true`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete project');
      }

      toast.showSuccess(data.message || 'Project permanently deleted successfully!');
      setShowDeleteModal(false);
      // Redirect to projects list
      setTimeout(() => {
        router.push('/projects');
      }, 500);
    } catch (err) {
      toast.showError(err.message || 'Failed to delete project');
      console.error('Delete project error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestoreClick = () => {
    setShowRestoreModal(true);
  };

  const handleRestoreConfirm = async () => {
    setRestoring(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/restore`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to restore project');
      }

      toast.showSuccess(data.message || 'Project restored successfully!');
      setShowRestoreModal(false);
      await fetchProject();
    } catch (err) {
      toast.showError(err.message || 'Failed to restore project');
      console.error('Restore project error:', err);
    } finally {
      setRestoring(false);
    }
  };


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

  const getStatusBadgeColor = (status) => {
    const colors = {
      planning: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-purple-100 text-purple-800',
      archived: 'bg-gray-100 text-gray-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading project...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !project) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
          <Link href="/projects" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Projects
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return null;
  }

  const statistics = project.statistics || {};

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <LoadingOverlay 
          isLoading={isSaving || fetchingFinancialData} 
          message={isSaving ? "Saving project..." : "Loading financial data..."} 
          fullScreen={false} 
        />
        {/* Header */}
        <div className="mb-8">
          <Breadcrumbs 
            items={[
              { label: 'Projects', href: '/projects' },
              { label: project.projectName || 'Project', href: `/projects/${projectId}`, current: true },
            ]}
          />
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">{project.projectName}</h1>
                {project.status === 'archived' && <ArchiveBadge />}
                {statistics && (() => {
                  const totalInvested = statistics.totalInvested || 0;
                  const capitalBalance = statistics.capitalBalance || 0;
                  const availableCapital = capitalBalance;
                  const totalUsed = totalInvested - capitalBalance;
                  const usagePercentage = totalInvested > 0 ? (totalUsed / totalInvested) * 100 : 0;
                  
                  let statusColor = 'bg-green-100 text-green-800';
                  let statusText = 'Capital OK';
                  
                  if (totalInvested === 0) {
                    statusColor = 'bg-red-100 text-red-800';
                    statusText = 'No Capital';
                  } else if (availableCapital < 0) {
                    statusColor = 'bg-red-100 text-red-800';
                    statusText = 'Negative';
                  } else if (usagePercentage > 80) {
                    statusColor = 'bg-yellow-100 text-yellow-800';
                    statusText = 'Low Capital';
                  }
                  
                  return (
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusColor}`} title={`Capital: ${formatCurrency(totalInvested)}, Available: ${formatCurrency(availableCapital)}`}>
                      💰 {statusText}
                    </span>
                  );
                })()}
              </div>
              <p className="text-gray-600 mt-1">
                {project.projectCode} {project.location && `• ${project.location}`}
              </p>
            </div>
            {canEdit && project.status !== 'archived' && (
              <div className="flex gap-2">
                <button
                  onClick={handleEditClick}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Edit Project
                </button>
                {canDelete && (
                  <>
                    <button
                      onClick={handleArchiveClick}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                    >
                      Archive
                    </button>
                    <button
                      onClick={handleDeleteClick}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
            {canDelete && project.status === 'archived' && (
              <div className="flex gap-2">
                <button
                  onClick={handleRestoreClick}
                  disabled={restoring}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {restoring ? 'Restoring...' : 'Restore Project'}
                </button>
                <button
                  onClick={handleDeleteClick}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            )}
            {!canEdit && canDelete && project.status !== 'archived' && (
              <div className="flex gap-2">
                <button
                  onClick={handleArchiveClick}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Archive
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Budget</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {formatCurrency(project.budget?.total || 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Materials Count</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              {statistics.materialsCount || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Expenses Count</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {statistics.expensesCount || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Budget Remaining</p>
            <p className="text-2xl font-bold text-purple-600 mt-2">
              {formatCurrency(statistics.budgetRemaining || project.budget?.total || 0)}
            </p>
          </div>
        </div>

        {/* Project Information */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600">Project Code</p>
                <p className="text-base font-medium text-gray-900 mt-1">{project.projectCode}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${getStatusBadgeColor(
                    project.status
                  )}`}
                >
                  {project.status || 'planning'}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Location</p>
                <p className="text-base font-medium text-gray-900 mt-1">{project.location || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Client</p>
                <p className="text-base font-medium text-gray-900 mt-1">{project.client || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Start Date</p>
                <p className="text-base font-medium text-gray-900 mt-1">{formatDate(project.startDate)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Planned End Date</p>
                <p className="text-base font-medium text-gray-900 mt-1">
                  {formatDate(project.plannedEndDate)}
                </p>
              </div>
              {project.description && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600">Description</p>
                  <p className="text-base text-gray-900 mt-1">{project.description}</p>
                </div>
              )}
            </div>
        </div>

        {/* Budget Breakdown */}
        <div className="mb-6">
          <HierarchicalBudgetDisplay budget={project.budget} />
        </div>

        {/* Budget Visualization */}
        {project.budget && (
          <div className="mb-6">
            <BudgetVisualization budget={project.budget} />
            {statistics.totalMaterialsSpent !== undefined && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Spent (Materials)</span>
                  <span className="text-lg font-bold text-orange-600">
                    {formatCurrency(statistics.totalMaterialsSpent)}
                  </span>
                </div>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${
                          project.budget?.total > 0
                            ? Math.min(100, (statistics.totalMaterialsSpent / project.budget.total) * 100)
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 leading-normal">
                    {project.budget?.total > 0
                      ? `${((statistics.totalMaterialsSpent / project.budget.total) * 100).toFixed(1)}% of budget used`
                      : 'No budget set'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Construction Phases Section */}
        <PhasesSection projectId={projectId} canEdit={canEdit} />

        {/* Project Health Dashboard */}
        <ProjectHealthDashboard projectId={projectId} />

        {/* Post-Creation Setup Wizard */}
        {project && (
          <PostCreationWizard
            projectId={projectId}
            projectData={project}
            onComplete={() => {
              // Refresh project data
              fetchProject();
            }}
            onDismiss={() => {
              // Wizard dismissed, continue normally
            }}
          />
        )}

        {/* Project Setup Checklist */}
        <ProjectSetupChecklist projectId={projectId} />

        {/* Floor Visualization */}
        {floors.length > 0 && (
          <FloorVisualization
            floors={floors}
            projectId={projectId}
            compact={false}
          />
        )}

        {/* Budget vs Actual Section */}
        <BudgetVsActualSection projectId={projectId} />

        {/* Initial Expenses Section */}
        <InitialExpensesSection projectId={projectId} />

        {/* Expenses Section */}
        <ExpensesSection projectId={projectId} />

        {/* Project Finances Section */}
        <ProjectFinancesSection projectId={projectId} />

        {/* Progress Documentation Section */}
        <ProgressSection projectId={projectId} />

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {canAccess && canAccess('create_bulk_material_request') && (
            <Link
              href={`/material-requests/bulk?projectId=${projectId}`}
              className="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-3 rounded-lg transition text-center"
            >
              📦 Bulk Material Request
            </Link>
          )}
          {canEdit && (
            <Link
              href={`/floors/new?projectId=${projectId}&basement=true`}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-6 py-3 rounded-lg transition text-center flex items-center justify-center gap-2"
              title="Add a basement floor to this project"
            >
              <span>🏢</span> Add Basement
            </Link>
          )}
          {canEdit && (
            <Link
              href={`/floors/new?projectId=${projectId}`}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition text-center"
            >
              + Add Floor
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            href={`/projects/${projectId}/finances`}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl">📊</div>
              <div>
                <h3 className="font-semibold text-gray-900">Financial Overview</h3>
                <p className="text-sm text-gray-600">Budget, Capital & Actual</p>
              </div>
            </div>
          </Link>
          <Link
            href={`/items?projectId=${projectId}`}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl">📦</div>
              <div>
                <h3 className="font-semibold text-gray-900">View Materials</h3>
                <p className="text-sm text-gray-600">{statistics.materialsCount || 0} items</p>
              </div>
            </div>
          </Link>
          <Link
            href={`/floors?projectId=${projectId}`}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl">🏢</div>
              <div>
                <h3 className="font-semibold text-gray-900">Manage Floors</h3>
                <p className="text-sm text-gray-600">View and edit project floors</p>
              </div>
            </div>
          </Link>
          {canAccess && canAccess('manage_project_team') && (
            <Link
              href={`/projects/${projectId}/team`}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">👥</div>
                <div>
                  <h3 className="font-semibold text-gray-900">Team Management</h3>
                  <p className="text-sm text-gray-600">Manage project team</p>
                </div>
              </div>
            </Link>
          )}
          <Link
            href={`/phases?projectId=${projectId}`}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl">🏗️</div>
              <div>
                <h3 className="font-semibold text-gray-900">Manage Phases</h3>
                <p className="text-sm text-gray-600">View and edit construction phases</p>
              </div>
            </div>
          </Link>
          <Link
            href={`/expenses?projectId=${projectId}`}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl">💰</div>
              <div>
                <h3 className="font-semibold text-gray-900">View Expenses</h3>
                <p className="text-sm text-gray-600">{statistics.expensesCount || 0} entries</p>
              </div>
            </div>
          </Link>
          <Link
            href={`/labour/entries?projectId=${projectId}`}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl">👷</div>
              <div>
                <h3 className="font-semibold text-gray-900">View Labour</h3>
                <p className="text-sm text-gray-600">Labour entries & workers</p>
              </div>
            </div>
          </Link>
          <Link
            href={`/items/new?projectId=${projectId}`}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl">➕</div>
              <div>
                <h3 className="font-semibold text-gray-900">Add Material</h3>
                <p className="text-sm text-gray-600">Create new entry</p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Edit Project Modal */}
      <EditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setError(null);
        }}
        onSave={handleSave}
        title="Edit Project"
        isLoading={isSaving}
        hasUnsavedChanges={hasUnsavedChanges()}
        showBudgetChangeWarning={hasBudgetChange()}
        maxWidth="max-w-4xl"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-base font-bold text-gray-900 mb-2 leading-tight">
                  Project Name <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="projectName"
                  value={formData.projectName || ''}
                  onChange={handleChange}
                  required
                  placeholder="Enter project name"
                  className="w-full px-4 py-3 text-base font-medium text-gray-900 bg-white border-2 border-gray-400 rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-300 focus:border-blue-600 transition-all placeholder:text-gray-500 placeholder:font-normal"
                />
              </div>
              <div>
                <label className="block text-base font-bold text-gray-900 mb-2 leading-tight">
                  Status <span className="text-red-600 font-bold">*</span>
                </label>
                <select
                  name="status"
                  value={formData.status || 'planning'}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 text-base font-medium text-gray-900 bg-white border-2 border-gray-400 rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-300 focus:border-blue-600 transition-all cursor-pointer"
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-base font-bold text-gray-900 mb-2 leading-tight">Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location || ''}
                  onChange={handleChange}
                  placeholder="Enter project location"
                  className="w-full px-4 py-3 text-base font-medium text-gray-900 bg-white border-2 border-gray-400 rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-300 focus:border-blue-600 transition-all placeholder:text-gray-500 placeholder:font-normal"
                />
              </div>
              <div>
                <label className="block text-base font-bold text-gray-900 mb-2 leading-tight">Client</label>
                <input
                  type="text"
                  name="client"
                  value={formData.client || ''}
                  onChange={handleChange}
                  placeholder="Enter client name"
                  className="w-full px-4 py-3 text-base font-medium text-gray-900 bg-white border-2 border-gray-400 rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-300 focus:border-blue-600 transition-all placeholder:text-gray-500 placeholder:font-normal"
                />
              </div>
              <div>
                <label className="block text-base font-bold text-gray-900 mb-2 leading-tight">Start Date</label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 text-base font-medium text-gray-900 bg-white border-2 border-gray-400 rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-300 focus:border-blue-600 transition-all cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-base font-bold text-gray-900 mb-2 leading-tight">Planned End Date</label>
                <input
                  type="date"
                  name="plannedEndDate"
                  value={formData.plannedEndDate || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 text-base font-medium text-gray-900 bg-white border-2 border-gray-400 rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-300 focus:border-blue-600 transition-all cursor-pointer"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-base font-bold text-gray-900 mb-2 leading-tight">Description</label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Enter project description"
                  className="w-full px-4 py-3 text-base font-medium text-gray-900 bg-white border-2 border-gray-400 rounded-lg shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-300 focus:border-blue-600 transition-all resize-y placeholder:text-gray-500 placeholder:font-normal"
                />
              </div>
            </div>

            <div className="pt-6 border-t-2 border-gray-300">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Budget Information</h3>
              <EnhancedBudgetInput
                value={formData.budget}
                onChange={handleBudgetChange}
                showAdvanced={true}
              />
            </div>
          </div>
        </form>
      </EditModal>

      {/* Archive/Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => !deleting && !archiving && setShowDeleteModal(false)}
        onArchive={handleArchiveConfirm}
        onDelete={handleDeleteConfirm}
        title={project?.status === 'archived' ? 'Delete Project Permanently' : 'Archive or Delete Project'}
        message={
          project ? (
            <>
              <p className="mb-3">
                {project.status === 'archived' ? (
                  <>
                    Are you sure you want to permanently delete <strong>"{project.projectName}"</strong>?
                    <br />
                    <span className="text-red-600 font-medium">This action cannot be undone.</span>
                  </>
                ) : (
                  <>
                    What would you like to do with <strong>"{project.projectName}"</strong>?
                  </>
                )}
              </p>
              {project.status !== 'archived' && (
                <>
                  <p className="mb-2 font-medium">Permanent deletion will:</p>
                  <ul className="list-disc list-inside mb-3 space-y-1 text-gray-600">
                    <li>Remove all investor allocations</li>
                    <li>Permanently delete all materials, expenses, and initial expenses</li>
                    <li>Delete all floors</li>
                    <li>Recalculate finances for affected projects</li>
                    {financialData && financialData.capitalBalance > 0 && (
                      <li>Return unused capital to investors</li>
                    )}
                  </ul>
                </>
              )}
            </>
          ) : (
            'Are you sure you want to proceed?'
          )
        }
        archiveLabel="Archive"
        deleteLabel="Delete Permanently"
        cancelText="Cancel"
        variant={project?.status === 'archived' ? 'danger' : 'both'}
        isArchiving={archiving}
        isDeleting={deleting}
        showRecommendation={project?.status !== 'archived' && financialData && financialData.totalUsed > 0}
        financialImpact={financialData}
        dependencies={dependencies}
      />

      {/* Restore Modal */}
      <RestoreModal
        isOpen={showRestoreModal}
        onClose={() => !restoring && setShowRestoreModal(false)}
        onRestore={handleRestoreConfirm}
        title="Restore Project"
        message="Are you sure you want to restore this project? All dependencies will be restored as well."
        itemName={project?.projectName}
        isLoading={restoring}
      />
    </AppLayout>
  );
}

