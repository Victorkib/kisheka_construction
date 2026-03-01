/**
 * Categories List Page
 * Displays all categories with view for all, create for OWNER
 * 
 * Route: /categories
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { CATEGORY_TYPE_OPTIONS } from '@/lib/constants/category-constants';
import { fetchNoCache } from '@/lib/fetch-helpers';

const PAGE_SIZE = 12;

function CategoriesPageContent() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canCreate, setCanCreate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [categoryType, setCategoryType] = useState(CATEGORY_TYPE_OPTIONS[0].value);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedUsage, setExpandedUsage] = useState(new Set());
  const [cloningId, setCloningId] = useState(null);
  const [cloneModal, setCloneModal] = useState(null); // { category, newName }

  useEffect(() => {
    fetchUser();
    fetchCategories(CATEGORY_TYPE_OPTIONS[0].value, 1);
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetchNoCache('/api/auth/me');
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        const role = data.data.role?.toLowerCase();
        setCanCreate(role === 'owner');
      }
    } catch (err) {
      console.error('Fetch user error:', err);
    }
  };

  const fetchCategories = async (type, pageNumber = 1) => {
    try {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams();
      query.set('type', type);
      query.set('page', String(pageNumber));
      query.set('pageSize', String(PAGE_SIZE));

      const response = await fetchNoCache(`/api/categories?${query.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch categories');
      }

      // Support both paginated and legacy responses
      if (Array.isArray(data.data)) {
        setCategories(data.data || []);
        setTotal(data.data.length || 0);
        setPage(1);
      } else if (data.data && Array.isArray(data.data.items)) {
        setCategories(data.data.items || []);
        setTotal(data.data.total || 0);
        setPage(data.data.page || 1);
      } else {
        setCategories([]);
        setTotal(0);
        setPage(1);
      }
    } catch (err) {
      setError(err.message);
      console.error('Fetch categories error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this category? This cannot be undone.'
    );
    if (!confirmDelete) return;

    try {
      setDeletingId(id);
      const response = await fetch(`/api/categories/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete category');
      }

      // Refresh categories
      await fetchCategories(categoryType);
    } catch (err) {
      console.error('Delete category error:', err);
      setError(err.message || 'Failed to delete category');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleUsageExpansion = (categoryId) => {
    setExpandedUsage((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleCloneClick = (category) => {
    setCloneModal({
      category,
      newName: `${category.name} (Copy)`,
    });
  };

  const handleCloneSubmit = async () => {
    if (!cloneModal) return;
    const { category, newName } = cloneModal;

    if (!newName || newName.trim().length === 0) {
      setError('Category name is required');
      return;
    }

    try {
      setCloningId(category._id);
      setError(null);

      const response = await fetch('/api/categories', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        body: JSON.stringify({
          name: newName.trim(),
          description: category.description || '',
          icon: category.icon || '',
          subcategories: category.subcategories || [],
          type: category.type || categoryType,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to clone category');
      }

      // Close modal and refresh
      setCloneModal(null);
      await fetchCategories(categoryType);
    } catch (err) {
      console.error('Clone category error:', err);
      setError(err.message || 'Failed to clone category');
    } finally {
      setCloningId(null);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">Categories</h1>
            <p className="text-sm sm:text-base ds-text-secondary mt-2">Manage categories by area</p>
          </div>
          {canCreate && (
            <Link
              href="/categories/new"
              className="ds-bg-accent-primary hover:bg-blue-700 active:bg-blue-800 text-white font-medium px-4 sm:px-6 py-2.5 rounded-lg transition-colors touch-manipulation text-sm sm:text-base text-center"
            >
              + Create Category
            </Link>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Category Type Filter */}
        <div className="mb-6">
          <label className="block text-sm font-semibold ds-text-secondary mb-2">
            Category Type
          </label>
          <select
            value={categoryType}
            onChange={(e) => {
              const nextType = e.target.value;
              setCategoryType(nextType);
              setPage(1);
              fetchCategories(nextType, 1);
            }}
            className="w-full max-w-xs px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Categories Grid */}
        {loading ? (
          <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 ds-text-secondary">Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="ds-bg-surface rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-xl font-semibold ds-text-primary mb-2">No categories found</h3>
            <p className="ds-text-secondary mb-6">
              {canCreate
                ? 'Get started by creating your first category'
                : 'No categories have been created yet. Contact an Owner to create categories.'}
            </p>
            {canCreate && (
              <Link
                href="/categories/new"
                className="inline-block ds-bg-accent-primary hover:bg-blue-700 active:bg-blue-800 text-white font-medium px-6 py-2.5 rounded-lg transition-colors touch-manipulation"
              >
                Create First Category
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {categories.map((category) => (
              <div
                key={category._id}
                className="ds-bg-surface rounded-lg shadow p-4 sm:p-6 hover:shadow-md transition border ds-border-subtle"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {category.icon && (
                      <span className="text-3xl">{category.icon}</span>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold ds-text-primary">{category.name}</h3>
                      {category.description && (
                        <p className="text-sm ds-text-secondary mt-1">{category.description}</p>
                      )}
                      <p className="text-xs ds-text-muted mt-1">
                        Type: {(category.type || categoryType).replace('_', ' ')}
                      </p>
                      {(category.usageTotal !== undefined ? category.usageTotal : category.usageCount || 0) > 0 && (
                        <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => toggleUsageExpansion(category._id)}
                          className="text-xs ds-text-accent-primary hover:ds-text-accent-hover active:ds-text-accent-hover font-medium flex items-center gap-1 touch-manipulation min-h-[44px] py-2"
                        >
                            <span>
                              Used by{' '}
                              {category.usageTotal !== undefined
                                ? category.usageTotal
                                : category.usageCount || 0}{' '}
                              record
                              {(category.usageTotal !== undefined
                                ? category.usageTotal
                                : category.usageCount || 0) !== 1
                                ? 's'
                                : ''}
                            </span>
                            {category.usageDetails && category.usageDetails.length > 0 && (
                              <svg
                                className={`w-3 h-3 transition-transform ${expandedUsage.has(category._id) ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </button>
                          {expandedUsage.has(category._id) && category.usageDetails && category.usageDetails.length > 0 && (
                            <div className="mt-2 pl-2 border-l-2 border-blue-400/60 space-y-1">
                              {category.usageDetails.map((detail, idx) => (
                                <div key={idx} className="text-xs ds-text-secondary flex justify-between">
                                  <span>{detail.label}:</span>
                                  <span className="font-semibold ds-text-primary">{detail.count}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {(category.usageTotal !== undefined ? category.usageTotal : category.usageCount || 0) === 0 && (
                        <p className="text-xs ds-text-muted mt-1 italic">Not in use</p>
                      )}
                    </div>
                  </div>
                </div>
                {category.subcategories && category.subcategories.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-semibold ds-text-secondary mb-2 leading-normal">Subcategories:</p>
                    <div className="flex flex-wrap gap-2">
                      {category.subcategories.map((sub, idx) => (
                        <span
                          key={idx}
                          className="inline-flex px-2 py-1 text-xs ds-bg-surface-muted ds-text-secondary rounded"
                        >
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t text-sm ds-text-secondary leading-normal">
                  <div className="flex items-center justify-between">
                    <span>
                      Created:{' '}
                      {category.createdAt
                        ? new Date(category.createdAt).toLocaleDateString()
                        : 'N/A'}
                    </span>
                    {canCreate && (
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/categories/${category._id}`}
                          className="px-3 py-1.5 bg-blue-500/10 ds-text-accent-primary hover:bg-blue-500/20 active:bg-blue-500/30 text-xs font-medium rounded-lg transition-colors touch-manipulation border border-blue-400/60"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleCloneClick(category)}
                          disabled={cloningId === category._id}
                          className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 active:bg-green-200 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                        >
                          {cloningId === category._id ? 'Cloning...' : 'Clone'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(category._id)}
                          disabled={deletingId === category._id}
                          className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                        >
                          {deletingId === category._id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination & Summary */}
        {categories.length > 0 && (
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ds-bg-surface rounded-lg shadow p-4 sm:p-6 border ds-border-subtle">
            <p className="text-sm ds-text-secondary text-center sm:text-left">
              Total Categories:{' '}
              <span className="font-semibold ds-text-primary">
                {total || categories.length}
              </span>
            </p>
            <div className="flex items-center justify-center sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (page > 1) {
                    const nextPage = page - 1;
                    setPage(nextPage);
                    fetchCategories(categoryType, nextPage);
                  }
                }}
                disabled={page <= 1 || loading}
                className="px-4 py-2 text-sm rounded-lg border ds-border-subtle ds-text-secondary hover:ds-bg-surface-muted active:ds-bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation font-medium"
              >
                Previous
              </button>
              <span className="text-sm ds-text-secondary px-2">
                Page{' '}
                <span className="font-semibold ds-text-primary">{page}</span>
                {total > 0 && (
                  <>
                    {' '}
                    of{' '}
                    <span className="font-semibold ds-text-primary">
                      {Math.max(1, Math.ceil((total || 0) / PAGE_SIZE))}
                    </span>
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;
                  if (page < totalPages) {
                    const nextPage = page + 1;
                    setPage(nextPage);
                    fetchCategories(categoryType, nextPage);
                  }
                }}
                disabled={loading || (total > 0 && page >= Math.max(1, Math.ceil(total / PAGE_SIZE)))}
                className="px-4 py-2 text-sm rounded-lg border ds-border-subtle ds-text-secondary hover:ds-bg-surface-muted active:ds-bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Clone Modal */}
        {cloneModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 safe-area-inset">
            <div className="ds-bg-surface rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold ds-text-primary mb-4">Clone Category</h3>
              <p className="text-sm ds-text-secondary mb-4">
                Create a copy of <span className="font-semibold">{cloneModal.category.name}</span> with a new name.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-semibold ds-text-secondary mb-2">
                  New Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={cloneModal.newName}
                  onChange={(e) =>
                    setCloneModal({ ...cloneModal, newName: e.target.value })
                  }
                  placeholder="Enter new category name"
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCloneSubmit();
                    }
                  }}
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCloneModal(null);
                    setError(null);
                  }}
                  className="px-4 py-2.5 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted active:ds-bg-surface-muted ds-text-secondary transition-colors touch-manipulation font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCloneSubmit}
                  disabled={cloningId !== null || !cloneModal.newName?.trim()}
                  className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation font-medium"
                >
                  {cloningId ? 'Cloning...' : 'Clone Category'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 ds-text-secondary">Loading categories...</p>
            </div>
          </div>
        </AppLayout>
      }
    >
      <CategoriesPageContent />
    </Suspense>
  );
}

