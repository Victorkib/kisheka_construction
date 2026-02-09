/**
 * Capital Balance Warning Component
 * Shows capital balance and warnings when approving spending
 */

'use client';

import { useState, useEffect } from 'react';

export function CapitalBalanceWarning({ projectId, amountToApprove }) {
  const [capitalInfo, setCapitalInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    fetchCapitalInfo();
  }, [projectId]);

  const fetchCapitalInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/financial-overview`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const result = await response.json();

      if (result.success) {
        setCapitalInfo(result.data);
      }
    } catch (err) {
      console.error('Fetch capital info error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !capitalInfo) {
    return null;
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const { financing, spendingLimit } = capitalInfo;
  const capitalBalance = financing?.capitalBalance || 0;
  const totalInvested = financing?.totalInvested || 0;
  const amount = amountToApprove || 0;
  const remainingAfterApproval = capitalBalance - amount;

  // Determine warning level
  let warningLevel = 'none';
  let message = '';
  let bgColor = '';
  let textColor = '';

  if (totalInvested === 0) {
    warningLevel = 'error';
    message = 'No capital allocated to this project. Cannot approve spending.';
    bgColor = 'bg-red-50';
    textColor = 'text-red-800';
  } else if (remainingAfterApproval < 0) {
    warningLevel = 'error';
    message = `Insufficient capital! This approval would exceed available capital by ${formatCurrency(Math.abs(remainingAfterApproval))}.`;
    bgColor = 'bg-red-50';
    textColor = 'text-red-800';
  } else if (remainingAfterApproval < totalInvested * 0.1) {
    warningLevel = 'warning';
    message = `Low capital warning: After approval, only ${formatCurrency(remainingAfterApproval)} (${((remainingAfterApproval / totalInvested) * 100).toFixed(1)}%) will remain.`;
    bgColor = 'bg-yellow-50';
    textColor = 'text-yellow-800';
  } else if (capitalBalance < totalInvested * 0.2) {
    warningLevel = 'info';
    message = `Capital balance is ${formatCurrency(capitalBalance)} (${((capitalBalance / totalInvested) * 100).toFixed(1)}% remaining).`;
    bgColor = 'bg-blue-50';
    textColor = 'text-blue-800';
  }

  if (warningLevel === 'none') {
    return null;
  }

  return (
    <div className={`${bgColor} border ${textColor.replace('800', '200')} rounded-lg p-4 mb-4`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {warningLevel === 'error' && (
            <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          {warningLevel === 'warning' && (
            <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          {warningLevel === 'info' && (
            <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-semibold ${textColor} mb-1`}>
            {warningLevel === 'error' && 'Insufficient Capital'}
            {warningLevel === 'warning' && 'Low Capital Warning'}
            {warningLevel === 'info' && 'Capital Balance'}
          </h3>
          <p className={`text-sm ${textColor}`}>{message}</p>
          <div className="mt-2 text-xs space-y-1">
            <p className={textColor}>
              <strong>Available Capital:</strong> {formatCurrency(capitalBalance)}
            </p>
            {amount > 0 && (
              <p className={textColor}>
                <strong>After Approval:</strong> {formatCurrency(remainingAfterApproval)} remaining
              </p>
            )}
            <p className={textColor}>
              <strong>Total Invested:</strong> {formatCurrency(totalInvested)}
            </p>
            <p className="text-gray-600 mt-2">
              <em>Note: Spending limit is based on available capital, not budget.</em>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

