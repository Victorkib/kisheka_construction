/**
 * Material Template Form Component
 * Reusable form for creating and editing templates
 */

'use client';

import { useState, useEffect } from 'react';
import { VALID_UNITS } from '@/lib/schemas/material-library-schema';
import { TEMPLATE_STATUS, TEMPLATE_CATEGORY_TYPES, PROJECT_PHASES } from '@/lib/schemas/material-template-schema';
import { LoadingButton } from '@/components/loading';

export function TemplateForm({
  initialData = null,
  onSubmit,
  onCancel,
  loading = false,
  showUsageStats = false,
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    isPublic: initialData?.isPublic || false,
    status: initialData?.status || (initialData?.isPublic ? TEMPLATE_STATUS.COMMUNITY : TEMPLATE_STATUS.PRIVATE),
    templateCategory: initialData?.templateCategory || '',
    templateType: initialData?.templateType || '',
    tags: initialData?.tags || [],
    projectPhase: initialData?.projectPhase || '',
    applicableFloors: initialData?.applicableFloors || [],
    expiresAt: initialData?.expiresAt || '',
    materials: initialData?.materials || [],
    defaultProjectSettings: initialData?.defaultProjectSettings || {
      defaultUrgency: 'medium',
      defaultReason: '',
      defaultCategoryId: '',
      defaultFloorId: '',
    },
  });

  const [categories, setCategories] = useState([]);
  const [floors, setFloors] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCategories();
    fetchFloors();
  }, []);

  const fetchFloors = async () => {
    try {
      const response = await fetch('/api/floors');
      const data = await response.json();
      if (data.success) {
        setFloors(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching floors:', err);
    }
  };

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

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleMaterialChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = { ...prev };
      updated.materials = [...prev.materials];
      updated.materials[index] = { ...updated.materials[index], [field]: value };

      // Auto-calculate total cost if unit cost or quantity changes
      if (field === 'estimatedUnitCost' || field === 'quantityNeeded') {
        const unitCost =
          field === 'estimatedUnitCost' ? parseFloat(value) : updated.materials[index].estimatedUnitCost;
        const quantity =
          field === 'quantityNeeded' ? parseFloat(value) : updated.materials[index].quantityNeeded;
        if (unitCost && quantity) {
          updated.materials[index].estimatedCost = unitCost * quantity;
        } else {
          updated.materials[index].estimatedCost = null;
        }
      }

      return updated;
    });
  };

  const handleAddMaterial = () => {
    setFormData((prev) => ({
      ...prev,
      materials: [
        ...prev.materials,
        {
          name: '',
          quantityNeeded: 1,
          quantityPerUnit: null,
          unit: 'piece',
          categoryId: '',
          category: '',
          estimatedUnitCost: null,
          estimatedCost: null,
          description: '',
          specifications: '',
          libraryMaterialId: null,
          isScalable: false,
          scalingFactor: 'fixed',
        },
      ],
    }));
  };

  const handleRemoveMaterial = (index) => {
    setFormData((prev) => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index),
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

  const handleRemoveTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleTagInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Template name is required');
      return;
    }

    if (formData.materials.length === 0) {
      setError('At least one material is required');
      return;
    }

    const invalidMaterials = formData.materials.filter(
      (m) => !m.name.trim() || !m.quantityNeeded || !m.unit
    );

    if (invalidMaterials.length > 0) {
      setError('Please fill in all required fields for all materials');
      return;
    }

    onSubmit(formData);
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Basic Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              placeholder="e.g., Foundation Materials, Roofing Supplies"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe when to use this template..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPublic"
              checked={formData.isPublic}
              onChange={(e) => {
                handleChange('isPublic', e.target.checked);
                // Auto-update status based on public/private
                if (e.target.checked && !formData.status) {
                  handleChange('status', TEMPLATE_STATUS.COMMUNITY);
                } else if (!e.target.checked && formData.status === TEMPLATE_STATUS.COMMUNITY) {
                  handleChange('status', TEMPLATE_STATUS.PRIVATE);
                }
              }}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isPublic" className="ml-2 text-sm text-gray-700">
              Make this template public (others can use it)
            </label>
          </div>
        </div>
      </div>

      {/* Template Organization */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Template Organization</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Template Category</label>
            <select
              value={formData.templateCategory}
              onChange={(e) => handleChange('templateCategory', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              <option value={TEMPLATE_CATEGORY_TYPES.CONSTRUCTION_PHASE}>Construction Phase</option>
              <option value={TEMPLATE_CATEGORY_TYPES.WORK_CATEGORY}>Work Category</option>
              <option value={TEMPLATE_CATEGORY_TYPES.PROJECT_TYPE}>Project Type</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Template Type</label>
            <input
              type="text"
              value={formData.templateType}
              onChange={(e) => handleChange('templateType', e.target.value)}
              placeholder="e.g., Foundation, Electrical, Roofing"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Project Phase</label>
            <select
              value={formData.projectPhase}
              onChange={(e) => handleChange('projectPhase', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {PROJECT_PHASES.map((phase) => (
                <option key={phase} value={phase}>
                  {phase.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Applicable Floors</label>
            <select
              multiple
              value={Array.isArray(formData.applicableFloors) ? formData.applicableFloors.map(f => f.toString()) : []}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value, 10));
                handleChange('applicableFloors', selected.length > 0 ? selected : []);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              size="4"
            >
              <option value="all">All Floors</option>
              {floors.map((floor) => (
                <option key={floor._id} value={floor.floorNumber}>
                  Floor {floor.floorNumber}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple floors</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tags</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleTagInputKeyPress}
                placeholder="Add a tag and press Enter"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
              >
                Add Tag
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
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Expiration Date (Optional)</label>
            <input
              type="date"
              value={formData.expiresAt ? new Date(formData.expiresAt).toISOString().split('T')[0] : ''}
              onChange={(e) => handleChange('expiresAt', e.target.value ? new Date(e.target.value).toISOString() : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">For cost-sensitive templates that may become outdated</p>
          </div>
        </div>
      </div>

      {/* Default Project Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Default Project Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Default Urgency</label>
            <select
              value={formData.defaultProjectSettings.defaultUrgency}
              onChange={(e) =>
                handleChange('defaultProjectSettings', {
                  ...formData.defaultProjectSettings,
                  defaultUrgency: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Default Reason</label>
            <input
              type="text"
              value={formData.defaultProjectSettings.defaultReason}
              onChange={(e) =>
                handleChange('defaultProjectSettings', {
                  ...formData.defaultProjectSettings,
                  defaultReason: e.target.value,
                })
              }
              placeholder="e.g., Foundation construction"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Default Category</label>
            <select
              value={formData.defaultProjectSettings.defaultCategoryId || ''}
              onChange={(e) => {
                const category = categories.find((c) => c._id === e.target.value);
                handleChange('defaultProjectSettings', {
                  ...formData.defaultProjectSettings,
                  defaultCategoryId: e.target.value,
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Default Floor</label>
            <select
              value={formData.defaultProjectSettings.defaultFloorId || ''}
              onChange={(e) =>
                handleChange('defaultProjectSettings', {
                  ...formData.defaultProjectSettings,
                  defaultFloorId: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {floors.map((floor) => (
                <option key={floor._id} value={floor._id}>
                  Floor {floor.floorNumber}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Materials */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Materials</h3>
          <button
            type="button"
            onClick={handleAddMaterial}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Add Material
          </button>
        </div>

        {formData.materials.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No materials added</p>
            <button
              type="button"
              onClick={handleAddMaterial}
              className="mt-2 text-blue-600 hover:text-blue-800 font-medium"
            >
              Add your first material
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {formData.materials.map((material, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-medium text-gray-900">Material {index + 1}</h4>
                  <button
                    type="button"
                    onClick={() => handleRemoveMaterial(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={material.name}
                      onChange={(e) => handleMaterialChange(index, 'name', e.target.value)}
                      required
                      placeholder="Material name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={material.quantityNeeded}
                      onChange={(e) => handleMaterialChange(index, 'quantityNeeded', e.target.value)}
                      required
                      min="0.01"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Unit <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={material.unit}
                      onChange={(e) => handleMaterialChange(index, 'unit', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {VALID_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                    <select
                      value={material.categoryId || ''}
                      onChange={(e) => {
                        const category = categories.find((c) => c._id === e.target.value);
                        handleMaterialChange(index, 'categoryId', e.target.value);
                        if (category) {
                          handleMaterialChange(index, 'category', category.name);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">None</option>
                      {categories.map((cat) => (
                        <option key={cat._id} value={cat._id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Estimated Unit Cost (KES)
                    </label>
                    <input
                      type="number"
                      value={material.estimatedUnitCost || ''}
                      onChange={(e) => handleMaterialChange(index, 'estimatedUnitCost', e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Total Cost</label>
                    <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
                      <span className="text-sm font-medium">
                        {formatCurrency(material.estimatedCost || (material.estimatedUnitCost && material.quantityNeeded ? material.estimatedUnitCost * material.quantityNeeded : 0))}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Scaling Factor</label>
                    <select
                      value={material.scalingFactor || 'fixed'}
                      onChange={(e) => handleMaterialChange(index, 'scalingFactor', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="fixed">Fixed Quantity</option>
                      <option value="per_floor">Per Floor</option>
                      <option value="per_sqm">Per Square Meter</option>
                    </select>
                  </div>
                  {material.scalingFactor !== 'fixed' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Quantity Per Unit</label>
                      <input
                        type="number"
                        value={material.quantityPerUnit || ''}
                        onChange={(e) => handleMaterialChange(index, 'quantityPerUnit', e.target.value)}
                        min="0.01"
                        step="0.01"
                        placeholder="e.g., 10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Quantity per {material.scalingFactor === 'per_floor' ? 'floor' : 'square meter'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage Statistics (Edit Mode) */}
      {showUsageStats && initialData && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Statistics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Times Used</p>
              <p className="text-2xl font-bold text-gray-900">{initialData.usageCount || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Last Used</p>
              <p className="text-lg font-medium text-gray-900">
                {initialData.lastUsedAt
                  ? new Date(initialData.lastUsedAt).toLocaleDateString('en-KE')
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
        >
          Cancel
        </button>
        <LoadingButton
          type="submit"
          isLoading={loading}
          loadingText="Saving..."
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          {initialData ? 'Update Template' : 'Create Template'}
        </LoadingButton>
      </div>
    </form>
  );
}

