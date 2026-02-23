/**
 * Fee Calculator Component for Activities
 * Calculates suggested fee based on activity type and assignment rates
 * Beautiful, interactive component with real-time calculations
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Calculator, 
  Sparkles,
  CheckCircle,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';

export function FeeCalculator({
  professionalServiceId,
  activityType,
  visitDuration,
  inspectionDuration,
  revisionDuration,
  onCalculatedFeeChange,
  className = '',
}) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationResult, setCalculationResult] = useState(null);
  const [error, setError] = useState(null);
  const [assignment, setAssignment] = useState(null);

  // Fetch assignment when professionalServiceId changes
  useEffect(() => {
    const fetchAssignment = async () => {
      if (!professionalServiceId) {
        setAssignment(null);
        return;
      }

      try {
        // Fetch full assignment (includes rates)
        const assignmentResponse = await fetch(`/api/professional-services/${professionalServiceId}`);
        const assignmentData = await assignmentResponse.json();
        
        if (assignmentData.success) {
          setAssignment(assignmentData.data);
        }
      } catch (err) {
        console.error('Error fetching assignment:', err);
      }
    };

    fetchAssignment();
  }, [professionalServiceId]);

  // Calculate fee when relevant fields change
  useEffect(() => {
    const calculateFee = async () => {
      // Reset state
      setCalculationResult(null);
      setError(null);

      // Check if we have minimum required fields
      if (!professionalServiceId || !activityType) {
        return;
      }

      // Skip calculation for activity types that don't typically have fees
      if (['document_upload', 'meeting', 'other'].includes(activityType)) {
        return;
      }

      setIsCalculating(true);

      try {
        const response = await fetch('/api/professional-activities/calculate-fee', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            professionalServiceId,
            activityType,
            visitDuration: visitDuration ? parseFloat(visitDuration) : null,
            inspectionDuration: inspectionDuration ? parseFloat(inspectionDuration) : null,
            revisionDuration: revisionDuration ? parseFloat(revisionDuration) : null,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to calculate fee');
          setIsCalculating(false);
          return;
        }

        setCalculationResult(data.data);
        if (data.data?.calculatedFee && onCalculatedFeeChange) {
          onCalculatedFeeChange(data.data.calculatedFee);
        }
      } catch (err) {
        console.error('Error calculating fee:', err);
        setError('Failed to calculate fee');
      } finally {
        setIsCalculating(false);
      }
    };

    // Debounce calculation
    const timeoutId = setTimeout(calculateFee, 500);
    return () => clearTimeout(timeoutId);
  }, [professionalServiceId, activityType, visitDuration, inspectionDuration, revisionDuration, onCalculatedFeeChange]);

  // Don't show if no assignment or activity type
  if (!professionalServiceId || !activityType) {
    return null;
  }

  // Don't show for activity types that don't typically have fees
  if (['document_upload', 'meeting', 'other'].includes(activityType)) {
    return null;
  }

  return (
    <div className={`rounded-lg border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-5 shadow-sm ${className}`}>
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="h-5 w-5 text-purple-600" />
        <h3 className="text-base font-semibold text-gray-900">Fee Calculator</h3>
            {isCalculating && (
              <Sparkles className="h-4 w-4 text-purple-500 animate-pulse ml-auto" />
            )}
      </div>

      {isCalculating && !calculationResult && (
        <div className="flex items-center gap-2 text-sm text-purple-700">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
          <span>Calculating suggested fee...</span>
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
          {/* Calculated Fee */}
          <div className="bg-white/70 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Suggested Fee</span>
                  <CheckCircle className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {calculationResult.calculatedFee.toLocaleString('en-KE', {
                style: 'currency',
                currency: 'KES',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>

          {/* Calculation Breakdown */}
          {calculationResult.calculation && (
            <div className="bg-white/70 rounded-lg p-4 border border-purple-200">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">Calculation</p>
              <div className="space-y-1">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Method:</span> {calculationResult.calculation.method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
                {calculationResult.calculation.formula && (
                  <p className="text-sm text-gray-600 font-mono bg-gray-50 px-2 py-1 rounded">
                    {calculationResult.calculation.formula}
                  </p>
                )}
                {calculationResult.calculation.rate && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <span className="text-gray-600">Rate:</span>
                      <span className="font-medium text-gray-900">
                        {calculationResult.calculation.rate.toLocaleString('en-KE', {
                          style: 'currency',
                          currency: 'KES',
                          minimumFractionDigits: 0,
                        })}
                      </span>
                      {calculationResult.calculation.duration && (
                        <>
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-medium text-gray-900">{calculationResult.calculation.duration} hours</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Hint */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <DollarSign className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-800">
              <span className="font-medium">Tip:</span> Click "Use Suggested Fee" to apply this amount, or enter your own fee amount.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
