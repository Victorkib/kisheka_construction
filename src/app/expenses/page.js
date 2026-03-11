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
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';
import { fetchNoCache } from '@/lib/fetch-helpers';

function ExpensesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const { currentProject, currentProjectId, loading: projectLoading, isEmpty } = useProjectContext();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  
  // Get projectId from context (prioritize current project over URL param)
  const projectIdFromContext = normalizeProjectId(currentProject?._id) || currentProjectId || '';
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
        return { ...prev, projectId: projectIdFromContext, phaseId: '' };
      });
    }
  }, [projectIdFromContext, activeProjectId]);

  useEffect(() => {
    if (!filters.projectId) {
      setPhases([]);
      return;
    }
    fetchAllPhases(filters.projectId);
  }, [filters.projectId]);

  // Fetch expenses when filters or pagination changes
  useEffect(() => {
    // Don't fetch if empty state
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

        const response = await fetchNoCache(`/api/expenses?${queryParams}`);
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
  }, [isEmpty, projectLoading, filters.projectId, filters.category, filters.phaseId, filters.status, filters.vendor, filters.search, filters.startDate, filters.endDate, filters.isIndirectCost, pagination.page, pagination.limit]);

  const fetchAllPhases = async (projectId) => {
    if (!projectId) {
      setPhases([]);
      return;
    }
    setLoadingPhases(true);
    try {
      const response = await fetchNoCache(`/api/phases?projectId=${projectId}`);
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
      ARCHIVED: 'ds-bg-surface-muted ds-text-secondary',
    };
    return colors[status] || 'ds-bg-surface-muted ds-text-primary';
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
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">Expenses</h1>
            <p className="text-sm sm:text-base md:text-lg ds-text-secondary mt-2 leading-relaxed">Track and manage project expenses</p>
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
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">Expenses</h1>
            <p className="text-sm sm:text-base md:text-lg ds-text-secondary mt-2 leading-relaxed">Track and manage project expenses</p>
          </div>
          {canAccess('create_expense') && (
            <Link
              href="/expenses/new"
              className="ds-bg-accent-primary hover:bg-blue-700 active:bg-blue-800 text-white font-medium px-4 sm:px-6 py-2.5 rounded-lg transition-colors touch-manipulation text-sm sm:text-base"
            >
              + Add Expense
            </Link>
          )}
        </div>

        <PrerequisiteGuide
          title="Expenses track services and overhead"
          description="Record expenses after projects and budgets are set."
          prerequisites={[
            'Project exists',
            'Budget categories are defined',
          ]}
          actions={[
            { href: '/projects/new', label: 'Create Project' },
            { href: '/projects', label: 'Set Budgets' },
            { href: '/expenses/new', label: 'Add Expense' },
          ]}
          tip="Use categories to keep reporting clean."
        />

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6 mb-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-4 leading-tight ds-text-primary">Filters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">Search</label>
              <input
                type="text"
                placeholder="Search expenses..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted"
              />
            </div>

            <div>
              <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted"
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
              <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">Phase</label>
              <select
                value={filters.phaseId}
                onChange={(e) => handleFilterChange('phaseId', e.target.value)}
                disabled={loadingPhases}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted disabled:opacity-50"
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
              <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="PAID">Paid</option>
              </select>
            </div>

            <div>
              <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">Cost Type</label>
              <select
                value={filters.isIndirectCost}
                onChange={(e) => handleFilterChange('isIndirectCost', e.target.value)}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted"
              >
                <option value="">All Costs</option>
                <option value="true">Indirect Costs</option>
                <option value="false">Direct Costs</option>
              </select>
            </div>

            <div>
              <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">Vendor</label>
              <input
                type="text"
                placeholder="Filter by vendor..."
                value={filters.vendor}
                onChange={(e) => handleFilterChange('vendor', e.target.value)}
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted"
              />
            </div>

            <div>
              <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">Start Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 pr-12 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted cursor-pointer"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    const input = e.target.closest('.relative').querySelector('input[type="date"]');
                    if (input) {
                      input.showPicker?.();
                      input.focus();
                    }
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-auto cursor-pointer hover:ds-bg-surface-muted rounded-r-lg transition-colors"
                  aria-label="Open date picker"
                  tabIndex={-1}
                >
                  <svg className="w-5 h-5 ds-text-secondary hover:ds-text-accent-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-base font-semibold ds-text-secondary mb-1 leading-normal">End Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 pr-12 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted cursor-pointer"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    const input = e.target.closest('.relative').querySelector('input[type="date"]');
                    if (input) {
                      input.showPicker?.();
                      input.focus();
                    }
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-auto cursor-pointer hover:ds-bg-surface-muted rounded-r-lg transition-colors"
                  aria-label="Open date picker"
                  tabIndex={-1}
                >
                  <svg className="w-5 h-5 ds-text-secondary hover:ds-text-accent-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        {loading ? (
          <div className="ds-bg-surface rounded-lg shadow overflow-hidden">
            <LoadingTable rows={10} columns={7} showHeader={true} />
          </div>
        ) : expenses.length === 0 ? (
          <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">💸</div>
            <h3 className="text-xl font-semibold ds-text-primary mb-2">No expenses found</h3>
            <p className="ds-text-secondary mb-6">
              {filters.search || filters.category || filters.status
                ? 'Try adjusting your filters'
                : 'Get started by creating your first expense'}
            </p>
            {canAccess('create_expense') && (
              <Link
                href="/expenses/new"
                className="inline-block ds-bg-accent-primary hover:bg-blue-700 active:bg-blue-800 text-white font-medium px-6 py-2.5 rounded-lg transition-colors touch-manipulation"
              >
                Create Your First Expense
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block ds-bg-surface rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-ds-border-subtle">
                  <thead className="ds-bg-surface-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Expense Code
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Vendor
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold ds-text-secondary uppercase tracking-wide leading-normal">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                    {expenses.map((expense) => (
                      <tr key={expense._id} className="hover:ds-bg-surface-muted">
                        <td className="px-6 py-4 whitespace-nowrap text-base leading-normal font-medium ds-text-primary">
                          {expense.expenseCode || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm ds-text-primary max-w-xs truncate">
                          {expense.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base leading-normal ds-text-muted">
                          <div className="flex items-center gap-2">
                            {expense.category?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                            {expense.isIndirectCost && (
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800" title="Indirect Cost">
                                Indirect
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base leading-normal ds-text-muted">
                          {expense.vendor || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base leading-normal font-semibold ds-text-primary">
                          {formatCurrency(expense.amount, expense.currency)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base leading-normal ds-text-muted">
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
                            className="ds-text-accent-primary hover:ds-text-accent-hover"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Desktop Pagination */}
              {pagination.pages > 1 && (
                <div className="ds-bg-surface-muted px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t ds-border-subtle">
                  <div className="text-sm ds-text-secondary text-center sm:text-left">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} expenses
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border ds-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:ds-bg-surface-muted active:ds-bg-surface-muted transition-colors touch-manipulation"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm ds-text-secondary flex items-center">
                      Page {pagination.page} of {pagination.pages}
                    </span>
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                      disabled={pagination.page === pagination.pages}
                      className="px-4 py-2 border ds-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:ds-bg-surface-muted active:ds-bg-surface-muted transition-colors touch-manipulation"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {expenses.map((expense) => (
                <div
                  key={expense._id}
                  className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle"
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-base font-semibold ds-text-primary truncate">
                          {expense.expenseCode || 'N/A'}
                        </p>
                        {expense.isIndirectCost && (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 flex-shrink-0" title="Indirect Cost">
                            Indirect
                          </span>
                        )}
                      </div>
                      <p className="text-sm ds-text-primary line-clamp-2">{expense.description}</p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ml-2 ${getStatusBadgeColor(
                        expense.status
                      )}`}
                    >
                      {expense.status}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs ds-text-muted mb-0.5">Amount</p>
                      <p className="text-sm font-semibold ds-text-primary">
                        {formatCurrency(expense.amount, expense.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs ds-text-muted mb-0.5">Date</p>
                      <p className="text-sm ds-text-secondary">{formatDate(expense.date)}</p>
                    </div>
                    <div>
                      <p className="text-xs ds-text-muted mb-0.5">Category</p>
                      <p className="text-sm ds-text-secondary">
                        {expense.category?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs ds-text-muted mb-0.5">Vendor</p>
                      <p className="text-sm ds-text-secondary truncate">{expense.vendor || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t ds-border-subtle">
                    <Link
                      href={`/expenses/${expense._id}`}
                      className="block text-center px-4 py-2.5 bg-blue-500/10 ds-text-accent-primary text-sm font-medium rounded-lg hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors touch-manipulation border border-blue-400/60"
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              ))}

              {/* Mobile Pagination */}
              {pagination.pages > 1 && (
                <div className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle">
                  <div className="text-sm ds-text-secondary text-center mb-3">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} expenses
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page === 1}
                      className="flex-1 px-4 py-2.5 border ds-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:ds-bg-surface-muted active:ds-bg-surface-muted transition-colors touch-manipulation font-medium"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2.5 text-sm ds-text-secondary font-medium">
                      {pagination.page} / {pagination.pages}
                    </span>
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                      disabled={pagination.page === pagination.pages}
                      className="flex-1 px-4 py-2.5 border ds-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:ds-bg-surface-muted active:ds-bg-surface-muted transition-colors touch-manipulation font-medium"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
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
            <p className="mt-4 ds-text-secondary">Loading expenses...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <ExpensesPageContent />
    </Suspense>
  );
}
