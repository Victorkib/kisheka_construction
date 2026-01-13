/**
 * Analytics Tab
 * Analytics and insights
 */

'use client';

import { RecommendationsPanel } from '@/components/analytics/RecommendationsPanel';
import { ForecastDisplay } from '@/components/analytics/ForecastDisplay';
import { TrendCharts } from '@/components/analytics/TrendCharts';

export function AnalyticsTab({ projectId }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Recommendations */}
      <div>
        <RecommendationsPanel projectId={projectId} />
      </div>

      {/* Forecast */}
      <div>
        <ForecastDisplay projectId={projectId} />
      </div>

      {/* Trends */}
      <div>
        <TrendCharts projectId={projectId} />
      </div>
    </div>
  );
}
