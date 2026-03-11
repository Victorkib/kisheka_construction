/**
 * Material Library Form Component
 * Reusable form for creating and editing library materials
 */

'use client';

import { useState, useEffect } from 'react';
import { VALID_UNITS } from '@/lib/schemas/material-library-schema';

export function MaterialLibraryForm({
  initialData = null,
  categories = [],
  onSubmit,
  onCancel,
  loading = false,
  error = null,
  isEdit = false,
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    category: '',
    defaultUnit: 'piece',
    defaultUnitCost: '',
    materialCode: '',
    brand: '',
    specifications: '',
    isCommon: false,
    isActive: true,
  });

  const [customUnit, setCustomUnit] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  // Load initial data if editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        categoryId: initialData.categoryId?.toString() || '',
        category: initialData.category || '',
        defaultUnit: initialData.defaultUnit || 'piece',
        defaultUnitCost: initialData.defaultUnitCost?.toString() || '',
        materialCode: initialData.materialCode || '',
        brand: initialData.brand || '',
        specifications: initialData.specifications || '',
        isCommon: initialData.isCommon || false,
        isActive: initialData.isActive !== undefined ? initialData.isActive : true,
      });
      if (initialData.defaultUnit && !VALID_UNITS.includes(initialData.defaultUnit)) {
        setCustomUnit(initialData.defaultUnit);
        setFormData((prev) => ({ ...prev, defaultUnit: 'others' }));
      }
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'categoryId') {
      const selectedCategory = categories.find((cat) => cat._id === value);
      setFormData((prev) => ({
        ...prev,
        categoryId: value,
        category: selectedCategory ? selectedCategory.name : '',
      }));
    } else if (name === 'defaultUnit') {
      setFormData((prev) => ({
        ...prev,
        defaultUnit: value,
      }));
      if (value !== 'others') {
        setCustomUnit('');
      }
    } else if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }

    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const errors = {};

    if (!formData.name || formData.name.trim().length < 2) {
      errors.name = 'Material name is required and must be at least 2 characters';
    }

    if (formData.name && formData.name.length > 200) {
      errors.name = 'Material name must be less than 200 characters';
    }

    if (!formData.defaultUnit) {
      errors.defaultUnit = 'Unit is required';
    }

    if (formData.defaultUnit === 'others' && !customUnit.trim()) {
      errors.customUnit = 'Please enter a custom unit name';
    }

    if (formData.defaultUnitCost && parseFloat(formData.defaultUnitCost) < 0) {
      errors.defaultUnitCost = 'Default unit cost must be >= 0';
    }

    if (formData.description && formData.description.length > 1000) {
      errors.description = 'Description must be less than 1000 characters';
    }

    if (formData.materialCode && formData.materialCode.length > 50) {
      errors.materialCode = 'Material code must be less than 50 characters';
    }

    if (formData.brand && formData.brand.length > 100) {
      errors.brand = 'Brand must be less than 100 characters';
    }

    if (formData.specifications && formData.specifications.length > 500) {
      errors.specifications = 'Specifications must be less than 500 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    const submitData = {
      ...formData,
      defaultUnit: formData.defaultUnit === 'others' ? customUnit.trim() : formData.defaultUnit,
      defaultUnitCost: formData.defaultUnitCost ? parseFloat(formData.defaultUnitCost) : null,
      categoryId: formData.categoryId || null,
    };

    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Basic Information */}
      <div>
        <h2 className="text-lg font-semibold ds-text-primary mb-4">Basic Information</h2>
        <div className="space-y-4">
          {/* Material Name */}
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Material Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Cement (50kg bag)"
              required
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:ds-text-muted ${
                validationErrors.name ? 'border-red-400/60' : 'ds-border-subtle'
              }`}
            />
            {validationErrors.name && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
            )}
            <p className="mt-1 text-sm ds-text-secondary">Unique name for this material</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Optional description..."
              rows={3}
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:ds-text-muted ${
                validationErrors.description ? 'border-red-400/60' : 'ds-border-subtle'
              }`}
            />
            {validationErrors.description && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.description}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Category
            </label>
            <select
              name="categoryId"
              value={formData.categoryId}
              onChange={handleChange}
              className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Category (Optional)</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id} className="ds-text-primary">
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Unit & Cost */}
      <div>
        <h2 className="text-lg font-semibold ds-text-primary mb-4">Unit & Cost</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Default Unit */}
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Default Unit <span className="text-red-500">*</span>
            </label>
            <select
              name="defaultUnit"
              value={formData.defaultUnit}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.defaultUnit ? 'border-red-400/60' : 'ds-border-subtle'
              }`}
            >
              {VALID_UNITS.map((unit) => (
                <option key={unit} value={unit} className="ds-text-primary">
                  {unit.charAt(0).toUpperCase() + unit.slice(1)}
                </option>
              ))}
            </select>
            {validationErrors.defaultUnit && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.defaultUnit}</p>
            )}
          </div>

          {/* Custom Unit (if "others" selected) */}
          {formData.defaultUnit === 'others' && (
            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">
                Custom Unit Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                placeholder="Enter custom unit"
                className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:ds-text-muted ${
                  validationErrors.customUnit ? 'border-red-400/60' : 'ds-border-subtle'
                }`}
              />
              {validationErrors.customUnit && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.customUnit}</p>
              )}
            </div>
          )}

          {/* Default Unit Cost */}
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Default Unit Cost (KES)
            </label>
            <input
              type="number"
              name="defaultUnitCost"
              value={formData.defaultUnitCost}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:ds-text-muted ${
                validationErrors.defaultUnitCost ? 'border-red-400/60' : 'ds-border-subtle'
              }`}
            />
            {validationErrors.defaultUnitCost && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.defaultUnitCost}</p>
            )}
            <p className="mt-1 text-sm ds-text-secondary">Optional estimated cost per unit</p>
          </div>
        </div>
      </div>

      {/* Additional Details */}
      <div>
        <h2 className="text-lg font-semibold ds-text-primary mb-4">Additional Details (Optional)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Material Code */}
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Material Code
            </label>
            <input
              type="text"
              name="materialCode"
              value={formData.materialCode}
              onChange={handleChange}
              placeholder="e.g., CEM-001"
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:ds-text-muted ${
                validationErrors.materialCode ? 'border-red-400/60' : 'ds-border-subtle'
              }`}
            />
            {validationErrors.materialCode && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.materialCode}</p>
            )}
          </div>

          {/* Brand */}
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Brand
            </label>
            <input
              type="text"
              name="brand"
              value={formData.brand}
              onChange={handleChange}
              placeholder="e.g., Bamburi, Dangote"
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:ds-text-muted ${
                validationErrors.brand ? 'border-red-400/60' : 'ds-border-subtle'
              }`}
            />
            {validationErrors.brand && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.brand}</p>
            )}
          </div>
        </div>

        {/* Specifications */}
        <div className="mt-4">
          <label className="block text-sm font-semibold ds-text-secondary mb-1">
            Specifications
          </label>
          <textarea
            name="specifications"
            value={formData.specifications}
            onChange={handleChange}
            placeholder="e.g., Grade 42.5, 12mm diameter, 6m length"
            rows={2}
            className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:ds-text-muted ${
              validationErrors.specifications ? 'border-red-400/60' : 'ds-border-subtle'
            }`}
          />
          {validationErrors.specifications && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.specifications}</p>
          )}
        </div>
      </div>

      {/* Options */}
      <div>
        <h2 className="text-lg font-semibold ds-text-primary mb-4">Options</h2>
        <div className="space-y-3">
          {/* Mark as Common */}
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              name="isCommon"
              checked={formData.isCommon}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 ds-border-subtle rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium ds-text-secondary">
              Mark as Commonly Used
            </span>
          </label>

          {/* Active Status */}
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 ds-border-subtle rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium ds-text-secondary">
              Active (Material is available for use)
            </span>
          </label>
        </div>
      </div>

      {/* Usage Statistics (Edit Mode Only) */}
      {isEdit && initialData && (
        <div className="ds-bg-surface-muted rounded-lg p-4">
          <h3 className="text-sm font-semibold ds-text-secondary mb-2">Usage Statistics</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="ds-text-secondary">Times Used:</span>
              <span className="ml-2 font-medium ds-text-primary">
                {initialData.usageCount || 0}
              </span>
            </div>
            {initialData.lastUsedAt && (
              <div>
                <span className="ds-text-secondary">Last Used:</span>
                <span className="ml-2 font-medium ds-text-primary">
                  {new Date(initialData.lastUsedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submit Buttons */}
      <div className="flex justify-end gap-4 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border ds-border-subtle rounded-lg hover:ds-bg-surface-muted ds-text-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Material' : 'Create Material')}
        </button>
      </div>
    </form>
  );
}

