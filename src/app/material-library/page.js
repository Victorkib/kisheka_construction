/**
 * Material Library List Page
 * Displays all library materials with filtering, sorting, and pagination
 * 
 * Route: /material-library
 */

'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingTable } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast';
import { MaterialLibraryTable } from '@/components/material-library/material-library-table';
import { MaterialLibraryFilters } from '@/components/material-library/material-library-filters';
import { MaterialLibrarySearch } from '@/components/material-library/material-library-search';
import { ConfirmationModal } from '@/components/modals';

function MaterialLibraryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [categories, setCategories] = useState([]);
  
  const [filters, setFilters] = useState({
    category: '',
    categoryId: searchParams.get('categoryId') || '',
    isCommon: searchParams.get('isCommon') || '',
    isActive: searchParams.get('isActive') || 'true',
    search: searchParams.get('search') || '',
    sortBy: searchParams.get('sortBy') || 'usageCount',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Memoize filter values to prevent unnecessary re-renders
  const filterValues = useMemo(() => ({
    categoryId: filters.categoryId,
    category: filters.category,
    isCommon: filters.isCommon,
    isActive: filters.isActive,
    search: filters.search,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }), [filters.categoryId, filters.category, filters.isCommon, filters.isActive, filters.search, filters.sortBy, filters.sortOrder]);

  // Fetch materials when filters or page change
  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filterValues.categoryId && { categoryId: filterValues.categoryId }),
        ...(filterValues.category && { category: filterValues.category }),
        ...(filterValues.isCommon && { isCommon: filterValues.isCommon }),
        ...(filterValues.isActive && { isActive: filterValues.isActive }),
        ...(filterValues.search && { search: filterValues.search }),
        sortBy: filterValues.sortBy,
        sortOrder: filterValues.sortOrder,
      });

      const response = await fetch(`/api/material-library?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch materials');
      }

      setMaterials(data.data.materials || []);
      // Only update pagination if it actually changed
      if (data.data.pagination) {
        setPagination((prev) => {
          const newPagination = data.data.pagination;
          if (
            prev.page === newPagination.page &&
            prev.limit === newPagination.limit &&
            prev.total === newPagination.total &&
            prev.pages === newPagination.pages
          ) {
            return prev; // Return same reference if values are the same
          }
          return newPagination;
        });
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch materials error:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filterValues.categoryId, filterValues.category, filterValues.isCommon, filterValues.isActive, filterValues.search, filterValues.sortBy, filterValues.sortOrder]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      
      // Update URL params (use setTimeout to avoid blocking state update)
      setTimeout(() => {
        const params = new URLSearchParams();
        Object.entries(newFilters).forEach(([k, v]) => {
          if (v) params.set(k, v);
        });
        router.push(`/material-library?${params.toString()}`, { scroll: false });
      }, 0);
      
      return newFilters;
    });
    setPagination((prev) => {
      if (prev.page === 1) return prev; // Avoid unnecessary update
      return { ...prev, page: 1 };
    });
  }, [router]);

  const handleDelete = (materialId, materialName) => {
    setMaterialToDelete({ id: materialId, name: materialName });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!materialToDelete) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/material-library/${materialToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete material');
      }

      toast.showSuccess('Material removed from library');
      setShowDeleteModal(false);
      setMaterialToDelete(null);
      fetchMaterials();
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleCommon = async (materialId, currentValue) => {
    try {
      const response = await fetch(`/api/material-library/${materialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCommon: !currentValue }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update material');
      }

      toast.showSuccess(
        `Material ${!currentValue ? 'marked as' : 'unmarked from'} commonly used`
      );
      fetchMaterials();
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    }
  };

  const handleToggleActive = async (materialId, currentValue) => {
    try {
      const response = await fetch(`/api/material-library/${materialId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentValue }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update material');
      }

      toast.showSuccess(`Material ${!currentValue ? 'activated' : 'deactivated'}`);
      fetchMaterials();
    } catch (err) {
      toast.showError(`Error: ${err.message}`);
    }
  };

  const handleEdit = (materialId) => {
    router.push(`/material-library/${materialId}/edit`);
  };

  const handleClearFilters = () => {
    setFilters({
      category: '',
      categoryId: '',
      isCommon: '',
      isActive: 'true',
      search: '',
      sortBy: 'usageCount',
      sortOrder: 'desc',
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
    router.push('/material-library', { scroll: false });
  };

  if (!canAccess('view_material_library')) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to view the material library.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const canManage = canAccess('manage_material_library');

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Material Library</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage commonly used construction materials
            </p>
          </div>
          {canManage && (
            <Link
              href="/material-library/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <svg
                className="h-5 w-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Material
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="mb-4">
          <MaterialLibrarySearch
            value={filters.search}
            onChange={(value) => handleFilterChange('search', value)}
          />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <MaterialLibraryFilters
            categories={categories}
            categoryId={filters.categoryId}
            isCommon={filters.isCommon}
            isActive={filters.isActive}
            onCategoryChange={(value) => handleFilterChange('categoryId', value)}
            onCommonToggle={(value) => handleFilterChange('isCommon', value)}
            onActiveToggle={(value) => handleFilterChange('isActive', value)}
            onClearFilters={handleClearFilters}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Materials Table */}
        {loading ? (
          <LoadingTable rows={5} columns={canManage ? 8 : 7} />
        ) : (
          <>
            <MaterialLibraryTable
              materials={materials}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleCommon={handleToggleCommon}
              onToggleActive={handleToggleActive}
              canManage={canManage}
            />

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>{' '}
                  of <span className="font-medium">{pagination.total}</span> results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.pages}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setMaterialToDelete(null);
          }}
          onConfirm={confirmDelete}
          title="Delete Material"
          message={`Are you sure you want to remove "${materialToDelete?.name}" from the library? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          isLoading={actionLoading}
        />
      </div>
    </AppLayout>
  );
}

export default function MaterialLibraryPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LoadingTable rows={5} columns={7} />
          </div>
        </AppLayout>
      }
    >
      <MaterialLibraryPageContent />
    </Suspense>
  );
}

