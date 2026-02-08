/**
 * Initial Expenses List Page
 * Displays all initial expenses with filtering, sorting, and pagination
 * 
 * Route: /initial-expenses
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';
import { NoProjectsEmptyState } from '@/components/empty-states';

function InitialExpensesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const {
    currentProject,
    currentProjectId,
    accessibleProjects,
    loading: projectLoading,
    isEmpty,
    switchProject,
  } = useProjectContext();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [totals, setTotals] = useState({ totalAmount: 0, approvedAmount: 0 });
  
  // Get projectId from context (prioritize current project over URL param)
  const projectIdFromContext = normalizeProjectId(currentProject?._id) || currentProjectId || '';
  const projectIdFromUrl = searchParams.get('projectId');
  
  // Filters
  const [filters, setFilters] = useState({
    projectId: projectIdFromContext || projectIdFromUrl || '',
    category: searchParams.get('category') || '',
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
  });

  useEffect(() => {
    if (projectIdFromContext && projectIdFromContext !== filters.projectId) {
      setFilters((prev) => ({ ...prev, projectId: projectIdFromContext }));
    }
  }, [projectIdFromContext, filters.projectId]);

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query string
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.category && { category: filters.category }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });

      const response = await fetch(`/api/initial-expenses?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch initial expenses');
      }

      setExpenses(data.data.expenses || []);
      setPagination(prev => {
        const newPagination = data.data.pagination || prev;
        // Only update if values actually changed
        if (prev.page === newPagination.page && 
            prev.limit === newPagination.limit && 
            prev.total === newPagination.total && 
            prev.pages === newPagination.pages) {
          return prev; // Return same reference to prevent re-render
        }
        return newPagination;
      });
      setTotals(prev => {
        const newTotals = data.data.totals || prev;
        // Only update if values actually changed
        if (prev.totalAmount === newTotals.totalAmount && 
            prev.totalCost === newTotals.totalCost) {
          return prev; // Return same reference to prevent re-render
        }
        return newTotals;
      });
    } catch (err) {
      setError(err.message);
      console.error('Fetch initial expenses error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters.projectId, filters.category, filters.status, filters.search, filters.startDate, filters.endDate, pagination.page, pagination.limit]);

  // Fetch expenses
  useEffect(() => {
    if (isEmpty) {
      setLoading(false);
      setExpenses([]);
      return;
    }
    if (!filters.projectId) {
      if (projectLoading) return;
      setLoading(false);
      setExpenses([]);
      return;
    }
    fetchExpenses();
  }, [fetchExpenses, isEmpty, projectLoading, filters.projectId]);

  const handleFilterChange = (key, value) => {
    let updatedFilters = { ...filters, [key]: value };
    if (key === 'projectId') {
      updatedFilters = { ...filters, projectId: value };
      if (value && value !== currentProjectId) {
        switchProject(value).catch((err) => {
          console.error('Error switching project:', err);
        });
      }
    }
    setFilters(updatedFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      deleted: 'bg-gray-200 text-gray-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount, currency = 'KES') => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const initialExpenseCategories = [
    'land',
    'transfer_fees',
    'county_fees',
    'permits',
    'approvals',
    'boreholes',
    'electricity',
    'other',
  ];

  const categoryLabels = {
    land: 'Land Purchase',
    transfer_fees: 'Transfer Fees',
    county_fees: 'County Fees',
    permits: 'Permits',
    approvals: 'Approvals',
    boreholes: 'Boreholes',
    electricity: 'Electricity',
    other: 'Other',
  };

  if (isEmpty && !loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Initial Expenses</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Track pre-construction expenses (land, permits, approvals, etc.)</p>
          </div>
          <NoProjectsEmptyState
            canCreate={canAccess('create_project')}
            role={canAccess('create_project') ? 'owner' : 'site_clerk'}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Initial Expenses</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Track pre-construction expenses (land, permits, approvals, etc.)</p>
          </div>
          {canAccess('create_initial_expense') && (
            <Link
              href="/initial-expenses/new"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
            >
              + Add Initial Expense
            </Link>
          )}
        </div>

        <PrerequisiteGuide
          title="Initial expenses are tied to projects"
          description="Record pre-construction costs once the project is created."
          prerequisites={[
            'Project exists',
            'Budget categories are defined',
          ]}
          actions={[
            { href: '/projects/new', label: 'Create Project' },
            { href: '/projects', label: 'Set Budgets' },
            { href: '/initial-expenses/new', label: 'Add Initial Expense' },
          ]}
          tip="Keep receipts ready for approvals."
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Total Initial Expenses</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.totalAmount)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Approved Amount</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.approvedAmount)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Total Records</p>
            <p className="text-2xl font-bold text-gray-900">{pagination.total}</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Project</label>
              <select
                value={filters.projectId}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              >
                <option value="">All Projects</option>
                {accessibleProjects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              >
                <option value="">All Categories</option>
                {initialExpenseCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryLabels[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Search</label>
              <input
                type="text"
                placeholder="Search..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <LoadingTable rows={10} columns={7} showHeader={true} />
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No initial expenses found.
              {canAccess('create_initial_expense') && (
                <Link href="/initial-expenses/new" className="text-blue-600 hover:underline"> Create one</Link>
              )}
            </div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Item Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Date Paid
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {expenses.map((expense) => (
                    <tr key={expense._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <Link
                          href={`/initial-expenses/${expense._id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {expense.expenseCode}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {expense.itemName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {categoryLabels[expense.category] || expense.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(expense.datePaid)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeColor(expense.status)}`}>
                          {expense.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/initial-expenses/${expense._id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    Showing page {pagination.page} of {pagination.pages} ({pagination.total} total)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                      disabled={pagination.page === pagination.pages}
                      className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function InitialExpensesPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading initial expenses...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <InitialExpensesPageContent />
    </Suspense>
  );
}

