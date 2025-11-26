/**
 * Restore Modal Component
 * 
 * Confirmation modal for restoring archived items
 * Similar to ConfirmationModal but specifically for restore actions
 */

'use client';

import { useEffect, useRef } from 'react';
import { LoadingSpinner } from '@/components/loading';

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
              <div className="flex-shrink-0 mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
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
                {itemName && (
                  <p className="mt-2 text-sm font-medium text-gray-900">
                    {itemName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-green-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {cancelText}
            </button>
            <button
              ref={restoreButtonRef}
              type="button"
              onClick={onRestore}
              disabled={isLoading}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      </div>
    </div>
  );
}

