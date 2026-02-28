/**
 * Rate Information Card Component
 * Displays professional rates from library or assignment
 * Beautiful, informative card showing hourly, per-visit, and retainer rates
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Clock, 
  MapPin, 
  Calendar,
  Info,
} from 'lucide-react';

export function RateInformationCard({ 
  professional, 
  assignment = null,
  className = '',
}) {
  const [rates, setRates] = useState({
    hourlyRate: null,
    perVisitRate: null,
    monthlyRetainer: null,
    source: null,
  });

  useEffect(() => {
    if (!professional && !assignment) {
      setRates({ hourlyRate: null, perVisitRate: null, monthlyRetainer: null, source: null });
      return;
    }

    // Prefer assignment rates (denormalized), fallback to library
    if (assignment && (assignment.hourlyRate || assignment.perVisitRate || assignment.monthlyRetainer)) {
      setRates({
        hourlyRate: assignment.hourlyRate || assignment.ratesSnapshot?.hourlyRate || null,
        perVisitRate: assignment.perVisitRate || assignment.ratesSnapshot?.perVisitRate || null,
        monthlyRetainer: assignment.monthlyRetainer || assignment.ratesSnapshot?.monthlyRetainer || null,
        source: 'assignment',
      });
    } else if (professional) {
      setRates({
        hourlyRate: professional.defaultHourlyRate || null,
        perVisitRate: professional.defaultPerVisitRate || null,
        monthlyRetainer: professional.defaultMonthlyRetainer || null,
        source: 'library',
      });
    }
  }, [professional, assignment]);

  const hasRates = rates.hourlyRate || rates.perVisitRate || rates.monthlyRetainer;

  if (!hasRates) {
    return (
      <div className={`rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900 mb-1">No Rates Configured</h3>
            <p className="text-sm text-amber-800">
              This professional doesn't have default rates set. You can still create the assignment, but contract value calculations won't be available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-blue-400/60 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-5 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-blue-600" />
        <h3 className="text-base font-semibold ds-text-primary">Professional Rates</h3>
        {rates.source && (
          <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
            {rates.source === 'assignment' ? 'From Assignment' : 'From Library'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Hourly Rate */}
        {rates.hourlyRate && (
          <div className="ds-bg-surface/70 rounded-lg p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium ds-text-secondary uppercase tracking-wide">Hourly Rate</span>
            </div>
            <p className="text-lg font-bold ds-text-primary">
              {rates.hourlyRate.toLocaleString('en-KE', { 
                style: 'currency', 
                currency: 'KES',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
            <p className="text-xs ds-text-muted mt-1">per hour</p>
          </div>
        )}

        {/* Per-Visit Rate */}
        {rates.perVisitRate && (
          <div className="ds-bg-surface/70 rounded-lg p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium ds-text-secondary uppercase tracking-wide">Per-Visit Rate</span>
            </div>
            <p className="text-lg font-bold ds-text-primary">
              {rates.perVisitRate.toLocaleString('en-KE', { 
                style: 'currency', 
                currency: 'KES',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
            <p className="text-xs ds-text-muted mt-1">per visit</p>
          </div>
        )}

        {/* Monthly Retainer */}
        {rates.monthlyRetainer && (
          <div className="ds-bg-surface/70 rounded-lg p-3 border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium ds-text-secondary uppercase tracking-wide">Monthly Retainer</span>
            </div>
            <p className="text-lg font-bold ds-text-primary">
              {rates.monthlyRetainer.toLocaleString('en-KE', { 
                style: 'currency', 
                currency: 'KES',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
            <p className="text-xs ds-text-muted mt-1">per month</p>
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="mt-4 pt-4 border-t border-blue-400/60">
        <p className="text-xs ds-text-secondary">
          <Info className="h-3 w-3 inline mr-1 text-blue-500" />
          These rates are used to calculate suggested contract values and fees. You can override any calculated amounts.
        </p>
      </div>
    </div>
  );
}
