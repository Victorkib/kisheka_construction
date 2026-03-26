/**
 * Contract Value Calculator Component
 * Calculates and suggests contract value based on rates and payment schedule
 * Beautiful, interactive component with real-time calculations
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Calculator, 
  Sparkles,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { RateInformationCard } from './RateInformationCard';
import { ContractValueComparisonWarning } from './ContractValueComparisonWarning';

export function ContractValueCalculator({
  professional,
  paymentSchedule,
  contractType,
  contractStartDate,
  contractEndDate,
  visitFrequency,
  floorsCount,
  currentContractValue,
  onSuggestedValueChange,
  className = '',
}) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationResult, setCalculationResult] = useState(null);
  const [error, setError] = useState(null);

  // Calculate when relevant fields change
  useEffect(() => {
    const calculateValue = async () => {
      // Reset state
      setCalculationResult(null);
      setError(null);

      // Check if we have minimum required fields
      if (!professional?._id || !paymentSchedule || !contractType || !contractStartDate) {
        return;
      }

      // Skip calculation for manual entry schedules
      if (['lump_sum', 'milestone', 'percentage'].includes(paymentSchedule)) {
        return;
      }

      setIsCalculating(true);

      try {
        const response = await fetch('/api/professional-services/calculate-contract-value', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            libraryId: professional._id,
            paymentSchedule,
            contractType,
            contractStartDate,
            contractEndDate: contractEndDate || null,
            visitFrequency: visitFrequency || null,
            floorsCount: floorsCount || null,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to calculate contract value');
          setIsCalculating(false);
          return;
        }

        setCalculationResult(data.data);
        if (data.data?.suggestedValue && onSuggestedValueChange) {
          onSuggestedValueChange(data.data.suggestedValue);
        }
      } catch (err) {
        console.error('Error calculating contract value:', err);
        setError('Failed to calculate contract value');
      } finally {
        setIsCalculating(false);
      }
    };

    // Debounce calculation
    const timeoutId = setTimeout(calculateValue, 500);
    return () => clearTimeout(timeoutId);
  }, [professional, paymentSchedule, contractType, contractStartDate, contractEndDate, visitFrequency, floorsCount, onSuggestedValueChange]);

  // Don't show if manual entry schedule
  if (['lump_sum', 'milestone', 'percentage'].includes(paymentSchedule)) {
    return null;
  }

  // Don't show if no professional selected
  if (!professional) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Rate Information */}
      <RateInformationCard professional={professional} />

      {/* Calculator */}
      {paymentSchedule && contractType && contractStartDate && (
        <div className="rounded-lg border border-green-400/60 bg-gradient-to-br from-green-50 to-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="h-5 w-5 text-green-600" />
            <h3 className="text-base font-semibold ds-text-primary">Contract Value Calculator</h3>
            {isCalculating && (
              <Sparkles className="h-4 w-4 text-green-500 animate-pulse ml-auto" />
            )}
          </div>

          {isCalculating && !calculationResult && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-600 border-t-transparent"></div>
              <span>Calculating suggested contract value...</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-100 border border-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">Calculation Unavailable</p>
                <p className="text-xs text-amber-800 mt-1">{error}</p>
              </div>
            </div>
          )}

          {calculationResult && !error && (
            <div className="space-y-3">
              {/* Suggested Value */}
              <div className="ds-bg-surface/70 rounded-lg p-4 border border-green-400/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium ds-text-secondary">Suggested Contract Value</span>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold ds-text-primary">
                  {calculationResult.suggestedValue.toLocaleString('en-KE', {
                    style: 'currency',
                    currency: 'KES',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>

              {/* Calculation Breakdown */}
              {calculationResult.calculation && (
                <div className="ds-bg-surface/70 rounded-lg p-4 border border-green-400/60">
                  <p className="text-xs font-medium ds-text-secondary uppercase tracking-wide mb-2">Calculation</p>
                  <div className="space-y-1">
                    <p className="text-sm ds-text-secondary">
                      <span className="font-medium">Method:</span> {calculationResult.calculation.method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    {calculationResult.calculation.formula && (
                      <p className="text-sm ds-text-secondary font-mono ds-bg-surface-muted px-2 py-1 rounded">
                        {calculationResult.calculation.formula}
                      </p>
                    )}
                    {calculationResult.breakdown && (
                      <div className="mt-2 pt-2 border-t ds-border-subtle">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {calculationResult.breakdown.rate && (
                            <>
                              <span className="ds-text-secondary">Rate:</span>
                              <span className="font-medium ds-text-primary">
                                {calculationResult.breakdown.rate.toLocaleString('en-KE', {
                                  style: 'currency',
                                  currency: 'KES',
                                  minimumFractionDigits: 0,
                                })}
                              </span>
                            </>
                          )}
                          {calculationResult.breakdown.months && (
                            <>
                              <span className="ds-text-secondary">Duration:</span>
                              <span className="font-medium ds-text-primary">{calculationResult.breakdown.months} months</span>
                            </>
                          )}
                          {calculationResult.breakdown.visitsPerMonth && (
                            <>
                              <span className="ds-text-secondary">Visits/Month:</span>
                              <span className="font-medium ds-text-primary">{calculationResult.breakdown.visitsPerMonth}</span>
                            </>
                          )}
                          {calculationResult.breakdown.totalVisits && (
                            <>
                              <span className="ds-text-secondary">Total Visits:</span>
                              <span className="font-medium ds-text-primary">{calculationResult.breakdown.totalVisits}</span>
                            </>
                          )}
                          {calculationResult.breakdown.estimatedHours && (
                            <>
                              <span className="ds-text-secondary">Est. Hours:</span>
                              <span className="font-medium ds-text-primary">{calculationResult.breakdown.estimatedHours.toFixed(1)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Hint */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-400/60">
                <Sparkles className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-800">
                  <span className="font-medium">Tip:</span> Click &quot;Use Suggested Value&quot; to apply this amount to the contract value field, or enter your own value.
                </p>
              </div>

              {/* Value Comparison Warning */}
              {currentContractValue && (
                <ContractValueComparisonWarning 
                  suggestedValue={calculationResult.suggestedValue}
                  currentValue={currentContractValue}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
