/**
 * Recent Updates
 */

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export default function RecentUpdates({ updates = [], onSupplierClick, getGradeColor }) {
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Updates</h3>
        <p className="text-sm text-gray-500">Latest performance updates</p>
      </div>

      {updates.length === 0 ? (
        <div className="text-sm text-gray-500">No recent updates available.</div>
      ) : (
        <div className="space-y-3">
          {updates.map((update, index) => (
            <div
              key={update.supplierId || index}
              className="flex items-center justify-between border border-gray-100 rounded-lg p-3"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Supplier {update.supplierId}
                </p>
                <p className="text-xs text-gray-500">
                  Updated {update.updatedAt ? new Date(update.updatedAt).toLocaleString() : '--'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {update.score ?? '--'}
                </p>
                <Badge variant="info" className={getGradeColor?.(update.grade)}>
                  {update.grade ?? '--'}
                </Badge>
              </div>
              <button
                type="button"
                onClick={() => onSupplierClick?.(update.supplierId)}
                className="ml-3 text-sm text-blue-600 hover:text-blue-800"
              >
                View
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
