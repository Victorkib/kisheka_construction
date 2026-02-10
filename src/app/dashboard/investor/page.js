/**
 * Investor Dashboard Page
 * Investor-specific dashboard showing their contribution and project finances
 * 
 * Route: /dashboard/investor
 * Auth: INVESTOR role only
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingCard, LoadingButton } from '@/components/loading';
import { StatementGenerator } from '@/components/investors/statement-generator';
import { useProjectContext } from '@/contexts/ProjectContext';
import { NoProjectsEmptyState, NoDataEmptyState } from '@/components/empty-states';
import { fetchNoCache } from '@/lib/fetch-helpers';

export default function InvestorDashboardPage() {
  const router = useRouter();
  const { isEmpty, loading: contextLoading, refreshAccessibleProjects } = useProjectContext();
  const [hasRefreshed, setHasRefreshed] = useState(false);

  // CRITICAL FIX: Refresh ProjectContext when dashboard loads if it's empty
  useEffect(() => {
    if (!contextLoading && isEmpty && !hasRefreshed && refreshAccessibleProjects) {
      console.log('Investor Dashboard: ProjectContext appears empty, refreshing...');
      setHasRefreshed(true);
      refreshAccessibleProjects().catch((err) => {
        console.error('Error refreshing accessible projects:', err);
      });
    }
  }, [contextLoading, isEmpty, hasRefreshed, refreshAccessibleProjects]);
  const [investor, setInvestor] = useState(null);
  const [finances, setFinances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [financesLoading, setFinancesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showStatementGenerator, setShowStatementGenerator] = useState(false);
  const [projectBreakdown, setProjectBreakdown] = useState([]);
  const [investorCapitalUsed, setInvestorCapitalUsed] = useState(0);
  const [investorTotalAllocated, setInvestorTotalAllocated] = useState(0);

  useEffect(() => {
    fetchInvestorData();
  }, []);

  useEffect(() => {
    if (investor) {
      fetchFinances();
    }
  }, [investor]);

  const fetchInvestorData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch investor data - API will automatically filter by userId for INVESTOR role
      const response = await fetchNoCache('/api/investors?status=ACTIVE');
      const data = await response.json();

      if (data.success && data.data.length > 0) {
        // API returns only the investor linked to current user (by userId)
        setInvestor(data.data[0]);
      } else if (data.success && data.data.length === 0) {
        // No investor record found for this user
        setError('No investor profile found. Please contact the administrator to create your investor account.');
      } else {
        setError(data.error || 'Failed to fetch investor data');
      }
    } catch (err) {
      console.error('Fetch investor error:', err);
      setError('Failed to load investor dashboard. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFinances = async () => {
    try {
      setFinancesLoading(true);
      
      // Fetch aggregate finances for total view
      const response = await fetchNoCache('/api/project-finances');
      const data = await response.json();

      if (data.success) {
        setFinances(data.data);
      }

      // Calculate investor's project-specific capital usage (real-time)
      if (investor && investor.projectAllocations && investor.projectAllocations.length > 0) {
        let totalUsed = 0;
        let totalAllocated = 0;
        const breakdown = [];

        for (const allocation of investor.projectAllocations) {
          if (allocation.projectId) {
            try {
              // Get project-specific finances (real-time)
              const projectFinancesResponse = await fetchNoCache(`/api/project-finances?projectId=${allocation.projectId}`);
              const projectFinancesData = await projectFinancesResponse.json();

              if (projectFinancesData.success) {
                const allocatedAmount = allocation.amount || 0;
                totalAllocated += allocatedAmount;

                const projectTotalInvested = projectFinancesData.data.totalInvested || 0;
                const projectTotalUsed = projectFinancesData.data.totalUsed || 0;

                if (projectTotalInvested > 0) {
                  const projectShare = allocatedAmount / projectTotalInvested;
                  const projectCapitalUsed = projectTotalUsed * projectShare;
                  totalUsed += projectCapitalUsed;

                  // Get project name
                  const projectResponse = await fetchNoCache(`/api/projects/${allocation.projectId}`);
                  const projectData = await projectResponse.json();
                  const projectName = projectData.success ? projectData.data.projectName : 'Unknown Project';

                  breakdown.push({
                    projectId: allocation.projectId,
                    projectName,
                    allocatedAmount,
                    capitalUsed: projectCapitalUsed,
                    capitalBalance: allocatedAmount - projectCapitalUsed,
                  });
                }
              }
            } catch (err) {
              console.error(`Error fetching project ${allocation.projectId} finances:`, err);
            }
          }
        }

        setInvestorTotalAllocated(totalAllocated || investor.totalInvested);
        setInvestorCapitalUsed(totalUsed);
        setProjectBreakdown(breakdown);
      } else if (investor) {
        // Fallback: Use proportional calculation (backward compatibility)
        const totalInvested = data.data?.totalInvested || 1;
        const totalUsed = data.data?.totalUsed || 0;
        const investorShare = totalInvested > 0 ? (investor.totalInvested / totalInvested) : 0;
        setInvestorTotalAllocated(investor.totalInvested);
        setInvestorCapitalUsed(totalUsed * investorShare);
        setProjectBreakdown([]);
      }
    } catch (err) {
      console.error('Fetch finances error:', err);
    } finally {
      setFinancesLoading(false);
    }
  };

  const handleOpenStatementGenerator = () => {
    setShowStatementGenerator(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // CRITICAL FIX: Wait for ProjectContext to finish loading before showing empty state
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
            <LoadingCard count={3} showHeader={true} lines={4} />
          </div>
        </div>
      </AppLayout>
    );
  }

  // Check empty state - no projects (but only if context has finished loading and we've attempted refresh)
  if (isActuallyEmpty && !error && investor) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">My Investment Dashboard</h1>
            <p className="mt-2 text-sm text-gray-700">
              Welcome, {investor.name}. View your investment details and project progress.
            </p>
          </div>
          <NoProjectsEmptyState
            canCreate={false}
            userName={investor.name}
            role="investor"
          />
        </div>
      </AppLayout>
    );
  }

  if (error || !investor) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-4">
            <p className="font-medium">{error || 'Investor profile not found.'}</p>
            <p className="text-sm mt-2">
              If you believe this is an error, please contact the administrator to link your user account to an investor record.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Calculate investor's share (for display only - actual calculation done in fetchFinances)
  const totalInvested = finances?.totalInvested || 1;
  const investorShare = totalInvested > 0 ? ((investorTotalAllocated || investor.totalInvested) / totalInvested) * 100 : 0;
  const investorCapitalBalance = (investorTotalAllocated || investor.totalInvested) - investorCapitalUsed;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">My Investment Dashboard</h1>
          <p className="mt-2 text-sm text-gray-700">
            Welcome, {investor.name}. View your investment details and project progress.
          </p>
        </div>

        {/* My Contribution Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">My Contribution</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Total Invested</div>
              <div className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(investor.totalInvested || 0)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Investment Type</div>
              <div className="text-xl font-semibold text-gray-900 mt-1">
                {investor.investmentType}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Share of Total</div>
              <div className="text-xl font-semibold text-gray-900 mt-1">
                {investorShare.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* Project Finances Overview */}
        {financesLoading ? (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i}>
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded w-32"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : finances ? (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Finances Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Total Capital Raised</div>
                <div className="text-xl font-semibold text-gray-900 mt-1">
                  {formatCurrency(finances.totalInvested || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Capital Used</div>
                <div className="text-xl font-semibold text-red-600 mt-1">
                  {formatCurrency(finances.totalUsed || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">My Capital Used</div>
                <div className="text-xl font-semibold text-orange-600 mt-1">
                  {formatCurrency(investorCapitalUsed)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">My Remaining Balance</div>
                <div className="text-xl font-semibold text-blue-600 mt-1">
                  {formatCurrency(investorCapitalBalance)}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Project Breakdown */}
        {projectBreakdown.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">My Project Allocations</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Allocated
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Capital Used
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Remaining
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {projectBreakdown.map((project) => (
                    <tr key={project.projectId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {project.projectName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(project.allocatedAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {formatCurrency(project.capitalUsed)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                        {formatCurrency(project.capitalBalance)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/projects/${project.projectId}/finances`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Financial Statements Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Financial Statements</h2>
            <button
              onClick={handleOpenStatementGenerator}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Generate Statement
            </button>
          </div>
          <p className="text-sm text-gray-600">
            Download your investment statement showing all contributions and capital usage in PDF, Excel, or JSON format.
          </p>
        </div>

        {/* Statement Generator Modal */}
        {showStatementGenerator && investor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <StatementGenerator
                investorId={investor._id}
                investorName={investor.name}
                onClose={() => setShowStatementGenerator(false)}
              />
            </div>
          </div>
        )}

        {/* Project Progress Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Progress</h2>
          <p className="text-sm text-gray-600 mb-4">
            View project details and progress updates.
          </p>
          <Link
            href="/projects"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            View Projects
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}

