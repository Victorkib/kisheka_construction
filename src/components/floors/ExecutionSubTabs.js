/**
 * Execution Sub-Tab Navigation Component
 * For navigating between Phase Work, Finishing, Progress, and Evidence sub-tabs
 *
 * @param {Object} props
 * @param {string} props.activeSubTab - Currently active sub-tab ID
 * @param {Function} props.onSubTabChange - Callback when sub-tab changes
 */

'use client';

export function ExecutionSubTabs({ activeSubTab, onSubTabChange }) {
  const subTabs = [
    { id: 'phase-work', label: 'Phase Work', icon: '🏗️' },
    { id: 'finishing', label: 'Finishing', icon: '🎨' },
    { id: 'progress', label: 'Progress', icon: '📈' },
    { id: 'evidence', label: 'Evidence', icon: '📸' },
  ];

  return (
    <div className="ds-bg-surface-muted rounded-lg p-1 mb-4">
      <nav className="flex space-x-1" aria-label="Execution sub-tabs">
        {subTabs.map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSubTabChange(tab.id)}
              className={`
                flex-1 py-2.5 px-3 rounded-md font-medium text-sm transition-colors
                ${isActive
                  ? 'ds-bg-surface ds-text-accent-primary shadow-sm'
                  : 'ds-text-muted hover:ds-text-secondary hover:ds-bg-surface/50'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="flex items-center justify-center gap-1.5">
                {tab.icon && <span>{tab.icon}</span>}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.charAt(0)}</span>
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default ExecutionSubTabs;
