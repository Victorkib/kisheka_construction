/**
 * Reports Tab
 * Report generation and scheduling
 */

'use client';

import { ReportGenerator } from '@/components/reports/ReportGenerator';
import { ScheduledReportsManager } from '@/components/reports/ScheduledReportsManager';

export function ReportsTab({ projectId }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Report Generator */}
      <div>
        <ReportGenerator projectId={projectId} />
      </div>

      {/* Scheduled Reports */}
      <div>
        <ScheduledReportsManager projectId={projectId} />
      </div>
    </div>
  );
}
