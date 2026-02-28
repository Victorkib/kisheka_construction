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
          <div className="h-4 ds-bg-surface-muted rounded w-3/4 mb-2"></div>
          <div className="h-3 ds-bg-surface-muted rounded w-1/2"></div>
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
        return 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/60';
      case 'planning':
        return 'bg-blue-500/20 text-blue-100 border border-blue-400/60';
      case 'paused':
        return 'bg-amber-500/20 text-amber-100 border border-amber-400/60';
      case 'completed':
        return 'bg-purple-500/20 text-purple-100 border border-purple-400/60';
      default:
        return 'bg-slate-500/20 text-slate-100 border border-slate-400/60';
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
            <h3 className="text-sm font-semibold ds-text-sidebar-primary group-hover:text-blue-300 transition truncate">
              {project.projectName}
            </h3>
            {project.projectCode && (
              <p className="text-xs ds-text-sidebar-secondary mt-0.5">
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
        <div className="space-y-1 pt-1 border-t border-slate-500/40">
          <Link
            href={`/projects/${projectId}`}
            className="block text-xs text-blue-300 hover:text-blue-200 font-medium transition"
          >
            View Details →
          </Link>
          <Link
            href={`/material-requests/new?projectId=${projectId}`}
            className="block text-xs text-blue-300 hover:text-blue-200 font-medium transition"
          >
            Create Material Request →
          </Link>
        </div>
      </div>
    </SidebarSection>
  );
}

