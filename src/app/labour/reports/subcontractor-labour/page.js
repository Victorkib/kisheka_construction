/**
 * Subcontractor Labour Report Page
 *
 * Route: /labour/reports/subcontractor-labour
 */

'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { ReportGenerator } from '@/components/labour/report-generator';

export default function SubcontractorLabourReportPage() {
  const [subcontractorOptions, setSubcontractorOptions] = useState([]);

  useEffect(() => {
    const fetchSubcontractors = async () => {
      try {
        const response = await fetch('/api/subcontractors?limit=200', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const data = await response.json();
        if (data.success) {
          const options = (data.data?.subcontractors || []).map((subcontractor) => ({
            value: subcontractor._id,
            label: subcontractor.companyName || subcontractor.name || 'Unnamed subcontractor',
          }));
          setSubcontractorOptions(options);
        }
      } catch (error) {
        console.error('Error fetching subcontractors:', error);
      }
    };

    fetchSubcontractors();
  }, []);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReportGenerator
          reportType="subcontractor-labour"
          apiEndpoint="/api/labour/reports/subcontractor-labour"
          title="Subcontractor Labour Report"
          description="Compare direct labour and subcontractor labour costs"
          showGroupBy={false}
          extraFilters={[
            {
              key: 'breakdown',
              label: 'Breakdown',
              type: 'select',
              placeholder: 'Select breakdown',
              options: [
                { value: 'combined', label: 'Combined' },
                { value: 'direct', label: 'Direct Only' },
                { value: 'subcontractor', label: 'Subcontractor Only' },
              ],
            },
            {
              key: 'subcontractorId',
              label: 'Subcontractor (optional)',
              type: 'select',
              placeholder: 'Select subcontractor',
              options: subcontractorOptions,
            },
          ]}
        />
      </div>
    </AppLayout>
  );
}
