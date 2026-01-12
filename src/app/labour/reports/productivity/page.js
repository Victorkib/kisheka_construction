/**
 * Productivity Report Page
 * 
 * Route: /labour/reports/productivity
 */

'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { ReportGenerator } from '@/components/labour/report-generator';
import { ProductivityChart } from '@/components/labour/productivity-chart';

export default function ProductivityReportPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReportGenerator
          reportType="productivity"
          apiEndpoint="/api/labour/reports/productivity"
          title="Productivity Analysis Report"
          description="Analyze worker productivity metrics, quality ratings, and cost efficiency"
          defaultFilters={{ groupBy: 'worker' }}
        >
          {(data) => <ProductivityChart data={data} />}
        </ReportGenerator>
      </div>
    </AppLayout>
  );
}

