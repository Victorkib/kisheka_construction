/**
 * Audit Trail Component
 * Displays audit logs and approval history for an entity
 */

'use client';

import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/loading';

export function AuditTrail({ entityType, entityId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!entityType || !entityId) return;

    fetchAuditLogs();
  }, [entityType, entityId]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/audit-logs?entityType=${entityType}&entityId=${entityId}&limit=50`
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch audit logs');
      }

      setLogs(data.data.logs || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'CREATED':
        return '➕';
      case 'UPDATED':
        return '✏️';
      case 'APPROVED':
        return '✅';
      case 'REJECTED':
        return '❌';
      case 'DELETED':
        return '🗑️';
      case 'SUBMITTED':
        return '📤';
      default:
        return '📝';
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATED':
        return 'bg-blue-100 text-blue-800';
      case 'UPDATED':
        return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'DELETED':
        return 'bg-gray-100 text-gray-800';
      case 'SUBMITTED':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatChanges = (changes) => {
    if (!changes || Object.keys(changes).length === 0) return null;

    // Check if this is a "before/after" format (used by material requests, purchase orders, etc.)
    if (changes.before !== undefined || changes.after !== undefined) {
      // Handle before/after format - show key differences
      const before = (changes.before && typeof changes.before === 'object') ? changes.before : {};
      const after = (changes.after && typeof changes.after === 'object') ? changes.after : {};
      const differences = [];

      // Compare key fields that commonly change
      const fieldsToCompare = ['status', 'approvedBy', 'rejectedBy', 'approvedByName', 'rejectedByName', 
                               'approvalDate', 'rejectionDate', 'financialStatus', 'totalCost', 'unitCost',
                               'quantityOrdered', 'supplierResponse', 'deliveryNoteFileUrl', 'supplierNotes',
                               'rejectionReason', 'linkedPurchaseOrderId', 'linkedMaterialId', 'materialRequestId'];

      fieldsToCompare.forEach(field => {
        const beforeValue = before[field];
        const afterValue = after[field];
        
        // Handle null/undefined comparisons
        const beforeIsSet = beforeValue !== undefined && beforeValue !== null;
        const afterIsSet = afterValue !== undefined && afterValue !== null;
        
        if (beforeIsSet && afterIsSet) {
          // Both values exist - compare them
          if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
            differences.push({
              field,
              oldValue: beforeValue,
              newValue: afterValue,
            });
          }
        } else if (!beforeIsSet && afterIsSet) {
          // New field added
          differences.push({
            field,
            oldValue: 'N/A',
            newValue: afterValue,
          });
        } else if (beforeIsSet && !afterIsSet) {
          // Field removed
          differences.push({
            field,
            oldValue: beforeValue,
            newValue: 'N/A',
          });
        }
      });

      // Show other non-before/after fields (like financialWarning, committedCost, etc.)
      const otherFields = Object.entries(changes)
        .filter(([key]) => key !== 'before' && key !== 'after')
        .map(([key, value]) => ({
          field: key,
          oldValue: 'N/A',
          newValue: typeof value === 'object' ? JSON.stringify(value) : value,
        }));

      const allChanges = [...differences, ...otherFields];

      if (allChanges.length === 0) {
        return (
          <div className="text-xs text-gray-600 mt-1">
            <span className="italic">Status or details updated</span>
          </div>
        );
      }

      return allChanges.map((change, index) => (
        <div key={`${change.field}-${index}`} className="text-xs text-gray-600 mt-1">
          <span className="font-medium">{change.field}:</span>{' '}
          <span className="text-red-600 line-through">{String(change.oldValue)}</span>{' '}
          → <span className="text-green-600">{String(change.newValue)}</span>
        </div>
      ));
    }

    // Handle field-by-field format (used by expenses, materials, etc.)
    const fieldChanges = Object.entries(changes)
      .filter(([field, change]) => {
        // Skip null values and ensure change is an object
        if (!change || typeof change !== 'object') return false;
        return change.oldValue !== undefined || change.newValue !== undefined;
      })
      .map(([field, change]) => {
        const oldValue = change.oldValue !== undefined ? change.oldValue : 'N/A';
        const newValue = change.newValue !== undefined ? change.newValue : 'N/A';

        return (
          <div key={field} className="text-xs text-gray-600 mt-1">
            <span className="font-medium">{field}:</span>{' '}
            <span className="text-red-600 line-through">{String(oldValue)}</span>{' '}
            → <span className="text-green-600">{String(newValue)}</span>
          </div>
        );
      });

    // Handle informational fields (like purchaseOrder, material, committedCostDecreased, etc.)
    // These are fields that don't follow the oldValue/newValue pattern but contain useful info
    const informationalFields = Object.entries(changes)
      .filter(([field, value]) => {
        // Skip if already handled as field-by-field change
        if (value && typeof value === 'object' && (value.oldValue !== undefined || value.newValue !== undefined)) {
          return false;
        }
        // Skip if it's a complex object (like purchaseOrder or material objects)
        // Only show simple values or important metadata
        if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 5) {
          return false; // Skip large objects
        }
        // Show simple values, numbers, strings, or small objects
        return value !== null && value !== undefined;
      })
      .map(([field, value]) => {
        let displayValue = value;
        if (typeof value === 'object' && !Array.isArray(value)) {
          // For small objects, show a summary
          if (Object.keys(value).length <= 3) {
            displayValue = JSON.stringify(value);
          } else {
            displayValue = `[Object with ${Object.keys(value).length} fields]`;
          }
        } else if (Array.isArray(value)) {
          displayValue = `[Array with ${value.length} items]`;
        }

        return (
          <div key={`info-${field}`} className="text-xs text-gray-600 mt-1">
            <span className="font-medium">{field}:</span>{' '}
            <span className="text-blue-600">{String(displayValue)}</span>
          </div>
        );
      });

    // Combine both types of changes
    if (fieldChanges.length === 0 && informationalFields.length === 0) {
      return null;
    }

    return (
      <>
        {fieldChanges}
        {informationalFields}
      </>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Audit Trail</h3>
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="sm" text="Loading audit trail..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Audit Trail</h3>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Audit Trail</h3>
        <div className="text-center py-8 text-gray-500">
          <p>No audit logs found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Audit Trail</h3>
      <div className="space-y-4">
        {logs.map((log, index) => (
          <div
            key={log._id || index}
            className="border-l-4 border-gray-200 pl-4 py-2 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{getActionIcon(log.action)}</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(
                      log.action
                    )}`}
                  >
                    {log.action}
                  </span>
                  {log.userName && (
                    <span className="text-sm text-gray-600">by {log.userName}</span>
                  )}
                </div>
                {log.changes && formatChanges(log.changes)}
                {log.reason && (
                  <div className="text-xs text-gray-600 mt-1">
                    <span className="font-medium">Reason:</span> {log.reason}
                  </div>
                )}
                {log.errorMessage && (
                  <div className="text-xs text-red-600 mt-1">
                    <span className="font-medium">Error:</span> {log.errorMessage}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 ml-4">
                {formatDate(log.timestamp || log.createdAt)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AuditTrail;

