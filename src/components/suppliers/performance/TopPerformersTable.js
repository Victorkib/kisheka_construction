/**
 * Top Performers Table
 */

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export default function TopPerformersTable({
  suppliers = [],
  category = 'overall',
  onSupplierClick,
  getGradeColor,
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold ds-text-primary">Top Performers</h3>
          <p className="text-sm ds-text-muted">Category: {category}</p>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <div className="text-center text-sm ds-text-muted py-8">
          No top performers available.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left ds-text-muted">
              <tr>
                <th className="pb-2">Supplier</th>
                <th className="pb-2">Score</th>
                <th className="pb-2">Grade</th>
                <th className="pb-2">Orders</th>
              </tr>
            </thead>
            <tbody className="ds-text-secondary">
              {suppliers.map((supplier) => (
                <tr
                  key={supplier.supplierId || supplier._id || supplier.name}
                  className="border-t ds-border-subtle hover:bg-ds-bg-surface-muted cursor-pointer"
                  onClick={() => onSupplierClick?.(supplier.supplierId || supplier._id)}
                >
                  <td className="py-3">
                    {supplier.supplierName || supplier.name || 'Unknown Supplier'}
                  </td>
                  <td className="py-3">
                    {typeof supplier.overallScore === 'number'
                      ? supplier.overallScore.toFixed(1)
                      : supplier.overallScore || '--'}
                  </td>
                  <td className="py-3">
                    <Badge variant="info" className={getGradeColor?.(supplier.grade)}>
                      {supplier.grade || '--'}
                    </Badge>
                  </td>
                  <td className="py-3">
                    {supplier.totalOrders ?? supplier.orderCount ?? '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
