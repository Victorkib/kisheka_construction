/**
 * By Phase Report Page
 *
 * Route: /labour/reports/by-phase
 */

'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { ReportGenerator } from '@/components/labour/report-generator';

export default function ByPhaseReportPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReportGenerator
          reportType="by-phase"
          apiEndpoint="/api/labour/reports/by-phase"
          title="Phase-Level Labour Report"
          description="Analyze labour costs within a phase with breakdowns by worker, skill, floor, or category"
          defaultFilters={{ groupBy: 'worker' }}
          groupByOptions={[
            { value: 'worker', label: 'Worker' },
            { value: 'skill', label: 'Skill' },
            { value: 'floor', label: 'Floor' },
            { value: 'category', label: 'Category' },
          ]}
        />
      </div>
    </AppLayout>
  );
}
