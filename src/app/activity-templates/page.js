/**
 * Activity Templates List Page
 * Displays all activity templates with filtering, sorting, and pagination
 * 
 * Route: /activity-templates
 */

'use client';

export const revalidate = 60;

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable, LoadingOverlay } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { ConfirmationModal } from '@/components/modals';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';

function ActivityTemplatesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  
  const [filters, setFilters] = useState({
    type: searchParams.get('type') || '',
    activityType: searchParams.get('activityType') || '',
    projectPhase: searchParams.get('projectPhase') || '',
    status: searchParams.get('status') || '',
    isPublic: searchParams.get('isPublic') || '',
    search: searchParams.get('search') || '',
    sortBy: searchParams.get('sortBy') || 'usageCount',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Memoize filter values
  const filterValues = useMemo(() => ({
    type: filters.type,
    activityType: filters.activityType,
    projectPhase: filters.projectPhase,
    status: filters.status,
    isPublic: filters.isPublic,
    search: filters.search,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }), [filters.type, filters.activityType, filters.projectPhase, filters.status, filters.isPublic, filters.search, filters.sortBy, filters.sortOrder]);

  // Fetch templates when filters or page change
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filterValues.type && { type: filterValues.type }),
        ...(filterValues.activityType && { activityType: filterValues.activityType }),
        ...(filterValues.projectPhase && { projectPhase: filterValues.projectPhase }),
        ...(filterValues.status && { status: filterValues.status }),
        ...(filterValues.isPublic && { isPublic: filterValues.isPublic }),
        ...(filterValues.search && { search: filterValues.search }),
        sortBy: filterValues.sortBy,
        sortOrder: filterValues.sortOrder,
      });

      const response = await fetch(`/api/activity-templates?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch activity templates');
      }

      setTemplates(data.data.templates || []);
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
      console.error('Fetch templates error:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filterValues]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      
      setTimeout(() => {
        const params = new URLSearchParams();
        Object.entries(newFilters).forEach(([k, v]) => {
          if (v) params.set(k, v);
        });
        router.push(`/activity-templates?${params.toString()}`, { scroll: false });
      }, 0);
      
      return newFilters;
    });
    setPagination((prev) => {
      if (prev.page === 1) return prev;
      return { ...prev, page: 1 };
    });
  }, [router]);

  const handleDelete = (templateId, templateName) => {
    setTemplateToDelete({ id: templateId, name: templateName });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/activity-templates/${templateToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete template');
      }

      toast.showSuccess('Activity template deleted successfully');
      setShowDeleteModal(false);
      setTemplateToDelete(null);
      fetchTemplates();
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getTypeBadgeColor = (type) => {
    return type === 'architect_activity' 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-green-100 text-green-800';
  };

  const getTypeLabel = (type) => {
    return type === 'architect_activity' ? 'Architect' : 'Engineer';
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      official: 'bg-purple-100 text-purple-800',
      community: 'bg-blue-100 text-blue-800',
      private: 'bg-gray-100 text-gray-800',
      deprecated: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LoadingOverlay
          isLoading={actionLoading}
          message="Updating template..."
          fullScreen
        />
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
              Activity Templates
            </h1>
            <p className="text-gray-600 mt-2">
              Create and manage reusable activity templates for quick entry
            </p>
          </div>
          {canAccess('create_activity_template') && (
            <Link
              href="/activity-templates/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Template
            </Link>
          )}
        </div>

        <PrerequisiteGuide
          title="Templates speed up activity logs"
          description="Create templates after you standardize activity types."
          prerequisites={[
            'Common activity types are defined',
            'Professional services are available',
          ]}
          actions={[
            { href: '/professional-services-library', label: 'Service Library' },
            { href: '/activity-templates/new', label: 'Create Template' },
            { href: '/professional-activities/new', label: 'Log Activity' },
          ]}
          tip="Use templates to keep approvals consistent."
        />

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="architect_activity">Architect</option>
                <option value="engineer_activity">Engineer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Activity Type</label>
              <select
                value={filters.activityType}
                onChange={(e) => handleFilterChange('activityType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Activity Types</option>
                <option value="site_visit">Site Visit</option>
                <option value="design_revision">Design Revision</option>
                <option value="inspection">Inspection</option>
                <option value="quality_check">Quality Check</option>
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
                <option value="official">Official</option>
                <option value="community">Community</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
              <select
                value={filters.isPublic}
                onChange={(e) => handleFilterChange('isPublic', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="true">Public</option>
                <option value="false">Private</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search templates..."
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
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No templates found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {canAccess('create_activity_template') 
                ? 'Get started by creating a new activity template.'
                : 'No activity templates have been created yet.'}
            </p>
            {canAccess('create_activity_template') && (
              <div className="mt-6">
                <Link
                  href="/activity-templates/new"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Template
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
                      Template Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Activity Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usage
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
                  {templates.map((template) => (
                    <tr key={template._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {template.name}
                            </div>
                            {template.description && (
                              <div className="text-sm text-gray-500">
                                {template.description.length > 50 
                                  ? `${template.description.substring(0, 50)}...` 
                                  : template.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadgeColor(template.type)}`}>
                          {getTypeLabel(template.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {template.activityType?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                        </div>
                        {template.projectPhase && (
                          <div className="text-xs text-gray-500">
                            Phase: {template.projectPhase.replace('_', ' ')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>Used {template.usageCount || 0} times</div>
                        {template.lastUsedAt && (
                          <div className="text-xs text-gray-400">
                            Last: {new Date(template.lastUsedAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {template.isPublic && (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                              Public
                            </span>
                          )}
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(template.status)}`}>
                            {template.status?.charAt(0).toUpperCase() + template.status?.slice(1) || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {canAccess('use_activity_template') && (
                            <Link
                              href={`/activity-templates/${template._id}/use`}
                              className="text-green-600 hover:text-green-900"
                            >
                              Use
                            </Link>
                          )}
                          {canAccess('manage_activity_templates') && (
                            <Link
                              href={`/activity-templates/${template._id}/edit`}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </Link>
                          )}
                          {canAccess('delete_activity_template') && (
                            <button
                              onClick={() => handleDelete(template._id, template.name)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
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

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setTemplateToDelete(null);
          }}
          onConfirm={confirmDelete}
          title="Delete Activity Template"
          message={`Are you sure you want to delete "${templateToDelete?.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
          loading={actionLoading}
        />
      </div>
    </AppLayout>
  );
}

export default function ActivityTemplatesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ActivityTemplatesPageContent />
    </Suspense>
  );
}





