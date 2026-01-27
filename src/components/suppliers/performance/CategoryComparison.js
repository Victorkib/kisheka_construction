/**
 * Category Comparison
 */

import Card from '@/components/ui/Card';

export default function CategoryComparison({
  topPerformers = [],
  categories = [],
  onCategoryChange,
  selectedCategory,
}) {
  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Category Comparison</h3>
          <p className="text-sm text-gray-500">
            Compare top performers across categories
          </p>
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange?.(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </div>

      {topPerformers.length === 0 ? (
        <div className="text-sm text-gray-500">No comparison data available.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topPerformers.map((supplier) => (
            <div
              key={supplier.supplierId || supplier._id || supplier.name}
              className="border border-gray-100 rounded-lg p-3"
            >
              <p className="text-sm font-medium text-gray-900">
                {supplier.supplierName || supplier.name || 'Unknown Supplier'}
              </p>
              <p className="text-xs text-gray-500">
                Score: {supplier.overallScore ?? '--'} | Grade: {supplier.grade ?? '--'}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
