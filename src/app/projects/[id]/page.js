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

  useEffect(() => {
    fetchFinances();
  }, [projectId]);

  const fetchFinances = async () => {
    try {
      const response = await fetch(`/api/project-finances?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setFinances(data.data);
      }
    } catch (err) {
      console.error('Fetch project finances error:', err);
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
        <h2 className="text-lg font-semibold text-gray-900">Project Finances</h2>
        <div className="flex gap-2">
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
        budget: {
          total: project.budget?.total || 0,
          materials: project.budget?.materials || 0,
          labour: project.budget?.labour || 0,
          contingency: project.budget?.contingency || 0,
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
    return (
      formData.projectName !== originalFormData.projectName ||
      formData.description !== originalFormData.description ||
      formData.location !== originalFormData.location ||
      formData.client !== originalFormData.client ||
      formData.status !== originalFormData.status ||
      formData.startDate !== originalFormData.startDate ||
      formData.plannedEndDate !== originalFormData.plannedEndDate ||
      formData.budget.total !== originalFormData.budget.total ||
      formData.budget.materials !== originalFormData.budget.materials ||
      formData.budget.labour !== originalFormData.budget.labour ||
      formData.budget.contingency !== originalFormData.budget.contingency
    );
  };

  const hasBudgetChange = () => {
    return originalFormData && (
      formData.budget.total !== originalFormData.budget.total ||
      formData.budget.materials !== originalFormData.budget.materials ||
      formData.budget.labour !== originalFormData.budget.labour ||
      formData.budget.contingency !== originalFormData.budget.contingency
    );
  };

  const validateForm = () => {
    if (!formData.projectName?.trim()) {
      toast.showError('Project name is required');
      return false;
    }
    if (formData.budget.total < 0) {
      toast.showError('Total budget cannot be negative');
      return false;
    }
    if (formData.budget.materials < 0 || formData.budget.labour < 0 || formData.budget.contingency < 0) {
      toast.showError('Budget values cannot be negative');
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
          <Link
            href="/projects"
            className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block"
          >
            ← Back to Projects
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">{project.projectName}</h1>
                {project.status === 'archived' && <ArchiveBadge />}
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
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Budget Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Budget</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {formatCurrency(project.budget?.total || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Materials</p>
              <p className="text-xl font-bold text-blue-600 mt-1">
                {formatCurrency(project.budget?.materials || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Labour</p>
              <p className="text-xl font-bold text-green-600 mt-1">
                {formatCurrency(project.budget?.labour || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Contingency</p>
              <p className="text-xl font-bold text-purple-600 mt-1">
                {formatCurrency(project.budget?.contingency || 0)}
              </p>
            </div>
          </div>
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="projectName"
                  value={formData.projectName || ''}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="status"
                  value={formData.status || 'planning'}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                <input
                  type="text"
                  name="client"
                  value={formData.client || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Planned End Date</label>
                <input
                  type="date"
                  name="plannedEndDate"
                  value={formData.plannedEndDate || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Budget</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="budget.total"
                    value={formData.budget?.total || 0}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Materials</label>
                  <input
                    type="number"
                    name="budget.materials"
                    value={formData.budget?.materials || 0}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Labour</label>
                  <input
                    type="number"
                    name="budget.labour"
                    value={formData.budget?.labour || 0}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contingency</label>
                  <input
                    type="number"
                    name="budget.contingency"
                    value={formData.budget?.contingency || 0}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
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

