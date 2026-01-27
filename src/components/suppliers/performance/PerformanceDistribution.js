/**
 * Performance Distribution
 */

import Card from '@/components/ui/Card';

export default function PerformanceDistribution({ distribution, selectedCategory }) {
  const overall = distribution?.overall;
  const total = distribution?.total ?? 0;

  const rows = overall
    ? [
        { label: 'Excellent (90+)', value: overall.excellent },
        { label: 'Good (80-89)', value: overall.good },
        { label: 'Average (70-79)', value: overall.average },
        { label: 'Below Avg (60-69)', value: overall.belowAverage },
        { label: 'Poor (<60)', value: overall.poor },
      ]
    : [];

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Distribution</h3>
        <p className="text-sm text-gray-500">
          {selectedCategory === 'overall' ? 'Overall scores' : `Category: ${selectedCategory}`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-gray-500">No distribution data available.</div>
      ) : (
        <div className="space-y-2 text-sm text-gray-700">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span>{row.label}</span>
              <span className="font-medium">
                {row.value ?? 0}
                {total ? ` / ${total}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
