/**
 * By Time Period Report Page
 *
 * Route: /labour/reports/by-time-period
 */

'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { ReportGenerator } from '@/components/labour/report-generator';

export default function ByTimePeriodReportPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReportGenerator
          reportType="by-time-period"
          apiEndpoint="/api/labour/reports/by-time-period"
          title="Time Period Labour Report"
          description="Track labour trends over time with daily, weekly, or monthly grouping"
          defaultFilters={{ groupBy: 'day' }}
          groupByOptions={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
      </div>
    </AppLayout>
  );
}
