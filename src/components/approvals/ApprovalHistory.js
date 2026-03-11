/**
 * Approval History Component
 * Displays approval timeline/chain for any approval type
 * 
 * @param {Object} props
 * @param {Array} props.history - Array of approval history entries
 * @param {string} props.type - Type of approval (materials, expenses, etc.)
 * @param {string} props.itemId - ID of the item
 * @param {Function} props.onRefresh - Callback to refresh history
 */

'use client';

import { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, User, MessageSquare } from 'lucide-react';

export function ApprovalHistory({ history = [], type, itemId, onRefresh }) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 ds-text-muted">
        <Clock className="mx-auto h-12 w-12 mb-3 opacity-50" />
        <p className="text-sm">No approval history available</p>
      </div>
    );
  }

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status, action) => {
    if (status === 'approved' || action === 'APPROVED') {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    }
    if (status === 'rejected' || action === 'REJECTED') {
      return <XCircle className="h-5 w-5 text-red-600" />;
    }
    return <Clock className="h-5 w-5 text-gray-400" />;
  };

  const getStatusColor = (status, action) => {
    if (status === 'approved' || action === 'APPROVED') {
      return 'border-green-500 bg-green-50';
    }
    if (status === 'rejected' || action === 'REJECTED') {
      return 'border-red-500 bg-red-50';
    }
    return 'border-gray-300 bg-gray-50';
  };

  return (
    <div className="space-y-4">
      {history.map((entry, index) => {
        const isApproved = entry.status === 'approved' || entry.action === 'APPROVED';
        const isRejected = entry.status === 'rejected' || entry.action === 'REJECTED';
        const statusColor = getStatusColor(entry.status, entry.action);
        const statusIcon = getStatusIcon(entry.status, entry.action);
        
        const approverName = entry.approverName || 
                           entry.approvedByName || 
                           entry.approver?.name || 
                           'Unknown';
        
        const timestamp = entry.approvedAt || 
                         entry.approvalDate || 
                         entry.timestamp || 
                         entry.createdAt;

        return (
          <div
            key={index}
            className={`border-l-4 ${statusColor} pl-4 py-3 rounded-r-lg`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{statusIcon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold ds-text-primary">
                    {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending'}
                  </span>
                  <span className="text-xs ds-text-muted">
                    {formatDateTime(timestamp)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm ds-text-secondary mb-2">
                  <User className="h-4 w-4" />
                  <span>{approverName}</span>
                </div>

                {(entry.notes || entry.approvalNotes || entry.reason) && (
                  <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1">
                        {entry.notes && (
                          <p className="text-sm ds-text-primary">{entry.notes}</p>
                        )}
                        {entry.approvalNotes && (
                          <p className="text-sm ds-text-primary">{entry.approvalNotes}</p>
                        )}
                        {entry.reason && (
                          <p className={`text-sm ${isRejected ? 'text-red-700' : 'ds-text-primary'}`}>
                            {entry.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {entry.previousStatus && entry.newStatus && (
                  <div className="mt-2 text-xs ds-text-muted">
                    Status changed from <span className="font-medium">{entry.previousStatus}</span> to{' '}
                    <span className="font-medium">{entry.newStatus}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ApprovalHistory;
