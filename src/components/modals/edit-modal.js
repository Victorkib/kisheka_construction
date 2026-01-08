/**
 * Edit Modal Component
 * 
 * A reusable modal component for editing entities with:
 * - Form validation
 * - Unsaved changes warning
 * - Loading states
 * - Success/error feedback
 * 
 * @component
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { LoadingSpinner } from '@/components/loading';
import { BaseModal } from './BaseModal';

export function EditModal({
  isOpen,
  onClose,
  onSave,
  title = 'Edit',
  children,
  isLoading = false,
  hasUnsavedChanges = false,
  showRoleChangeWarning = false,
  showBudgetChangeWarning = false,
  maxWidth = 'max-w-2xl',
}) {
  const modalRef = useRef(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        handleCloseAttempt();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, hasUnsavedChanges]);

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

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges && !isLoading) {
      setShowUnsavedWarning(true);
      setPendingClose(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowUnsavedWarning(false);
    setPendingClose(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowUnsavedWarning(false);
    setPendingClose(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <BaseModal
        isOpen={isOpen}
        onClose={handleCloseAttempt}
        maxWidth={maxWidth}
        closeOnBackdrop={!isLoading && !hasUnsavedChanges}
        closeOnEscape={!isLoading}
        variant="blue"
        showCloseButton={true}
        isLoading={isLoading}
        loadingMessage="Saving changes..."
        preventCloseDuringLoading={true}
      >
        {/* Modal header */}
        <div className="px-8 py-6 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            <h3
              className="text-2xl font-bold leading-7 text-gray-900"
              id="modal-title"
            >
              {title}
            </h3>
          </div>
        </div>

        {/* Warnings */}
        {showRoleChangeWarning && (
          <div className="px-8 py-4 bg-gradient-to-br from-yellow-50/80 to-orange-50/80 backdrop-blur-sm border-b border-yellow-200/50">
            <div className="flex items-start">
              <div className="flex-shrink-0 p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg mr-3">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-sm text-yellow-900 leading-relaxed">
                <strong className="font-semibold">Warning:</strong> Changing the user's role will affect their permissions and access to system features. This action will be logged in the audit trail.
              </p>
            </div>
          </div>
        )}

        {showBudgetChangeWarning && (
          <div className="px-8 py-4 bg-gradient-to-br from-yellow-50/80 to-orange-50/80 backdrop-blur-sm border-b border-yellow-200/50">
            <div className="flex items-start">
              <div className="flex-shrink-0 p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg mr-3">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-sm text-yellow-900 leading-relaxed">
                <strong className="font-semibold">Warning:</strong> Changing the project budget will affect financial calculations, spending limits, and investor allocations. This action will be logged in the audit trail.
              </p>
            </div>
          </div>
        )}

        {/* Modal content */}
        <div className={`px-8 py-6 max-h-[calc(100vh-300px)] overflow-y-auto ${isLoading ? 'pointer-events-none opacity-60' : ''}`}>
          {/* Disable all form fields during save */}
          <div className={isLoading ? 'pointer-events-none' : ''}>
            {children}
          </div>
        </div>

        {/* Modal footer */}
        <div className="px-8 py-6 border-t border-gray-200/50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 bg-gradient-to-br from-gray-50/50 to-transparent">
          <button
            type="button"
            onClick={handleCloseAttempt}
            disabled={isLoading}
            className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-gray-700 bg-white/60 backdrop-blur-sm border border-gray-300/50 rounded-xl hover:bg-white/80 hover:border-gray-400/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isLoading}
            className="relative w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 active:scale-100"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner size="sm" />
                Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </BaseModal>

      {/* Unsaved Changes Warning Modal */}
      {showUnsavedWarning && (
        <BaseModal
          isOpen={showUnsavedWarning}
          onClose={handleCancelClose}
          maxWidth="max-w-md"
          variant="yellow"
        >
          <div className="p-8">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-yellow-50/60 to-orange-50/40 backdrop-blur-sm mb-4 border border-yellow-200/30 shadow-lg">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full blur-sm opacity-50" />
                  <svg className="relative w-7 h-7 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold leading-7 text-gray-900 mb-3" id="warning-title">
                Unsaved Changes
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                You have unsaved changes. Are you sure you want to close without saving?
              </p>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-200/50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelClose}
                className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-gray-700 bg-white/60 backdrop-blur-sm border border-gray-300/50 rounded-xl hover:bg-white/80 hover:border-gray-400/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                className="relative w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl hover:from-yellow-600 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-all duration-200 shadow-lg shadow-yellow-500/30 hover:shadow-xl hover:shadow-yellow-500/40 hover:scale-105 active:scale-100"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </BaseModal>
      )}
    </>
  );
}

