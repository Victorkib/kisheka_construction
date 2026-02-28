/**
 * Workflow Guide Component
 * Visual representation of the workflow from project creation to material procurement
 * Shows current step and allows navigation between steps
 */

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Workflow steps definition
 */
const WORKFLOW_STEPS = [
  {
    id: 'project',
    label: 'Create Project',
    description: 'Set up project with budget and details',
    href: '/projects/new',
    icon: '🏗️',
    color: 'blue',
  },
  {
    id: 'financing',
    label: 'Allocate Capital',
    description: 'Add investors and allocate capital',
    href: '/financing',
    icon: '💰',
    color: 'green',
  },
  {
    id: 'floors',
    label: 'Create Floors',
    description: 'Set up project floors (usually auto-created)',
    href: '/floors',
    icon: '🏢',
    color: 'purple',
  },
  {
    id: 'material-request',
    label: 'Material Request',
    description: 'Create material request for approval',
    href: '/material-requests/new',
    icon: '📦',
    color: 'orange',
  },
  {
    id: 'approval',
    label: 'Approval',
    description: 'Get material request approved',
    href: '/dashboard/approvals',
    icon: '✅',
    color: 'yellow',
  },
  {
    id: 'purchase-order',
    label: 'Purchase Order',
    description: 'Create purchase order from approved request',
    href: '/purchase-orders/new',
    icon: '🛒',
    color: 'indigo',
  },
  {
    id: 'material',
    label: 'Receive Material',
    description: 'Mark materials as received',
    href: '/materials',
    icon: '📥',
    color: 'pink',
  },
];

/**
 * Determine current workflow step from pathname
 */
function getCurrentStep(pathname, searchParams) {
  // Project creation
  if (pathname === '/projects/new') return 'project';
  if (pathname.match(/^\/projects\/[^/]+$/)) return 'project';
  
  // Financing
  if (pathname === '/financing') return 'financing';
  
  // Floors
  if (pathname === '/floors/new' || pathname === '/floors') return 'floors';
  
  // Material request
  if (pathname === '/material-requests/new') return 'material-request';
  if (pathname.match(/^\/material-requests\/[^/]+$/)) return 'material-request';
  
  // Approval
  if (pathname === '/dashboard/approvals') return 'approval';
  
  // Purchase order
  if (pathname === '/purchase-orders/new') return 'purchase-order';
  if (pathname.match(/^\/purchase-orders\/[^/]+$/)) return 'purchase-order';
  
  // Materials
  if (pathname === '/materials' || pathname === '/items') return 'material';
  
  return null;
}

/**
 * Workflow Guide Component
 * @param {Object} props
 * @param {string} [props.currentStep] - Override current step ID
 * @param {string} [props.projectId] - Project ID for contextual links
 * @param {boolean} [props.compact=false] - Show compact version
 */
