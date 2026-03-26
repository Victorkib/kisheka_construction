/**
 * Operator Requirement Selector Component
 * Helps users specify operator requirements for equipment
 *
 * @component
 * @param {boolean} operatorRequired - Whether operator is required
 * @param {string} operatorType - Type of operator arrangement
 * @param {string} operatorNotes - Additional notes
 * @param {function} onChange - Callback when operator requirements change
 */

'use client';

import { useState, useEffect } from 'react';

const OPERATOR_TYPES = [
  {
    value: 'hired',
    label: 'Hired Operator',
    icon: '👷',
    description: 'We will hire a dedicated operator for this equipment',
    budgetImpact: 'Labour budget: Daily wages apply',
    color: 'blue',
    examples: 'Excavator operator, Crane operator, Bulldozer operator'
  },
  {
    value: 'owner_employee',
    label: "Owner's Employee",
    icon: '👔',
    description: "Company employee will operate (already on payroll)",
    budgetImpact: 'No additional labour cost (salaried)',
    color: 'green',
    examples: 'Site supervisor operates generator, Foreman operates mixer'
  },
  {
    value: 'included_in_rental',
    label: 'Included in Rental',
    icon: '📦',
    description: 'Operator cost is included in equipment rental fee',
    budgetImpact: 'Equipment budget: Already covered',
    color: 'purple',
    examples: 'Crane with operator, Concrete pump with operator'
  },
  {
    value: 'self_operated',
    label: 'Self-Operated',
    icon: '⚙️',
    description: 'Equipment is automated or does not need an operator',
    budgetImpact: 'No operator cost',
    color: 'orange',
    examples: 'Generators, Scaffolding, Compactors, Site fencing'
  }
];

