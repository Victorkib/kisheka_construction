/**
 * Material Library Picker
 * Single-select picker for material library entries.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MaterialLibrarySearch } from '@/components/material-library/material-library-search';

export function MaterialLibraryPicker({ onSelectMaterial, selectedMaterialId = null }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [filters, setFilters] = useState({
    categoryId: '',
    isCommon: '',
    isActive: 'true',
    search: '',
  });

  const filterValues = useMemo(() => ({
    categoryId: filters.categoryId,
    isCommon: filters.isCommon,
    isActive: filters.isActive,
    search: filters.search,
  }), [filters.categoryId, filters.isCommon, filters.isActive, filters.search]);

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
        if (data.data.pagination) {
          setPagination((prev) => ({
            ...prev,
            ...data.data.pagination,
            limit: data.data.pagination.limit || prev.limit,
          }));
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

  useEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [filterValues]);

  useEffect(() => {
    fetchMaterials(pagination.page, filterValues);
  }, [pagination.page, filterValues, fetchMaterials]);

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
      <MaterialLibrarySearch
        value={filters.search}
        onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
        placeholder="Search materials..."
      />

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
            type="button"
            onClick={() => setFilters({ categoryId: '', isCommon: '', isActive: 'true', search: '' })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 text-sm"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        {loading ? (
          <p className="text-sm text-gray-600">Loading materials...</p>
        ) : materials.length === 0 ? (
          <p className="text-sm text-gray-600">No materials found. Try adjusting filters.</p>
        ) : (
          <div className="space-y-2">
            {materials.map((material) => (
              <div key={material._id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{material.name}</p>
                  <p className="text-xs text-gray-600">
                    Unit: {material.defaultUnit || 'N/A'} • Default Cost: {formatCurrency(material.defaultUnitCost)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectMaterial(material)}
                  className={`px-3 py-1.5 text-xs rounded-lg border ${
                    selectedMaterialId === material._id.toString()
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {selectedMaterialId === material._id.toString() ? 'Selected' : 'Use'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
            disabled={pagination.page <= 1}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-gray-600">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            type="button"
            onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.page + 1, pagination.pages) }))}
            disabled={pagination.page >= pagination.pages}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
