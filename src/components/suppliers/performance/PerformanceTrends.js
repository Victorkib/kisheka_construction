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
          <h3 className="text-lg font-semibold text-gray-900">Performance Trends</h3>
          <p className="text-sm text-gray-500">Time range: {timeRange}</p>
        </div>
        <Badge variant={trendVariant}>{trendDirection}</Badge>
      </div>

      {weeklyAverages.length === 0 ? (
        <div className="text-sm text-gray-500">No trend data available.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="pb-2">Week</th>
                <th className="pb-2">Avg Score</th>
                <th className="pb-2">Suppliers</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {weeklyAverages.map((week) => (
                <tr key={week.week} className="border-t border-gray-100">
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
