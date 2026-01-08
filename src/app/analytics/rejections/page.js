/**
 * Rejection Analytics Dashboard Page
 * 
 * Comprehensive dashboard for analyzing supplier order rejections,
 * including reasons, trends, supplier performance, and resolution patterns.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import LoadingCard from '@/components/ui/LoadingCard';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { getUserProfile } from '@/lib/auth-helpers';

// Import chart components
import {
  ChartBar,
  ChartLine,
  ChartPie,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  Package,
  ArrowRight,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';

// Import UI components
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

// Rejection Analytics Components
import RejectionOverview from '@/components/analytics/RejectionOverview';
import RejectionReasonsChart from '@/components/analytics/RejectionReasonsChart';
import SupplierRejectionsChart from '@/components/analytics/SupplierRejectionsChart';
import RejectionTrendsChart from '@/components/analytics/RejectionTrendsChart';
import ResolutionEffectivenessChart from '@/components/analytics/ResolutionEffectivenessChart';
import ImpactAnalysisChart from '@/components/analytics/ImpactAnalysisChart';
import RejectionDetailsTable from '@/components/analytics/RejectionDetailsTable';

const RejectionAnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('30d');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // Fetch rejection analytics data
  const fetchAnalyticsData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const userProfile = await getUserProfile(user.id);
      if (!userProfile) {
        router.push('/login');
        return;
      }

      const params = new URLSearchParams({
        dateRange,
        category: selectedCategory,
        supplier: selectedSupplier
      });

      const response = await fetch(`/api/analytics/rejections?${params}`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch rejection analytics');
      }

      const data = await response.json();
      if (data.success) {
        setAnalyticsData(data.data);
      } else {
        throw new Error(data.message || 'Failed to load analytics');
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err.message);
      toast({
        title: 'Error',
        message: 'Failed to load rejection analytics',
        type: 'error'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh analytics data
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalyticsData();
  };

  // Export analytics data
  const handleExport = async () => {
    try {
      const response = await fetch('/api/analytics/rejections/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dateRange,
          category: selectedCategory,
          supplier: selectedSupplier
        })
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rejection-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        message: 'Analytics data exported successfully',
        type: 'success'
      });
    } catch (err) {
      console.error('Export error:', err);
      toast({
        title: 'Error',
        message: 'Failed to export analytics data',
        type: 'error'
      });
    }
  };

  // Load data on mount and when filters change
  useEffect(() => {
    setLoading(true);
    fetchAnalyticsData();
  }, [dateRange, selectedCategory, selectedSupplier]);

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Rejection Analytics</h1>
            <p className="text-gray-600 mt-2">Analyze supplier order rejection patterns and trends</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <LoadingCard />
            <LoadingCard />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Analytics</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </>
              )}
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const {
    overview,
    reasons,
    suppliers,
    categories,
    resolutions,
    trends,
    impact,
    recentRejections
  } = analyticsData;

  return (
    <AppLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Rejection Analytics</h1>
            <p className="text-gray-600 mt-2">Analyze supplier order rejection patterns and trends</p>
          </div>
          
          <div className="flex items-center space-x-3 mt-4 sm:mt-0">
            <Button
              variant="outline"
              onClick={handleExport}
              className="flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
            >
              {refreshing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <div className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center">
                <Filter className="w-4 h-4 mr-2 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filters:</span>
              </div>
              
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="6m">Last 6 months</option>
                <option value="1y">Last year</option>
              </select>
              
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories?.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
              
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Suppliers</option>
                {suppliers?.slice(0, 20).map((supplier) => (
                  <option key={supplier.supplierId} value={supplier.supplierId}>
                    {supplier.supplierName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Overview Cards */}
        <RejectionOverview overview={overview} />

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <RejectionReasonsChart reasons={reasons} />
          <SupplierRejectionsChart suppliers={suppliers.slice(0, 10)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <RejectionTrendsChart trends={trends} />
          <ResolutionEffectivenessChart resolutions={resolutions} />
        </div>

        <div className="mb-6">
          <ImpactAnalysisChart impact={impact} />
        </div>

        {/* Recent Rejections Table */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Rejections</h3>
            <RejectionDetailsTable rejections={recentRejections.slice(0, 20)} />
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};

export default RejectionAnalyticsDashboard;