export function OperatorRequirementSelector({
  operatorRequired = null,
  operatorType = null,
  operatorNotes = '',
  onChange,
}) {
  const [selectedRequired, setSelectedRequired] = useState(operatorRequired);
  const [selectedType, setSelectedType] = useState(operatorType || 'hired');
  const [notes, setNotes] = useState(operatorNotes);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (operatorRequired !== selectedRequired) {
      setSelectedRequired(operatorRequired);
    }
  }, [operatorRequired]);

  useEffect(() => {
    if (operatorType && operatorType !== selectedType) {
      setSelectedType(operatorType);
    }
  }, [operatorType]);

  useEffect(() => {
    if (operatorNotes !== notes) {
      setNotes(operatorNotes);
    }
  }, [operatorNotes]);

  const handleRequiredChange = (required) => {
    setSelectedRequired(required);
    onChange?.({
      operatorRequired: required,
      operatorType: required ? selectedType : null,
      operatorNotes: notes
    });
  };

  const handleTypeChange = (type) => {
    setSelectedType(type);
    onChange?.({
      operatorRequired: selectedRequired,
      operatorType: type,
      operatorNotes: notes
    });
  };

  const handleNotesChange = (value) => {
    setNotes(value);
    onChange?.({
      operatorRequired: selectedRequired,
      operatorType: selectedType,
      operatorNotes: value
    });
  };

  const selectedOperatorType = OPERATOR_TYPES.find(t => t.value === selectedType);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold ds-text-primary">Operator Requirements</h3>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs ds-text-accent-primary hover:ds-text-accent-hover font-medium"
        >
          {isExpanded ? 'Hide Info' : 'Learn More'}
        </button>
      </div>

      {/* Info Card */}
      {isExpanded && (
        <div className="ds-bg-accent-subtle rounded-lg border ds-border-accent-subtle p-4">
          <p className="text-sm ds-text-secondary">
            Specify whether this equipment requires an operator and how the operator will be provided.
            This helps with accurate budget planning and resource allocation.
          </p>
        </div>
      )}

      {/* Operator Required Toggle */}
      <div className="ds-bg-surface-muted rounded-xl border ds-border-subtle p-6">
        <label className="block text-sm font-semibold ds-text-primary mb-4">
          Does this equipment require an operator?
        </label>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleRequiredChange(true)}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              selectedRequired === true
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-ds-border-subtle ds-bg-surface hover:border-ds-border-strong'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                selectedRequired === true ? 'bg-blue-600 text-white' : 'ds-bg-surface-muted ds-text-muted'
              }`}>
                {selectedRequired === true ? '✓' : ''}
              </div>
              <div>
                <p className="font-semibold ds-text-primary">Yes, Operator Required</p>
                <p className="text-xs ds-text-secondary mt-1">Equipment needs a dedicated operator</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleRequiredChange(false)}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              selectedRequired === false
                ? 'border-gray-500 bg-gray-50 shadow-md'
                : 'border-ds-border-subtle ds-bg-surface hover:border-ds-border-strong'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                selectedRequired === false ? 'bg-gray-600 text-white' : 'ds-bg-surface-muted ds-text-muted'
              }`}>
                {selectedRequired === false ? '✓' : ''}
              </div>
              <div>
                <p className="font-semibold ds-text-primary">No Operator Required</p>
                <p className="text-xs ds-text-secondary mt-1">Self-operated or automated</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Operator Type Selection (only if operator is required) */}
      {selectedRequired === true && (
        <div className="ds-bg-surface-muted rounded-xl border ds-border-subtle p-6 space-y-4">
          <h4 className="text-sm font-semibold ds-text-primary">
            How will the operator be provided?
          </h4>

          {/* Operator Type Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {OPERATOR_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleTypeChange(type.value)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedType === type.value
                    ? `border-${type.color}-500 bg-${type.color}-50 shadow-md`
                    : 'border-ds-border-subtle ds-bg-surface hover:border-ds-border-strong'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{type.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h5 className="font-semibold ds-text-primary">{type.label}</h5>
                      {selectedType === type.value && (
                        <span className={`text-xs px-2 py-0.5 rounded-full bg-${type.color}-200 text-${type.color}-800`}>
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-xs ds-text-secondary mt-1">{type.description}</p>
                    <p className="text-xs font-medium ds-text-primary mt-2">{type.budgetImpact}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Selected Type Details */}
          {selectedOperatorType && (
            <div className={`p-4 rounded-lg border-2 border-${selectedOperatorType.color}-400/60 bg-${selectedOperatorType.color}-50/50`}>
              <h5 className="font-semibold ds-text-primary mb-2 flex items-center gap-2">
                <span>{selectedOperatorType.icon}</span>
                {selectedOperatorType.label} Details
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-medium ds-text-secondary mb-1">Examples</p>
                  <p className="ds-text-primary">{selectedOperatorType.examples}</p>
                </div>
                <div>
                  <p className="text-xs font-medium ds-text-secondary mb-1">Budget Impact</p>
                  <p className="ds-text-primary">{selectedOperatorType.budgetImpact}</p>
                </div>
              </div>
            </div>
          )}

          {/* Operator Notes */}
          <div className="pt-4 border-t ds-border-subtle">
            <label className="block text-sm font-semibold ds-text-primary mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="e.g., Operator must be certified, Shift schedule, Special requirements..."
              rows={3}
              className="w-full px-4 py-2.5 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus"
            />
            <p className="text-xs ds-text-secondary mt-2">
              Add any specific requirements or details about the operator arrangement
            </p>
          </div>
        </div>
      )}

      {/* Summary (when collapsed and set) */}
      {selectedRequired === false && (
        <div className="ds-bg-surface rounded-lg border ds-border-subtle p-4">
          <p className="text-sm ds-text-primary flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            This equipment does not require an operator (self-operated/automated)
          </p>
        </div>
      )}

      {selectedRequired === true && selectedType && (
        <div className="ds-bg-surface rounded-lg border ds-border-subtle p-4">
          <p className="text-sm ds-text-primary flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Operator: <span className="font-semibold">{selectedOperatorType?.label}</span>
            {notes && <span className="text-xs ds-text-secondary ml-2">({notes})</span>}
          </p>
        </div>
      )}
    </div>
  );
}

export default OperatorRequirementSelector;
