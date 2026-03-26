/**
 * Work Details Section
 * Work Item, Indirect Labour Category, Equipment, Subcontractor selection
 */

'use client';

import { getFieldValidationRules } from '@/lib/labour-entry-validation';
import { LABOUR_ENTRY_MODES } from '@/lib/constants/labour-entry-modes';

export function WorkDetailsSection({
  formData,
  onChange,
  onSectionChange,
  entryMode,
  config,
  workItems = [],
  loadingWorkItems = false,
}) {
  const workItemRules = getFieldValidationRules('workItemId', entryMode);
  const indirectRules = getFieldValidationRules('indirectCostCategory', entryMode);

  const INDIRECT_CATEGORIES = [
    { value: 'utilities', label: 'Utilities (Water, Electricity, etc.)' },
    { value: 'siteOverhead', label: 'Site Overhead (Security, Cleaning, etc.)' },
    { value: 'transportation', label: 'Transportation' },
    { value: 'safetyCompliance', label: 'Safety & Compliance' },
    { value: 'other', label: 'Other Indirect Costs' },
  ];

  return (
    <div className="ds-bg-surface rounded-xl shadow-lg border ds-border-subtle p-6">
      <h2 className="text-lg font-bold ds-text-primary mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 ds-text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Work Details
      </h2>

      {/* Work Item Selection */}
      {entryMode !== LABOUR_ENTRY_MODES.INDIRECT && entryMode !== LABOUR_ENTRY_MODES.EQUIPMENT_OPERATOR && (
        <div className={workItemRules.hidden ? 'hidden' : ''}>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Work Item {workItemRules.required && <span className="text-red-500">*</span>}
          </label>
          {loadingWorkItems ? (
            <div className="px-4 py-2.5 ds-bg-surface-muted rounded-lg ds-text-muted">Loading...</div>
          ) : formData.workItemId && entryMode === LABOUR_ENTRY_MODES.WORK_ITEM ? (
            <div className="ds-bg-surface-muted rounded-lg p-4 border-2 ds-border-accent-subtle">
              <p className="font-bold ds-text-primary">Work Item (Pre-selected)</p>
              <p className="text-sm ds-text-secondary">ID: {formData.workItemId}</p>
              <input type="hidden" name="workItemId" value={formData.workItemId} />
            </div>
          ) : (
            <select
              name="workItemId"
              value={formData.workItemId}
              onChange={onChange}
              required={workItemRules.required}
              className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
            >
              <option value="">Select Work Item</option>
              {workItems.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name} ({item.category})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Equipment Operator Mode - Work Item Optional */}
      {entryMode === LABOUR_ENTRY_MODES.EQUIPMENT_OPERATOR && (
        <div className="ds-bg-surface-muted rounded-lg p-4 border ds-border-subtle">
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Work Item (Optional - for better budget tracking)
          </label>
          <select
            name="workItemId"
            value={formData.workItemId}
            onChange={onChange}
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          >
            <option value="">No Work Item (Equipment Only)</option>
            {workItems.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name} ({item.category})
              </option>
            ))}
          </select>
          <p className="text-xs ds-text-secondary mt-2">
            Linking to a work item helps with budget tracking, but is not required for equipment operator labour.
          </p>
        </div>
      )}

      {/* Indirect Labour Category */}
      {entryMode === LABOUR_ENTRY_MODES.INDIRECT && (
        <div className={indirectRules.hidden ? 'hidden' : ''}>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Indirect Cost Category {indirectRules.required && <span className="text-red-500">*</span>}
          </label>
          <select
            name="indirectCostCategory"
            value={formData.indirectCostCategory}
            onChange={onChange}
            required={indirectRules.required}
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          >
            <option value="">Select Indirect Cost Category</option>
            {INDIRECT_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Subcontractor Selection */}
      {entryMode === LABOUR_ENTRY_MODES.SUBCONTRACTOR && (
        <div>
          <label className="block text-sm font-semibold ds-text-primary mb-2">
            Subcontractor {getFieldValidationRules('subcontractorId', entryMode).required && <span className="text-red-500">*</span>}
          </label>
          <select
            name="subcontractorId"
            value={formData.subcontractorId}
            onChange={onChange}
            required
            className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
          >
            <option value="">Select Subcontractor</option>
            {/* Subcontractors would be passed as prop */}
          </select>
        </div>
      )}

      {/* Mode-Specific Info */}
      <div className="mt-4 ds-bg-accent-subtle rounded-lg p-4 border ds-border-accent-subtle">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <p className="text-sm font-semibold ds-text-primary">{config.label}</p>
            <p className="text-xs ds-text-secondary mt-1">{config.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkDetailsSection;
