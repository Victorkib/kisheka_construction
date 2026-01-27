/**
 * Supplier Performance Overview
 */

import Card from '@/components/ui/Card';

export default function PerformanceOverview({ overview }) {
  if (!overview) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((item) => (
          <Card key={item} className="p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-6 bg-gray-200 rounded w-2/3"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const metrics = [
    {
      label: 'Total Suppliers',
      value: overview.totalSuppliers ?? 0,
    },
    {
      label: 'Suppliers Tracked',
      value: overview.suppliersWithPerformance ?? 0,
    },
    {
      label: 'Coverage',
      value: `${overview.performanceCoverage ?? 0}%`,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="p-6">
          <p className="text-sm text-gray-500">{metric.label}</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {typeof metric.value === 'number'
              ? metric.value.toLocaleString()
              : metric.value}
          </p>
        </Card>
      ))}
    </div>
  );
}
