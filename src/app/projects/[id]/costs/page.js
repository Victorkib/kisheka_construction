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
import { ResponsiveTabs } from '@/components/layout/ResponsiveTabs';
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
  {
    id: 'overview',
    label: 'Overview',
    abbr: 'Overview',
    description: 'Cost summary',
    icon: '📊',
  },
  {
    id: 'dcc',
    label: 'Direct Construction Costs',
    abbr: 'DCC',
    description: 'Direct construction costs',
    icon: '🏗️',
  },
  {
    id: 'preconstruction',
    label: 'Preconstruction',
    abbr: 'Pre-Const',
    description: 'Preconstruction costs',
    icon: '📋',
  },
  {
    id: 'indirect',
    label: 'Indirect Costs',
    abbr: 'Indirect',
    description: 'Indirect expenses',
    icon: '⚙️',
  },
  {
    id: 'contingency',
    label: 'Contingency',
    abbr: 'Contingency',
    description: 'Contingency reserve',
    icon: '🛡️',
  },
  {
    id: 'transfers',
    label: 'Budget Transfers',
    abbr: 'Transfers',
    description: 'Transfer budgets',
    icon: '🔄',
  },
  {
    id: 'adjustments',
    label: 'Budget Adjustments',
    abbr: 'Adjustments',
    description: 'Adjust budgets',
    icon: '📝',
  },
  {
    id: 'analytics',
    label: 'Analytics & Insights',
    abbr: 'Analytics',
    description: 'Analytics & insights',
    icon: '📈',
  },
  {
    id: 'reports',
    label: 'Reports',
    abbr: 'Reports',
    description: 'Generate reports',
    icon: '📄',
  },
];

function CostManagementContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id;
  const [activeTab, setActiveTab] = useState('overview');

  // Handle tab from URL query parameter
  useEffect(() => {
    const tabFromUrl = searchParams?.get('tab');
    if (tabFromUrl && TABS.find((t) => t.id === tabFromUrl)) {
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Cost Management
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-gray-600">
            Manage all cost categories, budgets, transfers, adjustments,
            analytics, and reports
          </p>
        </div>

        {/* Tabs Navigation */}
        <ResponsiveTabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Tab Content */}
        <div className="mt-4 sm:mt-6">{renderTabContent()}</div>
      </div>
    </AppLayout>
  );
}

export default function CostManagementPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading cost management...</p>
            </div>
          </div>
        </AppLayout>
      }
    >
      <CostManagementContent />
    </Suspense>
  );
}
