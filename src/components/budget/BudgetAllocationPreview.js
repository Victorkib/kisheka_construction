/**
 * Budget Allocation Preview Component
 * Shows preview of budget allocation before confirming
 *
 * Usage:
 * <BudgetAllocationPreview
 *   source="Phase Budget"
 *   sourceAmount={10000000}
 *   targets={floors}
 *   strategy="weighted"
 *   onStrategyChange={setStrategy}
 *   onConfirm={handleAllocate}
 * />
 */

'use client';

import { useState, useEffect } from 'react';

export function BudgetAllocationPreview({
  source = 'Budget',
  sourceAmount = 0,
  targets = [],
  strategy = 'weighted',
  onStrategyChange,
  onConfirm,
  onCancel,
  isLoading = false
}) {
  const [allocations, setAllocations] = useState([]);
  const [totalAllocated, setTotalAllocated] = useState(0);

  useEffect(() => {
    // Calculate allocations based on strategy
    const calculated = calculateAllocations(sourceAmount, targets, strategy);
    setAllocations(calculated);
    setTotalAllocated(calculated.reduce((sum, a) => sum + a.amount, 0));
  }, [sourceAmount, targets, strategy]);

  const isOverAllocated = totalAllocated > sourceAmount;
  const remaining = sourceAmount - totalAllocated;

  return (
    <div className="ds-bg-surface rounded-lg shadow-lg border-2 ds-border-accent-subtle p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold ds-text-primary">📋 Allocation Preview</h3>
          <p className="text-sm ds-text-secondary mt-1">
            Distributing {formatCurrency(sourceAmount)} from {source}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm ds-text-secondary">Total Allocated</p>
          <p className={`text-2xl font-bold ${isOverAllocated ? 'text-red-600' : 'ds-text-primary'}`}>
            {formatCurrency(totalAllocated)}
          </p>
        </div>
      </div>

      {/* Strategy Selector */}
      {onStrategyChange && (
        <div className="mb-6 p-4 ds-bg-surface-muted rounded-lg">
          <label className="block text-sm font-medium ds-text-secondary mb-3">
            Distribution Strategy
          </label>
          <div className="flex flex-wrap gap-4">
            <StrategyRadio
              value="even"
              current={strategy}
              onChange={onStrategyChange}
              label="Even"
              description="Equal distribution"
            />
            <StrategyRadio
              value="weighted"
              current={strategy}
              onChange={onStrategyChange}
              label="Weighted"
              description="By floor type"
            />
            <StrategyRadio
              value="manual"
              current={strategy}
              onChange={onStrategyChange}
              label="Manual"
              description="Custom amounts"
            />
          </div>
        </div>
      )}

      {/* Allocation List */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between text-xs font-medium ds-text-secondary uppercase tracking-wide mb-2">
          <span>Target</span>
          <span>Amount</span>
          <span>%</span>
        </div>
        
        {allocations.map((allocation, index) => (
          <div
            key={allocation.id}
            className="flex items-center gap-4 p-3 ds-bg-surface-muted rounded-lg hover:ds-bg-surface-muted/70 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium ds-text-primary truncate">
                {allocation.name}
              </p>
              {allocation.description && (
                <p className="text-xs ds-text-secondary truncate">{allocation.description}</p>
              )}
            </div>
            
            <div className="text-right min-w-[100px]">
              <p className="text-sm font-semibold ds-text-primary">
                {formatCurrency(allocation.amount)}
              </p>
            </div>
            
            <div className="text-right min-w-[60px]">
              <p className="text-sm ds-text-secondary">
                {sourceAmount > 0 ? Math.round((allocation.amount / sourceAmount) * 100) : 0}%
              </p>
            </div>
            
            <div className="w-24 hidden sm:block">
              <div className="ds-bg-surface rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    allocation.priority === 'high' ? 'ds-bg-accent-primary' : 'ds-bg-accent-subtle'
                  }`}
                  style={{ width: `${Math.min(100, (allocation.amount / sourceAmount) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="p-4 ds-bg-accent-subtle border ds-border-accent-subtle rounded-lg mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="ds-text-secondary">Source Amount</span>
          <span className="font-medium ds-text-primary">{formatCurrency(sourceAmount)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="ds-text-secondary">Total Allocated</span>
          <span className={`font-medium ${isOverAllocated ? 'text-red-600' : 'ds-text-primary'}`}>
            {formatCurrency(totalAllocated)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t ds-border-accent-subtle">
          <span className="ds-text-secondary">Remaining</span>
          <span className={`font-medium ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(remaining)}
          </span>
        </div>
      </div>

      {/* Warnings */}
      {isOverAllocated && (
        <div className="mb-6 p-4 bg-red-50 border border-red-400/60 rounded-lg">
          <p className="text-sm text-red-800">
            <strong>⚠️ Warning:</strong> Total allocations exceed source amount by {formatCurrency(Math.abs(remaining))}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
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
          onClick={() => onConfirm(allocations)}
          disabled={isLoading || isOverAllocated}
          className="flex-1 sm:flex-none px-6 py-3 text-sm font-medium text-white ds-bg-accent-primary rounded-lg hover:ds-bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Processing...' : 'Confirm Allocation'}
        </button>
      </div>
    </div>
  );
}

/**
 * Strategy Radio Button Component
 */
function StrategyRadio({ value, current, onChange, label, description }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="radio"
        name="strategy"
        value={value}
        checked={current === value}
        onChange={(e) => onChange(e.target.value)}
        className="w-4 h-4 text-blue-600 ds-border-subtle focus:ring-blue-500"
      />
      <div>
        <p className="text-sm font-medium ds-text-primary">{label}</p>
        <p className="text-xs ds-text-secondary">{description}</p>
      </div>
    </label>
  );
}

/**
 * Calculate allocations based on strategy
 */
function calculateAllocations(total, targets, strategy) {
  if (targets.length === 0) return [];
  
  switch (strategy) {
    case 'even': {
      const perTarget = Math.floor(total / targets.length);
      const remainder = total - (perTarget * targets.length);
      
      return targets.map((target, index) => ({
        id: target._id || target.id || index,
        name: target.name || target.floorName || `Target ${index + 1}`,
        description: target.description || '',
        amount: perTarget + (index === targets.length - 1 ? remainder : 0),
        priority: target.priority || 'normal'
      }));
    }
    
    case 'weighted': {
      // Use floor type weights
      const weights = targets.map(target => {
        const floorNumber = target.floorNumber;
        if (floorNumber < 0) return 1.2; // Basement
        if (floorNumber === 0) return 1.3; // Ground
        if (floorNumber === Math.max(...targets.map(t => t.floorNumber))) return 1.5; // Penthouse
        return 1.0; // Typical
      });
      
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      
      return targets.map((target, index) => ({
        id: target._id || target.id || index,
        name: target.name || target.floorName || `Target ${index + 1}`,
        description: target.description || '',
        amount: Math.round((weights[index] / totalWeight) * total),
        weight: weights[index],
        priority: weights[index] > 1.0 ? 'high' : 'normal'
      }));
    }
    
    case 'manual':
    default:
      return targets.map((target, index) => ({
        id: target._id || target.id || index,
        name: target.name || target.floorName || `Target ${index + 1}`,
        description: target.description || '',
        amount: target.manualAmount || 0,
        priority: 'normal'
      }));
  }
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

export default BudgetAllocationPreview;
