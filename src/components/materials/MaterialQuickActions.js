/**
 * Material Quick Actions Component
 * 
 * Provides quick access to material-related actions:
 * - Create Material Request
 * - Create Bulk Material Request
 * - View Material Library
 * - View Material Requests
 * - View Batches
 * 
 * @component
 */

'use client';

import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';
import { useProjectContext } from '@/contexts/ProjectContext';

export function MaterialQuickActions({ projectId = null }) {
  const { canAccess } = usePermissions();
  const { currentProjectId } = useProjectContext();
  
  // Use provided projectId or current project context
  const activeProjectId = projectId || currentProjectId;
  const projectQuery = activeProjectId ? `?projectId=${activeProjectId}` : '';

  const actions = [
    {
      label: 'New Material Request',
      description: 'Create a single material request',
      href: `/material-requests/new${projectQuery}`,
      icon: '📋',
      color: 'blue',
      permission: 'create_material_request',
      badge: null,
    },
    {
      label: 'Bulk Material Request',
      description: 'Create multiple requests at once',
      href: `/material-requests/bulk${projectQuery}`,
      icon: '📦',
      color: 'green',
      permission: 'create_bulk_material_request',
      badge: null,
    },
    {
      label: 'Material Library',
      description: 'Browse and manage material library',
      href: '/material-library',
      icon: '📚',
      color: 'purple',
      permission: 'view_material_library',
      badge: null,
    },
    {
      label: 'View Requests',
      description: 'Manage material requests',
      href: `/material-requests${projectQuery}`,
      icon: '📝',
      color: 'indigo',
      permission: 'view_material_requests',
      badge: null,
    },
    {
      label: 'View Batches',
      description: 'View bulk request batches',
      href: '/material-requests/batches',
      icon: '📋',
      color: 'teal',
      permission: 'view_bulk_material_requests',
      badge: null,
    },
    {
      label: 'Add Material',
      description: 'Create retroactive material entry',
      href: `/items/new${projectQuery}${projectQuery ? '&' : '?'}entryType=retroactive_entry`,
      icon: '➕',
      color: 'orange',
      permission: 'create_material',
      badge: null,
    },
  ];

  const filteredActions = actions.filter(action => 
    !action.permission || canAccess(action.permission)
  );

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700',
      green: 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700',
      purple: 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700',
      indigo: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700',
      teal: 'bg-teal-50 hover:bg-teal-100 border-teal-200 text-teal-700',
      orange: 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700',
    };
    return colors[color] || colors.blue;
  };

  if (filteredActions.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredActions.map((action, index) => (
          <Link
            key={index}
            href={action.href}
            className={`rounded-lg border p-4 transition-all hover:shadow-md ${getColorClasses(action.color)}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">{action.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-semibold text-sm leading-tight">{action.label}</h4>
                  {action.badge && (
                    <span className="px-2 py-0.5 bg-white/50 rounded text-xs font-medium">
                      {action.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs mt-1 opacity-80 leading-tight">{action.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
