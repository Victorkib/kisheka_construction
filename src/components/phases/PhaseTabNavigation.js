/**
 * Phase Tab Navigation Component
 * Reusable tab navigation for phase detail pages
 * 
 * @param {Object} props
 * @param {string} props.activeTab - Currently active tab ID
 * @param {Function} props.onTabChange - Callback when tab changes
 * @param {Array} props.tabs - Array of tab objects { id, label, icon, badge }
 */

'use client';

export function PhaseTabNavigation({ activeTab, onTabChange, tabs }) {
  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="flex space-x-8 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors
                ${isActive
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="flex items-center gap-2">
                {tab.icon && <span>{tab.icon}</span>}
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 && (
                  <span className={`
                    ml-2 px-2 py-0.5 text-xs font-semibold rounded-full
                    ${isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}
                  `}>
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default PhaseTabNavigation;


