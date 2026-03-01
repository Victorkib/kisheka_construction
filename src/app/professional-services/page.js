/**
 * Professional Services (Assignments) List Page
 * Displays all professional service assignments with filtering, sorting, and pagination
 * 
 * Route: /professional-services
 */

'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingOverlay, LoadingSpinner } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ConfirmationModal } from '@/components/modals';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useProfessionalPrerequisites } from '@/hooks/use-professional-prerequisites';

const normalizeId = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return normalizeId(value[0]);
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$oid) return value.$oid;
  if (typeof value === 'object' && value._id) return normalizeId(value._id);
  return value.toString?.() || '';
};

function ProfessionalServicesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const {
    currentProjectId,
    accessibleProjects,
    loading: projectLoading,
    isEmpty,
    switchProject,
  } = useProjectContext();
  
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [projects, setProjects] = useState([]);
  
  const [filters, setFilters] = useState({
    projectId: searchParams.get('projectId') || currentProjectId || '',
    libraryId: searchParams.get('libraryId') || '',
    type: searchParams.get('type') || '',
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
    sortBy: searchParams.get('sortBy') || 'assignedDate',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  });

  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [assignmentToTerminate, setAssignmentToTerminate] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Check prerequisites for creating assignments
  const {
    canProceed: canCreateAssignment,
    prerequisites: prereqStatus,
    prerequisiteDetails,
    loading: prereqLoading,
  } = useProfessionalPrerequisites('assignments', filters.projectId || currentProjectId);

  useEffect(() => {
    setProjects(accessibleProjects || []);
  }, [accessibleProjects]);

  useEffect(() => {
    if (currentProjectId && currentProjectId !== filters.projectId) {
      setFilters((prev) => ({ ...prev, projectId: currentProjectId }));
    }
  }, [currentProjectId, filters.projectId]);

  // Memoize filter values
  const filterValues = useMemo(() => ({
    projectId: filters.projectId,
    libraryId: filters.libraryId,
    type: filters.type,
    status: filters.status,
    search: filters.search,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }), [filters.projectId, filters.libraryId, filters.type, filters.status, filters.search, filters.sortBy, filters.sortOrder]);

  // Fetch assignments when filters or page change
  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filterValues.projectId && { projectId: filterValues.projectId }),
        ...(filterValues.libraryId && { libraryId: filterValues.libraryId }),
        ...(filterValues.type && { type: filterValues.type }),
        ...(filterValues.status && { status: filterValues.status }),
        ...(filterValues.search && { search: filterValues.search }),
        sortBy: filterValues.sortBy,
        sortOrder: filterValues.sortOrder,
      });

      const response = await fetch(`/api/professional-services?${queryParams}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch professional service assignments');
      }

      setAssignments(data.data.assignments || []);
      if (data.data.pagination) {
        setPagination((prev) => {
          const newPagination = data.data.pagination;
          if (
            prev.page === newPagination.page &&
            prev.limit === newPagination.limit &&
            prev.total === newPagination.total &&
            prev.pages === newPagination.pages
          ) {
            return prev;
          }
          return newPagination;
        });
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch assignments error:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filterValues]);

  useEffect(() => {
    if (isEmpty) {
      setLoading(false);
      setAssignments([]);
      return;
    }
    if (!filters.projectId) {
      if (projectLoading) return;
      setLoading(false);
      setAssignments([]);
      return;
    }
    fetchAssignments();
  }, [fetchAssignments, filters.projectId, isEmpty, projectLoading]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      const newFilters = key === 'projectId'
        ? { ...prev, projectId: value }
        : { ...prev, [key]: value };
      
      setTimeout(() => {
        const params = new URLSearchParams();
        Object.entries(newFilters).forEach(([k, v]) => {
          if (v) params.set(k, v);
        });
        router.push(`/professional-services?${params.toString()}`, { scroll: false });
      }, 0);
      
      return newFilters;
    });
    setPagination((prev) => {
      if (prev.page === 1) return prev;
      return { ...prev, page: 1 };
    });
    if (key === 'projectId' && value && value !== currentProjectId) {
      switchProject(value).catch((err) => {
        console.error('Error switching project:', err);
      });
    }
  }, [router, currentProjectId, switchProject]);

  const handleTerminate = (assignmentId, professionalName) => {
    const normalizedId = normalizeId(assignmentId);
    setAssignmentToTerminate({ id: normalizedId, name: professionalName });
    setShowTerminateModal(true);
  };

  const confirmTerminate = async () => {
    if (!assignmentToTerminate) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/professional-services/${assignmentToTerminate.id}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to terminate assignment');
      }

      toast.showSuccess('Professional service assignment terminated');
      setShowTerminateModal(false);
      setAssignmentToTerminate(null);
      fetchAssignments();
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getTypeBadgeColor = (type) => {
    return type === 'architect' 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-green-100 text-green-800';
  };

  const getTypeLabel = (type) => {
    return type === 'architect' ? 'Architect' : 'Engineer';
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      terminated: 'bg-red-100 text-red-800',
      on_hold: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status] || 'ds-bg-surface-muted ds-text-primary';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingOverlay
          isLoading={actionLoading}
          message="Updating assignment..."
          fullScreen
        />
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left Section: Heading and Description */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">
              Assignments
            </h1>
            <p className="text-sm sm:text-base ds-text-secondary mt-2">
              Manage architect and engineer assignments to projects
            </p>
        </div>

        {/* Right Section: Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {canAccess('assign_professional_service') && (
              <Link
                href="/professional-services-library"
                className="inline-flex items-center justify-center px-4 sm:px-6 py-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 active:bg-slate-800 transition-colors touch-manipulation text-sm sm:text-base"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" 
                  />
                </svg>
                Library
              </Link>
            )}

            {canAccess('assign_professional_service') && (
              <Link
                href="/professional-services/new"
                className={`inline-flex items-center justify-center px-4 sm:px-6 py-2.5 rounded-lg transition-all touch-manipulation text-sm sm:text-base ${
                  canCreateAssignment
                    ? 'ds-bg-accent-primary text-white hover:bg-blue-700 active:bg-blue-800 shadow-md hover:shadow-lg'
                    : 'ds-bg-surface-muted ds-text-muted cursor-not-allowed opacity-60'
                }`}
                onClick={(e) => {
                  if (!canCreateAssignment) {
                    e.preventDefault();
                    toast.showWarning('Please complete prerequisites first (Library entries and Projects)');
                  }
                }}
                title={
                  !canCreateAssignment
                    ? 'Complete prerequisites: Library entries and Projects required'
                    : 'Assign a professional to a project'
                }
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Assign Professional
                {!canCreateAssignment && (
                  <svg
                    className="w-4 h-4 ml-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                )}
              </Link>
            )}
        </div>
        </div>

        {!prereqLoading && (
          <PrerequisiteGuide
            title="Before you create an assignment"
            description="Assignments link a professional to a project and scope. Set up the project and service library first."
            prerequisiteDetails={prerequisiteDetails}
            blocking={!canCreateAssignment}
            canProceed={canCreateAssignment}
            actions={[
              { href: '/projects/new', label: 'Create Project', required: false },
              { href: '/professional-services-library/new', label: 'Add Service Type', required: false },
              { href: '/professional-services/new', label: 'New Assignment', required: !canCreateAssignment },
            ]}
            tip="Use project filters to keep billing and activity tracking aligned."
          />
        )}

        {/* Filters */}
        <div className="ds-bg-surface rounded-lg shadow p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Project Filter */}
            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-1">
                Project
              </label>
              <select
                value={filters.projectId}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-3 py-2.5 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ds-text-primary touch-manipulation"
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectName}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-1">
                Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full px-3 py-2.5 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ds-text-primary touch-manipulation"
              >
                <option value="">All Types</option>
                <option value="architect">Architects</option>
                <option value="engineer">Engineers</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium ds-text-secondary mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2.5 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ds-text-primary touch-manipulation"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="terminated">Terminated</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>

            {/* Search */}
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-sm font-medium ds-text-secondary mb-1">
                Search
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by professional name..."
                className="w-full px-3 py-2.5 border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ds-text-primary touch-manipulation"
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <LoadingTable rows={5} columns={7} />
        ) : assignments.length === 0 ? (
          <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
            <svg className="mx-auto h-12 w-12 ds-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium ds-text-primary">No assignments found</h3>
            <p className="mt-1 text-sm ds-text-muted">
              {canAccess('assign_professional_service') 
                ? 'Get started by assigning a professional to a project.'
                : 'No professional service assignments have been created yet.'}
            </p>
            {canAccess('assign_professional_service') && (
              <div className="mt-6">
                <Link
                  href="/professional-services/new"
                  className={`inline-flex items-center justify-center px-4 sm:px-6 py-2.5 rounded-lg transition-all touch-manipulation text-sm sm:text-base ${
                    canCreateAssignment
                      ? 'ds-bg-accent-primary text-white hover:bg-blue-700 active:bg-blue-800 shadow-md hover:shadow-lg'
                      : 'ds-bg-surface-muted ds-text-muted cursor-not-allowed opacity-60'
                  }`}
                  onClick={(e) => {
                    if (!canCreateAssignment) {
                      e.preventDefault();
                      toast.showWarning('Please complete prerequisites first (Library entries and Projects)');
                    }
                  }}
                  title={
                    !canCreateAssignment
                      ? 'Complete prerequisites: Library entries and Projects required'
                      : 'Assign a professional to a project'
                  }
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Assign Professional
                </Link>
              </div>
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
                    <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Professional
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Contract
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Financials
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Statistics
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium ds-text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="ds-bg-surface divide-y divide-ds-border-subtle">
                  {assignments.map((assignment) => {
                    const assignmentId = normalizeId(assignment._id);
                    return (
                      <tr key={assignmentId || assignment._id} className="hover:ds-bg-surface-muted">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium ds-text-primary">
                              {assignment.library?.name || 'N/A'}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadgeColor(assignment.type)}`}>
                                {getTypeLabel(assignment.type)}
                              </span>
                              <span className="text-xs ds-text-muted">
                                {assignment.professionalCode}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium ds-text-primary">
                          {assignment.project?.projectName || 'N/A'}
                        </div>
                        <div className="text-xs ds-text-muted">
                          {assignment.project?.projectCode || ''}
                        </div>
                        {assignment.phase && (
                          <div className="text-xs ds-text-muted mt-1">
                            Phase: {assignment.phase.phaseName}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                        <div>Type: {assignment.contractType?.replace('_', ' ') || 'N/A'}</div>
                        <div>Value: {formatCurrency(assignment.contractValue)}</div>
                        <div className="text-xs">Schedule: {assignment.paymentSchedule?.replace('_', ' ') || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                        <div>Total: {formatCurrency(assignment.totalFees)}</div>
                        <div>Paid: {formatCurrency(assignment.feesPaid)}</div>
                        <div className="text-xs text-red-600">Pending: {formatCurrency(assignment.feesPending)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm ds-text-muted">
                        <div>Activities: {assignment.totalActivities || 0}</div>
                        {assignment.type === 'architect' && (
                          <div className="text-xs">Visits: {assignment.totalSiteVisits || 0}</div>
                        )}
                        {assignment.type === 'engineer' && (
                          <div className="text-xs">Inspections: {assignment.totalInspections || 0}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(assignment.status)}`}>
                          {assignment.status?.charAt(0).toUpperCase() + assignment.status?.slice(1) || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/professional-services/${assignmentId}`}
                            className="ds-text-accent-primary hover:ds-text-accent-hover"
                          >
                            View
                          </Link>
                          {canAccess('edit_professional_service_assignment') && (
                            <Link
                              href={`/professional-services/${assignmentId}/edit`}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Edit
                            </Link>
                          )}
                          {canAccess('terminate_professional_service') && assignment.status === 'active' && (
                            <button
                              onClick={() => handleTerminate(assignmentId, assignment.library?.name)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Terminate
                            </button>
                          )}
                        </div>
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Desktop Pagination */}
            {pagination.pages > 1 && (
              <div className="ds-bg-surface px-4 py-3 flex items-center justify-between border-t ds-border-subtle sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-4 py-2 border ds-border-subtle text-sm font-medium rounded-md ds-text-secondary ds-bg-surface hover:ds-bg-surface-muted active:ds-bg-surface-muted disabled:opacity-50 transition-colors touch-manipulation"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.pages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border ds-border-subtle text-sm font-medium rounded-md ds-text-secondary ds-bg-surface hover:ds-bg-surface-muted active:ds-bg-surface-muted disabled:opacity-50 transition-colors touch-manipulation"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm ds-text-secondary">
                      Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(pagination.page * pagination.limit, pagination.total)}
                      </span>{' '}
                      of <span className="font-medium">{pagination.total}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={pagination.page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border ds-border-subtle ds-bg-surface text-sm font-medium ds-text-muted hover:ds-bg-surface-muted active:ds-bg-surface-muted disabled:opacity-50 transition-colors touch-manipulation"
                      >
                        Previous
                      </button>
                      {[...Array(pagination.pages)].map((_, i) => {
                        const page = i + 1;
                        if (
                          page === 1 ||
                          page === pagination.pages ||
                          (page >= pagination.page - 1 && page <= pagination.page + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => setPagination(prev => ({ ...prev, page }))}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-colors touch-manipulation ${
                                page === pagination.page
                                  ? 'z-10 bg-blue-500/10 border-ds-accent-primary ds-text-accent-primary'
                                  : 'ds-bg-surface ds-border-subtle ds-text-muted hover:ds-bg-surface-muted active:ds-bg-surface-muted'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        } else if (page === pagination.page - 2 || page === pagination.page + 2) {
                          return <span key={page} className="relative inline-flex items-center px-4 py-2 border ds-border-subtle ds-bg-surface text-sm font-medium ds-text-secondary">...</span>;
                        }
                        return null;
                      })}
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                        disabled={pagination.page === pagination.pages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border ds-border-subtle ds-bg-surface text-sm font-medium ds-text-muted hover:ds-bg-surface-muted active:ds-bg-surface-muted disabled:opacity-50 transition-colors touch-manipulation"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {assignments.map((assignment) => {
                const assignmentId = normalizeId(assignment._id);
                return (
                  <div
                    key={assignmentId || assignment._id}
                    className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle"
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold ds-text-primary truncate">
                          {assignment.library?.name || 'N/A'}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadgeColor(assignment.type)}`}>
                            {getTypeLabel(assignment.type)}
                          </span>
                          <span className="text-xs ds-text-muted">
                            {assignment.professionalCode}
                          </span>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ml-2 ${getStatusBadgeColor(assignment.status)}`}>
                        {assignment.status?.charAt(0).toUpperCase() + assignment.status?.slice(1) || 'N/A'}
                      </span>
                    </div>

                    {/* Project Info */}
                    <div className="mb-3 pb-3 border-b ds-border-subtle">
                      <p className="text-xs ds-text-muted mb-0.5">Project</p>
                      <p className="text-sm font-medium ds-text-primary">
                        {assignment.project?.projectName || 'N/A'}
                      </p>
                      {assignment.project?.projectCode && (
                        <p className="text-xs ds-text-secondary mt-0.5">
                          {assignment.project.projectCode}
                        </p>
                      )}
                      {assignment.phase && (
                        <p className="text-xs ds-text-muted mt-1">
                          Phase: {assignment.phase.phaseName}
                        </p>
                      )}
                    </div>

                    {/* Contract Details */}
                    <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b ds-border-subtle">
                      <div>
                        <p className="text-xs ds-text-muted mb-0.5">Contract Type</p>
                        <p className="text-sm font-medium ds-text-primary">
                          {assignment.contractType?.replace('_', ' ') || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs ds-text-muted mb-0.5">Contract Value</p>
                        <p className="text-sm font-semibold ds-text-primary">
                          {formatCurrency(assignment.contractValue)}
                        </p>
                      </div>
                    </div>

                    {/* Financials */}
                    <div className="grid grid-cols-3 gap-2 mb-3 pb-3 border-b ds-border-subtle">
                      <div>
                        <p className="text-xs ds-text-muted mb-0.5">Total</p>
                        <p className="text-sm font-semibold ds-text-primary">
                          {formatCurrency(assignment.totalFees)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs ds-text-muted mb-0.5">Paid</p>
                        <p className="text-sm font-semibold text-green-600">
                          {formatCurrency(assignment.feesPaid)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs ds-text-muted mb-0.5">Pending</p>
                        <p className="text-sm font-semibold text-red-600">
                          {formatCurrency(assignment.feesPending)}
                        </p>
                      </div>
                    </div>

                    {/* Statistics */}
                    <div className="mb-3 pb-3 border-b ds-border-subtle">
                      <p className="text-xs ds-text-muted mb-1">Statistics</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs ds-text-secondary">
                          Activities: <strong>{assignment.totalActivities || 0}</strong>
                        </span>
                        {assignment.type === 'architect' && (
                          <span className="text-xs ds-text-secondary">
                            Visits: <strong>{assignment.totalSiteVisits || 0}</strong>
                          </span>
                        )}
                        {assignment.type === 'engineer' && (
                          <span className="text-xs ds-text-secondary">
                            Inspections: <strong>{assignment.totalInspections || 0}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-3">
                      <Link
                        href={`/professional-services/${assignmentId}`}
                        className="flex-1 px-3 py-2 bg-blue-500/10 ds-text-accent-primary text-sm font-semibold rounded-lg hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors touch-manipulation text-center border border-blue-400/60"
                      >
                        View
                      </Link>
                      {canAccess('edit_professional_service_assignment') && (
                        <Link
                          href={`/professional-services/${assignmentId}/edit`}
                          className="flex-1 px-3 py-2 bg-indigo-50 text-indigo-600 text-sm font-semibold rounded-lg hover:bg-indigo-100 active:bg-indigo-200 transition-colors touch-manipulation text-center"
                        >
                          Edit
                        </Link>
                      )}
                      {canAccess('terminate_professional_service') && assignment.status === 'active' && (
                        <button
                          onClick={() => handleTerminate(assignmentId, assignment.library?.name)}
                          className="flex-1 px-3 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-100 active:bg-red-200 transition-colors touch-manipulation"
                        >
                          Terminate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Mobile Pagination */}
              {pagination.pages > 1 && (
                <div className="ds-bg-surface rounded-lg shadow p-4 border ds-border-subtle">
                  <div className="text-sm ds-text-secondary text-center mb-3">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page === 1}
                      className="flex-1 px-4 py-2.5 border-2 ds-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:ds-bg-surface-muted active:ds-bg-surface-muted ds-text-primary font-semibold transition-all duration-200 touch-manipulation"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2.5 text-sm ds-text-secondary font-medium">
                      {pagination.page} / {pagination.pages}
                    </span>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                      disabled={pagination.page === pagination.pages}
                      className="flex-1 px-4 py-2.5 border-2 ds-border-subtle rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:ds-bg-surface-muted active:ds-bg-surface-muted ds-text-primary font-semibold transition-all duration-200 touch-manipulation"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Terminate Confirmation Modal */}
        <ConfirmationModal
          isOpen={showTerminateModal}
          onClose={() => {
            setShowTerminateModal(false);
            setAssignmentToTerminate(null);
          }}
          onConfirm={confirmTerminate}
          title="Terminate Assignment"
          message={`Are you sure you want to terminate the assignment for "${assignmentToTerminate?.name}"? This action cannot be undone.`}
          confirmText="Terminate"
          cancelText="Cancel"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
          loading={actionLoading}
        />
      </div>
    </AppLayout>
  );
}

export default function ProfessionalServicesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center ds-bg-surface-muted">
        <div className="text-center">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      </div>
    }>
      <ProfessionalServicesPageContent />
    </Suspense>
  );
}





