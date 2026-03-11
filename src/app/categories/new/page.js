/**
 * Create New Category Page
 * Form for creating a new category
 * 
 * Route: /categories/new
 * Auth: OWNER only
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { CATEGORY_TYPE_OPTIONS } from '@/lib/constants/category-constants';

export default function NewCategoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [canCreate, setCanCreate] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    subcategories: [],
    type: CATEGORY_TYPE_OPTIONS[0].value,
  });

  const [newSubcategory, setNewSubcategory] = useState('');

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        const role = data.data.role?.toLowerCase();
        const hasPermission = role === 'owner';
        setCanCreate(hasPermission);
        if (!hasPermission) {
          setError('You do not have permission to create categories. Only Owners can create categories.');
        }
      }
    } catch (err) {
      console.error('Fetch user error:', err);
      setError('Failed to verify permissions');
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
    setLoading(true);
    setError(null);

    // Validation
    if (!formData.name || formData.name.trim().length === 0) {
      setError('Category name is required');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim(),
          icon: formData.icon.trim(),
          subcategories: formData.subcategories,
          type: formData.type,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create category');
      }

      // Redirect to categories list
      router.push('/categories');
    } catch (err) {
      setError(err.message);
      console.error('Create category error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!canCreate && user) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-400/60 text-yellow-700 px-4 py-3 rounded mb-6 text-sm sm:text-base">
            <p className="font-semibold">Access Denied</p>
            <p>You do not have permission to create categories. Only Owners can create categories.</p>
          </div>
          <Link href="/categories" className="ds-text-accent-primary hover:ds-text-accent-hover active:ds-text-accent-hover underline text-sm sm:text-base transition-colors touch-manipulation">
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
        <div className="mb-6 sm:mb-8">
          <Link href="/categories" className="ds-text-accent-primary hover:ds-text-accent-hover active:ds-text-accent-hover text-sm sm:text-base mb-4 inline-block transition-colors touch-manipulation">
            ← Back to Categories
          </Link>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">Create New Category</h1>
          <p className="text-sm sm:text-base ds-text-secondary mt-2">Add a new category for a specific area</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded mb-6 flex items-start gap-2 text-sm sm:text-base">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Error</p>
              <p className="break-words">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700 active:text-red-900 flex-shrink-0 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center">
              ×
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="ds-bg-surface rounded-lg shadow border ds-border-subtle p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Category Type */}
          <div>
            <h2 className="text-base sm:text-lg font-semibold ds-text-primary mb-4">Category Type</h2>
            <div>
              <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-1 leading-normal">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus touch-manipulation"
              >
                {CATEGORY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs sm:text-sm ds-text-secondary mt-1 leading-normal">
                Keeps categories organized by feature area
              </p>
            </div>
          </div>

          {/* Basic Information */}
          <div>
            <h2 className="text-base sm:text-lg font-semibold ds-text-primary mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-1 leading-normal">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Concrete, Steel, Electrical"
                  required
                  className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted touch-manipulation"
                />
                <p className="text-xs sm:text-sm ds-text-secondary mt-1 leading-normal">Unique name for this category</p>
              </div>

              <div>
                <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-1 leading-normal">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Category description..."
                  rows={3}
                  className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted touch-manipulation"
                />
              </div>

              <div>
                <label className="block text-sm sm:text-base font-semibold ds-text-secondary mb-1 leading-normal">Icon (Emoji)</label>
                <input
                  type="text"
                  name="icon"
                  value={formData.icon}
                  onChange={handleChange}
                  placeholder="e.g., 🏗️, 📦, ⚡"
                  maxLength={2}
                  className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted touch-manipulation"
                />
                <p className="text-xs sm:text-sm ds-text-secondary mt-1 leading-normal">Optional emoji icon for visual identification</p>
              </div>
            </div>
          </div>

          {/* Subcategories */}
          <div>
            <h2 className="text-base sm:text-lg font-semibold ds-text-primary mb-4">Subcategories (Optional)</h2>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
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
                  className="flex-1 px-3 py-2.5 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted touch-manipulation"
                />
                <button
                  type="button"
                  onClick={handleAddSubcategory}
                  className="px-4 py-2.5 ds-bg-surface-muted ds-text-secondary rounded-lg hover:ds-bg-surface active:ds-bg-surface transition-colors touch-manipulation min-h-[44px] sm:min-h-0"
                >
                  Add
                </button>
              </div>

              {formData.subcategories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.subcategories.map((sub, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      <span className="break-words">{sub}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubcategory(index)}
                        className="ds-text-accent-primary hover:ds-text-accent-hover active:ds-text-accent-hover flex-shrink-0 touch-manipulation min-w-[24px] min-h-[24px] flex items-center justify-center"
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
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4 pt-4 border-t">
            <Link href="/categories" className="w-full sm:w-auto px-6 py-2.5 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted active:ds-bg-surface transition-colors text-center touch-manipulation">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 ds-bg-accent-primary text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              {loading ? 'Creating...' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
