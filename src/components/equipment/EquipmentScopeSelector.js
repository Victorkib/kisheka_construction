/**
 * Equipment Scope Selector Component
 * Helps users select the appropriate equipment scope with guidance
 *
 * Usage:
 * <EquipmentScopeSelector
 *   value={equipmentScope}
 *   onChange={setEquipmentScope}
 *   projectId={projectId}
 *   phaseId={phaseId}
 *   floorId={floorId}
 * />
 */

'use client';

import { useState, useEffect } from 'react';

const SCOPE_OPTIONS = [
  {
    value: 'phase_specific',
    label: 'Phase-Specific',
    icon: '🏗️',
    description: 'Equipment used within a single phase',
    examples: 'Excavators (Basement), Concrete pumps (Superstructure)',
    budgetImpact: 'Charged to phase budget',
    color: 'blue'
  },
  {
    value: 'floor_specific',
    label: 'Floor-Specific',
    icon: '🏢',
    description: 'Equipment used on a specific floor',
    examples: 'Formwork for Floor 5, Waterproofing Basement 2',
    budgetImpact: 'Charged to floor budget (within phase)',
    color: 'green'
  },
  {
    value: 'multi_phase',
    label: 'Multi-Phase',
    icon: '🔄',
    description: 'Equipment shared across multiple phases',
    examples: 'Tower crane (Basement + Superstructure), Material hoist',
    budgetImpact: 'Cost split across selected phases',
    color: 'purple'
  },
  {
    value: 'site_wide',
    label: 'Site-Wide',
    icon: '🌍',
    description: 'Equipment used across the entire project',
    examples: 'Site fencing, Tower crane (entire project), Generators',
    budgetImpact: 'Charged to indirect costs',
    color: 'orange'
  }
];

export function EquipmentScopeSelector({
  value,
  onChange,
  projectId,
  phaseId,
  floorId,
  phases = [],
  floors = []
}) {
  const [selectedScope, setSelectedScope] = useState(value || 'phase_specific');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (value && value !== selectedScope) {
      setSelectedScope(value);
    }
  }, [value]);

  const handleScopeChange = (scopeValue) => {
    setSelectedScope(scopeValue);
    onChange(scopeValue);
  };

  const selectedOption = SCOPE_OPTIONS.find(opt => opt.value === selectedScope);

  return (
    <div className="space-y-4">
      {/* Scope Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SCOPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleScopeChange(option.value)}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              selectedScope === option.value
                ? `border-${option.color}-500 bg-${option.color}-50 shadow-md`
                : 'border-ds-border-subtle ds-bg-surface hover:border-ds-border-strong'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{option.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold ds-text-primary">{option.label}</h3>
                  {selectedScope === option.value && (
                    <span className={`text-xs px-2 py-0.5 rounded-full bg-${option.color}-200 text-${option.color}-800`}>
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-sm ds-text-secondary mt-1">{option.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Selected Scope Details */}
      {selectedOption && (
        <div className={`p-4 rounded-lg border-2 border-${selectedOption.color}-400/60 bg-${selectedOption.color}-50/50`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold ds-text-primary flex items-center gap-2">
              <span>{selectedOption.icon}</span>
              {selectedOption.label} Details
            </h4>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs ds-text-accent-primary hover:ds-text-accent-hover font-medium"
            >
              {showDetails ? 'Hide' : 'Show'} Requirements
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium ds-text-secondary uppercase tracking-wide mb-2">Examples</p>
              <p className="text-sm ds-text-primary">{selectedOption.examples}</p>
            </div>
            <div>
              <p className="text-xs font-medium ds-text-secondary uppercase tracking-wide mb-2">Budget Impact</p>
              <p className="text-sm ds-text-primary">{selectedOption.budgetImpact}</p>
            </div>
          </div>

          {showDetails && (
            <div className="mt-4 pt-4 border-t border-ds-border-subtle">
              <RequirementsDetails
                scope={selectedScope}
                phases={phases}
                floors={floors}
                phaseId={phaseId}
                floorId={floorId}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Requirements Details Component
 * Shows what fields are required for each scope
 */
function RequirementsDetails({ scope, phases, floors, phaseId, floorId }) {
  const getRequirements = () => {
    switch (scope) {
      case 'phase_specific':
        return {
          required: ['Phase'],
          optional: ['Floor'],
          validation: 'Phase must exist and belong to project',
          budgetValidation: 'Validated against phase equipment budget'
        };
      case 'floor_specific':
        return {
          required: ['Phase', 'Floor'],
          optional: [],
          validation: 'Floor must belong to selected phase',
          budgetValidation: 'Validated against floor equipment budget'
        };
      case 'multi_phase':
        return {
          required: ['Multiple Phases (2+)', 'Cost Split Configuration'],
          optional: [],
          validation: 'All phases must exist and belong to project',
          budgetValidation: 'Validated against EACH phase budget (split cost)'
        };
      case 'site_wide':
        return {
          required: [],
          optional: [],
          validation: 'No phase required',
          budgetValidation: 'Validated against indirect costs budget'
        };
      default:
        return null;
    }
  };

  const requirements = getRequirements();
  if (!requirements) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium ds-text-secondary mb-2">Required Fields</p>
          {requirements.required.length > 0 ? (
            <ul className="text-sm ds-text-primary space-y-1">
              {requirements.required.map((req, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="text-green-600">✓</span> {req}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm ds-text-muted">None</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium ds-text-secondary mb-2">Optional Fields</p>
          {requirements.optional.length > 0 ? (
            <ul className="text-sm ds-text-primary space-y-1">
              {requirements.optional.map((req, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="text-blue-600">○</span> {req}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm ds-text-muted">None</p>
          )}
        </div>
      </div>

      <div className="p-3 ds-bg-surface rounded-lg">
        <p className="text-xs font-medium ds-text-secondary mb-1">Validation Rules</p>
        <p className="text-sm ds-text-primary">{requirements.validation}</p>
      </div>

      <div className="p-3 ds-bg-surface rounded-lg">
        <p className="text-xs font-medium ds-text-secondary mb-1">Budget Validation</p>
        <p className="text-sm ds-text-primary">{requirements.budgetValidation}</p>
      </div>

      {/* Phase/Floor Status for current selection */}
      {(scope === 'phase_specific' || scope === 'floor_specific') && phaseId && (
        <div className="p-3 bg-green-50 border border-green-400/60 rounded-lg">
          <p className="text-sm text-green-800">
            ✓ Phase selected: {phases.find(p => p._id === phaseId)?.phaseName || phaseId.toString().slice(-4)}
          </p>
          {scope === 'floor_specific' && floorId && (
            <p className="text-sm text-green-800 mt-1">
              ✓ Floor selected: {floors.find(f => f._id === floorId)?.name || floorId.toString().slice(-4)}
            </p>
          )}
        </div>
      )}

      {scope === 'multi_phase' && (
        <div className="p-3 bg-blue-50 border border-blue-400/60 rounded-lg">
          <p className="text-sm text-blue-800">
            ℹ️ You will be prompted to select multiple phases and configure cost splitting on the next screen.
          </p>
        </div>
      )}
    </div>
  );
}

export default EquipmentScopeSelector;
