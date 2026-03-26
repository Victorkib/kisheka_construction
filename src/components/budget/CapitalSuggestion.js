/**
 * Capital Suggestion Component
 * Auto-suggests capital allocation based on budget
 *
 * Usage:
 * <CapitalSuggestion
 *   budgetTotal={10000000}
 *   currentCapital={5000000}
 *   availableProjectCapital={50000000}
 *   onAllocate={handleAllocate}
 * />
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/toast';

export function CapitalSuggestion({
  budgetTotal = 0,
  currentCapital = 0,
  availableProjectCapital = 0,
  onAllocate,
  floorName = 'this floor'
}) {
  const toast = useToast();
  const [suggestion, setSuggestion] = useState(null);
  const [customAmount, setCustomAmount] = useState('');

  useEffect(() => {
    if (budgetTotal > 0) {
      calculateSuggestion();
    }
  }, [budgetTotal, currentCapital, availableProjectCapital]);

  const calculateSuggestion = () => {
    const targetCoverage = 0.80; // 80% coverage target
    const suggestedCapital = Math.round(budgetTotal * targetCoverage);
    const additionalNeeded = suggestedCapital - currentCapital;
    const currentCoverage = budgetTotal > 0 ? (currentCapital / budgetTotal) * 100 : 0;

    setSuggestion({
      suggestedCapital,
      additionalNeeded,
      currentCoverage: Math.round(currentCoverage),
      targetCoverage: Math.round(targetCoverage * 100),
      canAllocate: additionalNeeded > 0 && availableProjectCapital >= additionalNeeded,
      insufficientCapital: additionalNeeded > 0 && availableProjectCapital < additionalNeeded
    });
  };

  const handleQuickAllocate = (amount) => {
    if (amount <= 0) {
      toast.showError('Amount must be greater than 0');
      return;
    }

    if (amount > availableProjectCapital) {
      toast.showError('Amount exceeds available project capital');
      return;
    }

    onAllocate?.(amount);
    toast.showSuccess(`Capital allocated: ${formatCurrency(amount)}`);
  };

  const handleCustomAllocate = () => {
    const amount = parseFloat(customAmount);
    
    if (isNaN(amount) || amount <= 0) {
      toast.showError('Please enter a valid amount');
      return;
    }

    if (amount > availableProjectCapital) {
      toast.showError('Amount exceeds available project capital');
      return;
    }

    onAllocate?.(amount);
    setCustomAmount('');
  };

  if (budgetTotal === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-400/60 rounded-lg">
        <p className="text-sm text-gray-700">
          Set a budget first to see capital suggestions
        </p>
      </div>
    );
  }

  if (!suggestion) return null;

  const { suggestedCapital, additionalNeeded, currentCoverage, targetCoverage, canAllocate, insufficientCapital } = suggestion;

  return (
    <div className="ds-bg-accent-subtle border-2 ds-border-accent-subtle rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold ds-text-primary">💡 Capital Suggestion</h3>
          <p className="text-sm ds-text-secondary mt-1">
            Recommended capital for {floorName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs ds-text-secondary">Current Coverage</p>
          <p className={`text-xl font-bold ${
            currentCoverage >= targetCoverage ? 'text-green-600' :
            currentCoverage >= 50 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {currentCoverage}%
          </p>
        </div>
      </div>

      {/* Coverage Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs ds-text-secondary mb-2">
          <span>Current: {formatCurrency(currentCapital)}</span>
          <span>Target: {targetCoverage}%</span>
        </div>
        <div className="w-full ds-bg-surface-muted rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${
              currentCoverage >= targetCoverage
                ? 'ds-bg-success'
                : currentCoverage >= 50
                ? 'ds-bg-warning'
                : 'ds-bg-danger'
            }`}
            style={{ width: `${Math.min(currentCoverage, 100)}%` }}
          />
        </div>
      </div>

      {/* Suggestion Box */}
      <div className="p-4 ds-bg-surface rounded-lg mb-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">💰</div>
          <div className="flex-1">
            <p className="text-sm font-medium ds-text-primary mb-2">
              {currentCoverage < targetCoverage ? (
                <>
                  Recommend allocating additional <span className="text-purple-700 font-bold">{formatCurrency(additionalNeeded)}</span>
                </>
              ) : currentCoverage > 120 ? (
                <>
                  Capital exceeds target by <span className="text-orange-700 font-bold">{formatCurrency(currentCapital - suggestedCapital)}</span>
                </>
              ) : (
                <>
                  ✓ Capital allocation is adequate
                </>
              )}
            </p>
            <p className="text-xs ds-text-secondary">
              For {formatCurrency(budgetTotal)} budget, recommend {formatCurrency(suggestedCapital)} capital ({targetCoverage}% coverage)
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {currentCoverage < targetCoverage && (
        <div className="space-y-3">
          <p className="text-xs font-medium ds-text-secondary uppercase tracking-wide">Quick Actions</p>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleQuickAllocate(additionalNeeded)}
              disabled={!canAllocate}
              className="px-4 py-3 text-sm font-medium text-white ds-bg-accent-primary rounded-lg hover:ds-bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Allocate Recommended<br/>
              <span className="text-xs opacity-80">{formatCurrency(additionalNeeded)}</span>
            </button>
            
            <button
              onClick={() => handleQuickAllocate(Math.round(budgetTotal * 0.5 - currentCapital))}
              disabled={!canAllocate}
              className="px-4 py-3 text-sm font-medium ds-text-accent-primary ds-bg-accent-subtle rounded-lg hover:ds-bg-accent-subtle/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Allocate 50% Coverage<br/>
              <span className="text-xs opacity-80">{formatCurrency(Math.round(budgetTotal * 0.5 - currentCapital))}</span>
            </button>
          </div>

          {insufficientCapital && (
            <div className="p-3 bg-red-50 border border-red-400/60 rounded-lg">
              <p className="text-xs text-red-800">
                ⚠️ Insufficient project capital. Available: {formatCurrency(availableProjectCapital)}
              </p>
            </div>
          )}

          {/* Custom Amount */}
          <div className="flex gap-2">
            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="Custom amount"
              className="flex-1 px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
            <button
              onClick={handleCustomAllocate}
              disabled={!customAmount}
              className="px-4 py-2 text-sm font-medium ds-text-secondary ds-bg-surface border ds-border-subtle rounded-lg hover:ds-bg-surface-muted disabled:opacity-50"
            >
              Allocate
            </button>
          </div>

          <p className="text-xs ds-text-secondary">
            Available project capital: <span className="font-semibold text-purple-700">{formatCurrency(availableProjectCapital)}</span>
          </p>
        </div>
      )}

      {currentCoverage >= targetCoverage && currentCoverage <= 120 && (
        <div className="p-4 bg-green-50 border border-green-400/60 rounded-lg">
          <p className="text-sm text-green-800">
            ✓ Capital allocation is optimal. No action needed.
          </p>
        </div>
      )}

      {currentCoverage > 120 && (
        <div className="p-4 bg-orange-50 border border-orange-400/60 rounded-lg">
          <p className="text-sm text-orange-800">
            ⚠️ Capital exceeds budget by {Math.round(currentCoverage - 100)}%. Consider reallocating excess to other floors.
          </p>
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

export default CapitalSuggestion;
