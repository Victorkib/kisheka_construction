/**
 * Approval History Modal Component
 * Modal wrapper for displaying approval history
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback to close modal
 * @param {string} props.type - Type of approval (materials, expenses, etc.)
 * @param {string} props.itemId - ID of the item
 * @param {string} props.itemName - Name/title of the item
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Clock, AlertCircle } from 'lucide-react';
import { ApprovalHistory } from './ApprovalHistory';
import { LoadingSpinner } from '@/components/loading';

export function ApprovalHistoryModal({ isOpen, onClose, type, itemId, itemName }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && itemId && type) {
      fetchHistory();
    } else {
      setHistory([]);
      setError(null);
    }
  }, [isOpen, itemId, type]);

  const fetchHistory = async () => {
    if (!itemId || !type) return;

    setLoading(true);
    setError(null);

    try {
      // Map approval types to API endpoints
      const endpointMap = {
        materials: `/api/materials/${itemId}`,
        expenses: `/api/expenses/${itemId}`,
        initial_expenses: `/api/initial-expenses/${itemId}`,
        material_requests: `/api/material-requests/${itemId}`,
        labour_entries: `/api/labour/entries/${itemId}`,
        professional_fees: `/api/professional-fees/${itemId}`,
        professional_activities: `/api/professional-activities/${itemId}`,
        budget_reallocations: `/api/budget-reallocations/${itemId}`,
        purchase_order_modifications: `/api/purchase-orders/${itemId}`,
        contingency_draws: `/api/contingency-draws/${itemId}`,
      };

      const endpoint = endpointMap[type];
      if (!endpoint) {
        throw new Error(`No endpoint found for type: ${type}`);
      }

      const response = await fetch(endpoint, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch approval history');
      }

      // Extract approval history from response
      const item = data.data?.material || 
                   data.data?.expense || 
                   data.data?.expenses?.[0] ||
                   data.data?.request ||
                   data.data?.entry ||
                   data.data?.fee ||
                   data.data?.activity ||
                   data.data?.reallocation ||
                   data.data?.order ||
                   data.data?.draw ||
                   data.data;

      // Get approval chain/history from item
      const approvalChain = item?.approvalChain || 
                           item?.approvalHistory || 
                           [];

      // Also check approvals collection if available
      if (approvalChain.length === 0 && itemId) {
        try {
          // Map type to model name
          const modelMap = {
            materials: 'MATERIAL',
            expenses: 'EXPENSE',
            initial_expenses: 'INITIAL_EXPENSE',
            material_requests: 'MATERIAL_REQUEST',
            labour_entries: 'LABOUR_ENTRY',
            professional_fees: 'PROFESSIONAL_FEE',
            professional_activities: 'PROFESSIONAL_ACTIVITY',
            budget_reallocations: 'BUDGET_REALLOCATION',
            purchase_order_modifications: 'PURCHASE_ORDER',
            contingency_draws: 'CONTINGENCY_DRAW',
          };

          const modelName = modelMap[type] || type.toUpperCase();
          const approvalsResponse = await fetch(
            `/api/approvals/history?relatedId=${itemId}&relatedModel=${modelName}`,
            {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
              },
            }
          );
          const approvalsData = await approvalsResponse.json();
          if (approvalsData.success && approvalsData.data?.approvals) {
            setHistory(approvalsData.data.approvals);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('Error fetching from approvals collection:', err);
        }
      }

      setHistory(approvalChain);
    } catch (err) {
      console.error('Error fetching approval history:', err);
      setError(err.message || 'Failed to load approval history');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom ds-bg-surface rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b ds-border-subtle">
            <div>
              <h3 className="text-lg font-semibold ds-text-primary">
                Approval History
              </h3>
              {itemName && (
                <p className="text-sm ds-text-secondary mt-1">{itemName}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5 ds-text-secondary" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <p className="text-sm ds-text-secondary">{error}</p>
                <button
                  onClick={fetchHistory}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Retry
                </button>
              </div>
            ) : (
              <ApprovalHistory
                history={history}
                type={type}
                itemId={itemId}
                onRefresh={fetchHistory}
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end px-6 py-4 border-t ds-border-subtle">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApprovalHistoryModal;
