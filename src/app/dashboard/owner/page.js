/**
 * Owner Dashboard
 * Executive summary with full access to all features
 * Redesigned for portfolio-wide view and actionable insights
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingCard } from '@/components/loading';
import { useProjectContext } from '@/contexts/ProjectContext';
import { NoProjectsEmptyState, ErrorState } from '@/components/empty-states';
import { fetchNoCache } from '@/lib/fetch-helpers';
import { ExecutiveSummary } from '@/components/dashboard/owner/ExecutiveSummary';
import { PortfolioOverview } from '@/components/dashboard/owner/PortfolioOverview';
import { FinancialHealth } from '@/components/dashboard/owner/FinancialHealth';
import { ActionItems } from '@/components/dashboard/owner/ActionItems';
import { QuickActions } from '@/components/dashboard/owner/QuickActions';

export default function OwnerDashboard() {
  const { isEmpty, loading: contextLoading, refreshAccessibleProjects } = useProjectContext();
  const [user, setUser] = useState(null);
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userError, setUserError] = useState(null);
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const router = useRouter();

  // CRITICAL FIX: Refresh ProjectContext when dashboard loads if it's empty
  // This ensures we have fresh data when navigating to dashboard
  useEffect(() => {
    // Only refresh once per mount, and only if context is not loading and appears empty
    if (!contextLoading && isEmpty && !hasRefreshed && refreshAccessibleProjects) {
      console.log('Dashboard: ProjectContext appears empty, refreshing...');
      setHasRefreshed(true);
      refreshAccessibleProjects().catch((err) => {
        console.error('Error refreshing accessible projects:', err);
      });
    }
  }, [contextLoading, isEmpty, hasRefreshed, refreshAccessibleProjects]);

  useEffect(() => {
    async function fetchData() {
      try {
        setUserError(null);
        
        // Fetch user data
        const userResponse = await fetchNoCache('/api/auth/me');
        const userData = await userResponse.json();

        if (!userData.success) {
          setUserError('Failed to load user data. Please try again.');
          setLoading(false);
          return;
        }

        setUser(userData.data);

        // Fetch portfolio-wide data (no project filter for owner)
        const portfolioResponse = await fetchNoCache('/api/dashboard/owner/portfolio');
        const portfolioResult = await portfolioResponse.json();

        if (portfolioResult.success) {
          setPortfolioData(portfolioResult.data);
        } else {
          setUserError(portfolioResult.error || 'Failed to load portfolio data');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setUserError('Network error. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [router]);

  // CRITICAL FIX: Wait for ProjectContext to finish loading before showing empty state
  // This prevents showing "No Projects" when data is still loading
  const isActuallyEmpty = isEmpty && !contextLoading && hasRefreshed;

  if (loading || contextLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-96"></div>
            </div>
            <LoadingCard count={4} showHeader={true} lines={3} />
          </div>
        </div>
      </AppLayout>
    );
  }

  // Check empty state FIRST - but only if context has finished loading and we've attempted refresh
  // This prevents showing "No Projects" prematurely
  if (isActuallyEmpty) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
              Owner Dashboard
            </h1>
            {user && (
              <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">
                Welcome, {user.firstName || user.email}!
              </p>
            )}
          </div>

          {/* Empty State - No Projects */}
          <NoProjectsEmptyState
            canCreate={true}
            userName={user?.firstName || user?.email}
            role="owner"
          />
        </div>
      </AppLayout>
    );
  }

  // Check for user error state
  if (userError) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorState
            title="Error Loading Dashboard"
            message={userError}
            onRetry={() => {
              setUserError(null);
              setLoading(true);
              window.location.reload();
            }}
          />
        </div>
      </AppLayout>
    );
  }

  // Check if user is null (shouldn't happen if fetch succeeded, but safety check)
  if (!user) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-8 text-center">
            <div className="max-w-2xl mx-auto">
              <div className="text-5xl mb-4">⏳</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Loading User Data
              </h2>
              <p className="text-lg text-gray-700 mb-6">
                Please wait while we load your information...
              </p>
              <LoadingSpinner />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const totalPendingApprovals = portfolioData?.actionItems?.reduce((sum, item) => {
    return sum + (item.type === 'pending_approvals' ? 1 : 0);
  }, 0) || 0;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
            Owner Dashboard
          </h1>
          <p className="text-base md:text-lg text-gray-700 mt-2 leading-relaxed">
            Welcome back, {user?.firstName || user?.email}! Portfolio overview and insights.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-6">
            <LoadingCard count={4} showHeader={true} lines={3} />
          </div>
        )}

        {/* Error State */}
        {userError && (
          <div className="mb-6">
            <ErrorState
              title="Error Loading Dashboard"
              message={userError}
              onRetry={() => {
                setUserError(null);
                setLoading(true);
                window.location.reload();
              }}
            />
          </div>
        )}

        {/* Dashboard Content */}
        {!loading && portfolioData && (
          <>
            {/* Executive Summary */}
            <ExecutiveSummary
              data={portfolioData.executiveSummary}
              formatCurrency={formatCurrency}
            />

            {/* Action Items */}
            {portfolioData.actionItems && portfolioData.actionItems.length > 0 && (
              <ActionItems
                items={portfolioData.actionItems}
                formatCurrency={formatCurrency}
              />
            )}

            {/* Portfolio Overview */}
            <PortfolioOverview
              projects={portfolioData.projects}
              formatCurrency={formatCurrency}
            />

            {/* Financial Health */}
            <FinancialHealth
              data={portfolioData.financialHealth}
              formatCurrency={formatCurrency}
            />

            {/* Quick Actions */}
            <QuickActions pendingApprovals={totalPendingApprovals} />
          </>
        )}

        {/* Empty State - No Projects */}
        {!loading && !userError && (!portfolioData || !portfolioData.projects || portfolioData.projects.length === 0) && (
          <NoProjectsEmptyState
            canCreate={true}
            userName={user?.firstName || user?.email}
            role="owner"
          />
        )}
      </div>
    </AppLayout>
  );
}
