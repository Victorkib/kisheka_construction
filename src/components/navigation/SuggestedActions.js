/**
 * Suggested Actions Component
 * Rule-based suggestions for next actions based on current state
 */

'use client';

import Link from 'next/link';
import { SidebarSection } from '@/components/layout/SidebarSection';
import { useSidebarData } from '@/components/layout/SidebarDataProvider';

/**
 * Suggested Actions Component
 * @param {Object} props
 * @param {boolean} [props.isCollapsed] - Is sidebar collapsed
 */
export function SuggestedActions({ isCollapsed = false }) {
  const { suggestions, loading } = useSidebarData();

  if (loading) {
    return null;
  }

  if (suggestions.length === 0) {
    return null;
  }

  // Determine if there are high priority suggestions
  const hasHighPriority = suggestions.some(s => s.priority === 'high');

  return (
    <SidebarSection
      id="suggested-actions"
      title="Suggested Actions"
      icon="💡"
      isCollapsed={isCollapsed}
      variant="secondary"
      collapsible={true}
      defaultCollapsed={false}
    >
      <div className="space-y-1.5">
        {suggestions.map((suggestion, index) => (
          <Link
            key={index}
            href={suggestion.href}
            className={`block p-2 rounded-lg border transition-colors ${
              suggestion.priority === 'high'
                ? 'bg-blue-500/20 border-blue-400/50 hover:bg-blue-500/30'
                : 'bg-slate-600/40 border-slate-500/50 hover:bg-slate-600/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base flex-shrink-0">{suggestion.icon}</span>
              <p className={`text-sm font-medium truncate ${
                suggestion.priority === 'high' ? 'text-blue-50' : 'text-white'
              }`}>
                {suggestion.label}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </SidebarSection>
  );
}

