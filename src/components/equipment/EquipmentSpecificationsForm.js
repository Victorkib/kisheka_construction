/**
 * Equipment Specifications Form Component
 * Allows users to enter technical specifications for equipment
 *
 * @component
 * @param {object} specifications - Current specifications object
 * @param {function} onChange - Callback when specifications change
 */

'use client';

import { useState, useEffect } from 'react';

const FUEL_TYPES = [
  { value: 'diesel', label: 'Diesel' },
  { value: 'electric', label: 'Electric' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'gasoline', label: 'Gasoline' },
  { value: 'hydraulic', label: 'Hydraulic' },
  { value: 'manual', label: 'Manual' },
  { value: 'other', label: 'Other' },
];

export function EquipmentSpecificationsForm({
  specifications = null,
  onChange,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [formData, setFormData] = useState({
    modelYear: '',
    weight: '',
    fuelType: '',
    capacity: '',
    dimensions: {
      length: '',
      width: '',
      height: '',
    },
  });

  useEffect(() => {
    if (specifications) {
      setFormData({
        modelYear: specifications.modelYear || '',
        weight: specifications.weight || '',
        fuelType: specifications.fuelType || '',
        capacity: specifications.capacity || '',
        dimensions: {
          length: specifications.dimensions?.length || '',
          width: specifications.dimensions?.width || '',
          height: specifications.dimensions?.height || '',
        },
      });
    }
  }, [specifications]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      const updatedFormData = {
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: value,
        },
      };
      setFormData(updatedFormData);
      onChange?.(updatedFormData);
    } else {
      const updatedFormData = {
        ...formData,
        [name]: value,
      };
      setFormData(updatedFormData);
      onChange?.(updatedFormData);
    }
  };

  const handleClear = () => {
    const emptyData = {
      modelYear: '',
      weight: '',
      fuelType: '',
      capacity: '',
      dimensions: {
        length: '',
        width: '',
        height: '',
      },
    };
    setFormData(emptyData);
    onChange?.(null);
  };

  return (
    <div className="ds-bg-surface-muted rounded-xl border ds-border-subtle p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-8 h-8 ds-bg-surface rounded-lg border ds-border-subtle flex items-center justify-center hover:ds-bg-surface-muted transition-colors"
          >
            <svg
              className={`w-5 h-5 ds-text-accent-primary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div>
            <h3 className="text-lg font-bold ds-text-primary">Technical Specifications</h3>
            <p className="text-xs ds-text-secondary">Optional: Add detailed equipment specifications</p>
          </div>
        </div>
        {(formData.modelYear || formData.weight || formData.fuelType || formData.capacity) && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs ds-text-secondary hover:ds-text-danger font-medium"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t ds-border-subtle">
          {/* Model Year */}
          <div>
            <label className="block text-sm font-semibold ds-text-primary mb-2">
              Model Year
            </label>
            <input
              type="number"
              name="modelYear"
              value={formData.modelYear}
              onChange={handleChange}
              placeholder="e.g., 2023"
              min="1900"
              max={new Date().getFullYear() + 1}
              className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
            />
          </div>

          {/* Weight */}
          <div>
            <label className="block text-sm font-semibold ds-text-primary mb-2">
              Weight (tons)
            </label>
            <input
              type="number"
              name="weight"
              value={formData.weight}
              onChange={handleChange}
              placeholder="e.g., 20.5"
              min="0"
              step="0.1"
              className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
            />
          </div>

          {/* Fuel Type */}
          <div>
            <label className="block text-sm font-semibold ds-text-primary mb-2">
              Fuel Type
            </label>
            <select
              name="fuelType"
              value={formData.fuelType}
              onChange={handleChange}
              className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
            >
              <option value="">Select Fuel Type</option>
              {FUEL_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-sm font-semibold ds-text-primary mb-2">
              Capacity
            </label>
            <input
              type="text"
              name="capacity"
              value={formData.capacity}
              onChange={handleChange}
              placeholder="e.g., 2.5 m³ bucket, 50 tons load"
              className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
            />
          </div>

          {/* Dimensions Section */}
          <div className="md:col-span-2">
            <h4 className="text-sm font-semibold ds-text-primary mb-3">Dimensions (meters)</h4>
            <div className="grid grid-cols-3 gap-4">
              {/* Length */}
              <div>
                <label className="block text-xs font-medium ds-text-secondary mb-2">
                  Length (m)
                </label>
                <input
                  type="number"
                  name="dimensions.length"
                  value={formData.dimensions.length}
                  onChange={handleChange}
                  placeholder="L"
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus text-sm"
                />
              </div>

              {/* Width */}
              <div>
                <label className="block text-xs font-medium ds-text-secondary mb-2">
                  Width (m)
                </label>
                <input
                  type="number"
                  name="dimensions.width"
                  value={formData.dimensions.width}
                  onChange={handleChange}
                  placeholder="W"
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus text-sm"
                />
              </div>

              {/* Height */}
              <div>
                <label className="block text-xs font-medium ds-text-secondary mb-2">
                  Height (m)
                </label>
                <input
                  type="number"
                  name="dimensions.height"
                  value={formData.dimensions.height}
                  onChange={handleChange}
                  placeholder="H"
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary (when collapsed) */}
      {!isExpanded && (formData.modelYear || formData.weight || formData.fuelType || formData.capacity) && (
        <div className="pt-4 border-t ds-border-subtle">
          <div className="flex flex-wrap gap-3">
            {formData.modelYear && (
              <span className="px-3 py-1.5 ds-bg-surface rounded-lg text-sm ds-text-primary border ds-border-subtle">
                Year: {formData.modelYear}
              </span>
            )}
            {formData.weight && (
              <span className="px-3 py-1.5 ds-bg-surface rounded-lg text-sm ds-text-primary border ds-border-subtle">
                Weight: {formData.weight} tons
              </span>
            )}
            {formData.fuelType && (
              <span className="px-3 py-1.5 ds-bg-surface rounded-lg text-sm ds-text-primary border ds-border-subtle capitalize">
                {formData.fuelType}
              </span>
            )}
            {formData.capacity && (
              <span className="px-3 py-1.5 ds-bg-surface rounded-lg text-sm ds-text-primary border ds-border-subtle">
                Capacity: {formData.capacity}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EquipmentSpecificationsForm;
