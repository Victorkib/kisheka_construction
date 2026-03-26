/**
 * Budget Management Drawer Component
 * Slide-in drawer for managing project budget without navigating away
 * 
 * Usage:
 * <BudgetManagementDrawer
 *   projectId="xxx"
 *   isOpen={true}
 *   onClose={() => setIsOpen(false)}
 *   existingBudget={budget}
 *   onSave={handleSave}
 * />
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/toast';
import { SmartBudgetInput } from './SmartBudgetInput';
import { BudgetWizard } from './BudgetWizard';

export function BudgetManagementDrawer({ 
  projectId, 
  isOpen, 
  onClose, 
  existingBudget, 
  onSave,
  preBudgetSummary 
}) {
  const toast = useToast();
  const [mode, setMode] = useState('quick'); // 'quick' | 'wizard'
  const [budgetData, setBudgetData] = useState(existingBudget || null);
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when drawer opens/closes
  useEffect(() => {
    if (isOpen) {
      setBudgetData(existingBudget || null);
      setMode('quick');
    }
  }, [isOpen, existingBudget]);

  const handleSave = async () => {
    if (!budgetData) return;
    
    setIsSaving(true);
    try {
      await onSave?.(budgetData);
      toast.showSuccess('Budget updated successfully!');
      onClose();
    } catch (error) {
      toast.showError(error.message || 'Failed to update budget');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const hasExistingBudget = existingBudget?.total > 0 || existingBudget?.directConstructionCosts > 0;
  const hasPreBudgetSpending = preBudgetSummary?.totalSpending?.total > 0;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 dark:bg-black/70 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl ds-bg-surface shadow-2xl z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b ds-border-subtle">
          <div>
            <h2 className="text-2xl font-bold ds-text-primary">
              {hasExistingBudget ? 'Manage Budget' : 'Set Initial Budget'}
            </h2>
            <p className="text-sm ds-text-secondary mt-1">
              {hasExistingBudget 
                ? 'Adjust your project budget and allocations' 
                : 'Configure your project financial structure'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 ds-bg-surface-muted hover:ds-bg-surface rounded-lg transition-colors"
            aria-label="Close drawer"
          >
            <svg className="w-6 h-6 ds-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current Status (if budget exists) */}
        {hasExistingBudget && mode === 'quick' && (
          <div className="p-6 border-b ds-border-subtle ds-bg-surface-muted/50">
            <h3 className="text-sm font-semibold ds-text-primary mb-3">📊 Current Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 ds-bg-surface rounded-lg border ds-border-subtle">
                <p className="text-xs ds-text-secondary mb-1">Total Budget</p>
                <p className="text-xl font-bold ds-text-primary">
                  {formatCurrency(existingBudget?.total || 0)}
                </p>
              </div>
              <div className="p-4 ds-bg-surface rounded-lg border ds-border-subtle">
                <p className="text-xs ds-text-secondary mb-1">Direct Construction Costs</p>
                <p className="text-xl font-bold ds-text-accent-primary">
                  {formatCurrency(existingBudget?.directConstructionCosts || 0)}
                </p>
              </div>
              {existingBudget?.preConstructionCosts > 0 && (
                <div className="p-4 ds-bg-surface rounded-lg border ds-border-subtle">
                  <p className="text-xs ds-text-secondary mb-1">Pre-Construction</p>
                  <p className="text-lg font-bold ds-text-primary">
                    {formatCurrency(existingBudget.preConstructionCosts)}
                  </p>
                </div>
              )}
              {existingBudget?.indirectCosts > 0 && (
                <div className="p-4 ds-bg-surface rounded-lg border ds-border-subtle">
                  <p className="text-xs ds-text-secondary mb-1">Indirect Costs</p>
                  <p className="text-lg font-bold ds-text-primary">
                    {formatCurrency(existingBudget.indirectCosts)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pre-Budget Spending Summary (if applicable) */}
        {hasPreBudgetSpending && !hasExistingBudget && mode === 'quick' && (
          <div className="p-6 border-b ds-border-subtle ds-bg-surface-muted/50">
            <h3 className="text-sm font-semibold ds-text-primary mb-3">📋 Pre-Budget Spending Detected</h3>
            <p className="text-sm ds-text-secondary mb-4">
              You've already spent money before setting a budget. We recommend using these values:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 ds-bg-surface rounded-lg border ds-border-subtle">
                <p className="text-xs ds-text-secondary mb-1">Total Spent</p>
                <p className="text-lg font-bold ds-text-accent-primary">
                  {formatCurrency(preBudgetSummary?.totalSpending?.total || 0)}
                </p>
              </div>
              <div className="p-4 ds-bg-surface rounded-lg border ds-border-subtle">
                <p className="text-xs ds-text-secondary mb-1">Recommended DCC</p>
                <p className="text-lg font-bold ds-text-primary">
                  {formatCurrency(preBudgetSummary?.recommendations?.dcc || 0)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="p-4 border-b ds-border-subtle ds-bg-surface-muted/50">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('quick')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'quick'
                  ? 'ds-bg-accent-primary text-white'
                  : 'ds-bg-surface ds-text-secondary hover:ds-bg-surface-muted'
              }`}
            >
              ⚡ Quick Edit
            </button>
            <button
              onClick={() => setMode('wizard')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'wizard'
                  ? 'ds-bg-accent-primary text-white'
                  : 'ds-bg-surface ds-text-secondary hover:ds-bg-surface-muted'
              }`}
            >
              🧙 Wizard
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {mode === 'wizard' ? (
            <BudgetWizard
              projectId={projectId}
              preBudgetSummary={preBudgetSummary}
              existingBudget={existingBudget}
              onSave={async (wizardData) => {
                setBudgetData(wizardData);
                setMode('quick'); // Switch back to quick mode for review
                toast.showSuccess('Budget configured! Review and save.');
              }}
            />
          ) : (
            <SmartBudgetInput
              value={budgetData || {
                total: 0,
                directConstructionCosts: 0,
                preConstructionCosts: 0,
                indirectCosts: 0,
                contingencyReserve: 0
              }}
              onChange={setBudgetData}
              showAdvanced={true}
              label={hasExistingBudget ? 'New Budget Values' : 'Initial Budget'}
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t ds-border-subtle ds-bg-surface-muted/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 ds-bg-surface-muted ds-text-secondary rounded-lg font-medium hover:ds-bg-surface-muted/70 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!budgetData || isSaving}
            className="flex-1 px-4 py-3 ds-bg-accent-primary text-white rounded-lg font-medium hover:ds-bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Saving...' : '💾 Save Changes'}
          </button>
        </div>
      </div>
    </>
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

export default BudgetManagementDrawer;
