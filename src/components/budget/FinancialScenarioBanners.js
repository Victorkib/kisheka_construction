/**
 * Financial Scenario Banners
 * Dismissible contextual guidance based on budget/capital status
 * 
 * Usage:
 * <FinancialScenarioBanners
 *   projectId="xxx"
 *   budget={budget}
 *   capital={capital}
 *   spending={spending}
 * />
 */

'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/toast';

const SCENARIOS = {
  NO_BUDGET_NO_CAPITAL: 'no-budget-no-capital',
  CAPITAL_NO_BUDGET: 'capital-no-budget',
  BUDGET_NO_CAPITAL: 'budget-no-capital',
  BOTH_PRESENT: 'both-present',
};

const BANNER_STORAGE_KEY = 'financial_scenario_dismissed';

export function FinancialScenarioBanners({ 
  projectId, 
  budget, 
  capital, 
  spending 
}) {
  const [dismissedBanners, setDismissedBanners] = useState([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Load dismissed banners from localStorage
    const stored = localStorage.getItem(BANNER_STORAGE_KEY);
    if (stored) {
      setDismissedBanners(JSON.parse(stored));
    }
  }, []);

  const handleDismiss = (scenarioId) => {
    const updated = [...dismissedBanners, scenarioId];
    setDismissedBanners(updated);
    localStorage.setItem(BANNER_STORAGE_KEY, JSON.stringify(updated));
  };

  const handleRestore = () => {
    setDismissedBanners([]);
    localStorage.removeItem(BANNER_STORAGE_KEY);
  };

  // Determine current scenario
  const hasBudget = budget?.total > 0 || budget?.directConstructionCosts > 0;
  const hasCapital = capital?.capitalBalance > 0 || capital?.totalInvested > 0;
  const hasSpending = spending?.total > 0;

  let scenario = null;

  if (!hasBudget && !hasCapital) {
    scenario = SCENARIOS.NO_BUDGET_NO_CAPITAL;
  } else if (hasCapital && !hasBudget) {
    scenario = SCENARIOS.CAPITAL_NO_BUDGET;
  } else if (hasBudget && !hasCapital) {
    scenario = SCENARIOS.BUDGET_NO_CAPITAL;
  } else {
    scenario = SCENARIOS.BOTH_PRESENT;
  }

  // Don't show if already dismissed
  if (dismissedBanners.includes(scenario)) {
    return null;
  }

  const scenarioConfig = SCENARIO_CONFIG[scenario];
  if (!scenarioConfig) return null;

  return (
    <div className={`rounded-lg border-2 p-4 mb-6 ${scenarioConfig.className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {scenarioConfig.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold ${scenarioConfig.titleColor}`}>
            {scenarioConfig.title}
          </h3>
          <p className="text-sm mt-1 ds-text-secondary">
            {scenarioConfig.description}
          </p>
          
          {/* Quick Actions */}
          {scenarioConfig.actions && (
            <div className="flex flex-wrap gap-2 mt-3">
              {scenarioConfig.actions.map((action, idx) => (
                <a
                  key={idx}
                  href={action.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${action.className}`}
                >
                  {action.icon}
                  {action.label}
                </a>
              ))}
            </div>
          )}

          {/* Tips */}
          {scenarioConfig.tips && (
            <div className="mt-3 p-3 rounded-lg bg-white/50 dark:bg-slate-800/50">
              <p className="text-xs font-semibold ds-text-primary mb-1">💡 Quick Tips:</p>
              <ul className="text-xs ds-text-secondary space-y-1 list-disc list-inside">
                {scenarioConfig.tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => handleDismiss(scenario)}
          className="flex-shrink-0 p-1 hover:bg-black/10 rounded transition-colors"
          aria-label="Dismiss this message"
        >
          <svg className="w-4 h-4 ds-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Restore Link */}
      {dismissedBanners.length > 0 && (
        <div className="mt-3 pt-3 border-t ds-border-subtle text-center">
          <button
            onClick={handleRestore}
            className="text-xs ds-text-accent-primary hover:underline"
          >
            Show dismissed messages
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Scenario configurations
 */
const SCENARIO_CONFIG = {
  [SCENARIOS.NO_BUDGET_NO_CAPITAL]: {
    className: 'ds-bg-accent-subtle/50 border-ds-border-accent-subtle',
    titleColor: 'ds-text-primary',
    icon: (
      <svg className="w-6 h-6 ds-text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: '🏗️ Starting from Scratch',
    description: 'No budget or capital set yet. That\'s perfectly fine! You can still track all spending and add financial structure later.',
    actions: [
      {
        href: `/capital/requests/new`,
        label: 'Add Capital',
        className: 'ds-bg-accent-primary text-white hover:ds-bg-accent-hover',
        icon: '💰',
      },
      {
        href: `?wizard=true`,
        label: 'Set Budget',
        className: 'ds-bg-surface ds-text-primary border ds-border-subtle hover:ds-bg-surface-muted',
        icon: '📊',
      },
    ],
    tips: [
      'All material requests, labour, and expenses will be tracked normally',
      'Set a budget anytime from the Budget Management page',
      'Add investor capital to track funding sources',
      'Pre-budget spending is automatically captured and can be used for recommendations',
    ],
  },
  [SCENARIOS.CAPITAL_NO_BUDGET]: {
    className: 'bg-blue-50 border-blue-400/60 dark:bg-blue-900/20 dark:border-blue-700/60',
    titleColor: 'text-blue-900 dark:text-blue-200',
    icon: (
      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: '💰 Capital-First Approach',
    description: 'You have investor capital but no detailed budget. Consider allocating capital to floors/phases or setting a budget for validation.',
    actions: [
      {
        href: `/dashboard/capital`,
        label: 'Allocate Capital',
        className: 'bg-blue-600 text-white hover:bg-blue-700',
        icon: '📍',
      },
      {
        href: `?wizard=true`,
        label: 'Set Budget',
        className: 'bg-white text-blue-700 border border-blue-400 hover:bg-blue-50',
        icon: '📊',
      },
    ],
    tips: [
      'Capital can be allocated to specific floors or phases',
      'Setting a budget enables automatic validation and alerts',
      'Track capital usage vs budget for better financial control',
      'Investor reports show capital deployment progress',
    ],
  },
  [SCENARIOS.BUDGET_NO_CAPITAL]: {
    className: 'bg-green-50 border-green-400/60 dark:bg-green-900/20 dark:border-green-700/60',
    titleColor: 'text-green-900 dark:text-green-200',
    icon: (
      <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: '📊 Budget Set - Full Control',
    description: 'Budget is configured! Consider adding investor capital to track funding sources and enable capital-based reporting.',
    actions: [
      {
        href: `/investors`,
        label: 'Add Capital',
        className: 'bg-green-600 text-white hover:bg-green-700',
        icon: '💰',
      },
      {
        href: `/dashboard/budget`,
        label: 'Manage Budget',
        className: 'bg-white text-green-700 border border-green-400 hover:bg-green-50',
        icon: '⚙️',
      },
    ],
    tips: [
      'Budget validation is active - you\'ll get alerts at 80%, 95%, and 100% utilization',
      'Capital tracking helps reconcile investor funds with expenses',
      'Use budget transfers to move funds between categories',
      'Contingency reserve provides buffer for unexpected costs',
    ],
  },
  [SCENARIOS.BOTH_PRESENT]: {
    className: 'bg-purple-50 border-purple-400/60 dark:bg-purple-900/20 dark:border-purple-700/60',
    titleColor: 'text-purple-900 dark:text-purple-200',
    icon: (
      <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: '✅ Full Financial Control',
    description: 'Both budget and capital are configured. You have complete financial tracking and validation enabled.',
    actions: [
      {
        href: `/dashboard/finances`,
        label: 'Financial Overview',
        className: 'bg-purple-600 text-white hover:bg-purple-700',
        icon: '📈',
      },
      {
        href: `/budget-reallocations`,
        label: 'Reallocate Funds',
        className: 'bg-white text-purple-700 border border-purple-400 hover:bg-purple-50',
        icon: '🔄',
      },
    ],
    tips: [
      'Monitor budget vs actual spending in the Financial Overview',
      'Use budget reallocations for major category changes',
      'Capital balance shows remaining investor funds',
      'Regular reviews help catch variances early',
    ],
  },
};

export default FinancialScenarioBanners;
