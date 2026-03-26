/**
 * Equipment Budget Impact Preview Component
 * Shows budget impact before confirming equipment creation
 *
 * Usage:
 * <BudgetImpactPreview
 *   equipmentData={equipmentData}
 *   validation={validationResult}
 *   onConfirm={handleConfirm}
 *   onCancel={handleCancel}
 * />
 */

'use client';

export function BudgetImpactPreview({
  equipmentData = {},
  validation = null,
  onConfirm,
  onCancel,
  isLoading = false
}) {
  const {
    equipmentName,
    equipmentScope,
    totalCost,
    dailyRate,
    startDate,
    endDate
  } = equipmentData;

  const scopeLabels = {
    phase_specific: 'Phase-Specific',
    floor_specific: 'Floor-Specific',
    multi_phase: 'Multi-Phase',
    site_wide: 'Site-Wide'
  };

  const scopeIcons = {
    phase_specific: '🏗️',
    floor_specific: '🏢',
    multi_phase: '🔄',
    site_wide: '🌍'
  };

  const hasErrors = validation?.errors?.length > 0;
  const hasWarnings = validation?.warnings?.length > 0;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="ds-bg-surface rounded-lg shadow-lg border-2 ds-border-accent-subtle p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold ds-text-primary">📋 Budget Impact Preview</h3>
          <p className="text-sm ds-text-secondary mt-1">
            Review before creating equipment
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs ds-text-secondary">Total Cost</p>
          <p className="text-2xl font-bold ds-text-accent-primary">
            {formatCurrency(totalCost || 0)}
          </p>
        </div>
      </div>

      {/* Equipment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 ds-bg-surface-muted rounded-lg">
          <p className="text-xs font-medium ds-text-secondary uppercase tracking-wide mb-2">Equipment</p>
          <p className="text-sm font-semibold ds-text-primary">{equipmentName || 'Unnamed'}</p>
          <p className="text-xs ds-text-secondary mt-1">
            {scopeIcons[equipmentScope]} {scopeLabels[equipmentScope] || equipmentScope}
          </p>
        </div>
        <div className="p-4 ds-bg-surface-muted rounded-lg">
          <p className="text-xs font-medium ds-text-secondary uppercase tracking-wide mb-2">Duration</p>
          <p className="text-sm ds-text-primary">
            {formatDate(startDate)} → {formatDate(endDate)}
          </p>
          <p className="text-xs ds-text-secondary mt-1">
            {formatCurrency(dailyRate || 0)} / day
          </p>
        </div>
      </div>

      {/* Budget Impact by Scope */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold ds-text-primary mb-3">Budget Impact</h4>
        <BudgetImpactDetails validation={validation} scope={equipmentScope} />
      </div>

      {/* Validation Messages */}
      {hasErrors && (
        <div className="mb-6 p-4 bg-red-50 border border-red-400/60 rounded-lg">
          <p className="text-sm font-semibold text-red-800 mb-2">⛔ Validation Errors</p>
          <ul className="text-sm text-red-700 space-y-1">
            {validation.errors.map((error, idx) => (
              <li key={idx}>• {error.message || error}</li>
            ))}
          </ul>
        </div>
      )}

      {hasWarnings && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-400/60 rounded-lg">
          <p className="text-sm font-semibold text-yellow-800 mb-2">⚠️ Warnings</p>
          <ul className="text-sm text-yellow-700 space-y-1">
            {validation.warnings.map((warning, idx) => (
              <li key={idx}>• {warning.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Success Message */}
      {!hasErrors && validation?.message && (
        <div className={`mb-6 p-4 rounded-lg ${
          validation.severity === 'warning'
            ? 'bg-yellow-50 border border-yellow-400/60'
            : 'bg-green-50 border border-green-400/60'
        }`}>
          <p className={`text-sm ${
            validation.severity === 'warning' ? 'text-yellow-800' : 'text-green-800'
          }`}>
            ✓ {validation.message}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-4 border-t ds-border-subtle">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 sm:flex-none px-6 py-3 text-sm font-medium ds-text-secondary ds-bg-surface border ds-border-subtle rounded-lg hover:ds-bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading || hasErrors}
          className={`flex-1 sm:flex-none px-6 py-3 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            hasErrors
              ? 'ds-bg-surface-muted'
              : 'ds-bg-accent-primary hover:ds-bg-accent-hover'
          }`}
        >
          {isLoading ? 'Creating...' : 'Confirm & Create'}
        </button>
      </div>
    </div>
  );
}

/**
 * Budget Impact Details Component
 */
function BudgetImpactDetails({ validation, scope }) {
  const details = validation?.details || {};

  if (!details.budget) {
    return (
      <div className="p-4 ds-bg-surface-muted rounded-lg">
        <p className="text-sm ds-text-secondary">No budget validation details available</p>
      </div>
    );
  }

  if (details.budget.type === 'multi_phase') {
    return (
      <div className="space-y-2">
        <p className="text-xs ds-text-secondary mb-2">Cost will be split across phases:</p>
        {details.budget.phases?.map((phase, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 ds-bg-surface rounded-lg">
            <span className="text-sm ds-text-primary">Phase {phase.phaseId?.toString().slice(-4)}</span>
            <span className="text-sm font-semibold ds-text-primary">
              {formatCurrency(phase.allocated || 0)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (details.budget.category === 'indirect_costs') {
    return (
      <div className="p-4 ds-bg-surface rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm ds-text-secondary">Charged to:</span>
          <span className="text-sm font-medium ds-text-primary">Indirect Costs (Project-level)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm ds-text-secondary">Budget:</span>
          <span className="text-sm ds-text-primary">
            {formatCurrency(details.budget.budget || 0)} total
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm ds-text-secondary">After this equipment:</span>
          <span className="text-sm ds-text-primary">
            {formatCurrency(details.budget.remaining || 0)} remaining
          </span>
        </div>
      </div>
    );
  }

  // Phase-specific or floor-specific
  return (
    <div className="p-4 ds-bg-surface rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm ds-text-secondary">Charged to:</span>
        <span className="text-sm font-medium ds-text-primary">
          {details.budget.type === 'floor_specific' ? 'Floor Budget' : 'Phase Budget'}
        </span>
      </div>
      {details.budget.available !== undefined && (
        <div className="flex items-center justify-between">
          <span className="text-sm ds-text-secondary">Available:</span>
          <span className="text-sm ds-text-primary">
            {formatCurrency(details.budget.available)}
          </span>
        </div>
      )}
      {details.budget.remaining !== undefined && (
        <div className="flex items-center justify-between">
          <span className="text-sm ds-text-secondary">After this equipment:</span>
          <span className="text-sm ds-text-primary">
            {formatCurrency(details.budget.remaining)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Format currency helper
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export default BudgetImpactPreview;
