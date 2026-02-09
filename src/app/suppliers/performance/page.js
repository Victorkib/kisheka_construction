/**
 * Supplier Performance Dashboard Page
 * 
 * Comprehensive dashboard for viewing and analyzing supplier performance metrics
 * including top performers, trends, and detailed analytics.
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import LoadingCard from '@/components/ui/LoadingCard';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import PrerequisiteGuide from '@/components/help/PrerequisiteGuide';

// Components
import PerformanceOverview from '@/components/suppliers/performance/PerformanceOverview';
import TopPerformersTable from '@/components/suppliers/performance/TopPerformersTable';
import PerformanceTrends from '@/components/suppliers/performance/PerformanceTrends';
import PerformanceDistribution from '@/components/suppliers/performance/PerformanceDistribution';
import CategoryComparison from '@/components/suppliers/performance/CategoryComparison';
import RecentUpdates from '@/components/suppliers/performance/RecentUpdates';

function SupplierPerformanceDashboard() {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();

  // State
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dashboard data
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('overall');
  const [timeRange, setTimeRange] = useState('3months');
  const [refreshing, setRefreshing] = useState(false);

  // Categories for filtering
  const categories = [
    { value: 'overall', label: 'Overall Performance' },
    { value: 'reliability', label: 'Reliability' },
    { value: 'quality', label: 'Quality' },
    { value: 'timeliness', label: 'Timeliness' },
    { value: 'communication', label: 'Communication' },
    { value: 'priceCompetitiveness', label: 'Price Competitiveness' }
  ];

  const timeRanges = [
    { value: '1month', label: 'Last Month' },
    { value: '3months', label: 'Last 3 Months' },
    { value: '6months', label: 'Last 6 Months' },
    { value: '1year', label: 'Last Year' }
  ];

  // Check authentication and permissions
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
          router.push('/login');
          return;
        }

        setUser(authUser);

        // Get user profile
        const profileResponse = await fetch('/api/auth/me', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        if (!profileResponse.ok) {
          toast.showError('User profile not found');
          return;
        }

        const profileResult = await profileResponse.json();
        if (!profileResult.success || !profileResult.data) {
          toast.showError('User profile not found');
          return;
        }

        setUserProfile(profileResult.data);

        // Check permissions
        const permissionsResponse = await fetch('/api/auth/permissions', {
          headers: {
            'Authorization': `Bearer ${authUser.id}`
          }
        });

        if (!permissionsResponse.ok) {
          toast.showError('Failed to verify permissions');
          return;
        }

        const permissions = await permissionsResponse.json();
        if (!permissions.data?.view_suppliers) {
          toast.showError('Insufficient permissions to view supplier performance');
          router.push('/dashboard');
          return;
        }

      } catch (error) {
        console.error('Auth check error:', error);
        setError('Authentication failed');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, toast, supabase]);

  // Load dashboard data
  useEffect(() => {
    if (userProfile) {
      loadDashboardData();
    }
  }, [userProfile, selectedCategory, timeRange]);

  const loadDashboardData = async () => {
    try {
      setRefreshing(true);
      setError(null);

      // Load dashboard data
      const dashboardResponse = await fetch('/api/suppliers/performance/dashboard', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (!dashboardResponse.ok) {
        throw new Error('Failed to load dashboard data');
      }

      const dashboardResult = await dashboardResponse.json();
      if (!dashboardResult.success) {
        throw new Error(dashboardResult.error || 'Failed to load dashboard data');
      }

      // Load top performers for selected category
      const topPerformersResponse = await fetch(
        `/api/suppliers/performance/top?category=${selectedCategory}&limit=10&minOrders=3`
      );
      
      let topPerformers = [];
      if (topPerformersResponse.ok) {
        const topPerformersResult = await topPerformersResponse.json();
        if (topPerformersResult.success) {
          topPerformers = topPerformersResult.data.suppliers;
        }
      }

      setDashboardData({
        ...dashboardResult.data,
        topPerformers
      });

    } catch (error) {
      console.error('Load dashboard data error:', error);
      setError(error.message);
      toast.showError(error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
  };

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  const handleSupplierClick = (supplierId) => {
    router.push(`/suppliers/${supplierId}/performance`);
  };

  const getPerformanceGradeColor = (grade) => {
    if (grade.startsWith('A')) return 'text-green-600 bg-green-100';
    if (grade.startsWith('B')) return 'text-blue-600 bg-blue-100';
    if (grade.startsWith('C')) return 'text-yellow-600 bg-yellow-100';
    if (grade.startsWith('D')) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingCard />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Dashboard</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!dashboardData) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p className="text-gray-500">No performance data available</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Supplier Performance Dashboard</h1>
              <p className="text-gray-600 mt-2">
                Comprehensive analysis of supplier performance metrics and trends
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          <PrerequisiteGuide
            title="Performance data requires supplier activity"
            description="Metrics are built from purchase orders and supplier history."
            prerequisites={[
              'Suppliers are onboarded',
              'Purchase orders have been processed',
            ]}
            actions={[
              { href: '/suppliers', label: 'View Suppliers' },
              { href: '/purchase-orders', label: 'View Orders' },
            ]}
            tip="Allow some time after orders are processed for metrics to update."
          />

          {/* Filters */}
          <div className="mt-6 flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Range</label>
              <select
                value={timeRange}
                onChange={(e) => handleTimeRangeChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timeRanges.map(range => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <PerformanceOverview 
          overview={dashboardData.overview}
          distribution={dashboardData.distribution}
          trends={dashboardData.trends}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Top Performers */}
          <div className="lg:col-span-2">
            <TopPerformersTable
              suppliers={dashboardData.topPerformers}
              category={selectedCategory}
              onSupplierClick={handleSupplierClick}
              getGradeColor={getPerformanceGradeColor}
            />
          </div>

          {/* Performance Distribution */}
          <div>
            <PerformanceDistribution
              distribution={dashboardData.distribution}
              selectedCategory={selectedCategory}
            />
          </div>
        </div>

        {/* Performance Trends */}
        <div className="mt-8">
          <PerformanceTrends
            trends={dashboardData.trends}
            timeRange={timeRange}
          />
        </div>

        {/* Category Comparison */}
        <div className="mt-8">
          <CategoryComparison
            topPerformers={dashboardData.topPerformers}
            categories={categories}
            onCategoryChange={handleCategoryChange}
            selectedCategory={selectedCategory}
          />
        </div>

        {/* Recent Updates */}
        <div className="mt-8">
          <RecentUpdates
            updates={dashboardData.recentUpdates}
            onSupplierClick={handleSupplierClick}
            getGradeColor={getPerformanceGradeColor}
          />
        </div>
      </div>
    </AppLayout>
  );
}

export default function SupplierPerformanceDashboardPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingCard />
        </div>
      </AppLayout>
    }>
      <SupplierPerformanceDashboard />
    </Suspense>
  );
}
