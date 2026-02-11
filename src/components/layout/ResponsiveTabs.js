'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * ResponsiveTabs Component
 * A responsive tab navigation that adapts to different screen sizes
 * - Desktop: Full labels with icons
 * - Tablet: Abbreviated labels with icons
 * - Mobile: Dropdown menu with icons
 */
export function ResponsiveTabs({ tabs, activeTab, onTabChange }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tabListRef = useRef(null);

  const activeTabData = tabs.find((tab) => tab.id === activeTab);

  const updateScrollButtons = () => {
    const el = tabListRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  };

  const handleScroll = () => {
    updateScrollButtons();
  };

  const scrollTabs = (direction) => {
    const el = tabListRef.current;
    if (!el) return;
    const amount = direction === 'left' ? -200 : 200;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  useEffect(() => {
    updateScrollButtons();
  }, [tabs, activeTab]);

  return (
    <div className="mb-4 sm:mb-6 border-b border-gray-200">
      {/* Desktop/Tablet View - Tab Navigation with side scroll controls */}
      <div className="relative hidden sm:block">
        {/* Left gradient + button */}
        {canScrollLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white via-white/80 to-transparent z-10" />
        )}
        <button
          type="button"
          onClick={() => scrollTabs('left')}
          disabled={!canScrollLeft}
          className={`
            hidden sm:flex items-center justify-center
            absolute inset-y-0 left-0 w-7 sm:w-8 z-20
            text-gray-500 hover:text-gray-800
            transition
            ${canScrollLeft ? 'cursor-pointer' : 'cursor-default opacity-0'}
          `}
          aria-label="Scroll tabs left"
        >
          <span className="inline-flex items-center justify-center rounded-full bg-white/80 shadow-sm border border-gray-200 w-6 h-6">
            ‹
          </span>
        </button>

        {/* Right gradient + button */}
        {canScrollRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white via-white/80 to-transparent z-10" />
        )}
        <button
          type="button"
          onClick={() => scrollTabs('right')}
          disabled={!canScrollRight}
          className={`
            hidden sm:flex items-center justify-center
            absolute inset-y-0 right-0 w-7 sm:w-8 z-20
            text-gray-500 hover:text-gray-800
            transition
            ${canScrollRight ? 'cursor-pointer' : 'cursor-default opacity-0'}
          `}
          aria-label="Scroll tabs right"
        >
          <span className="inline-flex items-center justify-center rounded-full bg-white/80 shadow-sm border border-gray-200 w-6 h-6">
            ›
          </span>
        </button>

        <nav
          ref={tabListRef}
          className="flex -mb-px space-x-1 md:space-x-2 lg:space-x-4 overflow-x-auto scrollbar-hide pr-6 pl-6"
          aria-label="Tabs"
          style={{ WebkitOverflowScrolling: 'touch' }}
          onScroll={handleScroll}
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
      </div>

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
