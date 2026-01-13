/**
 * Expenses List Page
 * Displays all expenses with filtering, sorting, and pagination
 * 
 * Route: /expenses
 */

'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingSpinner } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useProjectContext } from '@/contexts/ProjectContext';
import { normalizeProjectId } from '@/lib/utils/project-id-helpers';
import { NoProjectsEmptyState } from '@/components/empty-states';

function ExpensesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const { currentProject, isEmpty } = useProjectContext();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  
  // Get projectId from context (prioritize current project over URL param)
  const projectIdFromContext = normalizeProjectId(currentProject?._id);
  const projectIdFromUrl = searchParams.get('projectId');
  const activeProjectId = projectIdFromContext || projectIdFromUrl || '';
  
  // Filters
  const [filters, setFilters] = useState({
    projectId: activeProjectId,
    category: searchParams.get('category') || '',
    phaseId: searchParams.get('phaseId') || '',
    status: searchParams.get('status') || '',
    vendor: searchParams.get('vendor') || '',
    search: searchParams.get('search') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    isIndirectCost: searchParams.get('isIndirectCost') || '', // NEW: Filter by indirect costs
  });
  const [phases, setPhases] = useState([]);
  const [loadingPhases, setLoadingPhases] = useState(false);
  const fetchingRef = useRef(false);

  // Update filters when project changes (only if different)
  useEffect(() => {
    if (projectIdFromContext && projectIdFromContext !== activeProjectId) {
      setFilters(prev => {
        if (prev.projectId === projectIdFromContext) {
          return prev; // No change needed, return same reference
        }
        return { ...prev, projectId: projectIdFromContext };
      });
    }
  }, [projectIdFromContext, activeProjectId]);

  // Fetch expenses when filters or pagination changes
  useEffect(() => {
    // Don't fetch if empty state
    if (isEmpty) {
      setLoading(false);
      setExpenses([]);
      return;
    }

    // Prevent duplicate calls
    if (fetchingRef.current) return;
    
    const fetchData = async () => {
      fetchingRef.current = true;
      try {
        setLoading(true);
        setError(null);

        // Build query string
        const queryParams = new URLSearchParams({
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
          ...(filters.projectId && { projectId: filters.projectId }),
          ...(filters.category && { category: filters.category }),
          ...(filters.phaseId && { phaseId: filters.phaseId }),
          ...(filters.status && { status: filters.status }),
          ...(filters.vendor && { vendor: filters.vendor }),
          ...(filters.search && { search: filters.search }),
          ...(filters.startDate && { startDate: filters.startDate }),
          ...(filters.endDate && { endDate: filters.endDate }),
          ...(filters.isIndirectCost && { isIndirectCost: filters.isIndirectCost }),
        });

        const response = await fetch(`/api/expenses?${queryParams}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch expenses');
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
      } catch (err) {
        setError(err.message);
        console.error('Fetch expenses error:', err);
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    };

    fetchData();
  }, [isEmpty, filters.projectId, filters.category, filters.phaseId, filters.status, filters.vendor, filters.search, filters.startDate, filters.endDate, filters.isIndirectCost, pagination.page, pagination.limit]);

  const fetchAllPhases = async () => {
    setLoadingPhases(true);
    try {
      const response = await fetch('/api/phases');
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
    } finally {
      setLoadingPhases(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on filter change
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

  const expenseCategories = [
    'equipment_rental',
    'transport',
    'accommodation',
    'utilities',
    'safety',
    'permits',
    'training',
    'excavation',
    'earthworks',
    'construction_services',
    'other',
  ];

  // Check empty state - no projects
  if (isEmpty && !loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Expenses</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Track and manage project expenses</p>
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
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Expenses</h1>
            <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">Track and manage project expenses</p>
          </div>
          {canAccess('create_expense') && (
            <Link
              href="/expenses/new"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
            >
              + Add Expense
            </Link>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl md:text-2xl font-semibold mb-4 leading-tight text-gray-900">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Search</label>
              <input
                type="text"
                placeholder="Search expenses..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              >
                <option value="">All Categories</option>
                {expenseCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Phase</label>
              <select
                value={filters.phaseId}
                onChange={(e) => handleFilterChange('phaseId', e.target.value)}
                disabled={loadingPhases}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:opacity-50"
              >
                <option value="">All Phases</option>
                {loadingPhases ? (
                  <option>Loading phases...</option>
                ) : (
                  phases.map((phase) => (
                    <option key={phase._id} value={phase._id}>
                      {phase.name}
                    </option>
                  ))
                )}
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
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="PAID">Paid</option>
              </select>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Cost Type</label>
              <select
                value={filters.isIndirectCost}
                onChange={(e) => handleFilterChange('isIndirectCost', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              >
                <option value="">All Costs</option>
                <option value="true">Indirect Costs</option>
                <option value="false">Direct Costs</option>
              </select>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Vendor</label>
              <input
                type="text"
                placeholder="Filter by vendor..."
                value={filters.vendor}
                onChange={(e) => handleFilterChange('vendor', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
              />
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
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <LoadingTable rows={10} columns={7} showHeader={true} />
          ) : expenses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No expenses found</p>
              {canAccess('create_expense') && (
                <Link
                  href="/expenses/new"
                  className="mt-4 inline-block text-blue-600 hover:text-blue-800 font-medium"
                >
                  Create your first expense
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Expense Code
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Vendor
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide leading-normal">
                        Date
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
                        <td className="px-6 py-4 whitespace-nowrap text-base leading-normal font-medium text-gray-900">
                          {expense.expenseCode || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {expense.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base leading-normal text-gray-500">
                          <div className="flex items-center gap-2">
                            {expense.category?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                            {expense.isIndirectCost && (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800" title="Indirect Cost">
                                Indirect
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base leading-normal text-gray-500">
                          {expense.vendor || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base leading-normal font-semibold text-gray-900">
                          {formatCurrency(expense.amount, expense.currency)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base leading-normal text-gray-500">
                          {formatDate(expense.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                              expense.status
                            )}`}
                          >
                            {expense.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base leading-normal font-medium">
                          <Link
                            href={`/expenses/${expense._id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} expenses
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm text-gray-700">
                      Page {pagination.page} of {pagination.pages}
                    </span>
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
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

export default function ExpensesPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading expenses...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <ExpensesPageContent />
    </Suspense>
  );
}
