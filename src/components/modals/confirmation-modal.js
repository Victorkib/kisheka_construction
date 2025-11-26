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
  showIcon = true,
  showRecommendation = false, // New: Show recommendation banner
  financialImpact = null, // New: { totalUsed, totalInvested, capitalBalance }
  dependencies = null, // New: { materials, expenses, initialExpenses, floors, allocations }
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
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
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

  // Icon component
  const Icon = () => {
    if (!showIcon) return null;

    const iconClass = `w-6 h-6 ${styles.iconColor}`;
    
    if (variant === 'danger') {
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
    
    if (variant === 'warning') {
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
    
    if (variant === 'info') {
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    
    // Default (question mark)
    return (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Modal container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={modalRef}
          className="relative bg-white rounded-lg shadow-xl max-w-md w-full transform transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal content */}
          <div className="p-6">
            {/* Icon and Title */}
            <div className="flex items-start">
              {showIcon && (
                <div className={`flex-shrink-0 mx-auto flex items-center justify-center h-12 w-12 rounded-full ${styles.iconBg} mb-4`}>
                  <Icon />
                </div>
              )}
            </div>
            
            <div className="mt-3 text-center sm:mt-0 sm:text-left">
              <h3
                className="text-lg font-semibold leading-6 text-gray-900 mb-2"
                id="modal-title"
              >
                {title}
              </h3>
              <div className="mt-2">
                {typeof message === 'string' ? (
                  <p className="text-sm text-gray-500 whitespace-pre-line">
                    {message}
                  </p>
                ) : (
                  <div className="text-sm text-gray-500">
                    {message}
                  </div>
                )}
                
                {/* Recommendation Banner */}
                {showRecommendation && showBothActions && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800">
                          We strongly recommend archiving instead
                        </p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Archiving preserves all financial records and allows you to restore the item later. Permanent deletion is irreversible.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Financial Impact Summary */}
                {financialImpact && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-medium text-blue-800 mb-2">Financial Impact:</p>
                    <div className="space-y-1 text-xs text-blue-700">
                      <div className="flex justify-between">
                        <span>Total Used:</span>
                        <span className="font-medium">KES {financialImpact.totalUsed?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Invested:</span>
                        <span className="font-medium">KES {financialImpact.totalInvested?.toLocaleString() || 0}</span>
                      </div>
                      {financialImpact.capitalBalance !== undefined && (
                        <div className="flex justify-between">
                          <span>Unused Capital:</span>
                          <span className="font-medium">KES {financialImpact.capitalBalance.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Dependencies Summary */}
                {dependencies && (
                  <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs font-medium text-gray-800 mb-2">This will affect:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                      {dependencies.materials > 0 && (
                        <div>{dependencies.materials} material(s)</div>
                      )}
                      {dependencies.expenses > 0 && (
                        <div>{dependencies.expenses} expense(s)</div>
                      )}
                      {dependencies.initialExpenses > 0 && (
                        <div>{dependencies.initialExpenses} initial expense(s)</div>
                      )}
                      {dependencies.floors > 0 && (
                        <div>{dependencies.floors} floor(s)</div>
                      )}
                      {dependencies.allocations > 0 && (
                        <div>{dependencies.allocations} investor allocation(s)</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className={`bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t ${styles.borderColor}`}>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading || isArchiving || isDeleting}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  disabled={isLoading || isArchiving || isDeleting}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  disabled={isLoading || isArchiving || isDeleting}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                disabled={isLoading || isArchiving || isDeleting}
                className={`w-full sm:w-auto px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${styles.confirmBg}`}
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
      </div>
    </div>
  );
}

