/**
 * Communication Status Component
 * Displays email, SMS, and push notification status for purchase orders
 */

'use client';

import { useState } from 'react';
import { useToast } from '@/components/toast';

export function CommunicationStatus({ order, onRetry, canRetry = false }) {
  const toast = useToast();
  const [retrying, setRetrying] = useState({ email: false, sms: false, push: false });

  if (!order || !order.communications || !Array.isArray(order.communications) || order.communications.length === 0) {
    return null;
  }

  // Group communications by channel and get the latest status for each
  const communicationStatus = {
    email: null,
    sms: null,
    push: null,
  };

  order.communications.forEach((comm) => {
    if (comm.channel && communicationStatus[comm.channel] !== null) {
      // Keep the most recent communication for each channel
      const existing = communicationStatus[comm.channel];
      if (!existing || new Date(comm.sentAt) > new Date(existing.sentAt)) {
        communicationStatus[comm.channel] = comm;
      }
    }
  });

  // Check if supplier has communication enabled
  const supplier = order.supplier || {};
  const emailEnabled = supplier.emailEnabled !== false; // Default to true
  const smsEnabled = supplier.smsEnabled !== false && supplier.phone; // Default to true if phone exists
  const pushEnabled = supplier.pushNotificationsEnabled !== false; // Default to true

  const handleRetry = async (channel) => {
    if (!onRetry || retrying[channel]) return;

    setRetrying((prev) => ({ ...prev, [channel]: true }));
    try {
      await onRetry(channel);
      toast.showSuccess(`${channel.toUpperCase()} retry initiated`);
    } catch (error) {
      toast.showError(`Failed to retry ${channel}: ${error.message}`);
    } finally {
      setRetrying((prev) => ({ ...prev, [channel]: false }));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'failed':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-KE', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const hasAnyCommunication = communicationStatus.email || communicationStatus.sms || communicationStatus.push;
  const hasAnyEnabled = emailEnabled || smsEnabled || pushEnabled;

  if (!hasAnyCommunication && !hasAnyEnabled) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">📧 Communication Status</h2>
      
      <div className="space-y-4">
        {/* Email Status */}
        {emailEnabled && (
          <div className={`border rounded-lg p-4 ${communicationStatus.email ? getStatusColor(communicationStatus.email.status) : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📧</span>
                  <h3 className="font-semibold text-gray-900">Email</h3>
                  {communicationStatus.email && (
                    <span className="text-2xl">{getStatusIcon(communicationStatus.email.status)}</span>
                  )}
                </div>
                {communicationStatus.email ? (
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="font-medium">Status:</span>{' '}
                      <span className="capitalize">{communicationStatus.email.status}</span>
                    </p>
                    <p>
                      <span className="font-medium">Sent:</span> {formatTime(communicationStatus.email.sentAt)}
                    </p>
                    {communicationStatus.email.error && (
                      <p className="text-red-600 mt-1">
                        <span className="font-medium">Error:</span> {communicationStatus.email.error}
                      </p>
                    )}
                    {communicationStatus.email.messageId && (
                      <p className="text-xs text-gray-500 mt-1">
                        Message ID: {communicationStatus.email.messageId}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No email sent yet</p>
                )}
                {supplier.email && (
                  <p className="text-xs text-gray-500 mt-2">To: {supplier.email}</p>
                )}
              </div>
              {canRetry && communicationStatus.email?.status === 'failed' && (
                <button
                  onClick={() => handleRetry('email')}
                  disabled={retrying.email}
                  className="ml-4 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {retrying.email ? 'Retrying...' : 'Retry'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* SMS Status */}
        {smsEnabled && (
          <div className={`border rounded-lg p-4 ${communicationStatus.sms ? getStatusColor(communicationStatus.sms.status) : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📱</span>
                  <h3 className="font-semibold text-gray-900">SMS</h3>
                  {communicationStatus.sms && (
                    <span className="text-2xl">{getStatusIcon(communicationStatus.sms.status)}</span>
                  )}
                </div>
                {communicationStatus.sms ? (
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="font-medium">Status:</span>{' '}
                      <span className="capitalize">{communicationStatus.sms.status}</span>
                    </p>
                    <p>
                      <span className="font-medium">Sent:</span> {formatTime(communicationStatus.sms.sentAt)}
                    </p>
                    {communicationStatus.sms.error && (
                      <p className="text-red-600 mt-1">
                        <span className="font-medium">Error:</span> {communicationStatus.sms.error}
                      </p>
                    )}
                    {communicationStatus.sms.messageId && (
                      <p className="text-xs text-gray-500 mt-1">
                        Message ID: {communicationStatus.sms.messageId}
                      </p>
                    )}
                    {communicationStatus.sms.subscriptionCount !== undefined && (
                      <p className="text-xs text-gray-500 mt-1">
                        Sent to {communicationStatus.sms.subscriptionCount} subscription(s)
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No SMS sent yet</p>
                )}
                {supplier.phone && (
                  <p className="text-xs text-gray-500 mt-2">To: {supplier.phone}</p>
                )}
              </div>
              {canRetry && communicationStatus.sms?.status === 'failed' && (
                <button
                  onClick={() => handleRetry('sms')}
                  disabled={retrying.sms}
                  className="ml-4 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {retrying.sms ? 'Retrying...' : 'Retry'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Push Notification Status */}
        {pushEnabled && (
          <div className={`border rounded-lg p-4 ${communicationStatus.push ? getStatusColor(communicationStatus.push.status) : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔔</span>
                  <h3 className="font-semibold text-gray-900">Push Notification</h3>
                  {communicationStatus.push && (
                    <span className="text-2xl">{getStatusIcon(communicationStatus.push.status)}</span>
                  )}
                </div>
                {communicationStatus.push ? (
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="font-medium">Status:</span>{' '}
                      <span className="capitalize">{communicationStatus.push.status}</span>
                    </p>
                    <p>
                      <span className="font-medium">Sent:</span> {formatTime(communicationStatus.push.sentAt)}
                    </p>
                    {communicationStatus.push.error && (
                      <p className="text-red-600 mt-1">
                        <span className="font-medium">Error:</span> {communicationStatus.push.error}
                      </p>
                    )}
                    {communicationStatus.push.subscriptionCount !== undefined && (
                      <p className="text-xs text-gray-500 mt-1">
                        Sent to {communicationStatus.push.subscriptionCount} of {communicationStatus.push.totalSubscriptions || 0} subscription(s)
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No push notification sent yet</p>
                )}
              </div>
              {canRetry && communicationStatus.push?.status === 'failed' && (
                <button
                  onClick={() => handleRetry('push')}
                  disabled={retrying.push}
                  className="ml-4 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                >
                  {retrying.push ? 'Retrying...' : 'Retry'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* No Communications Message */}
        {!hasAnyCommunication && hasAnyEnabled && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <p className="text-sm text-gray-600">
              Communications will be sent when the purchase order is created. Check back after creating the order.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}



