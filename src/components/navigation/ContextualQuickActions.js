/**
 * Contextual Quick Actions Component
 * Shows relevant quick actions based on current page context
 */

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useProjectContext } from '@/contexts/ProjectContext';
import { SidebarSection } from '@/components/layout/SidebarSection';

/**
 * Get contextual quick actions based on current path
 * Now uses ProjectContext to get current project
 */
function getContextualActions(pathname, searchParams, canAccess, currentProjectId) {
  const actions = [];

  // Project detail page
  if (pathname.match(/^\/projects\/[^/]+$/)) {
    const projectId = pathname.split('/')[2];
    if (canAccess && canAccess('create_material_request')) {
      actions.push({
        label: 'Create Material Request',
        href: `/material-requests/new?projectId=${projectId}`,
        icon: '📦',
        color: 'blue',
      });
    }
    if (canAccess && canAccess('view_financing')) {
      actions.push({
        label: 'View Finances',
        href: `/projects/${projectId}/finances`,
        icon: '💰',
        color: 'green',
      });
    }
    if (canAccess && canAccess('edit_project')) {
      actions.push({
        label: 'Edit Project',
        // Navigate to project detail page where inline edit is available
        href: `/projects/${projectId}`,
        icon: '✏️',
        color: 'gray',
      });
    }
  }

  // Material request detail page
  if (pathname.match(/^\/material-requests\/[^/]+$/)) {
    const requestId = pathname.split('/')[2];
    if (canAccess && canAccess('create_purchase_order')) {
      actions.push({
        label: 'Create Purchase Order',
        href: `/purchase-orders/new?materialRequestId=${requestId}`,
        icon: '🛒',
        color: 'blue',
      });
    }
    actions.push({
      label: 'View Project',
      href: `/projects/${searchParams.get('projectId') || ''}`,
      icon: '🏗️',
      color: 'gray',
    });
  }

  // Purchase order detail page
  if (pathname.match(/^\/purchase-orders\/[^/]+$/)) {
    const orderId = pathname.split('/')[2];
    actions.push({
      label: 'View Material Request',
      href: `/material-requests/${searchParams.get('materialRequestId') || ''}`,
      icon: '📋',
      color: 'gray',
    });
    actions.push({
      label: 'View Project',
      href: `/projects/${searchParams.get('projectId') || ''}`,
      icon: '🏗️',
      color: 'gray',
    });
  }

  // Material requests list page
  if (pathname === '/material-requests') {
    // Prioritize ProjectContext over URL param
    const projectId = currentProjectId || searchParams.get('projectId');
    if (canAccess && canAccess('create_material_request')) {
      actions.push({
        label: projectId ? 'Create Request for Project' : 'Create Material Request',
        href: projectId ? `/material-requests/new?projectId=${projectId}` : '/material-requests/new',
        icon: '➕',
        color: 'blue',
      });
    }
    if (projectId) {
      actions.push({
        label: 'View Project',
        href: `/projects/${projectId}`,
        icon: '🏗️',
        color: 'gray',
      });
    }
  }

  // Purchase orders list page
  if (pathname === '/purchase-orders') {
    // Prioritize ProjectContext over URL param
    const projectId = currentProjectId || searchParams.get('projectId');
    if (canAccess && canAccess('create_purchase_order')) {
      actions.push({
        label: projectId ? 'Create Order for Project' : 'Create Purchase Order',
        href: projectId ? `/purchase-orders/new?projectId=${projectId}` : '/purchase-orders/new',
        icon: '➕',
        color: 'blue',
      });
    }
    if (projectId) {
      actions.push({
        label: 'View Project',
        href: `/projects/${projectId}`,
        icon: '🏗️',
        color: 'gray',
      });
    }
  }

  // Projects list page
  if (pathname === '/projects') {
    if (canAccess && canAccess('create_project')) {
      actions.push({
        label: 'Create Project',
        href: '/projects/new',
        icon: '➕',
        color: 'blue',
      });
    }
  }

  return actions;
}

/**
 * Contextual Quick Actions Component
 * @param {Object} props
 * @param {boolean} [props.isCollapsed] - Is sidebar collapsed
 */
export function ContextualQuickActions({ isCollapsed = false }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const { currentProjectId } = useProjectContext();

  const actions = useMemo(() => {
    return getContextualActions(pathname, searchParams, canAccess, currentProjectId);
  }, [pathname, searchParams, canAccess, currentProjectId]);

  // Don't show if no actions
  if (actions.length === 0) {
    return null;
  }

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700',
      green: 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700',
      gray: 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700',
      orange: 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700',
    };
    return colors[color] || colors.gray;
  };

  return (
    <SidebarSection
      id="contextual-quick-actions"
      title="Quick Actions"
      icon="⚡"
      isCollapsed={isCollapsed}
      variant="secondary"
      collapsible={true}
      defaultCollapsed={false}
      showBorder={true}
      className="flex-shrink-0"
    >
      <div className="space-y-1.5">
        {actions.map((action, index) => (
          <Link
            key={index}
            href={action.href}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${getColorClasses(action.color)}`}
          >
            <span className="text-base flex-shrink-0">{action.icon}</span>
            <span className="flex-1 font-medium truncate">{action.label}</span>
          </Link>
        ))}
      </div>
    </SidebarSection>
  );
}

