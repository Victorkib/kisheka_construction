/**
 * Activity Template Form Component
 * Reusable form for creating and editing activity templates
 * Pattern: Similar to material-template-form.js
 */

'use client';

import { useState, useEffect } from 'react';
import {
  TEMPLATE_STATUS,
  TEMPLATE_CATEGORY_TYPES,
  TEMPLATE_PROFESSIONAL_TYPES,
  getActivityTypesForProfessionalType,
} from '@/lib/constants/activity-template-constants';
import { PROJECT_PHASES } from '@/lib/schemas/material-template-schema';
import {
  VISIT_PURPOSES,
  INSPECTION_TYPES,
  COMPLIANCE_STATUSES,
} from '@/lib/constants/professional-activities-constants';

export function ActivityTemplateForm({
  initialData = null,
  onSubmit,
  onCancel,
  loading = false,
  showUsageStats = false,
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    type: initialData?.type || '',
    activityType: initialData?.activityType || '',
    isPublic: initialData?.isPublic || false,
    status: initialData?.status || (initialData?.isPublic ? TEMPLATE_STATUS.COMMUNITY : TEMPLATE_STATUS.PRIVATE),
    templateCategory: initialData?.templateCategory || '',
    templateType: initialData?.templateType || '',
    tags: initialData?.tags || [],
    projectPhase: initialData?.projectPhase || '',
    applicableFloors: initialData?.applicableFloors === 'all' ? 'all' : (initialData?.applicableFloors || []),
    defaultData: initialData?.defaultData || {
      visitPurpose: '',
      visitDuration: '',
      inspectionType: '',
      areasInspected: [],
      complianceStatus: '',
      notes: '',
      observations: '',
      recommendations: '',
      attendees: [],
      affectedAreas: [],
      revisionReason: '',
    },
    defaultFeeAmount: initialData?.defaultFeeAmount?.toString() || '',
    defaultExpenseAmount: initialData?.defaultExpenseAmount?.toString() || '',
    expiresAt: initialData?.expiresAt ? new Date(initialData.expiresAt).toISOString().split('T')[0] : '',
  });

  const [tagInput, setTagInput] = useState('');
  const [attendeeInput, setAttendeeInput] = useState('');
  const [areaInput, setAreaInput] = useState('');
  const [affectedAreaInput, setAffectedAreaInput] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  // Get available activity types based on selected type
  const availableActivityTypes = formData.type
    ? getActivityTypesForProfessionalType(formData.type)
    : [];

  const handleChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      
      // Auto-update status when isPublic changes
      if (field === 'isPublic') {
        if (value && updated.status === TEMPLATE_STATUS.PRIVATE) {
          updated.status = TEMPLATE_STATUS.COMMUNITY;
        } else if (!value && updated.status === TEMPLATE_STATUS.COMMUNITY) {
          updated.status = TEMPLATE_STATUS.PRIVATE;
        }
      }
      
      // Clear activity type if type changes
      if (field === 'type' && prev.type !== value) {
        updated.activityType = '';
      }
      
      return updated;
    });
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleDefaultDataChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      defaultData: {
        ...prev.defaultData,
        [field]: value,
      },
    }));
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

  const handleRemoveTag = (tag) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const handleAddAttendee = () => {
    if (attendeeInput.trim() && !formData.defaultData.attendees.includes(attendeeInput.trim())) {
      handleDefaultDataChange('attendees', [...formData.defaultData.attendees, attendeeInput.trim()]);
      setAttendeeInput('');
    }
  };

  const handleRemoveAttendee = (attendee) => {
    handleDefaultDataChange('attendees', formData.defaultData.attendees.filter((a) => a !== attendee));
  };

  const handleAddArea = () => {
    if (areaInput.trim() && !formData.defaultData.areasInspected.includes(areaInput.trim())) {
      handleDefaultDataChange('areasInspected', [...formData.defaultData.areasInspected, areaInput.trim()]);
      setAreaInput('');
    }
  };

  const handleRemoveArea = (area) => {
    handleDefaultDataChange('areasInspected', formData.defaultData.areasInspected.filter((a) => a !== area));
  };

  const handleAddAffectedArea = () => {
    if (affectedAreaInput.trim() && !formData.defaultData.affectedAreas.includes(affectedAreaInput.trim())) {
      handleDefaultDataChange('affectedAreas', [...formData.defaultData.affectedAreas, affectedAreaInput.trim()]);
      setAffectedAreaInput('');
    }
  };

  const handleRemoveAffectedArea = (area) => {
    handleDefaultDataChange('affectedAreas', formData.defaultData.affectedAreas.filter((a) => a !== area));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    const errors = {};
    if (!formData.name || formData.name.trim().length < 2) {
      errors.name = 'Template name is required and must be at least 2 characters';
    }
    if (!formData.type) {
      errors.type = 'Professional type is required';
    }
    if (!formData.activityType) {
      errors.activityType = 'Activity type is required';
    }

    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    // Prepare submission data
    const submitData = {
      ...formData,
      defaultFeeAmount: formData.defaultFeeAmount ? parseFloat(formData.defaultFeeAmount) : null,
      defaultExpenseAmount: formData.defaultExpenseAmount ? parseFloat(formData.defaultExpenseAmount) : null,
      defaultData: {
        ...formData.defaultData,
        visitDuration: formData.defaultData.visitDuration ? parseFloat(formData.defaultData.visitDuration) : null,
      },
      expiresAt: formData.expiresAt || null,
    };

    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Weekly Site Visit"
              required
              className={`w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.name ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {validationErrors.name && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Professional Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              required
              disabled={!!initialData}
              className={`w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.type ? 'border-red-300' : 'border-gray-300'
              } ${initialData ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            >
              <option value="">Select Professional Type</option>
              <option value={TEMPLATE_PROFESSIONAL_TYPES.ARCHITECT}>Architect Activity</option>
              <option value={TEMPLATE_PROFESSIONAL_TYPES.ENGINEER}>Engineer Activity</option>
            </select>
            {validationErrors.type && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.type}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Activity Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.activityType}
              onChange={(e) => handleChange('activityType', e.target.value)}
              required
              disabled={!formData.type}
              className={`w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                validationErrors.activityType ? 'border-red-300' : 'border-gray-300'
              } ${!formData.type ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            >
              <option value="">Select Activity Type</option>
              {availableActivityTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
            {validationErrors.activityType && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.activityType}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Template description..."
              rows={2}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Template Settings */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Template Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Template Category
            </label>
            <select
              value={formData.templateCategory}
              onChange={(e) => handleChange('templateCategory', e.target.value)}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Category (Optional)</option>
              {Object.values(TEMPLATE_CATEGORY_TYPES).map((category) => (
                <option key={category} value={category}>
                  {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Project Phase
            </label>
            <select
              value={formData.projectPhase}
              onChange={(e) => handleChange('projectPhase', e.target.value)}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Phase (Optional)</option>
              {PROJECT_PHASES.map((phase) => (
                <option key={phase} value={phase}>
                  {phase.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.values(TEMPLATE_STATUS).map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isPublic"
              checked={formData.isPublic}
              onChange={(e) => handleChange('isPublic', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isPublic" className="text-sm font-medium text-gray-700 cursor-pointer">
              Make this template public (others can use it)
            </label>
          </div>
        </div>

        {/* Tags */}
        <div className="mt-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Tags
          </label>
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
              placeholder="Add tag and press Enter"
              className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Add
            </button>
          </div>
          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Default Activity Data */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Default Activity Data</h2>
        
        {/* Site Visit Fields */}
        {formData.activityType === 'site_visit' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Visit Purpose
              </label>
              <select
                value={formData.defaultData.visitPurpose || ''}
                onChange={(e) => handleDefaultDataChange('visitPurpose', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Purpose (Optional)</option>
                {VISIT_PURPOSES.map((purpose) => (
                  <option key={purpose} value={purpose}>
                    {purpose.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Visit Duration (Hours)
              </label>
              <input
                type="number"
                value={formData.defaultData.visitDuration || ''}
                onChange={(e) => handleDefaultDataChange('visitDuration', e.target.value)}
                placeholder="0.0"
                min="0"
                step="0.5"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Inspection Fields */}
        {formData.activityType === 'inspection' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Inspection Type
              </label>
              <select
                value={formData.defaultData.inspectionType || ''}
                onChange={(e) => handleDefaultDataChange('inspectionType', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Type (Optional)</option>
                {INSPECTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Compliance Status
              </label>
              <select
                value={formData.defaultData.complianceStatus || ''}
                onChange={(e) => handleDefaultDataChange('complianceStatus', e.target.value)}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Status (Optional)</option>
                {COMPLIANCE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Design Revision Fields */}
        {formData.activityType === 'design_revision' && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Revision Reason
            </label>
            <input
              type="text"
              value={formData.defaultData.revisionReason || ''}
              onChange={(e) => handleDefaultDataChange('revisionReason', e.target.value)}
              placeholder="Default revision reason"
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Areas Inspected (for inspections) */}
        {(formData.activityType === 'inspection' || formData.activityType === 'quality_check') && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Default Areas Inspected
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddArea();
                  }
                }}
                placeholder="Add area and press Enter"
                className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddArea}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Add
              </button>
            </div>
            {formData.defaultData.areasInspected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.defaultData.areasInspected.map((area) => (
                  <span
                    key={area}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                  >
                    {area}
                    <button
                      type="button"
                      onClick={() => handleRemoveArea(area)}
                      className="ml-2 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Affected Areas (for design revisions) */}
        {formData.activityType === 'design_revision' && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Default Affected Areas
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={affectedAreaInput}
                onChange={(e) => setAffectedAreaInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAffectedArea();
                  }
                }}
                placeholder="Add affected area and press Enter"
                className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddAffectedArea}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Add
              </button>
            </div>
            {formData.defaultData.affectedAreas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.defaultData.affectedAreas.map((area) => (
                  <span
                    key={area}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800"
                  >
                    {area}
                    <button
                      type="button"
                      onClick={() => handleRemoveAffectedArea(area)}
                      className="ml-2 text-purple-600 hover:text-purple-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Attendees (for site visits) */}
        {formData.activityType === 'site_visit' && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Default Attendees
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAttendee();
                  }
                }}
                placeholder="Add attendee name and press Enter"
                className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddAttendee}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Add
              </button>
            </div>
            {formData.defaultData.attendees.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.defaultData.attendees.map((attendee) => (
                  <span
                    key={attendee}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    {attendee}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttendee(attendee)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Default Notes and Observations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Default Notes
            </label>
            <textarea
              value={formData.defaultData.notes || ''}
              onChange={(e) => handleDefaultDataChange('notes', e.target.value)}
              placeholder="Default notes..."
              rows={3}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Default Observations
            </label>
            <textarea
              value={formData.defaultData.observations || ''}
              onChange={(e) => handleDefaultDataChange('observations', e.target.value)}
              placeholder="Default observations..."
              rows={3}
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Default Recommendations
          </label>
          <textarea
            value={formData.defaultData.recommendations || ''}
            onChange={(e) => handleDefaultDataChange('recommendations', e.target.value)}
            placeholder="Default recommendations..."
            rows={2}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Financial Defaults */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Defaults (Optional)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Default Fee Amount (KES)
            </label>
            <input
              type="number"
              value={formData.defaultFeeAmount}
              onChange={(e) => handleChange('defaultFeeAmount', e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Default Expense Amount (KES)
            </label>
            <input
              type="number"
              value={formData.defaultExpenseAmount}
              onChange={(e) => handleChange('defaultExpenseAmount', e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Expiration */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Expiration (Optional)</h2>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Expiration Date
          </label>
          <input
            type="date"
            value={formData.expiresAt}
            onChange={(e) => handleChange('expiresAt', e.target.value)}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Optional: Set expiration date for cost-sensitive templates
          </p>
        </div>
      </div>

      {/* Usage Stats (if editing) */}
      {showUsageStats && initialData && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Usage Statistics</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Times Used:</span>
              <span className="ml-2 font-medium text-gray-900">{initialData.usageCount || 0}</span>
            </div>
            {initialData.lastUsedAt && (
              <div>
                <span className="text-gray-600">Last Used:</span>
                <span className="ml-2 font-medium text-gray-900">
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
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (initialData ? 'Updating...' : 'Creating...') : (initialData ? 'Update Template' : 'Create Template')}
        </button>
      </div>
    </form>
  );
}

