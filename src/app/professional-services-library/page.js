/**
 * Professional Services Library List Page
 * Displays all professionals in library with filtering, sorting, and pagination
 * 
 * Route: /professional-services-library
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

function ProfessionalServicesLibraryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  
  const [filters, setFilters] = useState({
    type: searchParams.get('type') || '',
    isCommon: searchParams.get('isCommon') || '',
    isActive: searchParams.get('isActive') || 'true',
    search: searchParams.get('search') || '',
    sortBy: searchParams.get('sortBy') || 'usageCount',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [professionalToDelete, setProfessionalToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Memoize filter values to prevent unnecessary re-renders
  const filterValues = useMemo(() => ({
    type: filters.type,
    isCommon: filters.isCommon,
    isActive: filters.isActive,
    search: filters.search,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }), [filters.type, filters.isCommon, filters.isActive, filters.search, filters.sortBy, filters.sortOrder]);

  // Fetch professionals when filters or page change
  const fetchProfessionals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filterValues.type && { type: filterValues.type }),
        ...(filterValues.isCommon && { isCommon: filterValues.isCommon }),
        ...(filterValues.isActive && { isActive: filterValues.isActive }),
        ...(filterValues.search && { search: filterValues.search }),
        sortBy: filterValues.sortBy,
        sortOrder: filterValues.sortOrder,
      });

      const response = await fetch(`/api/professional-services-library?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch professionals');
      }

      setProfessionals(data.data.professionals || []);
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
      console.error('Fetch professionals error:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filterValues]);

  useEffect(() => {
    fetchProfessionals();
  }, [fetchProfessionals]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      
      setTimeout(() => {
        const params = new URLSearchParams();
        Object.entries(newFilters).forEach(([k, v]) => {
          if (v) params.set(k, v);
        });
        router.push(`/professional-services-library?${params.toString()}`, { scroll: false });
      }, 0);
      
      return newFilters;
    });
    setPagination((prev) => {
      if (prev.page === 1) return prev;
      return { ...prev, page: 1 };
    });
  }, [router]);

  const handleDelete = (professionalId, professionalName) => {
    setProfessionalToDelete({ id: professionalId, name: professionalName });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!professionalToDelete) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/professional-services-library/${professionalToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete professional');
      }

      toast.showSuccess('Professional removed from library');
      setShowDeleteModal(false);
      setProfessionalToDelete(null);
      fetchProfessionals();
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleCommon = async (professionalId, currentValue) => {
    try {
      const response = await fetch(`/api/professional-services-library/${professionalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCommon: !currentValue }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update professional');
      }

      toast.showSuccess(
        `Professional ${!currentValue ? 'marked as' : 'unmarked from'} commonly used`
      );
      fetchProfessionals();
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    }
  };

  const handleToggleActive = async (professionalId, currentValue) => {
    try {
      const response = await fetch(`/api/professional-services-library/${professionalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentValue }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update professional');
      }

      toast.showSuccess(
        `Professional ${!currentValue ? 'activated' : 'deactivated'}`
      );
      fetchProfessionals();
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
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

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
              Library
            </h1>
            <p className="text-gray-600 mt-2">
              Manage architects and engineers for quick assignment to projects
            </p>
          </div>
          {canAccess('manage_professional_services_library') && (
            <Link
              href="/professional-services-library/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Professional
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="architect">Architects</option>
                <option value="engineer">Engineers</option>
              </select>
            </div>

            {/* Common Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Common
              </label>
              <select
                value={filters.isCommon}
                onChange={(e) => handleFilterChange('isCommon', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="true">Common Only</option>
                <option value="false">Not Common</option>
              </select>
            </div>

            {/* Active Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filters.isActive}
                onChange={(e) => handleFilterChange('isActive', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
                <option value="">All</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by name..."
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
        ) : professionals.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No professionals found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {canAccess('manage_professional_services_library') 
                ? 'Get started by adding a new professional to the library.'
                : 'No professionals have been added to the library yet.'}
            </p>
            {canAccess('manage_professional_services_library') && (
              <div className="mt-6">
                <Link
                  href="/professional-services-library/new"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Professional
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
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
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
                  {professionals.map((professional) => (
                    <tr key={professional._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {professional.name}
                            </div>
                            {professional.companyName && (
                              <div className="text-sm text-gray-500">
                                {professional.companyName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadgeColor(professional.type)}`}>
                          {getTypeLabel(professional.type)}
                        </span>
                        {professional.specialization && (
                          <div className="text-xs text-gray-500 mt-1">
                            {professional.specialization}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{professional.email || 'N/A'}</div>
                        <div>{professional.phone || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>Used {professional.usageCount || 0} times</div>
                        {professional.lastUsedAt && (
                          <div className="text-xs text-gray-400">
                            Last: {new Date(professional.lastUsedAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {professional.isCommon && (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                              Common
                            </span>
                          )}
                          {professional.isActive ? (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                              Inactive
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {canAccess('edit_professional_service') && (
                            <Link
                              href={`/professional-services-library/${professional._id}/edit`}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </Link>
                          )}
                          {canAccess('edit_professional_service') && (
                            <button
                              onClick={() => handleToggleCommon(professional._id, professional.isCommon)}
                              className="text-purple-600 hover:text-purple-900"
                              title={professional.isCommon ? 'Remove from common' : 'Mark as common'}
                            >
                              {professional.isCommon ? '★' : '☆'}
                            </button>
                          )}
                          {canAccess('edit_professional_service') && (
                            <button
                              onClick={() => handleToggleActive(professional._id, professional.isActive)}
                              className={professional.isActive ? 'text-gray-600 hover:text-gray-900' : 'text-green-600 hover:text-green-900'}
                              title={professional.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {professional.isActive ? '●' : '○'}
                            </button>
                          )}
                          {canAccess('delete_professional_service') && (
                            <button
                              onClick={() => handleDelete(professional._id, professional.name)}
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
            setProfessionalToDelete(null);
          }}
          onConfirm={confirmDelete}
          title="Delete Professional"
          message={`Are you sure you want to remove "${professionalToDelete?.name}" from the library? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
          loading={actionLoading}
        />
      </div>
    </AppLayout>
  );
}

export default function ProfessionalServicesLibraryPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProfessionalServicesLibraryPageContent />
    </Suspense>
  );
}





