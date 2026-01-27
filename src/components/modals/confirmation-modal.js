/**
 * Confirmation Modal Component
 * 
 * A modern, accessible confirmation dialog component
 * Replaces browser confirm() with a beautiful custom modal
 * 
 * Features:
 * - Beautiful, modern UI with animations
 * - Accessible (keyboard navigation, focus management)
 * - Customizable title, message, and button text
 * - Support for different variants (danger, warning, info)
 * - Loading states
 * - Escape key and backdrop click to close
 */

'use client';

import { useEffect, useRef } from 'react';
import { LoadingSpinner } from '@/components/loading';
import { BaseModal } from './BaseModal';

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  onArchive, // New: Archive action handler
  onDelete, // New: Delete action handler
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  archiveLabel = 'Archive', // New: Archive button label
  deleteLabel = 'Delete Permanently', // New: Delete button label
  variant = 'default', // 'default', 'danger', 'warning', 'info', 'both'
  isLoading = false,
  isArchiving = false, // New: Archive loading state
  isDeleting = false, // New: Delete loading state
  actionsDisabled = false, // New: Disable actions while loading context
  actionsDisabledReason = '', // New: Explain why actions are disabled
  showIcon = true,
  showRecommendation = false, // New: Show recommendation banner
  financialImpact = null, // New: { totalUsed, totalInvested, capitalBalance }
  dependencies = null, // New: dependency map (counts by entity type)
  size = 'md', // New: 'sm', 'md', 'lg', 'xl', 'full' - controls modal max width
  children, // Custom content (form fields, etc.) to render between message and buttons
}) {
  const modalRef = useRef(null);
  const confirmButtonRef = useRef(null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Variant styles
  const variantStyles = {
    default: {
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      confirmBg: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      borderColor: 'border-blue-200',
    },
    danger: {
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      confirmBg: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      borderColor: 'border-red-200',
    },
    warning: {
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      confirmBg: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
      borderColor: 'border-yellow-200',
    },
    info: {
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      confirmBg: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500',
      borderColor: 'border-indigo-200',
    },
  };

  const styles = variantStyles[variant === 'both' ? 'danger' : variant] || variantStyles.default;
  
  // Determine if we're showing both actions
  const showBothActions = variant === 'both' && onArchive && onDelete;

  // Get variant for BaseModal
  const modalVariant = variant === 'danger' ? 'red' : variant === 'warning' ? 'yellow' : variant === 'info' ? 'indigo' : 'blue';

  // Calculate overall loading state
  const overallLoading = isLoading || isArchiving || isDeleting;

  // Determine loading message based on operation
  const getLoadingMessage = () => {
    if (isDeleting) return 'Deleting...';
    if (isArchiving) return 'Archiving...';
    if (isLoading) return 'Processing...';
    return 'Processing...';
  };

  const loadingMessage = overallLoading ? getLoadingMessage() : '';

  const dependencyLabelMap = {
    materials: 'Materials',
    expenses: 'Expenses',
    initialExpenses: 'Initial expenses',
    floors: 'Floors',
    phases: 'Phases',
    workItems: 'Work items',
    labourEntries: 'Labour entries',
    labourBatches: 'Labour batches',
    labourCostSummaries: 'Labour summaries',
    materialRequests: 'Material requests',
    materialRequestBatches: 'Request batches',
    purchaseOrders: 'Purchase orders',
    equipment: 'Equipment',
    subcontractors: 'Subcontractors',
    professionalServices: 'Professional services',
    professionalFees: 'Professional fees',
    professionalActivities: 'Professional activities',
    siteReports: 'Site reports',
    supervisorSubmissions: 'Supervisor submissions',
    budgetReallocations: 'Budget reallocations',
    budgetAdjustments: 'Budget adjustments',
    budgetTransfers: 'Budget transfers',
    contingencyDraws: 'Contingency draws',
    approvals: 'Approvals',
    projectMemberships: 'Project team',
    projectTeams: 'Project teams',
    notifications: 'Notifications',
    auditLogs: 'Audit logs',
    investorAllocations: 'Investor allocations',
  };

  const normalizeDependencies = (deps) => {
    if (!deps) return null;
    const normalized = { ...deps };
    if (normalized.allocations && !normalized.investorAllocations) {
      normalized.investorAllocations = normalized.allocations;
    }
    delete normalized.allocations;
    return normalized;
  };

  const normalizedDependencies = normalizeDependencies(dependencies);
  const dependencyEntries = normalizedDependencies
    ? Object.entries(normalizedDependencies)
        .filter(([, value]) => typeof value === 'number' && value > 0)
        .map(([key, value]) => ({
          key,
          label: dependencyLabelMap[key] || key,
          count: value,
        }))
    : [];

  const dependencyPriority = [
    'materials',
    'expenses',
    'initialExpenses',
    'purchaseOrders',
    'materialRequests',
    'phases',
    'floors',
    'labourEntries',
    'workItems',
    'professionalServices',
    'equipment',
    'subcontractors',
    'investorAllocations',
  ];

  const sortedDependencies = dependencyEntries.sort((a, b) => {
    const aIndex = dependencyPriority.indexOf(a.key);
    const bIndex = dependencyPriority.indexOf(b.key);
    if (aIndex !== -1 || bIndex !== -1) {
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      if (aIndex !== bIndex) return aIndex - bIndex;
    }
    return b.count - a.count;
  });

  const maxVisibleDependencies = 6;
  const visibleDependencies = sortedDependencies.slice(0, maxVisibleDependencies);
  const hiddenDependencyCount = Math.max(0, sortedDependencies.length - visibleDependencies.length);
  const totalDependencyRecords = sortedDependencies.reduce((sum, entry) => sum + entry.count, 0);

  // Map size prop to maxWidth classes
  const sizeMap = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
    full: 'max-w-[95vw]',
  };
  const maxWidth = sizeMap[size] || sizeMap.md;

  // Icon component with modern gradient styling
  const Icon = () => {
    if (!showIcon) return null;

    const iconSize = 'w-7 h-7';
    
    if (variant === 'danger') {
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-red-400 to-red-600 rounded-full blur-sm opacity-50" />
          <svg className={`relative ${iconSize} text-red-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      );
    }
    
    if (variant === 'warning') {
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full blur-sm opacity-50" />
          <svg className={`relative ${iconSize} text-yellow-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      );
    }
    
    if (variant === 'info') {
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-600 rounded-full blur-sm opacity-50" />
          <svg className={`relative ${iconSize} text-indigo-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    }
    
    // Default (question mark)
    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full blur-sm opacity-50" />
        <svg className={`relative ${iconSize} text-blue-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    );
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={maxWidth}
      closeOnBackdrop={!overallLoading}
      closeOnEscape={!overallLoading}
      variant={modalVariant}
      isLoading={overallLoading}
      loadingMessage={loadingMessage}
      preventCloseDuringLoading={true}
    >
      {/* Modal content - scrollable for large content */}
      <div className={`flex flex-col ${size === 'full' || size === '2xl' || size === 'xl' ? 'max-h-[90vh]' : ''}`}>
        {/* Header Section - Sticky on large modals */}
        <div className={`${size === 'full' || size === '2xl' || size === 'xl' ? 'sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-200/50' : ''}`}>
          <div className={`${size === 'full' || size === '2xl' || size === 'xl' ? 'p-6' : 'p-8'}`}>
        {/* Icon and Title */}
        <div className="flex flex-col items-center text-center mb-6">
          {showIcon && (
            <div className="flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-white/60 to-white/40 backdrop-blur-sm mb-4 border border-white/30 shadow-lg">
              <Icon />
            </div>
          )}
          
          <h3
            className="text-2xl font-bold leading-7 text-gray-900 mb-3"
            id="modal-title"
          >
            {title}
          </h3>
          <div className="mt-2">
            {typeof message === 'string' ? (
              <p className="text-sm font-medium text-gray-700 whitespace-pre-line leading-relaxed">
                {message}
              </p>
            ) : (
              <div className="text-sm font-medium text-gray-700">
                {message}
              </div>
            )}
            
            {/* Recommendation Banner */}
            {showRecommendation && showBothActions && (
              <div className="mt-5 p-4 bg-gradient-to-br from-yellow-50/80 to-orange-50/80 backdrop-blur-sm border border-yellow-200/50 rounded-xl shadow-lg">
                <div className="flex items-start">
                  <div className="flex-shrink-0 p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg mr-3">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-yellow-900">
                      We strongly recommend archiving instead
                    </p>
                    <p className="text-xs text-yellow-800 mt-1 leading-relaxed">
                      Archiving preserves all financial records and allows you to restore the item later. Permanent deletion is irreversible.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {actionsDisabled && actionsDisabledReason && (
              <p className="mt-3 text-xs text-gray-500 flex items-center gap-2">
                <span className="h-3 w-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                {actionsDisabledReason}
              </p>
            )}
            
            {/* Financial Impact Summary */}
            {financialImpact && (
              <div className="mt-5 p-4 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 backdrop-blur-sm border border-blue-200/50 rounded-xl shadow-lg">
                <p className="text-xs font-semibold text-blue-900 mb-3 uppercase tracking-wide">Financial Impact:</p>
                <div className="space-y-2 text-sm text-blue-800">
                  <div className="flex justify-between items-center py-1 border-b border-blue-200/30">
                    <span className="font-medium">Total Used:</span>
                    <span className="font-bold text-blue-900">KES {financialImpact.totalUsed?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-blue-200/30">
                    <span className="font-medium">Total Invested:</span>
                    <span className="font-bold text-blue-900">KES {financialImpact.totalInvested?.toLocaleString() || 0}</span>
                  </div>
                  {financialImpact.capitalBalance !== undefined && (
                    <div className="flex justify-between items-center py-1">
                      <span className="font-medium">Unused Capital:</span>
                      <span className="font-bold text-blue-900">KES {financialImpact.capitalBalance.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Dependencies Summary */}
            {dependencies && (
              <div className="mt-5 p-4 bg-gradient-to-br from-gray-50/80 to-gray-100/80 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-lg">
                <p className="text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">Impact overview</p>
                {sortedDependencies.length > 0 ? (
                  <>
                    <p className="text-sm text-gray-700 mb-3">
                      About <span className="font-semibold text-gray-900">{totalDependencyRecords.toLocaleString()}</span> records across{' '}
                      <span className="font-semibold text-gray-900">{sortedDependencies.length}</span> areas will be affected.
                    </p>
                    <div className="flex flex-wrap gap-2 text-sm text-gray-700">
                      {visibleDependencies.map((entry) => (
                        <span
                          key={entry.key}
                          className="inline-flex items-center gap-2 rounded-full border border-gray-200/60 bg-white/80 px-3 py-1 shadow-sm"
                        >
                          <span className="font-semibold text-gray-900">{entry.count.toLocaleString()}</span>
                          <span>{entry.label}</span>
                        </span>
                      ))}
                    </div>
                    {hiddenDependencyCount > 0 && (
                      <p className="text-xs text-gray-500 mt-3">
                        Plus {hiddenDependencyCount} more record type{hiddenDependencyCount === 1 ? '' : 's'}.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-600">
                    No linked records found for this project.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
          </div>
        </div>
        {/* End of Header Section */}
        
        {/* Custom Content (children) - Form fields, additional inputs, etc. - Scrollable */}
        {children && (
          <div className={`flex-1 overflow-y-auto ${size === 'full' || size === '2xl' || size === 'xl' ? 'px-6' : 'px-8'} ${size === 'full' || size === '2xl' || size === 'xl' ? 'pb-4' : 'mt-6'}`}>
            {children}
          </div>
        )}

        {/* Actions - Sticky footer on large modals */}
        <div className={`${size === 'full' || size === '2xl' || size === 'xl' ? 'sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-gray-200/50' : ''} ${size === 'full' || size === '2xl' || size === 'xl' ? 'p-6' : 'p-8'} ${size === 'full' || size === '2xl' || size === 'xl' ? 'mt-0' : 'mt-8'} pt-6 border-t border-gray-200/50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3`}>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading || isArchiving || isDeleting}
            className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-gray-700 bg-white/60 backdrop-blur-sm border border-gray-300/50 rounded-xl hover:bg-white/80 hover:border-gray-400/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
          >
            {cancelText}
          </button>
          
          {showBothActions ? (
            <>
              {/* Archive Button (Primary/Recommended) */}
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={onArchive}
                disabled={actionsDisabled || isLoading || isArchiving || isDeleting}
                className="relative w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 active:scale-100"
              >
                {isArchiving ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner size="sm" />
                    Archiving...
                  </span>
                ) : (
                  archiveLabel
                )}
              </button>
              
              {/* Delete Button (Danger) */}
              <button
                type="button"
                onClick={onDelete}
                disabled={actionsDisabled || isLoading || isArchiving || isDeleting}
                className="relative w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 rounded-xl hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 hover:scale-105 active:scale-100"
              >
                {isDeleting ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner size="sm" />
                    Deleting...
                  </span>
                ) : (
                  deleteLabel
                )}
              </button>
            </>
          ) : (
            <button
              ref={confirmButtonRef}
              type="button"
              onClick={onConfirm}
              disabled={actionsDisabled || isLoading || isArchiving || isDeleting}
              className={`relative w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 active:scale-100 ${
                variant === 'danger'
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-500/30 hover:shadow-red-500/40 focus:ring-red-500'
                  : variant === 'warning'
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 shadow-yellow-500/30 hover:shadow-yellow-500/40 focus:ring-yellow-500'
                  : variant === 'info'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-indigo-500/30 hover:shadow-indigo-500/40 focus:ring-indigo-500'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/30 hover:shadow-blue-500/40 focus:ring-blue-500'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" />
                  Processing...
                </span>
              ) : (
                confirmText
              )}
            </button>
          )}
        </div>
      </div>
    </BaseModal>
  );
}

