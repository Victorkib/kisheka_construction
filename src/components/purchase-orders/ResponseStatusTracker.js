/**
 * Enhanced Response Status Tracker Component
 * Tracks and displays supplier response status with detailed timeline
 * and actionable next steps
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/toast';
import { LoadingSpinner } from '@/components/loading';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  MessageSquare, 
  RefreshCw,
  Eye,
  Calendar,
  User,
  FileText,
  TrendingUp,
  TrendingDown,
  Minimize,
  Package
} from 'lucide-react';

export function ResponseStatusTracker({ order, onRefresh, canManage = false }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [responseHistory, setResponseHistory] = useState([]);

  useEffect(() => {
    if (order) {
      setResponseHistory(buildResponseHistory(order));
    }
  }, [order]);

  const buildResponseHistory = (orderData) => {
    const history = [];
    
    // Initial order sent
    if (orderData.status === 'order_sent' || orderData.status === 'order_modified') {
      history.push({
        type: 'sent',
        timestamp: orderData.sentAt || orderData.createdAt,
        title: 'Order Sent to Supplier',
        description: `Purchase order sent to ${orderData.supplierName}`,
        status: 'completed',
        icon: FileText
      });
    }

    // Supplier response
    if (orderData.supplierResponse && orderData.supplierResponseDate) {
      const responseConfig = {
        accept: {
          title: 'Order Accepted',
          description: orderData.supplierNotes || 'Supplier accepted the order',
          color: 'green',
          icon: CheckCircle
        },
        reject: {
          title: 'Order Rejected',
          description: orderData.supplierNotes || 'Supplier rejected the order',
          color: 'red',
          icon: AlertCircle
        },
        modify: {
          title: 'Modification Requested',
          description: orderData.supplierNotes || 'Supplier requested modifications',
          color: 'blue',
          icon: MessageSquare
        }
      };

      const config = responseConfig[orderData.supplierResponse] || responseConfig.accept;
      history.push({
        type: 'response',
        timestamp: orderData.supplierResponseDate,
        title: config.title,
        description: config.description,
        status: 'completed',
        color: config.color,
        icon: config.icon,
        details: orderData.supplierResponse === 'modify' ? orderData.supplierModifications : null
      });
    }

    // Modification approval (if applicable)
    if (orderData.status === 'order_modified' && orderData.modificationApproved !== undefined) {
      history.push({
        type: 'approval',
        timestamp: orderData.modificationApprovedAt,
        title: orderData.modificationApproved ? 'Modifications Approved' : 'Modifications Rejected',
        description: orderData.modificationApproved ? 
          'PM/OWNER approved the supplier modifications' : 
          'PM/OWNER rejected the supplier modifications',
        status: 'completed',
        color: orderData.modificationApproved ? 'green' : 'red',
        icon: orderData.modificationApproved ? CheckCircle : AlertCircle
      });
    }

    // Retry actions
    if (orderData.status === 'retry_sent') {
      history.push({
        type: 'retry',
        timestamp: orderData.retrySentAt,
        title: 'Retry Sent to Supplier',
        description: 'Order resent to original supplier with adjustments',
        status: 'completed',
        color: 'orange',
        icon: RefreshCw
      });
    }

    // Alternative actions
    if (orderData.isAlternativeOrder) {
      history.push({
        type: 'alternative',
        timestamp: orderData.createdAt,
        title: 'Alternative Order Created',
        description: 'Order sent to alternative supplier',
        status: 'completed',
        color: 'purple',
        icon: RefreshCw
      });
    }

    // Ready for delivery (supplier fulfillment)
    if (orderData.status === 'ready_for_delivery' && orderData.deliveryNoteFileUrl) {
      history.push({
        type: 'fulfillment',
        timestamp: orderData.updatedAt || orderData.createdAt,
        title: 'Ready for Delivery',
        description: 'Supplier marked order as ready for delivery',
        status: 'completed',
        color: 'blue',
        icon: Package
      });
    }

    // Delivery confirmation
    if (orderData.status === 'delivered' && (orderData.deliveryConfirmedAt || orderData.fulfilledAt)) {
      const confirmedBy = orderData.deliveryConfirmedBy ? 'Owner/PM' : 'Supplier';
      const confirmationMethod = orderData.deliveryConfirmationMethod || 
        (orderData.status === 'delivered' && !orderData.deliveryConfirmedBy ? 'supplier_fulfill' : 'owner_pm_manual');
      const confirmationNote = orderData.deliveryConfirmedNotes || 
        (orderData.supplierNotes && orderData.status === 'delivered' ? orderData.supplierNotes : null);
      
      history.push({
        type: 'delivery',
        timestamp: orderData.deliveryConfirmedAt || orderData.fulfilledAt,
        title: 'Delivery Confirmed',
        description: `Delivery confirmed by ${confirmedBy}${confirmationNote ? `: ${confirmationNote}` : ''}`,
        status: 'completed',
        color: 'green',
        icon: Package
      });
    }

    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  const getStatusColor = (status) => {
    const colors = {
      'order_sent': 'blue',
      'order_modified': 'orange',
      'order_accepted': 'green',
      'order_rejected': 'red',
      'retry_sent': 'orange',
      'alternatives_sent': 'purple',
      'ready_for_delivery': 'blue',
      'delivered': 'green'
    };
    return colors[status] || 'gray';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'order_sent': Clock,
      'order_modified': MessageSquare,
      'order_accepted': CheckCircle,
      'order_rejected': AlertCircle,
      'retry_sent': RefreshCw,
      'alternatives_sent': RefreshCw,
      'ready_for_delivery': Package,
      'delivered': Package
    };
    return icons[status] || Clock;
  };

  const getStatusText = (status) => {
    const texts = {
      'order_sent': 'Awaiting Response',
      'order_modified': 'Modification Requested',
      'order_accepted': 'Order Accepted',
      'order_rejected': 'Order Rejected',
      'retry_sent': 'Retry Sent',
      'alternatives_sent': 'Alternative Sent',
      'ready_for_delivery': 'Ready for Delivery',
      'delivered': 'Delivered'
    };
    return texts[status] || 'Unknown Status';
  };

  const getNextSteps = () => {
    const steps = [];
    
    switch (order.status) {
      case 'order_sent':
        steps.push({
          title: 'Awaiting Supplier Response',
          description: 'Supplier should respond via the secure link sent to them',
          action: 'wait',
          priority: 'normal'
        });
        if (canManage) {
          steps.push({
            title: 'Follow Up',
            description: 'Send reminder if no response received within expected timeframe',
            action: 'followup',
            priority: 'low'
          });
        }
        break;
        
      case 'order_modified':
        steps.push({
          title: 'Review Modifications',
          description: 'Review and approve or reject supplier modifications',
          action: 'review',
          priority: 'high'
        });
        break;
        
      case 'order_rejected':
        if (order.isRetryable) {
          steps.push({
            title: 'Retry with Same Supplier',
            description: order.retryRecommendation || 'Consider retrying with adjustments',
            action: 'retry',
            priority: 'medium'
          });
        }
        steps.push({
          title: 'Send to Alternative Suppliers',
          description: 'Find and send to alternative suppliers',
          action: 'alternative',
          priority: 'medium'
        });
        break;
        
      case 'retry_sent':
        steps.push({
          title: 'Monitor Retry Response',
          description: 'Waiting for supplier response to retry attempt',
          action: 'wait',
          priority: 'normal'
        });
        break;
        
      case 'order_accepted':
        steps.push({
          title: 'Prepare for Delivery',
          description: 'Track delivery and prepare for material receipt',
          action: 'prepare',
          priority: 'normal'
        });
        break;
        
      case 'ready_for_delivery':
        steps.push({
          title: 'Confirm Delivery',
          description: 'Review delivery note and confirm delivery to create material entries',
          action: 'confirm',
          priority: 'high'
        });
        break;
        
      case 'delivered':
        steps.push({
          title: 'Review Materials',
          description: 'Materials have been created. Review and approve material entries.',
          action: 'review',
          priority: 'normal'
        });
        if (order.linkedMaterials && order.linkedMaterials.length > 0) {
          steps.push({
            title: 'Verify Receipt',
            description: 'Verify that materials match the delivery note and are in good condition.',
            action: 'verify',
            priority: 'normal'
          });
        }
        break;
    }
    
    return steps;
  };

  const getPerformanceMetrics = () => {
    if (!order.supplierId) return null;
    
    // This would typically come from supplier performance data
    // For now, showing placeholder metrics
    return {
      responseTime: order.supplierResponseDate ? 
        Math.round((new Date(order.supplierResponseDate) - new Date(order.sentAt)) / (1000 * 60 * 60)) : 
        null,
      acceptanceRate: 85, // Placeholder - would come from performance data
      averageResponseTime: 24 // Placeholder - would come from performance data
    };
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;
    
    setLoading(true);
    try {
      await onRefresh();
      toast.showSuccess('Status refreshed');
    } catch (error) {
      toast.showError('Failed to refresh status');
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon = getStatusIcon(order.status);
  const statusColor = getStatusColor(order.status);
  const performanceMetrics = getPerformanceMetrics();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg bg-${statusColor}-100`}>
              <StatusIcon className={`w-6 h-6 text-${statusColor}-600`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Response Status</h2>
              <p className="text-sm text-gray-600">{getStatusText(order.status)}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {onRefresh && (
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Eye className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Status Info */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current Status */}
          <div className="text-center">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-${statusColor}-100 text-${statusColor}-800`}>
              {getStatusText(order.status)}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {order.supplierResponseDate ? 
                `Updated ${new Date(order.supplierResponseDate).toLocaleDateString()}` : 
                `Sent ${new Date(order.sentAt || order.createdAt).toLocaleDateString()}`
              }
            </p>
          </div>

          {/* Response Time (if available) */}
          {performanceMetrics?.responseTime && (
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-lg font-semibold text-gray-900">
                  {performanceMetrics.responseTime}h
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Response Time</p>
            </div>
          )}

          {/* Supplier Info */}
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-900">
                {order.supplierName}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Supplier</p>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-200">
          {/* Response Timeline */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Response Timeline</h3>
            <div className="space-y-3">
              {responseHistory.map((event, index) => {
                const EventIcon = event.icon;
                return (
                  <div key={index} className="flex items-start space-x-3">
                    <div className={`p-1 rounded bg-${event.color || 'gray'}-100 mt-1`}>
                      <EventIcon className={`w-4 h-4 text-${event.color || 'gray'}-600`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{event.title}</p>
                      <p className="text-xs text-gray-500">{event.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                      {event.details && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                          {Object.entries(event.details).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-gray-600">{key}:</span>
                              <span className="text-gray-900">{value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Next Steps */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Next Steps</h3>
            <div className="space-y-3">
              {getNextSteps().map((step, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className={`p-1 rounded mt-1 ${
                    step.priority === 'high' ? 'bg-red-100' :
                    step.priority === 'medium' ? 'bg-yellow-100' :
                    'bg-gray-100'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      step.priority === 'high' ? 'bg-red-500' :
                      step.priority === 'medium' ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{step.title}</p>
                    <p className="text-xs text-gray-500">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Metrics (if available) */}
          {performanceMetrics && (
            <div className="p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Supplier Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-center space-x-1">
                    {performanceMetrics.responseTime < performanceMetrics.averageResponseTime ? (
                      <TrendingDown className="w-4 h-4 text-green-500" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-lg font-semibold text-gray-900">
                      {performanceMetrics.responseTime}h
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">This Response</p>
                </div>
                
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-lg font-semibold text-gray-900">
                    {performanceMetrics.averageResponseTime}h
                  </span>
                  <p className="text-xs text-gray-500">Average Response</p>
                </div>
                
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-lg font-semibold text-gray-900">
                    {performanceMetrics.acceptanceRate}%
                  </span>
                  <p className="text-xs text-gray-500">Acceptance Rate</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
