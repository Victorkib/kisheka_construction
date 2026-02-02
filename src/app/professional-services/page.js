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
import { LoadingTable, LoadingOverlay } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ConfirmationModal } from '@/components/modals';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';
import { useProjectContext } from '@/contexts/ProjectContext';

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

      const response = await fetch(`/api/professional-services?${queryParams}`);
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
        method: 'DELETE',
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
    return colors[status] || 'bg-gray-100 text-gray-800';
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
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
              Assignments
            </h1>
            <p className="text-gray-600 mt-2">
              Manage architect and engineer assignments to projects
            </p>
          </div>
          {canAccess('assign_professional_service') && (
            <Link
              href="/professional-services/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Assign Professional
            </Link>
          )}
        </div>

        <PrerequisiteGuide
          title="Before you create an assignment"
          description="Assignments link a professional to a project and scope. Set up the project and service library first."
          prerequisites={[
            'Project exists for the assignment',
            'Professional service library entry is created',
          ]}
          actions={[
            { href: '/projects/new', label: 'Create Project' },
            { href: '/professional-services-library/new', label: 'Add Service Type' },
            { href: '/professional-services/new', label: 'New Assignment' },
          ]}
          tip="Use project filters to keep billing and activity tracking aligned."
        />

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Project Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project
              </label>
              <select
                value={filters.projectId}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              >
                <option value="">All Types</option>
                <option value="architect">Architects</option>
                <option value="engineer">Engineers</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="terminated">Terminated</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>

            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by professional name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <LoadingTable rows={5} columns={7} />
        ) : assignments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No assignments found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {canAccess('assign_professional_service') 
                ? 'Get started by assigning a professional to a project.'
                : 'No professional service assignments have been created yet.'}
            </p>
            {canAccess('assign_professional_service') && (
              <div className="mt-6">
                <Link
                  href="/professional-services/new"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Professional
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contract
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Financials
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statistics
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {assignments.map((assignment) => {
                    const assignmentId = normalizeId(assignment._id);
                    return (
                      <tr key={assignmentId || assignment._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {assignment.library?.name || 'N/A'}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadgeColor(assignment.type)}`}>
                                {getTypeLabel(assignment.type)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {assignment.professionalCode}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {assignment.project?.projectName || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {assignment.project?.projectCode || ''}
                        </div>
                        {assignment.phase && (
                          <div className="text-xs text-gray-400 mt-1">
                            Phase: {assignment.phase.phaseName}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>Type: {assignment.contractType?.replace('_', ' ') || 'N/A'}</div>
                        <div>Value: {formatCurrency(assignment.contractValue)}</div>
                        <div className="text-xs">Schedule: {assignment.paymentSchedule?.replace('_', ' ') || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>Total: {formatCurrency(assignment.totalFees)}</div>
                        <div>Paid: {formatCurrency(assignment.feesPaid)}</div>
                        <div className="text-xs text-red-600">Pending: {formatCurrency(assignment.feesPending)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                            className="text-blue-600 hover:text-blue-900"
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

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.pages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
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
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
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
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                page === pagination.page
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        } else if (page === pagination.page - 2 || page === pagination.page + 2) {
                          return <span key={page} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>;
                        }
                        return null;
                      })}
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                        disabled={pagination.page === pagination.pages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
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
    <Suspense fallback={<div>Loading...</div>}>
      <ProfessionalServicesPageContent />
    </Suspense>
  );
}





