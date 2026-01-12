/**
 * Budget Variance Report Page
 * 
 * Route: /labour/reports/budget-variance
 */

'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { ReportGenerator } from '@/components/labour/report-generator';
import { BudgetVarianceChart } from '@/components/labour/budget-variance-chart';

export default function BudgetVarianceReportPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReportGenerator
          reportType="budget-variance"
          apiEndpoint="/api/labour/reports/budget-variance"
          title="Budget Variance Report"
          description="Compare actual labour costs against allocated budgets to identify overruns and savings"
          defaultFilters={{}}
        >
          {(data) => <BudgetVarianceChart data={data} />}
        </ReportGenerator>
      </div>
    </AppLayout>
  );
}

