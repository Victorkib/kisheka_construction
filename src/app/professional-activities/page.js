/**
 * Professional Activities List Page
 * Displays all professional activities with filtering, sorting, and pagination
 * 
 * Route: /professional-activities
 */

'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ConfirmationModal } from '@/components/modals';

function ProfessionalActivitiesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [projects, setProjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  
  const [filters, setFilters] = useState({
    projectId: searchParams.get('projectId') || '',
    professionalServiceId: searchParams.get('professionalServiceId') || '',
    activityType: searchParams.get('activityType') || '',
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
    sortBy: searchParams.get('sortBy') || 'activityDate',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  });

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch projects and assignments on mount
  useEffect(() => {
    fetchProjects();
    fetchAssignments();
  }, []);

  // Memoize filter values
  const filterValues = useMemo(() => ({
    projectId: filters.projectId,
    professionalServiceId: filters.professionalServiceId,
    activityType: filters.activityType,
    status: filters.status,
    search: filters.search,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }), [filters.projectId, filters.professionalServiceId, filters.activityType, filters.status, filters.search, filters.sortBy, filters.sortOrder]);

  // Fetch activities when filters or page change
  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filterValues.projectId && { projectId: filterValues.projectId }),
        ...(filterValues.professionalServiceId && { professionalServiceId: filterValues.professionalServiceId }),
        ...(filterValues.activityType && { activityType: filterValues.activityType }),
        ...(filterValues.status && { status: filterValues.status }),
        ...(filterValues.search && { search: filterValues.search }),
        sortBy: filterValues.sortBy,
        sortOrder: filterValues.sortOrder,
      });

      const response = await fetch(`/api/professional-activities?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch professional activities');
      }

      setActivities(data.data.activities || []);
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
      console.error('Fetch activities error:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filterValues]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchAssignments = async () => {
    try {
      const response = await fetch('/api/professional-services?status=active');
      const data = await response.json();
      if (data.success) {
        setAssignments(data.data.assignments || []);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    }
  };

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      
      setTimeout(() => {
        const params = new URLSearchParams();
        Object.entries(newFilters).forEach(([k, v]) => {
          if (v) params.set(k, v);
        });
        router.push(`/professional-activities?${params.toString()}`, { scroll: false });
      }, 0);
      
      return newFilters;
    });
    setPagination((prev) => {
      if (prev.page === 1) return prev;
      return { ...prev, page: 1 };
    });
  }, [router]);

  const handleApproveClick = (activityId) => {
    setSelectedActivityId(activityId);
    setApprovalNotes('');
    setShowApproveModal(true);
  };

  const handleApprove = async () => {
    if (!selectedActivityId) return;
    setActionLoading(true);
    setShowApproveModal(false);
    try {
      const response = await fetch(`/api/professional-activities/${selectedActivityId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes }),
      });

      const data = await response.json();
      if (data.success) {
        toast.showSuccess('Activity approved successfully');
        fetchActivities();
      } else {
        toast.showError(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
      setSelectedActivityId(null);
      setApprovalNotes('');
    }
  };

  const handleRejectClick = (activityId) => {
    setSelectedActivityId(activityId);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!selectedActivityId) return;
    if (!rejectionReason.trim()) {
      toast.showError('Rejection reason is required');
      return;
    }
    setActionLoading(true);
    setShowRejectModal(false);
    try {
      const response = await fetch(`/api/professional-activities/${selectedActivityId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason }),
      });

      const data = await response.json();
      if (data.success) {
        toast.showSuccess('Activity rejected successfully');
        fetchActivities();
      } else {
        toast.showError(`Error: ${data.error}`);
      }
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
      setSelectedActivityId(null);
      setRejectionReason('');
    }
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getActivityTypeLabel = (type) => {
    return type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A';
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
              Professional Activities
            </h1>
            <p className="text-gray-600 mt-2">
              Track and manage architect and engineer activities
            </p>
          </div>
          {canAccess('create_professional_activity') && (
            <Link
              href="/professional-activities/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Log Activity
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <select
                value={filters.projectId}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.projectName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Professional</label>
              <select
                value={filters.professionalServiceId}
                onChange={(e) => handleFilterChange('professionalServiceId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Professionals</option>
                {assignments.map((assignment) => (
                  <option key={assignment._id} value={assignment._id}>
                    {assignment.library?.name || 'N/A'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filters.activityType}
                onChange={(e) => handleFilterChange('activityType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="site_visit">Site Visit</option>
                <option value="design_revision">Design Revision</option>
                <option value="inspection">Inspection</option>
                <option value="quality_check">Quality Check</option>
                <option value="client_meeting">Client Meeting</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search activities..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <LoadingTable rows={5} columns={6} />
        ) : activities.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No activities found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {canAccess('create_professional_activity') 
                ? 'Get started by logging a new activity.'
                : 'No professional activities have been logged yet.'}
            </p>
            {canAccess('create_professional_activity') && (
              <div className="mt-6">
                <Link
                  href="/professional-activities/new"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Log Activity
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
                      Activity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Professional
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
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
                  {activities.map((activity) => (
                    <tr key={activity._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {getActivityTypeLabel(activity.activityType)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {activity.activityCode}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {activity.library?.name || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {activity.professionalService?.professionalCode || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {activity.project?.projectName || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {activity.activityDate ? new Date(activity.activityDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(activity.status)}`}>
                          {activity.status?.replace('_', ' ').toUpperCase() || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/professional-activities/${activity._id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </Link>
                          {canAccess('approve_professional_activity') && activity.status === 'pending_approval' && (
                            <>
                              <button
                                onClick={() => handleApproveClick(activity._id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectClick(activity._id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination - Similar structure as before */}
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

        {/* Approve Modal */}
        <ConfirmationModal
          isOpen={showApproveModal}
          onClose={() => {
            setShowApproveModal(false);
            setSelectedActivityId(null);
            setApprovalNotes('');
          }}
          onConfirm={handleApprove}
          title="Approve Activity"
          message={
            <div className="space-y-4">
              <p>Are you sure you want to approve this activity?</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Approval Notes (Optional)
                </label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any notes about this approval..."
                />
              </div>
            </div>
          }
          confirmText="Approve"
          cancelText="Cancel"
          confirmButtonClass="bg-green-600 hover:bg-green-700"
          loading={actionLoading}
        />

        {/* Reject Modal */}
        <ConfirmationModal
          isOpen={showRejectModal}
          onClose={() => {
            setShowRejectModal(false);
            setSelectedActivityId(null);
            setRejectionReason('');
          }}
          onConfirm={handleReject}
          title="Reject Activity"
          message={
            <div className="space-y-4">
              <p>Are you sure you want to reject this activity?</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Please provide a reason for rejection..."
                />
              </div>
            </div>
          }
          confirmText="Reject"
          cancelText="Cancel"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
          loading={actionLoading}
        />
      </div>
    </AppLayout>
  );
}

export default function ProfessionalActivitiesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProfessionalActivitiesPageContent />
    </Suspense>
  );
}





