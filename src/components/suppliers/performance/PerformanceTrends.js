/**
 * Performance Trends
 */

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export default function PerformanceTrends({ trends, timeRange }) {
  const weeklyAverages = trends?.weeklyAverages || [];
  const trendDirection = trends?.trendDirection || 'stable';

  const trendVariant = {
    improving: 'success',
    declining: 'danger',
    stable: 'info',
  }[trendDirection] || 'info';

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold ds-text-primary">Performance Trends</h3>
          <p className="text-sm ds-text-muted">Time range: {timeRange}</p>
        </div>
        <Badge variant={trendVariant}>{trendDirection}</Badge>
      </div>

      {weeklyAverages.length === 0 ? (
        <div className="text-sm ds-text-muted">No trend data available.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left ds-text-muted">
              <tr>
                <th className="pb-2">Week</th>
                <th className="pb-2">Avg Score</th>
                <th className="pb-2">Suppliers</th>
              </tr>
            </thead>
            <tbody className="ds-text-secondary">
              {weeklyAverages.map((week) => (
                <tr key={week.week} className="border-t ds-border-subtle">
                  <td className="py-2">{week.week}</td>
                  <td className="py-2">
                    {typeof week.averageScore === 'number'
                      ? week.averageScore.toFixed(1)
                      : '--'}
                  </td>
                  <td className="py-2">{week.supplierCount ?? '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
