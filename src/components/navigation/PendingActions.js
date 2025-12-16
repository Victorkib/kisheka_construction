/**
 * Pending Actions Component
 * Shows items requiring user action (approvals, responses, etc.)
 */

'use client';

import Link from 'next/link';
import { SidebarSection } from '@/components/layout/SidebarSection';
import { useSidebarData } from '@/components/layout/SidebarDataProvider';

/**
 * Pending Actions Component
 * @param {Object} props
 * @param {boolean} [props.isCollapsed] - Is sidebar collapsed
 */
export function PendingActions({ isCollapsed = false }) {
  const { pendingActions, loading } = useSidebarData();

  if (loading) {
    return null;
  }

  if (pendingActions.length === 0) {
    return null;
  }

  // Calculate total count for badge
  const totalCount = pendingActions.reduce((sum, action) => sum + (action.count || 0), 0);
  
  // Determine badge color based on highest priority
  const hasHighPriority = pendingActions.some(action => action.priority === 'high');
  const badgeColor = hasHighPriority ? 'red' : 'yellow';

  return (
    <SidebarSection
      id="pending-actions"
      title="Pending Actions"
      icon="⏰"
      isCollapsed={isCollapsed}
      variant="secondary"
      collapsible={true}
      defaultCollapsed={false}
      badge={totalCount}
      badgeColor={badgeColor}
    >
      <div className="space-y-2">
        {pendingActions.map((action, index) => (
          <Link
            key={index}
            href={action.href}
            className={`block p-2 rounded-lg border transition ${
              action.priority === 'high'
                ? 'bg-red-50 border-red-200 hover:bg-red-100'
                : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base flex-shrink-0">{action.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  action.priority === 'high' ? 'text-red-900' : 'text-yellow-900'
                }`}>
                  {action.label}
                </p>
              </div>
              {action.count > 0 && (
                <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full ${
                  action.priority === 'high'
                    ? 'bg-red-600 text-white'
                    : 'bg-yellow-600 text-white'
                }`}>
                  {action.count}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </SidebarSection>
  );
}

