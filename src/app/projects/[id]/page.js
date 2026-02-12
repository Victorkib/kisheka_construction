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
import { BaseModal, ConfirmationModal, EditModal, RestoreModal } from '@/components/modals';
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
import { CostManagementSummary } from '@/components/budget/CostManagementSummary';
import { EnhancedBudgetInput } from '@/components/budget/EnhancedBudgetInput';
import { BudgetVisualization } from '@/components/budget/BudgetVisualization';
import { useProjectContext } from '@/contexts/ProjectContext';
import { DomainTile } from '@/components/projects/DomainTile';
import { CoreKPICard } from '@/components/projects/CoreKPICard';
import { ProjectHealthStrip } from '@/components/projects/ProjectHealthStrip';
import { CollapsibleFinancialSnapshot } from '@/components/projects/CollapsibleFinancialSnapshot';
import { useProjectDomainSummaries } from '@/hooks/use-project-domain-summaries';
import { getBudgetStatus as getBudgetStatusHelper, getCapitalStatus as getCapitalStatusHelper } from '@/lib/financial-status-helpers';

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
      const response = await fetch(`/api/phases?projectId=${projectId}&includeFinancials=true`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
      const response = await fetch(`/api/projects/${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
      const response = await fetch(`/api/reports/budget-variance?projectId=${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
        {(() => {
          const { getBudgetStatus, formatPercentage, safePercentage } = require('@/lib/financial-status-helpers');
          const totalStatus = getBudgetStatus(budgetData.budget.total, budgetData.actual.total);
          const utilizationPercent = safePercentage(budgetData.actual.total, budgetData.budget.total);
          
          if (totalStatus.isOptional) {
            return (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800 font-medium mb-1">Budget Not Set</p>
                <p className="text-xs text-blue-700">{totalStatus.message}</p>
                <p className="text-xs text-blue-600 mt-2">Current Spending: {formatCurrency(budgetData.actual.total)}</p>
              </div>
            );
          }
          
          return (
            <>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Budget Utilization</span>
                <span className={`text-sm font-medium ${getVarianceColor(budgetData.variance.totalPercentage !== null ? budgetData.variance.totalPercentage : 0)}`}>
                  {formatPercentage(utilizationPercent, 'N/A')} used
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    totalStatus.status === 'over_budget'
                      ? 'bg-red-500'
                      : totalStatus.status === 'at_risk'
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{
                    width: `${utilizationPercent !== null ? Math.min(100, Math.max(0, utilizationPercent)) : 0}%`,
                  }}
                ></div>
              </div>
            </>
          );
        })()}
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
      const response = await fetch(`/api/expenses?projectId=${projectId}&limit=10`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
      const response = await fetch(`/api/initial-expenses?projectId=${projectId}&limit=5`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
            href={`/projects/${projectId}/budget`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Budget Management →
          </Link>
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
            <Link
              href={`/investors?projectId=${projectId}`}
              className="mt-2 inline-block text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Manage Capital →
            </Link>
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
      const response = await fetch(`/api/projects/${projectId}/progress`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
  const { 
    accessibleProjects, 
    refreshAccessibleProjects, 
    clearProject, 
    switchProject,
    isEmpty: hasNoProjects 
  } = useProjectContext();

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
  const [impactLoaded, setImpactLoaded] = useState(false);
  const [dependencies, setDependencies] = useState(null);
  const [floors, setFloors] = useState([]);
  const [floorsLoading, setFloorsLoading] = useState(true);
  const [initializingFloors, setInitializingFloors] = useState(false);
  const [showFloorInitModal, setShowFloorInitModal] = useState(false);
  const [floorInitError, setFloorInitError] = useState('');
  const [floorInitForm, setFloorInitForm] = useState({
    floorCount: 10,
    includeBasements: false,
    basementCount: 0,
  });

  // Domain summaries for tiles
  const { summaries: domainSummaries, loading: summariesLoading } = useProjectDomainSummaries(projectId);

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
    reallocatePhases: false, // Phase 2: Flag to rescale phase budgets when DCC changes
  });

  // Track page view
  useTrackPageView('project', async (id) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
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
      fetchFloors();
    } else {
      setError('Invalid project ID');
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId && canDelete) {
      fetchFinancialData();
    }
  }, [projectId, canDelete]);

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

      const response = await fetch(`/api/projects/${projectId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        // If project not found (404), it might have been deleted
        // Clear stale data and redirect to projects list
        if (data.error?.includes('not found') || response.status === 404) {
          clearProject();
          try {
            localStorage.removeItem('currentProjectId');
          } catch (storageError) {
            console.error('Error clearing localStorage:', storageError);
          }
          // Refresh accessible projects and navigate
          await refreshAccessibleProjects();
          const freshProjectsResponse = await fetch('/api/projects/accessible', {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
          });
          const freshProjectsData = await freshProjectsResponse.json();
          const availableProjects = freshProjectsData.success ? (freshProjectsData.data || []) : [];
          
          if (availableProjects.length > 0) {
            // Switch to first available project
            const nextProject = availableProjects[0];
            const nextProjectId = nextProject._id?.toString() || nextProject._id;
            try {
              await switchProject(nextProjectId, true);
              router.push(`/projects/${nextProjectId}`);
            } catch (switchError) {
              router.push('/projects');
            }
          } else {
            router.push('/projects');
          }
          return;
        }
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

  const fetchFloors = async () => {
    if (!projectId) {
      setFloors([]);
      setFloorsLoading(false);
      return;
    }
    try {
      setFloorsLoading(true);
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
      } else {
        setFloors([]);
      }
    } catch (err) {
      console.error('Fetch floors error:', err);
      setFloors([]);
    } finally {
      setFloorsLoading(false);
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
        reallocatePhases: false, // Phase 2: Flag to rescale phase budgets when DCC changes
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
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
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
          reallocatePhases: formData.reallocatePhases || false, // Phase 2: Include reallocation flag
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
      setImpactLoaded(false);

      const response = await fetch(`/api/projects/${projectId}/dependencies`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (data.success && data.data) {
        const { finances, dependencies: dependencyMap, investorAllocations } = data.data;

        setFinancialData({
          totalUsed: finances?.totalUsed || 0,
          totalInvested: finances?.totalInvested || 0,
          capitalBalance: finances?.capitalBalance || 0,
        });

        setDependencies({
          ...(dependencyMap || {}),
          investorAllocations: investorAllocations || dependencyMap?.investorAllocations || 0,
        });
      } else {
        setDependencies(null);
      }
    } catch (err) {
      console.error('Error fetching financial/dependency data:', err);
      setDependencies(null);
    } finally {
      setFetchingFinancialData(false);
      setImpactLoaded(true);
    }
  };

  const handleInitializeFloors = () => {
    setFloorInitError('');
    setFloorInitForm((prev) => ({
      floorCount: typeof prev.floorCount === 'number' ? prev.floorCount : 10,
      includeBasements: !!prev.includeBasements,
      basementCount: typeof prev.basementCount === 'number' ? prev.basementCount : 0,
    }));
    setShowFloorInitModal(true);
  };

  const handleFloorInitChange = (field, value) => {
    setFloorInitError('');
    setFloorInitForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitFloorInit = async () => {
    if (!projectId) {
      toast.showError('Invalid project ID');
      return;
    }

    const floorCount = parseInt(floorInitForm.floorCount, 10);
    const basementCount = parseInt(floorInitForm.basementCount, 10);
    const includeBasements = !!floorInitForm.includeBasements;

    if (isNaN(floorCount) || floorCount < 0 || floorCount > 50) {
      setFloorInitError('Floor count must be a number between 0 and 50.');
      return;
    }

    if (includeBasements && (isNaN(basementCount) || basementCount < 0 || basementCount > 10)) {
      setFloorInitError('Basement count must be a number between 0 and 10.');
      return;
    }

    if (floorCount === 0 && (!includeBasements || basementCount === 0)) {
      setFloorInitError('Please add at least one floor or basement.');
      return;
    }

    try {
      setInitializingFloors(true);
      const response = await fetch(`/api/projects/${projectId}/floors/initialize`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          floorCount,
          includeBasements,
          basementCount,
        }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to initialize floors');
      }

      toast.showSuccess(`Successfully initialized ${data.data.count} floors`);
      setShowFloorInitModal(false);
      await fetchFloors();
    } catch (err) {
      const message = err.message || 'Failed to initialize floors';
      setFloorInitError(message);
      toast.showError(message);
      console.error('Initialize floors error:', err);
    } finally {
      setInitializingFloors(false);
    }
  };

  const handleArchiveClick = () => {
    setShowDeleteModal(true);
    if (!fetchingFinancialData) {
      fetchFinancialData();
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
    if (!fetchingFinancialData) {
      fetchFinancialData();
    }
  };

  const handleArchiveConfirm = async () => {
    setArchiving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/archive`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
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
      const deleteUrl = project?.status === 'archived'
        ? `/api/projects/${projectId}?force=true`
        : `/api/projects/${projectId}`;
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        const errorMessage = typeof data.error === 'string'
          ? data.error
          : data.error?.message || 'Failed to delete project';
        throw new Error(errorMessage);
      }

      toast.showSuccess(data.message || 'Project permanently deleted successfully!');
      setShowDeleteModal(false);
      
      // CRITICAL: Clean up stale data and handle navigation
      // 1. Clear current project from context (if it's the deleted one)
      clearProject();
      
      // 2. Clear localStorage
      try {
        localStorage.removeItem('currentProjectId');
      } catch (storageError) {
        console.error('Error clearing localStorage:', storageError);
      }
      
      // 3. Refresh accessible projects list
      await refreshAccessibleProjects();
      
      // 4. Wait a moment for context to update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 5. Handle navigation based on available projects
      // Get fresh accessible projects after refresh
      const freshProjectsResponse = await fetch('/api/projects/accessible', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const freshProjectsData = await freshProjectsResponse.json();
      const availableProjects = freshProjectsData.success ? (freshProjectsData.data || []) : [];
      
      if (availableProjects.length === 0) {
        // No projects available - navigate to projects list (empty state)
        router.push('/projects');
      } else {
        // Select next available project
        const nextProject = availableProjects[0]; // Use first available project
        const nextProjectId = nextProject._id?.toString() || nextProject._id;
        
        try {
          // Switch to next project
          await switchProject(nextProjectId, true);
          // Navigate to the new project's detail page
          router.push(`/projects/${nextProjectId}`);
        } catch (switchError) {
          console.error('Error switching to next project:', switchError);
          // If switch fails, just go to projects list
          router.push('/projects');
        }
      }
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
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border border-slate-700/60 overflow-hidden">
            {/* Top bar with icon and text */}
            <div className="px-6 sm:px-8 py-5 border-b border-slate-700/60 flex items-center gap-4">
              <div className="relative">
                <div className="h-11 w-11 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/40">
                  {/* Hard hat icon */}
                  <svg
                    className="h-6 w-6 text-slate-900"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 15v2a2 2 0 002 2h12a2 2 0 002-2v-2M4 15a8 8 0 0116 0M4 15h16"
                    />
                  </svg>
                </div>
                {/* Small pulsing dot */}
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-300 tracking-wide uppercase">
                  Preparing Project Site
                </p>
                <p className="text-xs sm:text-sm text-slate-200/80 mt-1">
                  Loading project dashboard, finances, phases and progress — setting up your construction control room.
                </p>
              </div>
            </div>

            {/* Main skeleton content */}
            <div className="px-6 sm:px-8 py-6 space-y-6">
              {/* Simulated header (project title, meta) */}
              <div className="space-y-3">
                <div className="h-6 sm:h-7 w-2/3 bg-slate-700/60 rounded-md animate-pulse" />
                <div className="h-4 w-1/2 bg-slate-700/50 rounded-md animate-pulse" />
                <div className="flex flex-wrap gap-2 pt-1">
                  <div className="h-5 w-24 bg-slate-700/60 rounded-full animate-pulse" />
                  <div className="h-5 w-20 bg-slate-700/40 rounded-full animate-pulse" />
                  <div className="h-5 w-28 bg-slate-700/40 rounded-full animate-pulse" />
                </div>
              </div>

              {/* Three-column construction tiles (Budget, Capital, Phases) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Budget
                    </span>
                    <span className="h-2 w-8 rounded-full bg-emerald-500/70 animate-pulse" />
                  </div>
                  <div className="h-5 w-3/4 bg-slate-700/60 rounded-md animate-pulse" />
                  <div className="mt-1 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-2 w-1/2 bg-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Aligning budget structure and allocations…
                  </p>
                </div>

                <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Capital
                    </span>
                    <span className="h-2 w-8 rounded-full bg-sky-500/70 animate-pulse" />
                  </div>
                  <div className="h-5 w-2/3 bg-slate-700/60 rounded-md animate-pulse" />
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-2 w-1/3 bg-slate-800 rounded-full animate-pulse" />
                    <div className="h-2 w-1/4 bg-slate-800 rounded-full animate-pulse" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Reconciling capital raised, used and remaining…
                  </p>
                </div>

                <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      Phases & Floors
                    </span>
                    <span className="h-2 w-8 rounded-full bg-amber-400/80 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-slate-800 rounded-md animate-pulse" />
                    <div className="h-3 w-5/6 bg-slate-800 rounded-md animate-pulse" />
                    <div className="h-3 w-2/3 bg-slate-800 rounded-md animate-pulse" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Loading construction phases and floor stack overview…
                  </p>
                </div>
              </div>

              {/* Bottom progress bar like a construction timeline */}
              <div className="pt-2 border-t border-slate-700/60">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-slate-300">
                    Preparing project workspace
                  </span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Almost there…
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-1.5 w-1/3 bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400 animate-pulse" />
                </div>
              </div>
            </div>
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

  // Calculate health statuses for health strip
  const totalInvested = statistics.totalInvested || 0;
  const capitalBalance = statistics.capitalBalance || 0;
  const availableCapital = capitalBalance;
  const totalUsed = totalInvested - capitalBalance;
  
  // Budget utilization
  const budgetTotal = project.budget?.total || 0;
  const actualSpent = statistics.totalMaterialsSpent || 0;
  
  // Use financial status helpers for accurate status determination
  const budgetStatusObj = getBudgetStatusHelper(budgetTotal, actualSpent);
  const capitalStatusObj = getCapitalStatusHelper(totalInvested, totalUsed, availableCapital);
  
  const usagePercentage = capitalStatusObj.utilization !== null ? capitalStatusObj.utilization : 0;
  const budgetUtilization = budgetStatusObj.utilization !== null ? budgetStatusObj.utilization : 0;
  
  // Determine health statuses (using helper results)
  const getBudgetStatus = () => {
    return budgetStatusObj.status;
  };
  
  const getCapitalStatus = () => {
    return capitalStatusObj.status;
  };
  
  const getScheduleStatus = () => {
    // Simple check - can be enhanced with actual dates vs progress
    return 'on_track'; // Placeholder
  };
  
  // Calculate overall completion from phases (if available)
  const overallCompletion = 0; // Will be calculated from phases if needed
  
  // Health summary text
  const healthSummary = (() => {
    const parts = [];
    if (domainSummaries.phases.atRisk > 0) {
      parts.push(`${domainSummaries.phases.atRisk} phase${domainSummaries.phases.atRisk > 1 ? 's' : ''} at risk`);
    }
    if (usagePercentage > 80) {
      parts.push(`Capital utilization at ${usagePercentage.toFixed(0)}%`);
    }
    if (budgetUtilization > 80) {
      parts.push(`Budget utilization at ${budgetUtilization.toFixed(0)}%`);
    }
    if (parts.length === 0) {
      return 'All systems operational';
    }
    return parts.join(' • ');
  })();

  // Calculate budget variance percentage
  const budgetVariance = budgetTotal > 0 
    ? ((budgetTotal - actualSpent) / budgetTotal) * 100 
    : 0;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <Breadcrumbs 
            items={[
              { label: 'Projects', href: '/projects' },
              { label: project.projectName || 'Project', href: `/projects/${projectId}`, current: true },
            ]}
          />
        </div>

        {/* Header Band */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                  {project.projectName}
                </h1>
                {project.status === 'archived' && <ArchiveBadge />}
                {statistics && (() => {
                  let statusColor = 'bg-green-100 text-green-800';
                  let statusText = 'Capital OK';
                  
                  // Use capital status helper for accurate status
                  if (capitalStatusObj.status === 'not_set') {
                    statusColor = 'bg-blue-100 text-blue-800';
                    statusText = 'Capital Not Set';
                  } else if (capitalStatusObj.status === 'overspent') {
                    statusColor = 'bg-red-100 text-red-800';
                    statusText = 'Overspent';
                  } else if (capitalStatusObj.status === 'low') {
                    statusColor = 'bg-yellow-100 text-yellow-800';
                    statusText = 'Low Capital';
                  }
                  
                  return (
                    <span 
                      className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusColor}`} 
                      title={`Capital: ${formatCurrency(totalInvested)}, Available: ${formatCurrency(availableCapital)}`}
                    >
                      💰 {statusText}
                    </span>
                  );
                })()}
              </div>
              <p className="text-gray-600 mt-1">
                {project.projectCode} {project.location && `• ${project.location}`}
                {project.client && ` • ${project.client}`}
              </p>
              {(project.startDate || project.plannedEndDate) && (
                <p className="text-sm text-gray-500 mt-1">
                  {project.startDate && formatDate(project.startDate)}
                  {project.startDate && project.plannedEndDate && ' - '}
                  {project.plannedEndDate && formatDate(project.plannedEndDate)}
                </p>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {canEdit && project.status !== 'archived' && (
                <>
                  <button
                    onClick={handleEditClick}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                  >
                    Edit Project
                  </button>
                  <Link
                    href={`/projects/${projectId}/costs`}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                  >
                    Cost Management
                  </Link>
                  <Link
                    href={`/projects/${projectId}/budget`}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm font-medium"
                  >
                    Budget Management
                  </Link>
                  <Link
                    href={`/projects/${projectId}/finances`}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                  >
                    Financial Overview
                  </Link>
                </>
              )}
              {canDelete && project.status !== 'archived' && (
                <>
                  <button
                    onClick={handleArchiveClick}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm font-medium"
                  >
                    Archive
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
                  >
                    Delete
                  </button>
                </>
              )}
              {canDelete && project.status === 'archived' && (
                <>
                  <button
                    onClick={handleRestoreClick}
                    disabled={restoring}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm font-medium"
                  >
                    {restoring ? 'Restoring...' : 'Restore'}
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 text-sm font-medium"
                  >
                    {deleting ? 'Deleting...' : 'Delete Permanently'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Core KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <CoreKPICard
            title="Budget"
            primaryValue={formatCurrency(budgetTotal)}
            secondaryValue={`Remaining: ${formatCurrency(statistics.budgetRemaining || budgetTotal)}`}
            progress={budgetUtilization}
            progressColor={budgetUtilization > 100 ? 'red' : budgetUtilization > 80 ? 'yellow' : 'green'}
            icon="💰"
          />
          <CoreKPICard
            title="Capital"
            primaryValue={formatCurrency(totalInvested)}
            secondaryValue={`Balance: ${formatCurrency(capitalBalance)}`}
            progress={usagePercentage}
            progressColor={usagePercentage > 90 ? 'red' : usagePercentage > 80 ? 'yellow' : 'green'}
            icon="💵"
          />
          <CoreKPICard
            title="Progress"
            primaryValue={`${overallCompletion}%`}
            secondaryValue="Overall completion"
            progress={overallCompletion}
            icon="📊"
          />
          <CoreKPICard
            title="Scope"
            primaryValue={`${domainSummaries.phases.count} phases`}
            secondaryValue={`${domainSummaries.floors.count} floors`}
            icon="🏗️"
          />
        </div>

        {/* Project Health Strip */}
        <div className="mb-6">
          <ProjectHealthStrip
            statuses={[
              { label: 'Budget', status: getBudgetStatus() },
              { label: 'Capital', status: getCapitalStatus() },
              { label: 'Schedule', status: getScheduleStatus() },
            ]}
            summary={healthSummary}
            link={`/projects/${projectId}/health`}
            projectId={projectId}
          />
        </div>

        {/* Domain Tiles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <DomainTile
            icon="🏗️"
            title="Phases"
            metrics={[
              { label: 'Total', value: `${domainSummaries.phases.count} phases` },
              { label: 'At Risk', value: `${domainSummaries.phases.atRisk} phases` },
              { label: 'Allocated', value: formatCurrency(domainSummaries.phases.allocated) },
            ]}
            link={`/phases?projectId=${projectId}`}
          />
          
          <DomainTile
            icon="🏢"
            title="Floors"
            metrics={[
              { label: 'Total', value: `${domainSummaries.floors.count} floors` },
              { label: 'Completed', value: `${domainSummaries.floors.completed} floors` },
              { label: 'In Progress', value: `${domainSummaries.floors.inProgress} floors` },
            ]}
            link={`/floors?projectId=${projectId}`}
          />
          
          <DomainTile
            icon="💰"
            title="Costs"
            metrics={[
              { label: 'Budget Variance', value: `${budgetVariance >= 0 ? '+' : ''}${budgetVariance.toFixed(1)}%` },
              { label: 'Budget Utilization', value: `${budgetUtilization.toFixed(1)}%` },
            ]}
            link={`/projects/${projectId}/costs`}
          />
          
          <DomainTile
            icon="📊"
            title="Finances"
            metrics={[
              { label: 'Capital Raised', value: formatCurrency(totalInvested) },
              { label: 'Capital Used', value: formatCurrency(totalUsed) },
              { label: 'Balance', value: formatCurrency(capitalBalance) },
            ]}
            link={`/projects/${projectId}/finances`}
          />
          
          <DomainTile
            icon="📦"
            title="Materials"
            metrics={[
              { label: 'Items', value: `${domainSummaries.materials.count} items` },
              { label: 'Top Category', value: domainSummaries.materials.topCategory || 'N/A' },
              { label: 'Total Cost', value: formatCurrency(domainSummaries.materials.totalCost) },
            ]}
            link={`/items?projectId=${projectId}`}
          />
          
          <DomainTile
            icon="👷"
            title="Labour"
            metrics={[
              { label: 'Entries', value: `${domainSummaries.labour.count} entries` },
              { label: 'Total Hours', value: `${domainSummaries.labour.totalHours.toFixed(0)} hrs` },
              { label: 'Total Cost', value: formatCurrency(domainSummaries.labour.totalCost) },
            ]}
            link={`/labour/entries?projectId=${projectId}`}
          />
          
          <DomainTile
            icon="💳"
            title="Expenses"
            metrics={[
              { label: 'Entries', value: `${domainSummaries.expenses.count} entries` },
              { label: 'Approved/Paid', value: formatCurrency(domainSummaries.expenses.approved) },
            ]}
            link={`/expenses?projectId=${projectId}`}
          />
          
          <DomainTile
            icon="📸"
            title="Progress"
            metrics={[
              { label: 'Photos', value: `${domainSummaries.progress.photos} photos` },
              { label: 'Milestones', value: `${domainSummaries.progress.milestones} milestones` },
              { label: 'Updates', value: `${domainSummaries.progress.updates} updates` },
            ]}
            link={`/projects/${projectId}/progress`}
          />
        </div>

        {/* Optional: Collapsible Financial Snapshot */}
        <div className="mb-6">
          <CollapsibleFinancialSnapshot 
            projectId={projectId}
            budget={project.budget}
          />
        </div>

        {/* Setup & Administration (moved to bottom) */}
        <div className="space-y-6 mt-8">
          {/* Project Information (compact) */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {project.description && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-600">Description</p>
                  <p className="text-base text-gray-900 mt-1">{project.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Project Setup Checklist */}
          <ProjectSetupChecklist projectId={projectId} />

          {/* Post-Creation Setup Wizard */}
          {project && (
            <PostCreationWizard
              projectId={projectId}
              projectData={project}
              onComplete={() => {
                fetchProject();
              }}
              onDismiss={() => {
                // Wizard dismissed, continue normally
              }}
            />
          )}

          {/* Floors Setup (if no floors) */}
          {!floorsLoading && floors.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Floors</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    No floors have been created for this project yet.
                  </p>
                </div>
                {canEdit && (
                  <button
                    onClick={handleInitializeFloors}
                    disabled={initializingFloors}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    {initializingFloors ? 'Creating Floors...' : 'Auto-create Floors'}
                  </button>
                )}
              </div>
              {canEdit && (
                <p className="text-xs text-gray-500 mt-3">
                  This will create a ground floor and the number of upper floors you specify. Basements are optional.
                </p>
              )}
            </div>
          )}
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
              {/* Phase 2: Option to rescale phase budgets when DCC changes */}
              {hasBudgetChange() && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <label className="flex items-start cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.reallocatePhases || false}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          reallocatePhases: e.target.checked,
                        }));
                      }}
                      className="mt-1 mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">
                        Also reallocate phase budgets proportionally to match new DCC
                      </span>
                      <p className="text-xs text-gray-600 mt-1">
                        When enabled, all phase budgets will be scaled proportionally based on the change in Direct Construction Costs (DCC). 
                        This ensures phase budgets remain proportional to the new project budget.
                      </p>
                    </div>
                  </label>
                </div>
              )}
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
                    Choose what to do with <strong>"{project.projectName}"</strong>.
                  </>
                )}
              </p>
              {project.status !== 'archived' && (
                <p className="text-sm text-gray-600">
                  Archive keeps the project and records but hides it from active views. Delete permanently removes the project and linked data.
                </p>
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
        actionsDisabled={!impactLoaded}
        actionsDisabledReason={!impactLoaded ? 'Loading impact summary before enabling actions...' : ''}
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

      {/* Auto-create Floors Modal */}
      <BaseModal
        isOpen={showFloorInitModal}
        onClose={() => !initializingFloors && setShowFloorInitModal(false)}
        maxWidth="max-w-2xl"
        variant="indigo"
        showCloseButton={true}
        isLoading={initializingFloors}
        loadingMessage="Creating floors..."
        preventCloseDuringLoading={true}
      >
        <div className="px-8 py-6 border-b border-gray-200/50">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600/90 text-white rounded-xl p-3 shadow-lg shadow-indigo-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Auto-create Floors</h3>
              <p className="text-sm text-gray-600">
                Generate a default floor stack for this project.
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {floorInitError && (
            <div className="bg-red-50/80 border border-red-200/70 text-red-700 px-4 py-3 rounded-xl">
              {floorInitError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Number of Floors
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={floorInitForm.floorCount}
                onChange={(e) => handleFloorInitChange('floorCount', e.target.value)}
                className="w-full px-4 py-3 bg-white/80 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              />
              <p className="text-xs text-gray-500 mt-2">
                Includes ground floor. Range: 0-50.
              </p>
            </div>

            <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/70 border border-indigo-200/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Include Basements</p>
                  <p className="text-xs text-gray-600">Optional underground floors</p>
                </div>
                <input
                  type="checkbox"
                  checked={floorInitForm.includeBasements}
                  onChange={(e) => handleFloorInitChange('includeBasements', e.target.checked)}
                  className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
              </div>
              {floorInitForm.includeBasements && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Basement Count
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={floorInitForm.basementCount}
                    onChange={(e) => handleFloorInitChange('basementCount', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/90 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                  <p className="text-xs text-gray-500 mt-2">Range: 0-10.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-8 py-6 border-t border-gray-200/50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 bg-gradient-to-br from-gray-50/60 to-transparent">
          <button
            type="button"
            onClick={() => setShowFloorInitModal(false)}
            disabled={initializingFloors}
            className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-gray-700 bg-white/70 backdrop-blur-sm border border-gray-300/50 rounded-xl hover:bg-white/90 hover:border-gray-400/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmitFloorInit}
            disabled={initializingFloors}
            className="relative w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl hover:from-indigo-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40"
          >
            {initializingFloors ? 'Creating Floors...' : 'Create Floors'}
          </button>
        </div>
      </BaseModal>
    </AppLayout>
  );
}

