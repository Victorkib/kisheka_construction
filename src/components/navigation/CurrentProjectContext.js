/**
 * Current Project Context Component
 * Shows current project information in sidebar when viewing project-related pages
 */

'use client';

import Link from 'next/link';
import { SidebarSection } from '@/components/layout/SidebarSection';
import { useSidebarData } from '@/components/layout/SidebarDataProvider';

/**
 * Current Project Context Component
 * @param {Object} props
 * @param {boolean} [props.isCollapsed] - Is sidebar collapsed
 */
export function CurrentProjectContext({ isCollapsed = false }) {
  const { project, projectId, loading } = useSidebarData();
  
  if (!projectId) {
    return null;
  }
  
  if (loading) {
    return (
      <SidebarSection
        id="current-project"
        title="Current Project"
        icon="🏗️"
        isCollapsed={isCollapsed}
        variant="primary"
        collapsible={false}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </SidebarSection>
    );
  }
  
  if (!project) {
    return null;
  }
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'planning':
        return 'bg-blue-100 text-blue-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <SidebarSection
      id="current-project"
      title="Current Project"
      icon="🏗️"
      isCollapsed={isCollapsed}
      variant="primary"
      collapsible={false}
    >
      <div className="space-y-3">
        <div>
          <Link
            href={`/projects/${projectId}`}
            className="block group"
          >
            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition truncate">
              {project.projectName}
            </h3>
            {project.projectCode && (
              <p className="text-xs text-gray-600 mt-0.5">
                {project.projectCode}
              </p>
            )}
          </Link>
        </div>
        
        {/* Project Status */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(project.status)}`}>
            {project.status || 'planning'}
          </span>
        </div>
        
        {/* Quick Project Actions */}
        <div className="space-y-1 pt-1 border-t border-blue-200">
          <Link
            href={`/projects/${projectId}`}
            className="block text-xs text-blue-600 hover:text-blue-800 font-medium transition"
          >
            View Details →
          </Link>
          <Link
            href={`/material-requests/new?projectId=${projectId}`}
            className="block text-xs text-blue-600 hover:text-blue-800 font-medium transition"
          >
            Create Material Request →
          </Link>
        </div>
      </div>
    </SidebarSection>
  );
}

