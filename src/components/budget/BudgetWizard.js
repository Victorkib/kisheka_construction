/**
 * Project Budget Wizard Component
 * Context-aware step-by-step budget creation with smart recommendations
 *
 * Usage:
 * <BudgetWizard
 *   projectId="xxx"
 *   preBudgetSummary={summary}
 *   existingBudget={budget}
 *   onSave={handleSave}
 * />
 *
 * Features:
 * - If budget exists: Shows adjustment wizard (changes only)
 * - If no budget: Shows full budget setup
 * - If pre-budget spending exists: Shows "capture spending" step first
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/toast';
import { SmartBudgetInput } from './SmartBudgetInput';
import { BudgetAllocationPreview } from './BudgetAllocationPreview';
import { PreBudgetSpendingSummary } from './PreBudgetSpendingSummary';

export function BudgetWizard({ projectId, preBudgetSummary, existingBudget, onSave }) {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [isCalculating, setIsCalculating] = useState(false);

  const [budgetData, setBudgetData] = useState(() => {
    if (existingBudget) {
      return {
        total: existingBudget.total || 0,
        directConstructionCosts: existingBudget.directConstructionCosts || 0,
        preConstructionCosts: existingBudget.preConstructionCosts || 0,
        indirectCosts: existingBudget.indirectCosts || 0,
        contingencyReserve: existingBudget.contingencyReserve || 0,
        // Keep detailed breakdowns for backward compatibility
        _detailedBreakdown: existingBudget._detailedBreakdown || {
          materials: { total: 0, structural: 0, finishing: 0, mep: 0, specialty: 0 },
          labour: { total: 0, skilled: 0, unskilled: 0, supervisory: 0, specialized: 0 },
          equipment: { total: 0, rental: 0, purchase: 0, maintenance: 0 },
          subcontractors: { total: 0, specializedTrades: 0, professionalServices: 0 },
          preConstruction: {
            total: 0,
            landAcquisition: 0,
            legalRegulatory: 0,
            permitsApprovals: 0,
            sitePreparation: 0,
          },
          indirect: {
            total: 0,
            siteOverhead: 0,
            transportation: 0,
            utilities: 0,
            safetyCompliance: 0,
          },
          contingency: {
            total: 0,
            designContingency: 0,
            constructionContingency: 0,
            ownersReserve: 0,
          },
        }
      };
    }
    
    // Default simplified structure
    return {
      total: 0,
      directConstructionCosts: 0,
      preConstructionCosts: 0,
      indirectCosts: 0,
      contingencyReserve: 0,
      _detailedBreakdown: {
        materials: { total: 0, structural: 0, finishing: 0, mep: 0, specialty: 0 },
        labour: { total: 0, skilled: 0, unskilled: 0, supervisory: 0, specialized: 0 },
        equipment: { total: 0, rental: 0, purchase: 0, maintenance: 0 },
        subcontractors: { total: 0, specializedTrades: 0, professionalServices: 0 },
        preConstruction: {
          total: 0,
          landAcquisition: 0,
          legalRegulatory: 0,
          permitsApprovals: 0,
          sitePreparation: 0,
        },
        indirect: {
          total: 0,
          siteOverhead: 0,
          transportation: 0,
          utilities: 0,
          safetyCompliance: 0,
        },
        contingency: {
          total: 0,
          designContingency: 0,
          constructionContingency: 0,
          ownersReserve: 0,
        },
      }
    };
  });

  // Add project type state for dynamic updates
  const [projectType, setProjectType] = useState('residential');

  // Category breakdown percentages
  const [dccBreakdown, setDccBreakdown] = useState({
    materials: 65,
    labour: 25,
    equipment: 5,
    subcontractors: 3,
    contingency: 2
  });

  // Allocation preferences
  const [allocationPrefs, setAllocationPrefs] = useState({
    autoAllocateToPhases: true,
    autoAllocateToFloors: false,
    floorAllocationStrategy: 'weighted'
  });

  // Validation
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  // Step 1: Apply recommendations to simplified structure
  useEffect(() => {
    if (preBudgetSummary && step === 1) {
      setIsCalculating(true);

      // Apply recommendations to simplified structure
      const recommendations = {
        total: 0, // Will be calculated
        directConstructionCosts: preBudgetSummary.recommendations?.dcc || preBudgetSummary.totalSpending?.dcc || 0,
        preConstructionCosts: preBudgetSummary.recommendations?.preConstruction || preBudgetSummary.totalSpending?.preConstruction || 0,
        indirectCosts: preBudgetSummary.recommendations?.indirect || preBudgetSummary.totalSpending?.indirect || 0,
        contingencyReserve: Math.round((preBudgetSummary.recommendations?.dcc || 0) * 0.05),
        _detailedBreakdown: {
          materials: { 
            total: preBudgetSummary.recommendations?.dcc || preBudgetSummary.totalSpending?.dcc || 0,
            structural: 0,
            finishing: 0,
            mep: 0,
            specialty: 0
          },
          labour: { total: 0, skilled: 0, unskilled: 0, supervisory: 0, specialized: 0 },
          equipment: { total: 0, rental: 0, purchase: 0, maintenance: 0 },
          subcontractors: { total: 0, specializedTrades: 0, professionalServices: 0 },
          preConstruction: {
            total: preBudgetSummary.recommendations?.preConstruction || preBudgetSummary.totalSpending?.preConstruction || 0,
            landAcquisition: 0,
            legalRegulatory: 0,
            permitsApprovals: 0,
            sitePreparation: 0,
          },
          indirect: {
            total: preBudgetSummary.recommendations?.indirect || preBudgetSummary.totalSpending?.indirect || 0,
            siteOverhead: 0,
            transportation: 0,
            utilities: 0,
            safetyCompliance: 0,
          },
          contingency: {
            total: Math.round((preBudgetSummary.recommendations?.dcc || 0) * 0.05),
            designContingency: 0,
            constructionContingency: 0,
            ownersReserve: 0,
          },
        }
      };

      // Calculate total
      recommendations.total = recommendations.directConstructionCosts +
                             recommendations.preConstructionCosts +
                             recommendations.indirectCosts +
                             recommendations.contingencyReserve;

      setBudgetData(recommendations);
      setIsCalculating(false);
    }
  }, [preBudgetSummary, step]);

  const handleUseRecommended = () => {
    if (preBudgetSummary?.recommendations) {
      const simplifiedRecommendations = {
        total: 0, // Will be calculated
        directConstructionCosts: preBudgetSummary.recommendations.dcc || 0,
        preConstructionCosts: preBudgetSummary.recommendations.preConstruction || 0,
        indirectCosts: preBudgetSummary.recommendations.indirect || 0,
        contingencyReserve: Math.round((preBudgetSummary.recommendations.dcc || 0) * 0.05),
        _detailedBreakdown: {
          materials: { 
            total: preBudgetSummary.recommendations.dcc || 0,
            structural: 0,
            finishing: 0,
            mep: 0,
            specialty: 0
          },
          labour: { total: 0, skilled: 0, unskilled: 0, supervisory: 0, specialized: 0 },
          equipment: { total: 0, rental: 0, purchase: 0, maintenance: 0 },
          subcontractors: { total: 0, specializedTrades: 0, professionalServices: 0 },
          preConstruction: {
            total: preBudgetSummary.recommendations.preConstruction || 0,
            landAcquisition: 0,
            legalRegulatory: 0,
            permitsApprovals: 0,
            sitePreparation: 0,
          },
          indirect: {
            total: preBudgetSummary.recommendations.indirect || 0,
            siteOverhead: 0,
            transportation: 0,
            utilities: 0,
            safetyCompliance: 0,
          },
          contingency: {
            total: Math.round((preBudgetSummary.recommendations.dcc || 0) * 0.05),
            designContingency: 0,
            constructionContingency: 0,
            ownersReserve: 0,
          },
        }
      };
      
      // Calculate total
      simplifiedRecommendations.total = simplifiedRecommendations.directConstructionCosts +
                                     simplifiedRecommendations.preConstructionCosts +
                                     simplifiedRecommendations.indirectCosts +
                                     simplifiedRecommendations.contingencyReserve;
      
      setBudgetData(simplifiedRecommendations);
      toast.showSuccess('Recommended values applied');
    }
  };

  const handleBudgetChange = (newBudget) => {
    setBudgetData(newBudget);
    
    // Real-time validation
    if (preBudgetSummary) {
      const warnings = [];
      
      if (newBudget.directConstructionCosts > 0 && preBudgetSummary.totalSpending?.dcc > 0) {
        if (newBudget.directConstructionCosts < preBudgetSummary.totalSpending.dcc) {
          warnings.push({
            category: 'DCC',
            message: `DCC budget is less than spending (${formatCurrency(preBudgetSummary.totalSpending.dcc)})`
          });
        }
      }
      
      setValidationWarnings(warnings);
    }
  };

  const handleNext = () => {
    // Validate current step before proceeding
    if (step === 1) {
      if (budgetData.total <= 0) {
        toast.showError('Total budget must be greater than 0');
        return;
      }
      
      if (validationWarnings.some(w => w.category === 'DCC' && w.message.includes('less than'))) {
        toast.showWarning('DCC budget is less than actual spending. This may cause issues.');
        return;
      }
    }
    
    setStep(step + 1);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...budgetData,
        dccBreakdown,
        allocationPrefs
      };
      
      await onSave?.(payload);
      toast.showSuccess('Budget saved successfully!');
    } catch (error) {
      toast.showError(error.message || 'Failed to save budget');
    }
  };

  // Remove unused dccBreakdown logic since EnhancedBudgetInput handles its own breakdown
  // This is kept for compatibility with existing allocation preferences
  const getDccBreakdownFromEnhanced = () => {
    const directCosts = budgetData.directCosts || {};
    const totalDcc = budgetData.directConstructionCosts || 1;
    
    if (totalDcc === 0) return dccBreakdown;
    
    return {
      materials: Math.round((directCosts.materials?.total || 0) / totalDcc * 100) || 65,
      labour: Math.round((directCosts.labour?.total || 0) / totalDcc * 100) || 25,
      equipment: Math.round((directCosts.equipment?.total || 0) / totalDcc * 100) || 5,
      subcontractors: Math.round((directCosts.subcontractors?.total || 0) / totalDcc * 100) || 3,
      contingency: Math.max(0, 100 - (
        Math.round((directCosts.materials?.total || 0) / totalDcc * 100) +
        Math.round((directCosts.labour?.total || 0) / totalDcc * 100) +
        Math.round((directCosts.equipment?.total || 0) / totalDcc * 100) +
        Math.round((directCosts.subcontractors?.total || 0) / totalDcc * 100)
      ))
    };
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <StepIndicator number={1} active={step >= 1} completed={step > 1} label="Budget" />
            <div className={`w-12 h-0.5 ${step >= 2 ? 'ds-bg-accent-primary' : 'ds-bg-surface-muted'}`} />
            <StepIndicator number={2} active={step >= 2} completed={step > 2} label="Breakdown" />
            <div className={`w-12 h-0.5 ${step >= 3 ? 'ds-bg-accent-primary' : 'ds-bg-surface-muted'}`} />
            <StepIndicator number={3} active={step >= 3} completed={step > 3} label="Allocate" />
            <div className={`w-12 h-0.5 ${step >= 4 ? 'ds-bg-accent-primary' : 'ds-bg-surface-muted'}`} />
            <StepIndicator number={4} active={step >= 4} completed={false} label="Review" />
          </div>
        </div>
      </div>

      {/* Step 1: Budget Entry */}
      {step === 1 && (
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold ds-text-primary">💰 Step 1: Project Budget</h2>
              <p className="text-sm ds-text-secondary mt-1">
                Enter your project budget or use recommended values
              </p>
            </div>
            {preBudgetSummary && (
              <button
                onClick={handleUseRecommended}
                className="px-4 py-2 ds-bg-accent-subtle ds-text-accent-primary rounded-lg hover:ds-bg-accent-subtle/70 text-sm font-medium"
              >
                ✨ Use Recommended
              </button>
            )}
          </div>

          {isCalculating ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 ds-border-accent-primary mx-auto"></div>
              <p className="mt-4 ds-text-secondary">Calculating recommendations...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Single SmartBudgetInput instance */}
              <SmartBudgetInput
                value={budgetData}
                onChange={handleBudgetChange}
                projectType={projectType}
                onProjectTypeChange={setProjectType}
                showAdvanced={false}
                disabled={isCalculating}
              />

              {/* Validation Warnings */}
              {validationWarnings.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-400/60 rounded-lg">
                  <p className="text-sm text-yellow-800 font-semibold mb-2">⚠️ Warnings:</p>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {validationWarnings.map((warning, index) => (
                      <li key={index}>• {warning.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end mt-6">
            <button
              onClick={handleNext}
              className="px-6 py-3 text-sm font-medium text-white ds-bg-accent-primary rounded-lg hover:ds-bg-accent-hover"
            >
              Next: Breakdown →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Category Breakdown */}
      {step === 2 && (
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold ds-text-primary mb-2">📊 Step 2: Budget Overview</h2>
          <p className="text-sm ds-text-secondary mb-6">
            Review your budget structure and allocation preferences
          </p>

          {/* Budget Summary from Enhanced Structure */}
          <div className="mb-8 p-6 ds-bg-accent-subtle border-2 ds-border-accent-subtle rounded-lg">
            <h4 className="text-lg font-semibold ds-text-primary mb-4">💰 Budget Summary</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="ds-bg-surface rounded-lg p-4 border ds-border-subtle shadow-sm">
                <label className="block text-xs font-semibold ds-text-secondary mb-2 uppercase tracking-wide">
                  Total Project Budget
                </label>
                <p className="text-xl font-bold ds-text-primary">{formatCurrency(budgetData.total || 0)}</p>
              </div>
              <div className="ds-bg-surface rounded-lg p-4 border border-blue-400/60 shadow-sm">
                <label className="block text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">
                  Direct Construction
                </label>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(budgetData.directConstructionCosts || 0)}</p>
              </div>
              <div className="ds-bg-surface rounded-lg p-4 border border-purple-400/60 shadow-sm">
                <label className="block text-xs font-semibold text-purple-700 mb-2 uppercase tracking-wide">
                  Pre-Construction
                </label>
                <p className="text-xl font-bold text-purple-600">{formatCurrency(budgetData.preConstructionCosts || 0)}</p>
              </div>
              <div className="ds-bg-surface rounded-lg p-4 border border-orange-200 shadow-sm">
                <label className="block text-xs font-semibold text-orange-700 mb-2 uppercase tracking-wide">
                  Contingency Reserve
                </label>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(budgetData.contingencyReserve || 0)}</p>
              </div>
            </div>
          </div>

          {/* DCC Breakdown Visualization */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold ds-text-primary mb-4">🏗️ Direct Construction Breakdown</h4>
            <div className="space-y-4">
              {Object.entries(getDccBreakdownFromEnhanced()).map(([category, percentage]) => (
                <div key={category}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium ds-text-secondary capitalize">
                      {category}
                    </label>
                    <span className="text-sm font-semibold ds-text-primary">{percentage}%</span>
                  </div>
                  <div className="w-full ds-bg-surface-muted rounded-full h-3">
                    <div
                      className="ds-bg-accent-primary h-3 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 text-sm font-medium ds-text-secondary ds-bg-surface-muted rounded-lg hover:ds-bg-surface-muted/70"
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-3 text-sm font-medium text-white ds-bg-accent-primary rounded-lg hover:ds-bg-accent-hover"
            >
              Next: Allocation →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Allocation Preferences */}
      {step === 3 && (
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold ds-text-primary mb-2">🏗️ Step 3: Allocation Preferences</h2>
          <p className="text-sm ds-text-secondary mb-6">
            Choose how to distribute the budget
          </p>

          <div className="space-y-6">
            <div className="p-4 ds-bg-surface-muted rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allocationPrefs.autoAllocateToPhases}
                  onChange={(e) => setAllocationPrefs({ ...allocationPrefs, autoAllocateToPhases: e.target.checked })}
                  className="w-5 h-5 text-blue-600 ds-border-subtle rounded focus:ring-blue-500"
                />
                <div>
                  <p className="text-sm font-medium ds-text-primary">Auto-allocate to phases</p>
                  <p className="text-xs ds-text-secondary">Distribute budget to existing phases based on sequence</p>
                </div>
              </label>
            </div>

            <div className="p-4 ds-bg-surface-muted rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allocationPrefs.autoAllocateToFloors}
                  onChange={(e) => setAllocationPrefs({ ...allocationPrefs, autoAllocateToFloors: e.target.checked })}
                  className="w-5 h-5 text-blue-600 ds-border-subtle rounded focus:ring-blue-500"
                />
                <div>
                  <p className="text-sm font-medium ds-text-primary">Auto-allocate to floors</p>
                  <p className="text-xs ds-text-secondary">Distribute phase budgets to floors</p>
                </div>
              </label>

              {allocationPrefs.autoAllocateToFloors && (
                <div className="mt-4 ml-8">
                  <label className="block text-sm font-medium ds-text-secondary mb-2">
                    Floor Allocation Strategy
                  </label>
                  <select
                    value={allocationPrefs.floorAllocationStrategy}
                    onChange={(e) => setAllocationPrefs({ ...allocationPrefs, floorAllocationStrategy: e.target.value })}
                    className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg"
                  >
                    <option value="weighted">Weighted (by floor type)</option>
                    <option value="even">Even distribution</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-3 text-sm font-medium ds-text-secondary ds-bg-surface-muted rounded-lg hover:ds-bg-surface-muted/70"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="px-6 py-3 text-sm font-medium text-white ds-bg-accent-primary rounded-lg hover:ds-bg-accent-hover"
            >
              Next: Review →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Confirm */}
      {step === 4 && (
        <div className="ds-bg-surface rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold ds-text-primary mb-2">✅ Step 4: Review & Confirm</h2>
          <p className="text-sm ds-text-secondary mb-6">
            Review your complete budget configuration before saving
          </p>

          {/* Enhanced Budget Summary */}
          <div className="mb-8 p-6 ds-bg-accent-subtle border-2 ds-border-accent-subtle rounded-lg">
            <h4 className="text-lg font-semibold ds-text-primary mb-4">📋 Final Budget Summary</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="ds-bg-surface rounded-lg p-4 border ds-border-subtle shadow-sm">
                <label className="block text-xs font-semibold ds-text-secondary mb-2 uppercase tracking-wide">
                  Total Project Budget
                </label>
                <p className="text-xl font-bold ds-text-primary">{formatCurrency(budgetData.total || 0)}</p>
              </div>
              <div className="ds-bg-surface rounded-lg p-4 border border-blue-400/60 shadow-sm">
                <label className="block text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">
                  Direct Construction
                </label>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(budgetData.directConstructionCosts || 0)}</p>
              </div>
              <div className="ds-bg-surface rounded-lg p-4 border border-purple-400/60 shadow-sm">
                <label className="block text-xs font-semibold text-purple-700 mb-2 uppercase tracking-wide">
                  Pre-Construction
                </label>
                <p className="text-xl font-bold text-purple-600">{formatCurrency(budgetData.preConstructionCosts || 0)}</p>
              </div>
              <div className="ds-bg-surface rounded-lg p-4 border border-orange-200 shadow-sm">
                <label className="block text-xs font-semibold text-orange-700 mb-2 uppercase tracking-wide">
                  Contingency Reserve
                </label>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(budgetData.contingencyReserve || 0)}</p>
              </div>
            </div>

            {/* Allocation Preferences Summary */}
            <div className="border-t ds-border-accent-subtle pt-4">
              <h5 className="text-sm font-semibold ds-text-primary mb-3">🎯 Allocation Preferences</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${allocationPrefs.autoAllocateToPhases ? 'ds-bg-accent-primary' : 'ds-bg-surface-muted'}`} />
                  <span className="text-sm ds-text-secondary">Auto-allocate to phases</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${allocationPrefs.autoAllocateToFloors ? 'ds-bg-accent-primary' : 'ds-bg-surface-muted'}`} />
                  <span className="text-sm ds-text-secondary">Auto-allocate to floors</span>
                </div>
                {allocationPrefs.autoAllocateToFloors && (
                  <div className="text-sm ds-text-secondary">
                    Floor strategy: <span className="font-medium ds-text-primary">{allocationPrefs.floorAllocationStrategy}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <BudgetAllocationPreview
            source="Project Budget"
            sourceAmount={budgetData.total}
            targets={[]}
            strategy={allocationPrefs.floorAllocationStrategy}
            onConfirm={handleSave}
            onCancel={() => setStep(3)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Step Indicator Component
 */
function StepIndicator({ number, active, completed, label }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
          completed
            ? 'ds-bg-accent-primary text-white'
            : active
            ? 'ds-bg-accent-subtle ds-text-accent-primary'
            : 'ds-bg-surface-muted ds-text-muted'
        }`}
      >
        {completed ? '✓' : number}
      </div>
      <span className={`text-sm font-medium hidden sm:inline ${active ? 'ds-text-primary' : 'ds-text-muted'}`}>
        {label}
      </span>
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

export default BudgetWizard;
