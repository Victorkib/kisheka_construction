/**
 * Cost Management Page
 * Dedicated page for managing all cost categories, transfers, adjustments, analytics, and reports
 * 
 * Route: /projects/[id]/costs
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { CostOverviewTab } from './components/CostOverviewTab';
import { DCCTab } from './components/DCCTab';
import { PreconstructionTab } from './components/PreconstructionTab';
import { IndirectCostsTab } from './components/IndirectCostsTab';
import { ContingencyTab } from './components/ContingencyTab';
import { TransfersTab } from './components/TransfersTab';
import { AdjustmentsTab } from './components/AdjustmentsTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { ReportsTab } from './components/ReportsTab';

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'dcc', label: 'Direct Construction Costs', icon: '🏗️' },
  { id: 'preconstruction', label: 'Preconstruction', icon: '📋' },
  { id: 'indirect', label: 'Indirect Costs', icon: '⚙️' },
  { id: 'contingency', label: 'Contingency', icon: '🛡️' },
  { id: 'transfers', label: 'Budget Transfers', icon: '🔄' },
  { id: 'adjustments', label: 'Budget Adjustments', icon: '📝' },
  { id: 'analytics', label: 'Analytics & Insights', icon: '📈' },
  { id: 'reports', label: 'Reports', icon: '📄' },
];

function CostManagementContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id;
  const [activeTab, setActiveTab] = useState('overview');

  // Handle tab from URL query parameter
  useEffect(() => {
    const tabFromUrl = searchParams?.get('tab');
    if (tabFromUrl && TABS.find(t => t.id === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <CostOverviewTab projectId={projectId} />;
      case 'dcc':
        return <DCCTab projectId={projectId} />;
      case 'preconstruction':
        return <PreconstructionTab projectId={projectId} />;
      case 'indirect':
        return <IndirectCostsTab projectId={projectId} />;
      case 'contingency':
        return <ContingencyTab projectId={projectId} />;
      case 'transfers':
        return <TransfersTab projectId={projectId} />;
      case 'adjustments':
        return <AdjustmentsTab projectId={projectId} />;
      case 'analytics':
        return <AnalyticsTab projectId={projectId} />;
      case 'reports':
        return <ReportsTab projectId={projectId} />;
      default:
        return <CostOverviewTab projectId={projectId} />;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: 'Projects', href: '/projects' },
            { label: 'Project Details', href: `/projects/${projectId}` },
            { label: 'Cost Management', href: null },
          ]}
        />

        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cost Management</h1>
          <p className="mt-2 text-xs sm:text-sm text-gray-600">
            Manage all cost categories, budgets, transfers, adjustments, analytics, and reports
          </p>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-4 sm:mb-6 border-b border-gray-200">
          <nav 
            className="-mb-px flex space-x-2 sm:space-x-4 md:space-x-8 overflow-x-auto scrollbar-hide" 
            aria-label="Tabs"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-3 sm:py-4 px-2 sm:px-3 md:px-1 border-b-2 font-medium text-xs sm:text-sm transition min-w-[44px] min-h-[44px] flex items-center justify-center
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span className="mr-1 sm:mr-2 text-base sm:text-lg">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-4 sm:mt-6">
          {renderTabContent()}
        </div>
      </div>
    </AppLayout>
  );
}

export default function CostManagementPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading cost management...</p>
          </div>
        </div>
      </AppLayout>
    }>
      <CostManagementContent />
    </Suspense>
  );
}
