/**
 * Material Guide Component
 * 
 * Consolidated component that combines PrerequisiteGuide and QuickActions
 * into a single, elegant, space-efficient component.
 * 
 * Features:
 * - Collapsible guide section (prerequisites, tips)
 * - Quick action cards in a compact grid
 * - Modern, clean design
 * - Permission-based filtering
 * 
 * @component
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';
import { useProjectContext } from '@/contexts/ProjectContext';
import { ChevronDown, ChevronUp, Info, Lightbulb, CheckCircle2, Sparkles } from 'lucide-react';

export function MaterialGuide({
  title,
  description,
  prerequisites = [],
  tip,
  projectId = null,
  variant = 'default', // 'default' | 'compact' | 'expanded'
}) {
  const { canAccess } = usePermissions();
  const { currentProjectId } = useProjectContext();
  const [isGuideExpanded, setIsGuideExpanded] = useState(variant === 'expanded');
  const [showAllActions, setShowAllActions] = useState(false);
  
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
      priority: 'high',
    },
    {
      label: 'Bulk Material Request',
      description: 'Create multiple requests at once',
      href: `/material-requests/bulk${projectQuery}`,
      icon: '📦',
      color: 'green',
      permission: 'create_bulk_material_request',
      priority: 'high',
    },
    {
      label: 'Add Material',
      description: 'Create retroactive material entry',
      href: `/items/new${projectQuery}${projectQuery ? '&' : '?'}entryType=retroactive_entry`,
      icon: '➕',
      color: 'orange',
      permission: 'create_material',
      priority: 'high',
    },
    {
      label: 'Material Library',
      description: 'Browse and manage material library',
      href: '/material-library',
      icon: '📚',
      color: 'purple',
      permission: 'view_material_library',
      priority: 'medium',
    },
    {
      label: 'View Requests',
      description: 'Manage material requests',
      href: `/material-requests${projectQuery}`,
      icon: '📝',
      color: 'indigo',
      permission: 'view_material_requests',
      priority: 'medium',
    },
    {
      label: 'View Batches',
      description: 'View bulk request batches',
      href: '/material-requests/batches',
      icon: '📋',
      color: 'teal',
      permission: 'view_bulk_material_requests',
      priority: 'low',
    },
  ];

  const filteredActions = actions.filter(action => 
    !action.permission || canAccess(action.permission)
  );

  // Separate actions by priority
  const highPriorityActions = filteredActions.filter(a => a.priority === 'high');
  const otherActions = filteredActions.filter(a => a.priority !== 'high');

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-400/60 ds-text-accent-primary hover:border-blue-400/60',
      green: 'bg-green-500/10 hover:bg-green-500/20 border-green-400/60 text-emerald-200 hover:border-green-400/60',
      purple: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-400/60 text-purple-200 hover:border-purple-400/60',
      indigo: 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-400/60 text-indigo-200 hover:border-indigo-400/60',
      teal: 'bg-teal-500/10 hover:bg-teal-500/20 border-teal-400/60 text-teal-200 hover:border-teal-400/60',
      orange: 'bg-orange-500/10 hover:bg-orange-500/20 border-orange-400/60 text-orange-200 hover:border-orange-400/60',
    };
    return colors[color] || colors.blue;
  };

  const hasGuideContent = title || description || prerequisites.length > 0 || tip;
  const hasActions = filteredActions.length > 0;

  if (!hasGuideContent && !hasActions) {
    return null;
  }

  return (
    <div className="ds-bg-surface rounded-xl shadow-sm border ds-border-subtle mb-6 overflow-hidden">
      {/* Main Content Area */}
      <div className="p-5">
        {/* Quick Actions - Always Visible */}
        {hasActions && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 ds-text-accent-primary" />
                <h3 className="text-lg font-semibold ds-text-primary">Quick Actions</h3>
              </div>
              {hasGuideContent && (
                <button
                  onClick={() => setIsGuideExpanded(!isGuideExpanded)}
                  className="flex items-center gap-1.5 text-sm ds-text-secondary hover:ds-text-primary transition-colors px-2 py-1 rounded-md hover:ds-bg-surface-muted"
                >
                  {isGuideExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      <span className="hidden sm:inline">Hide Guide</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      <span className="hidden sm:inline">Show Guide</span>
                    </>
                  )}
                </button>
              )}
            </div>
            
            {/* High Priority Actions - Always Visible */}
            {highPriorityActions.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                {highPriorityActions.map((action, index) => (
                  <Link
                    key={index}
                    href={action.href}
                    className={`rounded-lg border-2 p-3.5 transition-all hover:shadow-lg hover:scale-[1.02] ${getColorClasses(action.color)}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{action.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm leading-tight mb-0.5 ds-text-primary">{action.label}</h4>
                        <p className="text-xs ds-text-secondary leading-tight">{action.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Other Actions - Show More/Less */}
            {otherActions.length > 0 && (
              <>
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 transition-all ${showAllActions ? 'block' : 'hidden'}`}>
                  {otherActions.map((action, index) => (
                    <Link
                      key={index}
                      href={action.href}
                      className={`rounded-lg border-2 p-3.5 transition-all hover:shadow-lg hover:scale-[1.02] ${getColorClasses(action.color)}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">{action.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm leading-tight mb-0.5">{action.label}</h4>
                          <p className="text-xs opacity-75 leading-tight">{action.description}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                <button
                  onClick={() => setShowAllActions(!showAllActions)}
                  className="mt-2 text-sm ds-text-secondary hover:ds-text-primary font-medium transition-colors flex items-center gap-1"
                >
                  {showAllActions ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      <span>Show Less</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      <span>Show More Actions ({otherActions.length})</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {/* Guide Section - Collapsible */}
        {hasGuideContent && (
          <div className={`border-t ds-border-subtle pt-4 transition-all ${!isGuideExpanded ? 'hidden' : 'block'}`}>
            <div className="ds-bg-accent-subtle rounded-lg p-4 border ds-border-accent-subtle">
              <div className="flex items-start gap-2.5 mb-3">
                <Info className="w-5 h-5 ds-text-accent-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  {title && (
                    <h4 className="text-base font-semibold ds-text-primary mb-1.5">{title}</h4>
                  )}
                  {description && (
                    <p className="text-sm ds-text-secondary leading-relaxed">{description}</p>
                  )}
                </div>
              </div>

              {/* Prerequisites */}
              {prerequisites.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 ds-text-accent-primary" />
                    <p className="text-xs font-semibold uppercase tracking-wide ds-text-secondary">
                      Prerequisites
                    </p>
                  </div>
                  <ul className="space-y-1.5 ml-6">
                    {prerequisites.map((item, index) => (
                      <li key={index} className="text-sm ds-text-secondary flex items-start gap-2">
                        <span className="ds-text-accent-primary mt-1 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tip */}
              {tip && (
                <div className="ds-bg-accent-subtle border ds-border-accent-subtle rounded-lg p-3 mt-3">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 ds-text-accent-primary flex-shrink-0 mt-0.5" />
                    <p className="text-xs ds-text-accent-primary leading-relaxed">
                      <span className="font-semibold">💡 Tip:</span> {tip}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
