/**
 * By Floor Report Page
 *
 * Route: /labour/reports/by-floor
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { ReportGenerator } from '@/components/labour/report-generator';

export default function ByFloorReportPage() {
  const [floorOptions, setFloorOptions] = useState([]);

  const fetchFloors = useCallback(async (projectId) => {
    if (!projectId) {
      setFloorOptions([]);
      return;
    }

    try {
      const response = await fetch(`/api/floors?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        const options = (data.data || []).map((floor) => ({
          value: floor._id,
          label: floor.floorName || `Floor ${floor.floorNumber}`,
        }));
        setFloorOptions(options);
      }
    } catch (error) {
      console.error('Error fetching floors:', error);
    }
  }, []);

  const handleFiltersChange = useCallback(
    (filters) => {
      if (filters.projectId) {
        fetchFloors(filters.projectId);
      } else {
        setFloorOptions([]);
      }
    },
    [fetchFloors]
  );

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReportGenerator
          reportType="by-floor"
          apiEndpoint="/api/labour/reports/by-floor"
          title="Floor-Level Labour Report"
          description="Track labour costs and hours for a specific floor"
          showGroupBy={false}
          onFiltersChange={handleFiltersChange}
          extraFilters={[
            {
              key: 'floorId',
              label: 'Floor',
              type: 'select',
              placeholder: 'Select floor',
              options: floorOptions,
              required: true,
              disabled: floorOptions.length === 0,
            },
          ]}
        />
      </div>
    </AppLayout>
  );
}
