/**
 * Edit Category Page
 * Form for editing an existing category
 *
 * Route: /categories/[id]
 * Auth: OWNER only
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { CATEGORY_TYPE_OPTIONS } from '@/lib/constants/category-constants';

export default function EditCategoryPage() {
  const router = useRouter();
  const params = useParams();
  const categoryId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canEdit, setCanEdit] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    subcategories: [],
    type: CATEGORY_TYPE_OPTIONS[0]?.value,
  });

  const [newSubcategory, setNewSubcategory] = useState('');

  useEffect(() => {
    if (!categoryId) return;
    fetchUserAndCategory();
  }, [categoryId]);

  const fetchUserAndCategory = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load user
      const userResponse = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      const userData = await userResponse.json();
      if (userData.success) {
        setUser(userData.data);
        const role = userData.data.role?.toLowerCase();
        const hasPermission = role === 'owner';
        setCanEdit(hasPermission);
        if (!hasPermission) {
          setError('You do not have permission to edit categories. Only Owners can edit categories.');
          setLoading(false);
          return;
        }
      }

      // Load category details
      const categoryResponse = await fetch(`/api/categories?type=all`, {
        cache: 'no-store',
      });
      const categoryData = await categoryResponse.json();
      if (!categoryData.success) {
        throw new Error(categoryData.error || 'Failed to load category');
      }

      const found = (categoryData.data || []).find((c) => c._id === categoryId);
      if (!found) {
        throw new Error('Category not found');
      }

      setFormData({
        name: found.name || '',
        description: found.description || '',
        icon: found.icon || '',
        subcategories: Array.isArray(found.subcategories) ? found.subcategories : [],
        type: found.type || CATEGORY_TYPE_OPTIONS[0]?.value,
      });
    } catch (err) {
      console.error('Fetch category error:', err);
      setError(err.message || 'Failed to load category');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddSubcategory = () => {
    if (newSubcategory.trim() && !formData.subcategories.includes(newSubcategory.trim())) {
      setFormData((prev) => ({
        ...prev,
        subcategories: [...prev.subcategories, newSubcategory.trim()],
      }));
      setNewSubcategory('');
    }
  };

  const handleRemoveSubcategory = (index) => {
    setFormData((prev) => ({
      ...prev,
      subcategories: prev.subcategories.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!categoryId) return;

    setSaving(true);
    setError(null);

    if (!formData.name || formData.name.trim().length === 0) {
      setError('Category name is required');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/categories/${encodeURIComponent(categoryId)}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          icon: formData.icon.trim(),
          subcategories: formData.subcategories,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update category');
      }

      router.push('/categories');
    } catch (err) {
      console.error('Update category error:', err);
      setError(err.message || 'Failed to update category');
    } finally {
      setSaving(false);
    }
  };

  if (!categoryId) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-red-600">Invalid category URL</p>
        </div>
      </AppLayout>
    );
  }

  if (!canEdit && user) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to edit categories. Only Owners can edit categories.</p>
          </div>
          <Link href="/categories" className="text-blue-600 hover:text-blue-900 underline">
            ← Back to Categories
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/categories" className="text-blue-600 hover:text-blue-900 text-sm mb-4 inline-block">
            ← Back to Categories
          </Link>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
            Edit Category
          </h1>
          <p className="text-gray-600 mt-2">Update category details</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 flex items-start gap-2">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="font-semibold">Error</p>
              <p>{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              ×
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading category...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
            {/* Basic Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                    Category Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Icon (Emoji)</label>
                  <input
                    type="text"
                    name="icon"
                    value={formData.icon}
                    onChange={handleChange}
                    maxLength={2}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* Subcategories */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Subcategories</h2>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubcategory}
                    onChange={(e) => setNewSubcategory(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubcategory();
                      }
                    }}
                    placeholder="Enter subcategory name"
                    className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubcategory}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Add
                  </button>
                </div>

                {formData.subcategories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.subcategories.map((sub, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {sub}
                        <button
                          type="button"
                          onClick={() => handleRemoveSubcategory(index)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Link href="/categories" className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AppLayout>
  );
}

