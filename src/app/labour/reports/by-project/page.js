/**
 * By Project Report Page
 * 
 * Route: /labour/reports/by-project
 */

'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { ReportGenerator } from '@/components/labour/report-generator';
import { LabourCostChart } from '@/components/labour/labour-cost-chart';

export default function ByProjectReportPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReportGenerator
          reportType="by-project"
          apiEndpoint="/api/labour/reports/by-project"
          title="Project-Level Labour Report"
          description="View labour costs and hours across all projects with breakdown by phase, worker, or skill"
          defaultFilters={{ groupBy: 'phase' }}
        >
          {(data) => <LabourCostChart data={data} />}
        </ReportGenerator>
      </div>
    </AppLayout>
  );
}

