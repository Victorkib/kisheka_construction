/**
 * Rate Information Panel Component for Fees
 * Displays professional rates and suggests fee amounts based on fee type
 * Beautiful, informative panel with real-time suggestions
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Clock, 
  MapPin, 
  Calendar,
  Info,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import { getSuggestedFeeAmount, validateFeeAmount } from '@/lib/professional-rates-helpers';

export function RateInformationPanel({ 
  professionalService,
  feeType,
  currentAmount,
  onSuggestedAmountChange,
  className = '',
}) {
  const [rates, setRates] = useState({
    hourlyRate: null,
    perVisitRate: null,
    monthlyRetainer: null,
    source: null,
  });
  const [suggestedAmount, setSuggestedAmount] = useState(null);
  const [calculation, setCalculation] = useState(null);
  const [validation, setValidation] = useState(null);

  // Get rates from assignment
  useEffect(() => {
    if (!professionalService) {
      setRates({ hourlyRate: null, perVisitRate: null, monthlyRetainer: null, source: null });
      return;
    }

    // Get rates from assignment (denormalized)
    setRates({
      hourlyRate: professionalService.hourlyRate || professionalService.ratesSnapshot?.hourlyRate || null,
      perVisitRate: professionalService.perVisitRate || professionalService.ratesSnapshot?.perVisitRate || null,
      monthlyRetainer: professionalService.monthlyRetainer || professionalService.ratesSnapshot?.monthlyRetainer || null,
      source: 'assignment',
    });
  }, [professionalService]);

  // Calculate suggested amount when fee type or rates change
  useEffect(() => {
    if (!professionalService || !feeType) {
      setSuggestedAmount(null);
      setCalculation(null);
      return;
    }

    const result = getSuggestedFeeAmount(feeType, professionalService);
    
    if (result.suggestedAmount) {
      setSuggestedAmount(result.suggestedAmount);
      setCalculation(result.calculation);
      
      if (onSuggestedAmountChange) {
        onSuggestedAmountChange(result.suggestedAmount);
      }
    } else {
      setSuggestedAmount(null);
      setCalculation(null);
    }
  }, [professionalService, feeType, onSuggestedAmountChange]);

  // Validate current amount against contract value
  useEffect(() => {
    if (!professionalService || !currentAmount) {
      setValidation(null);
      return;
    }

    const amount = parseFloat(currentAmount);
    if (isNaN(amount) || amount <= 0) {
      setValidation(null);
      return;
    }

    const result = validateFeeAmount(amount, professionalService);
    setValidation(result);
  }, [professionalService, currentAmount]);

  const hasRates = rates.hourlyRate || rates.perVisitRate || rates.monthlyRetainer;

  if (!professionalService) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Rate Information */}
      {hasRates ? (
        <div className="rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-semibold text-gray-900">Professional Rates</h3>
            {rates.source && (
              <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                From Assignment
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Hourly Rate */}
            {rates.hourlyRate && (
              <div className="bg-white/70 rounded-lg p-3 border border-indigo-100">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Hourly Rate</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {rates.hourlyRate.toLocaleString('en-KE', { 
                    style: 'currency', 
                    currency: 'KES',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="text-xs text-gray-500 mt-1">per hour</p>
              </div>
            )}

            {/* Per-Visit Rate */}
            {rates.perVisitRate && (
              <div className="bg-white/70 rounded-lg p-3 border border-indigo-100">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Per-Visit Rate</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {rates.perVisitRate.toLocaleString('en-KE', { 
                    style: 'currency', 
                    currency: 'KES',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="text-xs text-gray-500 mt-1">per visit</p>
              </div>
            )}

            {/* Monthly Retainer */}
            {rates.monthlyRetainer && (
              <div className="bg-white/70 rounded-lg p-3 border border-indigo-100">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Monthly Retainer</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {rates.monthlyRetainer.toLocaleString('en-KE', { 
                    style: 'currency', 
                    currency: 'KES',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="text-xs text-gray-500 mt-1">per month</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900 mb-1">No Rates Configured</h3>
              <p className="text-sm text-amber-800">
                This assignment doesn't have rates set. Fee suggestions won't be available, but you can still enter a manual amount.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Suggested Fee Amount */}
      {suggestedAmount && feeType && (
        <div className="rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-green-600" />
            <h3 className="text-base font-semibold text-gray-900">Suggested Fee Amount</h3>
          </div>

          <div className="bg-white/70 rounded-lg p-4 border border-green-200 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Based on {feeType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                  <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {suggestedAmount.toLocaleString('en-KE', {
                style: 'currency',
                currency: 'KES',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>

          {calculation && (
            <div className="bg-white/70 rounded-lg p-4 border border-green-200">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">Calculation</p>
              <p className="text-sm text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded">
                {calculation.formula}
              </p>
            </div>
          )}

          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-800">
              <span className="font-medium">Tip:</span> This is a suggested amount based on the professional's rates. You can use this amount or enter your own.
            </p>
          </div>
        </div>
      )}

      {/* Validation Warnings */}
      {validation && currentAmount && (
        <div className={`rounded-lg p-4 border ${
          validation.isValid 
            ? validation.warning 
              ? 'border-yellow-200 bg-yellow-50' 
              : 'border-green-200 bg-green-50'
            : 'border-red-200 bg-red-50'
        }`}>
          {!validation.isValid && (
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Validation Error</p>
                <p className="text-xs text-red-800 mt-1">{validation.error}</p>
              </div>
            </div>
          )}
          {validation.isValid && validation.warning && (
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900">Warning</p>
                <p className="text-xs text-yellow-800 mt-1">{validation.warning}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
