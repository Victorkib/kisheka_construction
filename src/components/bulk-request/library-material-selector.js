/**
 * Library Material Selector Component
 * Allows selection of materials from the material library
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MaterialLibrarySearch } from '@/components/material-library/material-library-search';

export function LibraryMaterialSelector({ onAddMaterials, selectedLibraryIds = [] }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set(selectedLibraryIds));
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [filters, setFilters] = useState({
    categoryId: '',
    isCommon: '',
    isActive: 'true',
    search: '',
  });

  // Memoize filter values to prevent unnecessary re-renders
  const filterValues = useMemo(() => ({
    categoryId: filters.categoryId,
    isCommon: filters.isCommon,
    isActive: filters.isActive,
    search: filters.search,
  }), [filters.categoryId, filters.isCommon, filters.isActive, filters.search]);

  // Fetch categories on mount
  useEffect(() => {
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
    fetchCategories();
  }, []);

  // Memoized fetchMaterials function to prevent unnecessary recreations
  const fetchMaterials = useCallback(async (page, filterVals) => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(filterVals.categoryId && { categoryId: filterVals.categoryId }),
        ...(filterVals.isCommon && { isCommon: filterVals.isCommon }),
        ...(filterVals.isActive && { isActive: filterVals.isActive }),
        ...(filterVals.search && { search: filterVals.search }),
        sortBy: 'usageCount',
        sortOrder: 'desc',
      });

      const response = await fetch(`/api/material-library?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        setMaterials(data.data.materials || []);
        // Only update pagination if it actually changed
        if (data.data.pagination) {
          setPagination((prev) => {
            const newPagination = data.data.pagination;
            // Preserve limit if not provided
            const updatedPagination = {
              ...newPagination,
              limit: newPagination.limit || prev.limit,
            };
            // Only update if values actually changed
            if (
              prev.page === updatedPagination.page &&
              prev.limit === updatedPagination.limit &&
              prev.total === updatedPagination.total &&
              prev.pages === updatedPagination.pages
            ) {
              return prev; // Return same reference if values are the same
            }
            return updatedPagination;
          });
        }
      } else {
        throw new Error(data.error || 'Failed to fetch materials');
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
      setError(err.message || 'Failed to load materials. Please try again.');
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPagination((prev) => {
      if (prev.page === 1) return prev; // Avoid unnecessary update
      return { ...prev, page: 1 };
    });
  }, [filterValues]);

  // Fetch materials when page or filters change
  useEffect(() => {
    fetchMaterials(pagination.page, filterValues);
  }, [pagination.page, filterValues, fetchMaterials]);

  const handleToggleSelect = (materialId) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(materialId)) {
        newSet.delete(materialId);
      } else {
        newSet.add(materialId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === materials.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(materials.map((m) => m._id.toString())));
    }
  };

  const handleAddSelected = () => {
    const selectedMaterials = materials.filter((m) => selectedIds.has(m._id.toString()));
    
    const materialsToAdd = selectedMaterials.map((material) => ({
      name: material.name,
      quantityNeeded: 1, // Default quantity
      unit: material.defaultUnit,
      categoryId: material.categoryId?.toString(),
      category: material.category,
      estimatedUnitCost: material.defaultUnitCost || null,
      libraryMaterialId: material._id.toString(),
      description: material.description || '',
      specifications: material.specifications || '',
    }));

    onAddMaterials(materialsToAdd);
    setSelectedIds(new Set()); // Clear selection after adding
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'N/A';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div>
        <MaterialLibrarySearch
          value={filters.search}
          onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
          placeholder="Search materials..."
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
          <select
            value={filters.categoryId}
            onChange={(e) => setFilters((prev) => ({ ...prev, categoryId: e.target.value }))}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" className="text-gray-900">All Categories</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id} className="text-gray-900">
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.isCommon === 'true'}
              onChange={(e) => setFilters((prev) => ({ ...prev, isCommon: e.target.checked ? 'true' : '' }))}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Common Only</span>
          </label>
        </div>
        <div className="flex items-end">
          <button
            onClick={() => setFilters({ categoryId: '', isCommon: '', isActive: 'true', search: '' })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 text-sm"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          <p className="text-sm font-medium">{error}</p>
          <button
            onClick={() => fetchMaterials(pagination.page, filterValues)}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Materials List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading materials...</p>
        </div>
      ) : error ? (
        null // Error message already shown above
      ) : materials.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No materials found</p>
          <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          {/* Select All & Add Button */}
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.size > 0 && selectedIds.size === materials.length}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Select All ({selectedIds.size} selected)
              </span>
            </label>
            <button
              onClick={handleAddSelected}
              disabled={selectedIds.size === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Add Selected ({selectedIds.size})
            </button>
          </div>

          {/* Materials Grid */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {materials.map((material) => {
                const isSelected = selectedIds.has(material._id.toString());
                return (
                  <div
                    key={material._id}
                    onClick={() => handleToggleSelect(material._id.toString())}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-sm">{material.name}</h4>
                        {material.category && (
                          <p className="text-xs text-gray-500 mt-1">{material.category}</p>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(material._id.toString())}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>Unit:</span>
                        <span className="font-medium">{material.defaultUnit}</span>
                      </div>
                      {material.defaultUnitCost && (
                        <div className="flex justify-between">
                          <span>Cost:</span>
                          <span className="font-medium">{formatCurrency(material.defaultUnitCost)}</span>
                        </div>
                      )}
                      {material.isCommon && (
                        <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
                          Common
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="text-sm text-gray-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} materials
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1 || loading}
                    className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      let pageNum;
                      if (pagination.pages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.pages - 2) {
                        pageNum = pagination.pages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                          disabled={loading}
                          className={`px-3 py-1 rounded-lg text-sm ${
                            pagination.page === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 hover:bg-gray-50'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.pages || loading}
                    className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
  );
}

