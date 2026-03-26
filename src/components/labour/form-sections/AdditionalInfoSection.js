/**
 * Additional Information Section
 * Notes, ratings, and other optional fields
 */

'use client';

export function AdditionalInfoSection({
  formData,
  onChange,
}) {
  return (
    <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6">
      <h2 className="text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 ds-text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Additional Information
      </h2>

      {/* Task Description (if not already shown in Equipment section) */}
      {!formData.equipmentId && (
        <div className="mb-6">
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Task Description
          </label>
          <textarea
            name="taskDescription"
            value={formData.taskDescription}
            onChange={onChange}
            rows={3}
            placeholder="Describe the work performed..."
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          />
        </div>
      )}

      {/* Quantity/Unit (for piecework) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Quantity Completed (Optional)
          </label>
          <input
            type="number"
            name="quantityCompleted"
            value={formData.quantityCompleted}
            onChange={onChange}
            min="0"
            step="0.01"
            placeholder="0"
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Unit of Measure (Optional)
          </label>
          <select
            name="unitOfMeasure"
            value={formData.unitOfMeasure}
            onChange={onChange}
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          >
            <option value="">Select Unit</option>
            <option value="blocks">Blocks</option>
            <option value="sqm">Square Meters (m²)</option>
            <option value="cbm">Cubic Meters (m³)</option>
            <option value="units">Units</option>
            <option value="meters">Meters (m)</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Unit Rate (Optional)
          </label>
          <input
            type="number"
            name="unitRate"
            value={formData.unitRate}
            onChange={onChange}
            min="0"
            step="0.01"
            placeholder="0.00"
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          />
        </div>
      </div>

      {/* Performance Ratings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Quality Rating (Optional)
          </label>
          <select
            name="qualityRating"
            value={formData.qualityRating}
            onChange={onChange}
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          >
            <option value="">Select Rating</option>
            <option value="5">⭐⭐⭐⭐⭐ - Excellent</option>
            <option value="4">⭐⭐⭐⭐ - Good</option>
            <option value="3">⭐⭐⭐ - Average</option>
            <option value="2">⭐⭐ - Below Average</option>
            <option value="1">⭐ - Poor</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Productivity Rating (Optional)
          </label>
          <select
            name="productivityRating"
            value={formData.productivityRating}
            onChange={onChange}
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          >
            <option value="">Select Rating</option>
            <option value="5">⭐⭐⭐⭐⭐ - Excellent</option>
            <option value="4">⭐⭐⭐⭐ - Good</option>
            <option value="3">⭐⭐⭐ - Average</option>
            <option value="2">⭐⭐ - Below Average</option>
            <option value="1">⭐ - Poor</option>
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-semibold ds-text-primary mb-2">
          Additional Notes (Optional)
        </label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={onChange}
          rows={4}
          placeholder="Add any additional notes, observations, or important information..."
          className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
        />
      </div>
    </div>
  );
}

export default AdditionalInfoSection;
