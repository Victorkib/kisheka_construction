/**
 * Cost Summary Report Page
 * 
 * Route: /labour/reports/cost-summary
 */

'use client';

import { Suspense } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { LabourCostSummary } from '@/components/labour/cost-summary';
import { LoadingSpinner } from '@/components/loading';
import { useSearchParams } from 'next/navigation';

function CostSummaryContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const phaseId = searchParams.get('phaseId');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Labour Cost Summary</h1>
        <p className="text-gray-600">
          Comprehensive labour cost summaries with breakdowns by role, skill type, and direct vs
          subcontractor labour
        </p>
      </div>
      {projectId ? (
        <LabourCostSummary
          projectId={projectId}
          phaseId={phaseId}
          periodType={phaseId ? 'phase_total' : 'project_total'}
        />
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <p className="text-blue-800">
            Please select a project from the{' '}
            <a href="/labour/reports" className="underline font-medium">
              reports page
            </a>{' '}
            or add ?projectId=xxx to the URL
          </p>
        </div>
      )}
    </div>
  );
}

export default function CostSummaryReportPage() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner size="lg" text="Loading..." />
          </div>
        }
      >
        <CostSummaryContent />
      </Suspense>
    </AppLayout>
  );
}

