/**
 * Material Library Filters Component
 * Filter controls for material library list
 */

'use client';

export function MaterialLibraryFilters({
  categories = [],
  categoryId,
  isCommon,
  isActive,
  onCategoryChange,
  onCommonToggle,
  onActiveToggle,
  onClearFilters,
}) {
  return (
    <div className="ds-bg-surface rounded-lg shadow p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Category Filter */}
        <div>
          <label className="block text-sm font-semibold ds-text-secondary mb-1">
            Category
          </label>
          <select
            value={categoryId || ''}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="" className="ds-text-primary">All Categories</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id} className="ds-text-primary">
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Common Materials Toggle */}
        <div className="flex items-end">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isCommon === 'true'}
              onChange={(e) => onCommonToggle(e.target.checked ? 'true' : '')}
              className="w-4 h-4 text-blue-600 ds-border-subtle rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium ds-text-secondary">
              Common Only
            </span>
          </label>
        </div>

        {/* Active Materials Toggle */}
        <div className="flex items-end">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive === 'true' || isActive === null}
              onChange={(e) => onActiveToggle(e.target.checked ? 'true' : 'false')}
              className="w-4 h-4 text-blue-600 ds-border-subtle rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium ds-text-secondary">
              Active Only
            </span>
          </label>
        </div>

        {/* Clear Filters Button */}
        <div className="flex items-end">
          <button
            onClick={onClearFilters}
            className="w-full px-4 py-2 border ds-border-subtle hover:ds-bg-surface-muted ds-text-secondary font-medium rounded-lg transition"
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
}

