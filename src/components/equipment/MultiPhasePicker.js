/**
 * Multi-Phase Picker Component
 * Allows selecting multiple phases and configuring cost splitting
 *
 * Usage:
 * <MultiPhasePicker
 *   phases={phases}
 *   selectedPhaseIds={selectedPhaseIds}
 *   costSplit={costSplit}
 *   onChange={handleChange}
 * />
 */

'use client';

import { useState, useEffect } from 'react';

export function MultiPhasePicker({
  phases = [],
  selectedPhaseIds = [],
  costSplit = null,
  onChange
}) {
  const [localSelectedIds, setLocalSelectedIds] = useState(selectedPhaseIds);
  const [localCostSplit, setLocalCostSplit] = useState(costSplit || { type: 'equal', percentages: {} });
  const [showCostSplitConfig, setShowCostSplitConfig] = useState(false);

  useEffect(() => {
    if (selectedPhaseIds && selectedPhaseIds !== localSelectedIds) {
      setLocalSelectedIds(selectedPhaseIds);
    }
  }, [selectedPhaseIds]);

  useEffect(() => {
    if (costSplit && JSON.stringify(costSplit) !== JSON.stringify(localCostSplit)) {
      setLocalCostSplit(costSplit);
    }
  }, [costSplit]);

  const handlePhaseToggle = (phaseId) => {
    const newSelectedIds = localSelectedIds.includes(phaseId)
      ? localSelectedIds.filter(id => id !== phaseId)
      : [...localSelectedIds, phaseId];
    
    setLocalSelectedIds(newSelectedIds);
    
    // Update cost split percentages when phases change
    const newPercentages = { ...localCostSplit.percentages };
    if (!localSelectedIds.includes(phaseId)) {
      // Adding phase - assign equal percentage initially
      newPercentages[phaseId] = Math.round(100 / (newSelectedIds.length + 1));
    } else {
      // Removing phase - delete its percentage
      delete newPercentages[phaseId];
      // Redistribute percentages
      const remaining = newSelectedIds.filter(id => id !== phaseId).length;
      if (remaining > 0) {
        Object.keys(newPercentages).forEach(key => {
          newPercentages[key] = Math.round(100 / remaining);
        });
      }
    }

    const newCostSplit = { ...localCostSplit, percentages: newPercentages };
    setLocalCostSplit(newCostSplit);
    
    onChange?.({
      phaseIds: newSelectedIds,
      costSplit: newCostSplit
    });
  };

  const handleCostSplitTypeChange = (type) => {
    const newCostSplit = { ...localCostSplit, type };
    setLocalCostSplit(newCostSplit);
    onChange?.({
      phaseIds: localSelectedIds,
      costSplit: newCostSplit
    });
  };

  const handlePercentageChange = (phaseId, percentage) => {
    const newPercentages = {
      ...localCostSplit.percentages,
      [phaseId]: parseFloat(percentage) || 0
    };
    const newCostSplit = { ...localCostSplit, percentages: newPercentages };
    setLocalCostSplit(newCostSplit);
    onChange?.({
      phaseIds: localSelectedIds,
      costSplit: newCostSplit
    });
  };

  const totalPercentage = Object.values(localCostSplit.percentages || {}).reduce((sum, val) => sum + (val || 0), 0);
  const percentageValid = Math.abs(totalPercentage - 100) < 0.1;

  return (
    <div className="space-y-4">
      {/* Phase Selection */}
      <div>
        <h3 className="text-sm font-semibold ds-text-primary mb-3">Select Phases</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {phases.map((phase) => {
            const isSelected = localSelectedIds.includes(phase._id);
            return (
              <button
                key={phase._id}
                type="button"
                onClick={() => handlePhaseToggle(phase._id)}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-ds-border-subtle ds-bg-surface hover:border-ds-border-strong'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium ds-text-primary">{phase.phaseName}</p>
                    <p className="text-xs ds-text-secondary">{phase.phaseCode}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isSelected ? 'bg-purple-600 text-white' : 'ds-bg-surface-muted ds-text-muted'
                  }`}>
                    {isSelected ? '✓' : '+'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {localSelectedIds.length < 2 && (
          <p className="text-xs text-orange-600 mt-2">
            ⚠️ Select at least 2 phases for multi-phase equipment
          </p>
        )}
      </div>

      {/* Cost Split Configuration */}
      {localSelectedIds.length >= 2 && (
        <div className="ds-bg-surface rounded-lg border ds-border-subtle p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold ds-text-primary">Cost Split Configuration</h3>
            <button
              type="button"
              onClick={() => setShowCostSplitConfig(!showCostSplitConfig)}
              className="text-xs ds-text-accent-primary hover:ds-text-accent-hover font-medium"
            >
              {showCostSplitConfig ? 'Hide' : 'Configure'}
            </button>
          </div>

          {/* Split Type Selector */}
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="costSplitType"
                checked={localCostSplit.type === 'equal'}
                onChange={() => handleCostSplitTypeChange('equal')}
                className="w-4 h-4 text-purple-600"
              />
              <span className="text-sm ds-text-primary">Equal Split</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="costSplitType"
                checked={localCostSplit.type === 'percentage'}
                onChange={() => handleCostSplitTypeChange('percentage')}
                className="w-4 h-4 text-purple-600"
              />
              <span className="text-sm ds-text-primary">Custom Percentages</span>
            </label>
          </div>

          {showCostSplitConfig && (
            <div className="space-y-3">
              {localCostSplit.type === 'equal' ? (
                <div className="p-3 bg-blue-50 border border-blue-400/60 rounded-lg">
                  <p className="text-sm text-blue-800">
                    ✓ Cost will be split equally across {localSelectedIds.length} phases ({Math.round(100 / localSelectedIds.length)}% each)
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {localSelectedIds.map((phaseId) => {
                    const phase = phases.find(p => p._id === phaseId);
                    const currentPercentage = localCostSplit.percentages[phaseId] || 0;
                    return (
                      <div key={phaseId} className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="text-sm ds-text-primary">{phase?.phaseName || phaseId.toString().slice(-4)}</p>
                        </div>
                        <div className="w-32">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={currentPercentage}
                            onChange={(e) => handlePercentageChange(phaseId, e.target.value)}
                            className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg text-sm"
                            placeholder="%"
                          />
                        </div>
                        <span className="text-sm ds-text-secondary w-8">%</span>
                      </div>
                    );
                  })}
                  
                  {/* Total Percentage Indicator */}
                  <div className={`p-3 rounded-lg ${
                    percentageValid
                      ? 'bg-green-50 border border-green-400/60'
                      : 'bg-red-50 border border-red-400/60'
                  }`}>
                    <p className={`text-sm ${percentageValid ? 'text-green-800' : 'text-red-800'}`}>
                      Total: {totalPercentage.toFixed(1)}% {percentageValid ? '✓' : `(Must equal 100%)`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MultiPhasePicker;