export function WorkflowGuide({ currentStep: overrideStep, projectId, compact = false }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const currentStepId = overrideStep || getCurrentStep(pathname, searchParams);
  const currentStepIndex = WORKFLOW_STEPS.findIndex(step => step.id === currentStepId);

  const getStepHref = (step) => {
    if (projectId && step.href.includes('?')) {
      return `${step.href}?projectId=${projectId}`;
    }
    if (projectId && step.href === '/projects/new') {
      return `/projects/${projectId}`;
    }
    if (projectId && step.href === '/material-requests/new') {
      return `/material-requests/new?projectId=${projectId}`;
    }
    if (projectId && step.href === '/purchase-orders/new') {
      return `/purchase-orders/new?projectId=${projectId}`;
    }
    return step.href;
  };

  const getColorClasses = (color, isActive, isCompleted, isUpcoming) => {
    const baseColors = {
      blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-400/60',
        text: 'text-blue-700',
        active: 'bg-blue-100 border-blue-400 text-blue-900',
        completed: 'bg-blue-50 border-blue-400/60 text-blue-800',
        upcoming: 'ds-bg-surface-muted ds-border-subtle ds-text-muted',
      },
      green: {
        bg: 'bg-green-50',
        border: 'border-green-400/60',
        text: 'text-green-700',
        active: 'bg-green-100 border-green-400 text-green-900',
        completed: 'bg-green-50 border-green-400/60 text-green-800',
        upcoming: 'ds-bg-surface-muted ds-border-subtle ds-text-muted',
      },
      purple: {
        bg: 'bg-purple-50',
        border: 'border-purple-400/60',
        text: 'text-purple-700',
        active: 'bg-purple-100 border-purple-400 text-purple-900',
        completed: 'bg-purple-50 border-purple-400/60 text-purple-800',
        upcoming: 'ds-bg-surface-muted ds-border-subtle ds-text-muted',
      },
      orange: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-700',
        active: 'bg-orange-100 border-orange-400 text-orange-900',
        completed: 'bg-orange-50 border-orange-300 text-orange-800',
        upcoming: 'ds-bg-surface-muted ds-border-subtle ds-text-muted',
      },
      yellow: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-400/60',
        text: 'text-yellow-700',
        active: 'bg-yellow-100 border-yellow-400 text-yellow-900',
        completed: 'bg-yellow-50 border-yellow-400/60 text-yellow-800',
        upcoming: 'ds-bg-surface-muted ds-border-subtle ds-text-muted',
      },
      indigo: {
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        text: 'text-indigo-700',
        active: 'bg-indigo-100 border-indigo-400 text-indigo-900',
        completed: 'bg-indigo-50 border-indigo-300 text-indigo-800',
        upcoming: 'ds-bg-surface-muted ds-border-subtle ds-text-muted',
      },
      pink: {
        bg: 'bg-pink-50',
        border: 'border-pink-200',
        text: 'text-pink-700',
        active: 'bg-pink-100 border-pink-400 text-pink-900',
        completed: 'bg-pink-50 border-pink-300 text-pink-800',
        upcoming: 'ds-bg-surface-muted ds-border-subtle ds-text-muted',
      },
    };

    const colors = baseColors[color] || baseColors.blue;
    
    if (isActive) return `${colors.active} border-2 font-semibold`;
    if (isCompleted) return `${colors.completed} border hover:${colors.active}`;
    if (isUpcoming) return `${colors.upcoming} border`;
    return `${colors.bg} ${colors.border} ${colors.text} border hover:${colors.active}`;
  };

  if (compact) {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-4 mb-6">
        <h3 className="text-sm font-semibold ds-text-primary mb-3">Workflow</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {WORKFLOW_STEPS.map((step, index) => {
            const isActive = step.id === currentStepId;
            const isCompleted = currentStepIndex !== -1 && index < currentStepIndex;
            const isUpcoming = currentStepIndex !== -1 && index > currentStepIndex;
            
            return (
              <div key={step.id} className="flex items-center flex-shrink-0">
                <Link
                  href={getStepHref(step)}
                  className={`px-3 py-2 rounded-lg border text-xs transition ${getColorClasses(step.color, isActive, isCompleted, isUpcoming)}`}
                >
                  <span className="mr-1">{step.icon}</span>
                  <span>{step.label}</span>
                </Link>
                {index < WORKFLOW_STEPS.length - 1 && (
                  <svg className="w-4 h-4 ds-text-muted mx-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="ds-bg-surface rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold ds-text-primary">Workflow Guide</h2>
        <span className="text-sm ds-text-muted">
          Step {currentStepIndex !== -1 ? currentStepIndex + 1 : '?'} of {WORKFLOW_STEPS.length}
        </span>
      </div>
      
      <div className="space-y-3">
        {WORKFLOW_STEPS.map((step, index) => {
          const isActive = step.id === currentStepId;
          const isCompleted = currentStepIndex !== -1 && index < currentStepIndex;
          const isUpcoming = currentStepIndex !== -1 && index > currentStepIndex;
          
          return (
            <div key={step.id} className="flex items-start gap-4">
              {/* Step Number/Icon */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                isActive 
                  ? 'bg-blue-100 border-blue-500 text-blue-900' 
                  : isCompleted
                    ? 'bg-green-100 border-green-500 text-green-900'
                    : isUpcoming
                      ? 'ds-bg-surface-muted ds-border-subtle ds-text-muted'
                      : 'ds-bg-surface-muted ds-border-subtle ds-text-muted'
              }`}>
                {isCompleted ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-lg">{step.icon}</span>
                )}
              </div>
              
              {/* Step Content */}
              <div className="flex-1">
                <Link
                  href={getStepHref(step)}
                  className={`block p-4 rounded-lg border-2 transition ${
                    isActive
                      ? 'bg-blue-50 border-blue-400 shadow-md'
                      : isCompleted
                        ? 'bg-green-50 border-green-400/60 hover:bg-green-100'
                        : isUpcoming
                          ? 'ds-bg-surface-muted ds-border-subtle opacity-60'
                          : 'ds-bg-surface ds-border-subtle hover:ds-bg-surface-muted'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`font-semibold ${
                        isActive ? 'text-blue-900' : isCompleted ? 'text-green-900' : 'ds-text-secondary'
                      }`}>
                        {step.label}
                      </h3>
                      <p className={`text-sm mt-1 ${
                        isActive ? 'text-blue-700' : isCompleted ? 'text-green-700' : 'ds-text-secondary'
                      }`}>
                        {step.description}
                      </p>
                    </div>
                    {isActive && (
                      <span className="px-2 py-1 text-xs font-semibold bg-blue-600 text-white rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Help Text */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-400/60 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Follow the workflow steps in order. Each step builds on the previous one. 
          {currentStepId && currentStepIndex !== -1 && currentStepIndex < WORKFLOW_STEPS.length - 1 && (
            <> Next: <strong>{WORKFLOW_STEPS[currentStepIndex + 1].label}</strong></>
          )}
        </p>
      </div>
    </div>
  );
}

