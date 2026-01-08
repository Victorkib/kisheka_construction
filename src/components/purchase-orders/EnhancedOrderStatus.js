/**
 * Enhanced Order Status Component
 * Displays comprehensive order status with integrated supplier performance indicators
 * and actionable insights
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/toast';
import { LoadingSpinner } from '@/components/loading';
import { SupplierPerformanceIndicators } from './SupplierPerformanceIndicators';
import { ResponseStatusTracker } from './ResponseStatusTracker';
import { CommunicationStatus } from './CommunicationStatus';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  AlertTriangle, 
  Package, 
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  Info,
  RefreshCw,
  Eye,
  BarChart3
} from 'lucide-react';

export function EnhancedOrderStatus({ order, canManage = false, onRefresh }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    performance: false,
    status: true,
    communication: false
  });
  const [supplierPerformance, setSupplierPerformance] = useState(null);

  useEffect(() => {
    if (order?.supplierId && expandedSections.performance) {
      fetchSupplierPerformance();
    }
  }, [order?.supplierId, expandedSections.performance]);

  const fetchSupplierPerformance = async () => {
    if (!order?.supplierId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/suppliers/${order.supplierId}/performance?projectId=${order.projectId || ''}`);
      if (response.ok) {
        const data = await response.json();
        setSupplierPerformance(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch supplier performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusColor = (status) => {
    const colors = {
      'order_sent': 'blue',
      'order_modified': 'orange',
      'order_accepted': 'green',
      'order_rejected': 'red',
      'retry_sent': 'orange',
      'alternatives_sent': 'purple',
      'order_fulfilled': 'green',
      'delivery_confirmed': 'green',
      'ready_for_delivery': 'blue',
      'delivered': 'green'
    };
    return colors[status] || 'gray';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'order_sent': Clock,
      'order_modified': AlertTriangle,
      'order_accepted': CheckCircle,
      'order_rejected': AlertCircle,
      'retry_sent': RefreshCw,
      'alternatives_sent': RefreshCw,
      'order_fulfilled': Package,
      'delivery_confirmed': CheckCircle,
      'ready_for_delivery': Package,
      'delivered': Package
    };
    return icons[status] || Clock;
  };

  const getStatusText = (status) => {
    const texts = {
      'order_sent': 'Order Sent',
      'order_modified': 'Modification Requested',
      'order_accepted': 'Order Accepted',
      'order_rejected': 'Order Rejected',
      'retry_sent': 'Retry Sent',
      'alternatives_sent': 'Alternative Sent',
      'order_fulfilled': 'Order Fulfilled',
      'delivery_confirmed': 'Delivery Confirmed',
      'ready_for_delivery': 'Ready for Delivery',
      'delivered': 'Delivered'
    };
    return texts[status] || 'Unknown Status';
  };

  const getPriorityLevel = (order) => {
    const daysUntilDelivery = order.deliveryDate ? 
      Math.ceil((new Date(order.deliveryDate) - new Date()) / (1000 * 60 * 60 * 24)) : 
      null;

    if (daysUntilDelivery === null) return { level: 'normal', color: 'gray', label: 'No delivery date' };
    if (daysUntilDelivery < 0) return { level: 'overdue', color: 'red', label: 'Overdue' };
    if (daysUntilDelivery <= 3) return { level: 'urgent', color: 'red', label: 'Urgent' };
    if (daysUntilDelivery <= 7) return { level: 'high', color: 'orange', label: 'High Priority' };
    if (daysUntilDelivery <= 14) return { level: 'medium', color: 'yellow', label: 'Medium Priority' };
    return { level: 'normal', color: 'green', label: 'Normal Priority' };
  };

  const getRiskIndicators = () => {
    const indicators = [];
    
    // Check for delayed response
    if (order.status === 'order_sent' && order.sentAt) {
      const responseDelay = Math.ceil((new Date() - new Date(order.sentAt)) / (1000 * 60 * 60));
      if (responseDelay > 48) {
        indicators.push({
          type: 'delayed_response',
          severity: 'high',
          message: `Supplier hasn't responded in ${responseDelay} hours`,
          icon: Clock,
          color: 'red'
        });
      }
    }

    // Check for high value order with new supplier
    if (order.totalCost > 100000 && supplierPerformance) {
      if (supplierPerformance.totalOrders < 5) {
        indicators.push({
          type: 'new_supplier_high_value',
          severity: 'medium',
          message: 'High value order with new supplier',
          icon: AlertTriangle,
          color: 'orange'
        });
      }
    }

    // Check for delivery urgency
    const priority = getPriorityLevel(order);
    if (priority.level === 'urgent' && order.status !== 'order_accepted') {
      indicators.push({
        type: 'urgent_delivery',
        severity: 'high',
        message: 'Urgent delivery needed',
        icon: Calendar,
        color: 'red'
      });
    }

    // Check for poor performance
    if (supplierPerformance && supplierPerformance.overallScore < 60) {
      indicators.push({
        type: 'poor_performance',
        severity: 'medium',
        message: 'Supplier has below-average performance',
        icon: TrendingDown,
        color: 'orange'
      });
    }

    return indicators;
  };

  const renderStatusHeader = () => {
    const StatusIcon = getStatusIcon(order.status);
    const statusColor = getStatusColor(order.status);
    const priority = getPriorityLevel(order);

    return (
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-lg bg-${statusColor}-100`}>
              <StatusIcon className={`w-8 h-8 text-${statusColor}-600`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{getStatusText(order.status)}</h2>
              <p className="text-sm text-gray-600">PO #{order.purchaseOrderNumber}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full bg-${priority.color}-100 text-${priority.color}-800 font-medium`}>
              {priority.label}
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <span className="text-lg font-semibold text-gray-900">
                ${order.totalCost?.toFixed(2) || '0.00'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Total Value</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              <Package className="w-4 h-4 text-gray-400" />
              <span className="text-lg font-semibold text-gray-900">
                {order.quantityOrdered || 0}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Quantity</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-lg font-semibold text-gray-900">
                {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Delivery Date</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-lg font-semibold text-gray-900">
                {order.sentAt ? Math.ceil((new Date() - new Date(order.sentAt)) / (1000 * 60 * 60)) : 'N/A'}h
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Time Elapsed</p>
          </div>
        </div>
      </div>
    );
  };

  const renderRiskIndicators = () => {
    const indicators = getRiskIndicators();
    
    if (indicators.length === 0) return null;

    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">Risk Indicators</h3>
        {indicators.map((indicator, index) => {
          const IndicatorIcon = indicator.icon;
          return (
            <div key={index} className={`flex items-center space-x-3 p-3 rounded-lg bg-${indicator.color}-50 border border-${indicator.color}-200`}>
              <IndicatorIcon className={`w-5 h-5 text-${indicator.color}-600`} />
              <div className="flex-1">
                <p className={`text-sm font-medium text-${indicator.color}-800`}>
                  {indicator.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPerformanceSummary = () => {
    if (!supplierPerformance) {
      return (
        <div className="text-center py-4">
          <div className="flex items-center justify-center space-x-2">
            <Info className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">No performance data available</span>
          </div>
        </div>
      );
    }

    const grade = supplierPerformance.overallScore >= 90 ? 'A' :
                  supplierPerformance.overallScore >= 80 ? 'B' :
                  supplierPerformance.overallScore >= 70 ? 'C' :
                  supplierPerformance.overallScore >= 60 ? 'D' : 'F';
    
    const gradeColor = supplierPerformance.overallScore >= 90 ? 'green' :
                       supplierPerformance.overallScore >= 80 ? 'blue' :
                       supplierPerformance.overallScore >= 70 ? 'yellow' :
                       supplierPerformance.overallScore >= 60 ? 'orange' : 'red';

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-${gradeColor}-100`}>
            <span className={`text-lg font-bold text-${gradeColor}-600`}>{grade}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Performance Grade</p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-lg font-semibold text-gray-900">
              {supplierPerformance.timeliness?.responseRate || 0}%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Response Rate</p>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-lg font-semibold text-gray-900">
              {supplierPerformance.timeliness?.averageResponseTime || 'N/A'}h
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Avg Response Time</p>
        </div>
      </div>
    );
  };

  if (!order) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const riskIndicators = getRiskIndicators();

  return (
    <div className="space-y-6">
      {/* Status Header */}
      {renderStatusHeader()}

      {/* Risk Indicators */}
      {riskIndicators.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {renderRiskIndicators()}
        </div>
      )}

      {/* Expandable Sections */}
      <div className="space-y-4">
        {/* Performance Section */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <button
            onClick={() => toggleSection('performance')}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <span className="font-medium text-gray-900">Supplier Performance</span>
            </div>
            <Eye className={`w-4 h-4 text-gray-400 transform transition-transform ${expandedSections.performance ? 'rotate-180' : ''}`} />
          </button>
          
          {expandedSections.performance && (
            <div className="p-4 border-t border-gray-200">
              {renderPerformanceSummary()}
              <div className="mt-4">
                <SupplierPerformanceIndicators
                  supplierId={order.supplierId}
                  supplierName={order.supplierName}
                  projectId={order.projectId}
                  compact={true}
                />
              </div>
            </div>
          )}
        </div>

        {/* Status Tracking Section */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <button
            onClick={() => toggleSection('status')}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Activity className="w-5 h-5 text-green-500" />
              <span className="font-medium text-gray-900">Status Tracking</span>
            </div>
            <Eye className={`w-4 h-4 text-gray-400 transform transition-transform ${expandedSections.status ? 'rotate-180' : ''}`} />
          </button>
          
          {expandedSections.status && (
            <div className="p-4 border-t border-gray-200">
              <ResponseStatusTracker
                order={order}
                onRefresh={onRefresh}
                canManage={canManage}
              />
            </div>
          )}
        </div>

        {/* Communication Section */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <button
            onClick={() => toggleSection('communication')}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-purple-500" />
              <span className="font-medium text-gray-900">Communication Status</span>
            </div>
            <Eye className={`w-4 h-4 text-gray-400 transform transition-transform ${expandedSections.communication ? 'rotate-180' : ''}`} />
          </button>
          
          {expandedSections.communication && (
            <div className="p-4 border-t border-gray-200">
              <CommunicationStatus
                order={order}
                onRetry={onRefresh}
                canRetry={canManage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
