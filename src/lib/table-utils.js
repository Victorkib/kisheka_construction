/**
 * Responsive Table Utilities
 * Provides optimized table layouts and utilities for better width utilization
 */

import { useState } from 'react';

/**
 * Table Density Control Component
 */
export function TableDensityControl({ density, onDensityChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium ds-text-secondary">Density:</span>
      <button
        onClick={() => onDensityChange('compact')}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          density === 'compact'
            ? 'ds-bg-accent-primary text-white'
            : 'ds-bg-surface ds-text-primary border ds-border-subtle hover:ds-bg-surface-muted'
        }`}
      >
        Compact
      </button>
      <button
        onClick={() => onDensityChange('normal')}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          density === 'normal'
            ? 'ds-bg-accent-primary text-white'
            : 'ds-bg-surface ds-text-primary border ds-border-subtle hover:ds-bg-surface-muted'
        }`}
      >
        Normal
      </button>
      <button
        onClick={() => onDensityChange('comfortable')}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          density === 'comfortable'
            ? 'ds-bg-accent-primary text-white'
            : 'ds-bg-surface ds-text-primary border ds-border-subtle hover:ds-bg-surface-muted'
        }`}
      >
        Comfortable
      </button>
    </div>
  );
}

/**
 * Get padding classes based on density
 */
export function getDensityClasses(density) {
  const configs = {
    compact: {
      cellPadding: 'px-3 py-2',
      headerPadding: 'px-3 py-2.5',
      textSizes: {
        header: 'text-xs',
        cell: 'text-sm'
      }
    },
    normal: {
      cellPadding: 'px-4 py-3',
      headerPadding: 'px-4 py-3',
      textSizes: {
        header: 'text-xs',
        cell: 'text-sm'
      }
    },
    comfortable: {
      cellPadding: 'px-6 py-4',
      headerPadding: 'px-6 py-4',
      textSizes: {
        header: 'text-sm',
        cell: 'text-base'
      }
    }
  };
  return configs[density] || configs.normal;
}

/**
 * Column Visibility Control Component
 */
export function ColumnVisibilityControl({ columns, visibleColumns, onToggleColumn }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 ds-bg-surface ds-text-primary border-2 ds-border-subtle rounded-lg text-sm font-medium hover:ds-bg-surface-muted transition-colors"
      >
        ⚙️ Columns
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 ds-bg-surface rounded-lg shadow-xl border ds-border-subtle z-20 p-2">
            <div className="text-xs font-semibold ds-text-secondary uppercase tracking-wide mb-2 px-2">
              Toggle Columns
            </div>
            {columns.map((col) => (
              <label
                key={col.id}
                className="flex items-center gap-2 px-2 py-1.5 hover:ds-bg-surface-muted rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(col.id)}
                  onChange={(e) => onToggleColumn(col.id, e.target.checked)}
                  className="w-4 h-4 ds-text-accent-primary ds-border-subtle rounded focus:ring-ds-accent-focus"
                />
                <span className="text-sm ds-text-primary">{col.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Optimized Table Container
 */
export function OptimizedTableContainer({ 
  children, 
  className = '',
  fullWidth = false 
}) {
  return (
    <div 
      className={`
        ds-bg-surface rounded-xl shadow-lg border ds-border-subtle overflow-hidden
        ${fullWidth ? 'w-full' : 'w-full max-w-7xl mx-auto'}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/**
 * Responsive Table Wrapper
 */
export function ResponsiveTableWrapper({ 
  children, 
  className = '',
  horizontalScroll = true 
}) {
  return (
    <div 
      className={`
        overflow-x-auto
        ${horizontalScroll ? 'scroll-smooth' : ''}
        ${className}
      `}
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
      }}
    >
      <div className="min-w-full">
        {children}
      </div>
    </div>
  );
}

/**
 * Table utilities default export
 */
export default {
  TableDensityControl,
  ColumnVisibilityControl,
  OptimizedTableContainer,
  ResponsiveTableWrapper,
  getDensityClasses
};
