/**
 * Restore Modal Component
 * 
 * Confirmation modal for restoring archived items
 * Similar to ConfirmationModal but specifically for restore actions
 */

'use client';

import { useEffect, useRef } from 'react';
import { LoadingSpinner } from '@/components/loading';
import { BaseModal } from './BaseModal';

export function RestoreModal({
  isOpen,
  onClose,
  onRestore,
  title = 'Restore Item',
  message = 'Are you sure you want to restore this item?',
  restoreText = 'Restore',
  cancelText = 'Cancel',
  isLoading = false,
  itemName = null,
}) {
  const modalRef = useRef(null);
  const restoreButtonRef = useRef(null);

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
    if (isOpen && restoreButtonRef.current) {
      setTimeout(() => {
        restoreButtonRef.current?.focus();
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

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      closeOnBackdrop={!isLoading}
      closeOnEscape={!isLoading}
      variant="green"
      isLoading={isLoading}
      loadingMessage="Restoring..."
      preventCloseDuringLoading={true}
    >
      {/* Modal content */}
      <div className="p-8">
        {/* Icon and Title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-green-50/60 to-emerald-50/40 backdrop-blur-sm mb-4 border border-green-200/30 shadow-lg">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full blur-sm opacity-50" />
              <svg
                className="relative w-7 h-7 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
          </div>
          
          <h3
            className="text-2xl font-bold leading-7 text-gray-900 mb-3"
            id="modal-title"
          >
            {title}
          </h3>
          <div className="mt-2">
            {typeof message === 'string' ? (
              <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                {message}
              </p>
            ) : (
              <div className="text-sm text-gray-600">
                {message}
              </div>
            )}
            {itemName && (
              <p className="mt-3 text-sm font-semibold text-gray-900 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-2 rounded-lg border border-green-200/50">
                {itemName}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 pt-6 border-t border-gray-200/50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-gray-700 bg-white/60 backdrop-blur-sm border border-gray-300/50 rounded-xl hover:bg-white/80 hover:border-gray-400/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
          >
            {cancelText}
          </button>
          <button
            ref={restoreButtonRef}
            type="button"
            onClick={onRestore}
            disabled={isLoading}
            className="relative w-full sm:w-auto px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 hover:scale-105 active:scale-100"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner size="sm" />
                Restoring...
              </span>
            ) : (
              restoreText
            )}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

