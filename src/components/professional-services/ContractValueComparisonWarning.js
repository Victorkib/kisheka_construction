/**
 * Contract Value Comparison Warning Component
 * Shows warning if entered value differs significantly from suggested value
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export function ContractValueComparisonWarning({ suggestedValue, currentValue }) {
  const [warning, setWarning] = useState(null);

  useEffect(() => {
    if (!suggestedValue || !currentValue) {
      setWarning(null);
      return;
    }

    const entered = parseFloat(currentValue);
    if (isNaN(entered) || entered <= 0) {
      setWarning(null);
      return;
    }

    const difference = Math.abs(entered - suggestedValue);
    const percentageDiff = (difference / suggestedValue) * 100;

    // Warn if difference is more than 20%
    if (percentageDiff > 20) {
      const isHigher = entered > suggestedValue;
      setWarning({
        message: `The entered contract value is ${percentageDiff.toFixed(0)}% ${isHigher ? 'higher' : 'lower'} than the suggested value based on rates.`,
        type: percentageDiff > 50 ? 'error' : 'warning',
      });
    } else {
      setWarning(null);
    }
  }, [suggestedValue, currentValue]);

  if (!warning) return null;

  return (
    <div className={`mt-3 flex items-start gap-2 p-3 rounded-lg border ${
      warning.type === 'error' 
        ? 'bg-red-50 border-red-200' 
        : 'bg-yellow-50 border-yellow-200'
    }`}>
      <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
        warning.type === 'error' ? 'text-red-600' : 'text-yellow-600'
      }`} />
      <div className="flex-1">
        <p className={`text-sm font-medium ${
          warning.type === 'error' ? 'text-red-900' : 'text-yellow-900'
        }`}>
          {warning.type === 'error' ? 'Significant Difference' : 'Value Difference'}
        </p>
        <p className={`text-xs mt-1 ${
          warning.type === 'error' ? 'text-red-800' : 'text-yellow-800'
        }`}>
          {warning.message}
        </p>
      </div>
    </div>
  );
}
