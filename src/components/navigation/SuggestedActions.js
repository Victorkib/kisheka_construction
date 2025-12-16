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
      <div className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <Link
            key={index}
            href={suggestion.href}
            className={`block p-2 rounded-lg border transition ${
              suggestion.priority === 'high'
                ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base flex-shrink-0">{suggestion.icon}</span>
              <p className={`text-sm font-medium ${
                suggestion.priority === 'high' ? 'text-blue-900' : 'text-gray-900'
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

