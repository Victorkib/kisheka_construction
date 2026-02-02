/**
 * Categories List Page
 * Displays all categories with view for all, create for OWNER
 * 
 * Route: /categories
 */

'use client';

export const revalidate = 60;

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { CATEGORY_TYPE_OPTIONS } from '@/lib/constants/category-constants';

function CategoriesPageContent() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canCreate, setCanCreate] = useState(false);
  const [categoryType, setCategoryType] = useState(CATEGORY_TYPE_OPTIONS[0].value);

  useEffect(() => {
    fetchUser();
    fetchCategories(CATEGORY_TYPE_OPTIONS[0].value);
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
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

  const fetchCategories = async (type) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/categories?type=${encodeURIComponent(type)}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch categories');
      }

      setCategories(data.data || []);
    } catch (err) {
      setError(err.message);
      console.error('Fetch categories error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Categories</h1>
            <p className="text-gray-600 mt-2">Manage categories by area</p>
          </div>
          {canCreate && (
            <Link
              href="/categories/new"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
            >
              + Create Category
            </Link>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Category Type Filter */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Category Type
          </label>
          <select
            value={categoryType}
            onChange={(e) => {
              const nextType = e.target.value;
              setCategoryType(nextType);
              fetchCategories(nextType);
            }}
            className="w-full max-w-xs px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No categories found</h3>
            <p className="text-gray-600 mb-6">
              {canCreate
                ? 'Get started by creating your first category'
                : 'No categories have been created yet. Contact an Owner to create categories.'}
            </p>
            {canCreate && (
              <Link
                href="/categories/new"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition"
              >
                Create First Category
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <div
                key={category._id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {category.icon && (
                      <span className="text-3xl">{category.icon}</span>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                      {category.description && (
                        <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Type: {(category.type || categoryType).replace('_', ' ')}
                      </p>
                      {category.usageCount !== undefined && (
                        <p className="text-xs text-gray-500 mt-1">
                          Used by {category.usageCount} record{category.usageCount !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {category.subcategories && category.subcategories.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-semibold text-gray-700 mb-2 leading-normal">Subcategories:</p>
                    <div className="flex flex-wrap gap-2">
                      {category.subcategories.map((sub, idx) => (
                        <span
                          key={idx}
                          className="inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                        >
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t text-sm text-gray-600 leading-normal">
                  Created: {category.createdAt ? new Date(category.createdAt).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {categories.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">
              Total Categories: <span className="font-semibold text-gray-900">{categories.length}</span>
            </p>
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
              <p className="mt-4 text-gray-600">Loading categories...</p>
            </div>
          </div>
        </AppLayout>
      }
    >
      <CategoriesPageContent />
    </Suspense>
  );
}

