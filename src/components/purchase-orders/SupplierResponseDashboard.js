/**
 * Enhanced Supplier Response Dashboard Component
 * Comprehensive dashboard for managing supplier responses
 * with analytics, quick actions, and performance insights
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/toast';
import { LoadingSpinner, LoadingCard } from '@/components/loading';
import { SupplierResponseInterface } from './SupplierResponseInterface';
import { ResponseStatusTracker } from './ResponseStatusTracker';
import { CommunicationStatus } from './CommunicationStatus';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  MessageSquare,
  RefreshCw,
  Filter,
  Download,
  Calendar,
  DollarSign,
  Users,
  Activity
} from 'lucide-react';

export function SupplierResponseDashboard({ 
  order, 
  token, 
  isSupplierView = false,
  canManage = false,
  onResponse,
  onRefresh 
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(isSupplierView ? 'respond' : 'overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [timeFilter, setTimeFilter] = useState('7d'); // 7d, 30d, 90d, all

  useEffect(() => {
    if (order && !isSupplierView) {
      loadDashboardData();
    }
  }, [order, timeFilter]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load supplier response analytics
      const response = await fetch(`/api/analytics/supplier-responses?timeFilter=${timeFilter}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResponseSubmit = async (responseData) => {
    if (!onResponse) return;
    
    try {
      await onResponse(responseData);
      if (!isSupplierView) {
        await loadDashboardData(); // Refresh dashboard data
      }
    } catch (error) {
      throw error;
    }
  };

  const getQuickStats = () => {
    if (!dashboardData) return null;

    return {
      totalResponses: dashboardData.totalResponses || 0,
      averageResponseTime: dashboardData.averageResponseTime || 0,
      acceptanceRate: dashboardData.acceptanceRate || 0,
      rejectionRate: dashboardData.rejectionRate || 0,
      modificationRate: dashboardData.modificationRate || 0,
      pendingResponses: dashboardData.pendingResponses || 0
    };
  };

  const getResponseTrends = () => {
    if (!dashboardData?.trends) return [];

    return dashboardData.trends.map(trend => ({
      ...trend,
      acceptanceRate: trend.acceptanceRate || 0,
      responseTime: trend.responseTime || 0
    }));
  };

  const getTopPerformers = () => {
    if (!dashboardData?.topSuppliers) return [];

    return dashboardData.topSuppliers.slice(0, 5);
  };

  const getRecentActivity = () => {
    if (!dashboardData?.recentActivity) return [];

    return dashboardData.recentActivity.slice(0, 10);
  };

  const renderOverviewTab = () => {
    const stats = getQuickStats();
    const trends = getResponseTrends();
    const topPerformers = getTopPerformers();
    const recentActivity = getRecentActivity();

    if (loading && !dashboardData) {
      return (
        <div className="space-y-6">
          <LoadingCard className="h-32" />
          <LoadingCard className="h-64" />
          <LoadingCard className="h-48" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Responses</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalResponses}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Response Time</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.averageResponseTime}h</p>
                </div>
                <Clock className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Acceptance Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.acceptanceRate}%</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pendingResponses}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
            </div>
          </div>
        )}

        {/* Response Trends */}
        {trends.length > 0 && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Response Trends</h3>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </div>
            
            <div className="space-y-3">
              {trends.map((trend, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium">{trend.period}</span>
                  </div>
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>{trend.acceptanceRate}%</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>{trend.responseTime}h</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <BarChart3 className="w-4 h-4 text-gray-500" />
                      <span>{trend.totalResponses}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Performing Suppliers */}
        {topPerformers.length > 0 && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Suppliers</h3>
            <div className="space-y-3">
              {topPerformers.map((supplier, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{supplier.name}</p>
                      <p className="text-xs text-gray-500">{supplier.totalResponses} responses</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>{supplier.acceptanceRate}%</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>{supplier.averageResponseTime}h</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {recentActivity.map((activity, index) => {
                const ActivityIcon = activity.type === 'accept' ? CheckCircle :
                                   activity.type === 'reject' ? AlertCircle :
                                   activity.type === 'modify' ? MessageSquare :
                                   Clock;
                
                return (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`p-1 rounded mt-1 ${
                      activity.type === 'accept' ? 'bg-green-100' :
                      activity.type === 'reject' ? 'bg-red-100' :
                      activity.type === 'modify' ? 'bg-blue-100' :
                      'bg-gray-100'
                    }`}>
                      <ActivityIcon className={`w-4 h-4 ${
                        activity.type === 'accept' ? 'text-green-600' :
                        activity.type === 'reject' ? 'text-red-600' :
                        activity.type === 'modify' ? 'text-blue-600' :
                        'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-xs text-gray-500">{activity.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRespondTab = () => {
    if (!order || !token) {
      return (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No valid order or response token found</p>
        </div>
      );
    }

    return (
      <SupplierResponseInterface
        order={order}
        token={token}
        onResponse={handleResponseSubmit}
      />
    );
  };

  const renderStatusTab = () => {
    if (!order) {
      return (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No order data available</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <ResponseStatusTracker
          order={order}
          onRefresh={onRefresh}
          canManage={canManage}
        />
        
        <CommunicationStatus
          order={order}
          onRetry={onRefresh}
          canRetry={canManage}
        />
      </div>
    );
  };

  const tabs = isSupplierView ? [
    { id: 'respond', label: 'Respond to Order', icon: MessageSquare }
  ] : [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'status', label: 'Status Tracking', icon: Clock }
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isSupplierView ? 'Supplier Response Portal' : 'Response Management Dashboard'}
            </h1>
            {order && (
              <p className="text-gray-600 mt-1">
                Purchase Order #{order.purchaseOrderNumber}
              </p>
            )}
          </div>
          
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'respond' && renderRespondTab()}
        {activeTab === 'status' && renderStatusTab()}
      </div>
    </div>
  );
}
