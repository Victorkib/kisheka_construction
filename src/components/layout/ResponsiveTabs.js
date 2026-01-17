'use client';

import { useState } from 'react';

/**
 * ResponsiveTabs Component
 * A responsive tab navigation that adapts to different screen sizes
 * - Desktop: Full labels with icons
 * - Tablet: Abbreviated labels with icons
 * - Mobile: Dropdown menu with icons
 */
export function ResponsiveTabs({ tabs, activeTab, onTabChange }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const activeTabData = tabs.find((tab) => tab.id === activeTab);

  return (
    <div className="mb-4 sm:mb-6 border-b border-gray-200">
      {/* Desktop/Tablet View - Tab Navigation */}
      <nav
        className="hidden sm:flex -mb-px space-x-1 md:space-x-2 lg:space-x-4 overflow-x-auto scrollbar-hide"
        aria-label="Tabs"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              onTabChange(tab.id);
              setIsDropdownOpen(false);
            }}
            className={`
              group relative py-3 lg:py-4 px-2 lg:px-3 border-b-2 font-medium text-sm lg:text-base transition
              flex items-center gap-1 lg:gap-2 flex-shrink-0
              ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }
            `}
            title={tab.label}
          >
            <span className="text-base lg:text-lg flex-shrink-0">
              {tab.icon}
            </span>
            {/* Full label on large screens */}
            <span className="hidden lg:inline whitespace-nowrap">
              {tab.label}
            </span>
            {/* Abbreviated label on medium screens */}
            <span className="lg:hidden whitespace-nowrap text-xs lg:text-sm">
              {tab.abbr || tab.label}
            </span>
          </button>
        ))}
      </nav>

      {/* Mobile View - Dropdown */}
      <div className="sm:hidden">
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`
              w-full py-3 px-3 border-b-2 font-medium text-sm
              flex items-center justify-between gap-2
              transition
              ${
                isDropdownOpen
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600'
              }
            `}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base flex-shrink-0">
                {activeTabData?.icon}
              </span>
              <span className="truncate">{activeTabData?.label}</span>
            </div>
            <svg
              className={`w-5 h-5 flex-shrink-0 transition-transform ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div
              className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    onTabChange(tab.id);
                    setIsDropdownOpen(false);
                  }}
                  className={`
                    w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0
                    flex items-center gap-3 transition
                    ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <span className="text-lg flex-shrink-0">{tab.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {tab.label}
                    </div>
                    {tab.description && (
                      <div className="text-xs text-gray-500 truncate">
                        {tab.description}
                      </div>
                    )}
                  </div>
                  {activeTab === tab.id && (
                    <svg
                      className="w-5 h-5 text-blue-600 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
