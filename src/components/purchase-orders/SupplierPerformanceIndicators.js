/**
 * Supplier Performance Indicators Component
 * Displays comprehensive supplier performance metrics and indicators
 * for purchase order views
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/toast';
import { LoadingSpinner } from '@/components/loading';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  DollarSign,
  Package,
  Calendar,
  Award,
  AlertTriangle,
  BarChart3,
  Star,
  Users,
  Activity
} from 'lucide-react';

export function SupplierPerformanceIndicators({ 
  supplierId, 
  supplierName, 
  projectId,
  showDetails = false,
  compact = false 
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);
  const [expanded, setExpanded] = useState(showDetails);

  useEffect(() => {
    if (supplierId && !compact) {
      fetchSupplierPerformance();
    }
  }, [supplierId, projectId]);

  const fetchSupplierPerformance = async () => {
    if (!supplierId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/performance?projectId=${projectId || ''}`);
      if (response.ok) {
        const data = await response.json();
        setPerformanceData(data.data);
      } else {
        console.warn('Failed to fetch supplier performance data');
      }
    } catch (error) {
      console.error('Error fetching supplier performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceGrade = (score) => {
    if (score >= 90) return { grade: 'A', color: 'green', description: 'Excellent' };
    if (score >= 80) return { grade: 'B', color: 'blue', description: 'Good' };
    if (score >= 70) return { grade: 'C', color: 'yellow', description: 'Average' };
    if (score >= 60) return { grade: 'D', color: 'orange', description: 'Below Average' };
    return { grade: 'F', color: 'red', description: 'Poor' };
  };

  const getTrendIcon = (trend) => {
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Activity className="w-4 h-4 ds-text-muted" />;
  };

  const getRiskLevel = (score) => {
    if (score >= 80) return { level: 'Low', color: 'green', icon: CheckCircle };
    if (score >= 60) return { level: 'Medium', color: 'yellow', icon: AlertTriangle };
    return { level: 'High', color: 'red', icon: AlertCircle };
  };

  const renderCompactView = () => {
    if (!performanceData) return null;

    const grade = getPerformanceGrade(performanceData.overallScore);
    const risk = getRiskLevel(performanceData.overallScore);

    return (
      <div className="flex items-center space-x-3 text-sm">
        <div className={`px-2 py-1 rounded-full bg-${grade.color}-100 text-${grade.color}-800 font-medium`}>
          {grade.grade}
        </div>
        <div className="flex items-center space-x-1">
          <span className="ds-text-secondary">Risk:</span>
          <span className={`text-${risk.color}-600 font-medium`}>{risk.level}</span>
        </div>
        <div className="flex items-center space-x-1">
          <Clock className="w-3 h-3 ds-text-muted" />
          <span className="ds-text-secondary">{performanceData.timeliness?.averageResponseTime || 'N/A'}h</span>
        </div>
      </div>
    );
  };

  const renderDetailedView = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      );
    }

    if (!performanceData) {
      return (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 ds-text-muted mx-auto mb-4" />
          <p className="ds-text-muted">No performance data available</p>
        </div>
      );
    }

    const grade = getPerformanceGrade(performanceData.overallScore);
    const risk = getRiskLevel(performanceData.overallScore);
    const RiskIcon = risk.icon;

    return (
      <div className="space-y-6">
        {/* Overall Score */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold ds-text-primary">Overall Performance</h3>
              <p className="text-sm ds-text-secondary mt-1">{supplierName}</p>
            </div>
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-${grade.color}-100`}>
                <span className={`text-2xl font-bold text-${grade.color}-600`}>{grade.grade}</span>
              </div>
              <p className="text-sm ds-text-secondary mt-2">{grade.description}</p>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm ds-text-secondary">Performance Score</span>
              <span className="text-sm font-medium">{performanceData.overallScore}/100</span>
            </div>
            <div className="w-full ds-bg-surface-muted rounded-full h-2">
              <div 
                className={`bg-${grade.color}-500 h-2 rounded-full transition-all duration-300`}
                style={{ width: `${performanceData.overallScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="ds-bg-surface border ds-border-subtle rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg bg-${risk.color}-100`}>
                <RiskIcon className={`w-5 h-5 text-${risk.color}-600`} />
              </div>
              <div>
                <h4 className="font-medium ds-text-primary">Risk Level</h4>
                <p className="text-sm ds-text-secondary">Based on performance metrics</p>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full bg-${risk.color}-100 text-${risk.color}-800 font-medium`}>
              {risk.level}
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Reliability */}
          <div className="ds-bg-surface border ds-border-subtle rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-medium ds-text-primary">Reliability</span>
              </div>
              <div className="flex items-center space-x-1">
                {getTrendIcon(performanceData.reliability?.trend)}
                <span className="text-sm font-medium">{performanceData.reliability?.score || 0}%</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="ds-text-secondary">On-Time Delivery</span>
                <span className="font-medium">{performanceData.reliability?.onTimeDeliveryRate || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="ds-text-secondary">Order Completion</span>
                <span className="font-medium">{performanceData.reliability?.completionRate || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="ds-text-secondary">Quality Score</span>
                <span className="font-medium">{performanceData.quality?.score || 0}%</span>
              </div>
            </div>
          </div>

          {/* Responsiveness */}
          <div className="ds-bg-surface border ds-border-subtle rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-500" />
                <span className="font-medium ds-text-primary">Responsiveness</span>
              </div>
              <div className="flex items-center space-x-1">
                {getTrendIcon(performanceData.timeliness?.trend)}
                <span className="text-sm font-medium">{performanceData.timeliness?.score || 0}%</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="ds-text-secondary">Avg Response Time</span>
                <span className="font-medium">{performanceData.timeliness?.averageResponseTime || 'N/A'}h</span>
              </div>
              <div className="flex justify-between">
                <span className="ds-text-secondary">Response Rate</span>
                <span className="font-medium">{performanceData.timeliness?.responseRate || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="ds-text-secondary">Communication</span>
                <span className="font-medium">{performanceData.communication?.score || 0}%</span>
              </div>
            </div>
          </div>

          {/* Cost Performance */}
          <div className="ds-bg-surface border ds-border-subtle rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                <span className="font-medium ds-text-primary">Cost Performance</span>
              </div>
              <div className="flex items-center space-x-1">
                {getTrendIcon(performanceData.priceCompetitiveness?.trend)}
                <span className="text-sm font-medium">{performanceData.priceCompetitiveness?.score || 0}%</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="ds-text-secondary">Price Competitiveness</span>
                <span className="font-medium">{performanceData.priceCompetitiveness?.score || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="ds-text-secondary">Total Orders</span>
                <span className="font-medium">{performanceData.totalOrders || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="ds-text-secondary">Total Value</span>
                <span className="font-medium">${(performanceData.totalValue || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Recent Performance */}
          <div className="ds-bg-surface border ds-border-subtle rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-purple-500" />
                <span className="font-medium ds-text-primary">Recent Activity</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="ds-text-secondary">Last 30 Days</span>
                <span className="font-medium">{performanceData.recentPerformance?.last30Days?.orders || 0} orders</span>
              </div>
              <div className="flex justify-between">
                <span className="ds-text-secondary">Acceptance Rate</span>
                <span className="font-medium">{performanceData.recentPerformance?.last30Days?.acceptanceRate || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="ds-text-secondary">Avg Order Value</span>
                <span className="font-medium">${(performanceData.recentPerformance?.last30Days?.averageOrderValue || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {performanceData.recommendations && performanceData.recommendations.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-400/60 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium ds-text-primary">Recommendations</h4>
                <ul className="mt-2 space-y-1 text-sm ds-text-secondary">
                  {performanceData.recommendations.slice(0, 3).map((recommendation, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-yellow-600 mt-1">•</span>
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (compact) {
    return renderCompactView();
  }

  return (
    <div className="ds-bg-surface rounded-lg border ds-border-subtle">
      <div className="p-6 border-b ds-border-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Award className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold ds-text-primary">Supplier Performance</h2>
              <p className="text-sm ds-text-secondary">{supplierName}</p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 ds-text-muted hover:ds-text-secondary transition-colors"
          >
            <BarChart3 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-6">
          {renderDetailedView()}
        </div>
      )}
    </div>
  );
}
