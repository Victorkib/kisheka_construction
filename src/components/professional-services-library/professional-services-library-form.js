/**
 * Professional Services Library Form Component
 * Reusable form for creating and editing library professionals
 */

'use client';

import { useState, useEffect } from 'react';
import {
  ENGINEER_SPECIALIZATIONS,
  CONTRACT_TYPES,
  PAYMENT_SCHEDULES,
  VISIT_FREQUENCIES,
} from '@/lib/constants/professional-services-constants';
import { getProfessionalTypeLabel } from '@/lib/professional-services-helpers';

export function ProfessionalServicesLibraryForm({
  initialData = null,
  onSubmit,
  onCancel,
  loading = false,
  error = null,
  isEdit = false,
}) {
  const inputFocusClass = 'focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-primary';

  const [formData, setFormData] = useState({
    name: '',
    type: '',
    description: '',
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    registrationNumber: '',
    licenseNumber: '',
    specialization: '',
    defaultContractType: '',
    defaultPaymentSchedule: '',
    defaultVisitFrequency: '',
    defaultHourlyRate: '',
    defaultPerVisitRate: '',
    defaultPerFloorRate: '',
    defaultMonthlyRetainer: '',
    isCommon: false,
    isActive: true,
    tags: [],
  });

  const [tagInput, setTagInput] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState(null);

  // Load roles for dynamic professional type options
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setRolesLoading(true);
        setRolesError(null);
        const response = await fetch('/api/professional-roles', {
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to load professional roles');
        }
        setRoles(data.data.roles || []);
      } catch (err) {
        console.error('Error loading professional roles:', err);
        setRolesError(err.message || 'Failed to load roles');
      } finally {
        setRolesLoading(false);
      }
    };

    fetchRoles();
  }, []);

  // Load initial data if editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        type: initialData.type || '',
        description: initialData.description || '',
        companyName: initialData.companyName || '',
        firstName: initialData.firstName || '',
        lastName: initialData.lastName || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        address: initialData.address || '',
        registrationNumber: initialData.registrationNumber || '',
        licenseNumber: initialData.licenseNumber || '',
        specialization: initialData.specialization || '',
        defaultContractType: initialData.defaultContractType || '',
        defaultPaymentSchedule: initialData.defaultPaymentSchedule || '',
        defaultVisitFrequency: initialData.defaultVisitFrequency || '',
        defaultHourlyRate: initialData.defaultHourlyRate?.toString() || '',
        defaultPerVisitRate: initialData.defaultPerVisitRate?.toString() || '',
        defaultPerFloorRate: initialData.defaultPerFloorRate?.toString() || '',
        defaultMonthlyRetainer: initialData.defaultMonthlyRetainer?.toString() || '',
        isCommon: initialData.isCommon || false,
        isActive: initialData.isActive !== undefined ? initialData.isActive : true,
        tags: initialData.tags || [],
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Basic validation
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Professional name is required';
    }
    if (!formData.type) {
      errors.type = 'Professional type is required';
    }
    if (!formData.companyName && (!formData.firstName || !formData.lastName)) {
      errors.name = 'Either company name or first name and last name are required';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email address';
    }

    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    // Prepare submission data
    const submitData = {
      ...formData,
      defaultHourlyRate: formData.defaultHourlyRate ? parseFloat(formData.defaultHourlyRate) : null,
      defaultPerVisitRate: formData.defaultPerVisitRate ? parseFloat(formData.defaultPerVisitRate) : null,
      defaultPerFloorRate: formData.defaultPerFloorRate ? parseFloat(formData.defaultPerFloorRate) : null,
      defaultMonthlyRetainer: formData.defaultMonthlyRetainer ? parseFloat(formData.defaultMonthlyRetainer) : null,
    };

    onSubmit(submitData);
  };

  const getContractTypes = () => {
    if (!formData.type) return CONTRACT_TYPES.ALL;
    return formData.type === 'architect'
      ? CONTRACT_TYPES.ARCHITECT
      : formData.type === 'engineer'
        ? CONTRACT_TYPES.ENGINEER
        : CONTRACT_TYPES.ALL;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="ds-bg-danger/10 border ds-border-danger/40 ds-text-danger px-4 py-3 rounded-lg flex items-start gap-2">
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
          {/* Professional Type */}
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Professional Type <span className="text-red-500">*</span>
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg ${inputFocusClass} ${
                validationErrors.type ? 'border-red-400/60' : 'ds-border-subtle'
              }`}
            >
              <option value="">Select Type</option>
              {roles.length > 0
                ? roles.map((role) => (
                    <option key={role.slug} value={role.slug} className="ds-text-primary">
                      {role.name}
                    </option>
                  ))
                : null}
            </select>
            {validationErrors.type && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.type}</p>
            )}
            {rolesLoading && !rolesError && (
              <p className="mt-1 text-xs ds-text-muted">Loading professional roles…</p>
            )}
            {rolesError && (
              <p className="mt-1 text-xs text-amber-700">
                {rolesError}. You can still select previously configured types.
              </p>
            )}
          </div>

          {/* Name (Company or Individual) */}
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Professional/Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., John Doe Architects or ABC Engineering Firm"
              required
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg ${inputFocusClass} placeholder:ds-text-muted ${
                validationErrors.name ? 'border-red-400/60' : 'ds-border-subtle'
              }`}
            />
            {validationErrors.name && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
            )}
            <p className="mt-1 text-sm ds-text-secondary">Full name or company name</p>
          </div>

          {/* Company Name (Optional) */}
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Company Name (if applicable)
            </label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              placeholder="e.g., ABC Architects Ltd"
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} placeholder:ds-text-muted`}
            />
          </div>

          {/* Individual Name Fields (if no company) */}
          {!formData.companyName && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold ds-text-secondary mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="First name"
                  required={!formData.companyName}
                  className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} placeholder:ds-text-muted`}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold ds-text-secondary mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Last name"
                  required={!formData.companyName}
                  className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} placeholder:ds-text-muted`}
                />
              </div>
            </div>
          )}

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
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} placeholder:ds-text-muted`}
            />
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div>
        <h2 className="text-lg font-semibold ds-text-primary mb-4">Contact Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="email@example.com"
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border rounded-lg ${inputFocusClass} placeholder:ds-text-muted ${
                validationErrors.email ? 'border-red-400/60' : 'ds-border-subtle'
              }`}
            />
            {validationErrors.email && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Phone
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+254712345678"
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} placeholder:ds-text-muted`}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-semibold ds-text-secondary mb-1">
            Address
          </label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Physical address..."
            rows={2}
            className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} placeholder:ds-text-muted`}
          />
        </div>
      </div>

      {/* Professional Credentials */}
      <div>
        <h2 className="text-lg font-semibold ds-text-primary mb-4">Professional Credentials</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Registration Number
            </label>
            <input
              type="text"
              name="registrationNumber"
              value={formData.registrationNumber}
              onChange={handleChange}
              placeholder="Professional registration number"
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} placeholder:ds-text-muted`}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              License Number
            </label>
            <input
              type="text"
              name="licenseNumber"
              value={formData.licenseNumber}
              onChange={handleChange}
              placeholder="Architecture/Engineering license"
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} placeholder:ds-text-muted`}
            />
          </div>
        </div>
        {formData.type === 'engineer' && (
          <div className="mt-4">
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Specialization
            </label>
            <select
              name="specialization"
              value={formData.specialization}
              onChange={handleChange}
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass}`}
            >
              <option value="">Select Specialization (Optional)</option>
              {ENGINEER_SPECIALIZATIONS.map((spec) => (
                <option key={spec} value={spec} className="ds-text-primary">
                  {spec.charAt(0).toUpperCase() + spec.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Default Contract Terms */}
      <div>
        <h2 className="text-lg font-semibold ds-text-primary mb-4">Default Contract Terms (Optional)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Default Contract Type
            </label>
            <select
              name="defaultContractType"
              value={formData.defaultContractType}
              onChange={handleChange}
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass}`}
            >
              <option value="">Select (Optional)</option>
              {getContractTypes().map((type) => (
                <option key={type} value={type} className="ds-text-primary">
                  {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Default Payment Schedule
            </label>
            <select
              name="defaultPaymentSchedule"
              value={formData.defaultPaymentSchedule}
              onChange={handleChange}
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass}`}
            >
              <option value="">Select (Optional)</option>
              {PAYMENT_SCHEDULES.map((schedule) => (
                <option key={schedule} value={schedule} className="ds-text-primary">
                  {schedule.charAt(0).toUpperCase() + schedule.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
        {formData.type === 'engineer' && (
          <div className="mt-4">
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Default Visit Frequency
            </label>
            <select
              name="defaultVisitFrequency"
              value={formData.defaultVisitFrequency}
              onChange={handleChange}
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass}`}
            >
              <option value="">Select (Optional)</option>
              {VISIT_FREQUENCIES.map((freq) => (
                <option key={freq} value={freq} className="ds-text-primary">
                  {freq.charAt(0).toUpperCase() + freq.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Default Rates */}
      <div>
        <h2 className="text-lg font-semibold ds-text-primary mb-4">Default Rates (Optional)</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Hourly Rate (KES)
            </label>
            <input
              type="number"
              name="defaultHourlyRate"
              value={formData.defaultHourlyRate}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} placeholder:ds-text-muted`}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Per-Visit Rate (KES)
            </label>
            <input
              type="number"
              name="defaultPerVisitRate"
              value={formData.defaultPerVisitRate}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} placeholder:ds-text-muted`}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Per-Floor Rate (KES)
            </label>
            <input
              type="number"
              name="defaultPerFloorRate"
              value={formData.defaultPerFloorRate}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} placeholder:ds-text-muted`}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold ds-text-secondary mb-1">
              Monthly Retainer (KES)
            </label>
            <input
              type="number"
              name="defaultMonthlyRetainer"
              value={formData.defaultMonthlyRetainer}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={`w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} placeholder:ds-text-muted`}
            />
          </div>
        </div>
      </div>

      {/* Tags */}
      <div>
        <h2 className="text-lg font-semibold ds-text-primary mb-4">Tags (Optional)</h2>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            placeholder="Add a tag and press Enter"
            className={`flex-1 px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg ${inputFocusClass} placeholder:ds-text-muted`}
          />
          <button
            type="button"
            onClick={handleAddTag}
            className="px-4 py-2 ds-bg-surface-muted ds-text-secondary rounded-lg hover:ds-bg-surface-muted"
          >
            Add
          </button>
        </div>
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm ds-bg-accent-subtle ds-text-accent-primary"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-2 ds-text-accent-primary hover:ds-text-accent-hover"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Options */}
      <div>
        <h2 className="text-lg font-semibold ds-text-primary mb-4">Options</h2>
        <div className="space-y-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              name="isCommon"
              checked={formData.isCommon}
              onChange={handleChange}
              className="w-4 h-4 ds-text-accent-primary ds-border-subtle rounded focus:ring-ds-accent-focus"
            />
            <span className="text-sm font-medium ds-text-secondary">
              Mark as Commonly Used
            </span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="w-4 h-4 ds-text-accent-primary ds-border-subtle rounded focus:ring-ds-accent-focus"
            />
            <span className="text-sm font-medium ds-text-secondary">
              Active (Professional is available for assignment)
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
              <span className="ds-text-secondary">Times Assigned:</span>
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
          className="px-6 py-2 ds-bg-accent-primary text-white rounded-lg hover:ds-bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Professional' : 'Create Professional')}
        </button>
      </div>
    </form>
  );
}

