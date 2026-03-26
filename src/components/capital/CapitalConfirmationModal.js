/**
 * Capital Confirmation Modal Component
 * Shows authorization level, impact, and requires explicit confirmation
 *
 * Usage:
 * <CapitalConfirmationModal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   onConfirm={handleConfirm}
 *   amount={amount}
 *   operationType="allocation"
 *   floorName="Floor 5"
 *   authLevel={authLevel}
 *   availableCapital={availableCapital}
 * />
 */

'use client';

import { useState, useEffect } from 'react';
import { BaseModal } from '@/components/modals';
import { getCapitalAuthLevel, getAuthBadgeColor, formatCurrency } from '@/lib/capital-authorization';

export function CapitalConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
  operationType = 'allocation',
  floorName,
  authLevel: providedAuthLevel,
  availableCapital,
  isLoading = false
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [authLevel, setAuthLevel] = useState(null);

  useEffect(() => {
    if (amount && providedAuthLevel) {
      setAuthLevel(providedAuthLevel);
    } else if (amount) {
      setAuthLevel(getCapitalAuthLevel(amount));
    }
  }, [amount, providedAuthLevel]);

  const handleClose = () => {
    setAcknowledged(false);
    onClose();
  };

  if (!authLevel) return null;

  const remainingAfterOperation = (availableCapital || 0) - amount;
  const percentageOfAvailable = availableCapital > 0 ? (amount / availableCapital) * 100 : 0;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="💰 Confirm Capital Allocation"
      maxWidth="max-w-2xl"
      isLoading={isLoading}
      loadingMessage="Processing capital allocation..."
    >
      <div className="space-y-6">
        {/* Authorization Level Badge */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium ds-text-secondary">Authorization Level</span>
          <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${getAuthBadgeColor(authLevel)}`}>
            {authLevel.name}
          </span>
        </div>

        {/* Amount Display */}
        <div className="p-6 ds-bg-accent-subtle border-2 ds-border-accent-subtle rounded-xl">
          <p className="text-xs ds-text-secondary uppercase tracking-wide mb-2">Allocation Amount</p>
          <p className="text-4xl font-bold ds-text-accent-primary">{formatCurrency(amount)}</p>
          {availableCapital > 0 && (
            <p className="text-sm ds-text-secondary mt-2">
              {percentageOfAvailable.toFixed(1)}% of available capital ({formatCurrency(availableCapital)})
            </p>
          )}
        </div>

        {/* Operation Details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 ds-bg-surface-muted rounded-lg">
            <p className="text-xs ds-text-secondary mb-1">Operation Type</p>
            <p className="text-sm font-semibold ds-text-primary capitalize">
              {operationType.replace('_', ' ')}
            </p>
          </div>
          {floorName && (
            <div className="p-4 ds-bg-surface-muted rounded-lg">
              <p className="text-xs ds-text-secondary mb-1">Floor</p>
              <p className="text-sm font-semibold ds-text-primary">{floorName}</p>
            </div>
          )}
        </div>

        {/* Impact Summary */}
        <div className="p-4 ds-bg-surface rounded-lg border ds-border-subtle">
          <p className="text-sm font-semibold ds-text-primary mb-3">Capital Impact</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="ds-text-secondary">Available Before:</span>
              <span className="font-medium ds-text-primary">{formatCurrency(availableCapital)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="ds-text-secondary">Allocation:</span>
              <span className="font-medium text-red-600">-{formatCurrency(amount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t ds-border-subtle">
              <span className="font-semibold ds-text-primary">Remaining After:</span>
              <span className={`font-bold ${remainingAfterOperation < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(Math.max(0, remainingAfterOperation))}
              </span>
            </div>
          </div>
        </div>

        {/* Warning for Large Allocations */}
        {percentageOfAvailable > 50 && (
          <div className="p-4 bg-orange-50 border border-orange-400/60 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-orange-800">High Capital Usage</p>
                <p className="text-xs text-orange-700 mt-1">
                  This allocation uses {percentageOfAvailable.toFixed(1)}% of available capital. 
                  Ensure this aligns with project financial planning.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Acknowledgment Checkbox */}
        <div className="p-4 ds-bg-surface-muted rounded-lg">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 w-5 h-5 text-blue-600 ds-border-subtle rounded focus:ring-blue-500"
            />
            <span className="text-sm ds-text-secondary">
              I acknowledge this capital allocation of <strong className="ds-text-primary">{formatCurrency(amount)}</strong> 
              and confirm it has been properly planned and authorized.
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t ds-border-subtle">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-4 py-3 text-sm font-medium ds-text-secondary ds-bg-surface border ds-border-subtle rounded-lg hover:ds-bg-surface-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!acknowledged || isLoading}
            className="flex-1 px-4 py-3 text-sm font-medium text-white ds-bg-accent-primary rounded-lg hover:ds-bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : `Confirm ${authLevel.name} Allocation`}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

export default CapitalConfirmationModal;
