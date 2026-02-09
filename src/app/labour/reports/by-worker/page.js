/**
 * By Worker Report Page
 *
 * Route: /labour/reports/by-worker
 */

'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { ReportGenerator } from '@/components/labour/report-generator';

export default function ByWorkerReportPage() {
  const [workerOptions, setWorkerOptions] = useState([]);

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const response = await fetch('/api/labour/workers?status=active&limit=200', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const data = await response.json();
        if (data.success) {
          const options = (data.data?.workers || []).map((worker) => ({
            value: worker.userId || worker._id,
            label: worker.workerName || worker.employeeId || 'Unnamed worker',
          }));
          setWorkerOptions(options);
        }
      } catch (error) {
        console.error('Error fetching workers:', error);
      }
    };

    fetchWorkers();
  }, []);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReportGenerator
          reportType="by-worker"
          apiEndpoint="/api/labour/reports/by-worker"
          title="Worker-Level Labour Report"
          description="Review labour output and costs for a specific worker"
          showGroupBy={false}
          extraFilters={[
            {
              key: 'workerId',
              label: 'Worker',
              type: 'select',
              placeholder: 'Select worker',
              options: workerOptions,
              required: true,
            },
            {
              key: 'workerName',
              label: 'Worker Name (optional)',
              type: 'text',
              placeholder: 'Use if worker ID is unknown',
            },
          ]}
        />
      </div>
    </AppLayout>
  );
}
