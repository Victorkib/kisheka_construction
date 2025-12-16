/**
 * Base Modal Component
 * Foundation for all modals with glassmorphism design
 * 
 * Features:
 * - Glassmorphism (frosted glass effect)
 * - Smooth animations (entrance/exit)
 * - Backdrop blur
 * - Modern shadows with colored accents
 * - Consistent structure
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { ModalLoadingOverlay } from './ModalLoadingOverlay';

/**
 * Base Modal Component
 * @param {Object} props
 * @param {boolean} props.isOpen - Is modal open
 * @param {Function} props.onClose - Close handler
 * @param {React.ReactNode} props.children - Modal content
 * @param {string} props.maxWidth - Max width class (default: 'max-w-md')
 * @param {boolean} props.closeOnBackdrop - Close on backdrop click (default: true)
 * @param {boolean} props.closeOnEscape - Close on Escape key (default: true)
 * @param {string} props.variant - Color variant (blue, red, yellow, green, indigo)
 * @param {boolean} props.showCloseButton - Show close button (default: false)
 * @param {boolean} props.isLoading - Show loading overlay (default: false)
 * @param {string} props.loadingMessage - Loading message (default: 'Processing...')
 * @param {number} props.loadingProgress - Loading progress 0-100 (optional)
 * @param {boolean} props.preventCloseDuringLoading - Prevent close during loading (default: true)
 */
export function BaseModal({
  isOpen,
  onClose,
  children,
  maxWidth = 'max-w-md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  variant = 'blue',
  showCloseButton = false,
  isLoading = false,
  loadingMessage = 'Processing...',
  loadingProgress = null,
  preventCloseDuringLoading = true,
}) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const modalRef = useRef(null);
  const backdropRef = useRef(null);

  // Handle mount/unmount with animation
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Trigger animation after render
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsAnimating(false);
      // Remove from DOM after animation
      setTimeout(() => setShouldRender(false), 300);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    // Prevent closing during loading if preventCloseDuringLoading is true
    if (isLoading && preventCloseDuringLoading) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose, isLoading, preventCloseDuringLoading]);

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

  // Variant color mappings
  const variantStyles = {
    blue: {
      shadow: 'shadow-blue-500/20',
      glow: 'shadow-[0_0_30px_rgba(59,130,246,0.3)]',
      border: 'border-blue-200/30',
    },
    red: {
      shadow: 'shadow-red-500/20',
      glow: 'shadow-[0_0_30px_rgba(239,68,68,0.3)]',
      border: 'border-red-200/30',
    },
    yellow: {
      shadow: 'shadow-yellow-500/20',
      glow: 'shadow-[0_0_30px_rgba(234,179,8,0.3)]',
      border: 'border-yellow-200/30',
    },
    green: {
      shadow: 'shadow-green-500/20',
      glow: 'shadow-[0_0_30px_rgba(34,197,94,0.3)]',
      border: 'border-green-200/30',
    },
    indigo: {
      shadow: 'shadow-indigo-500/20',
      glow: 'shadow-[0_0_30px_rgba(99,102,241,0.3)]',
      border: 'border-indigo-200/30',
    },
  };

  const styles = variantStyles[variant] || variantStyles.blue;

  if (!shouldRender) return null;

  const handleBackdropClick = (e) => {
    // Prevent closing during loading if preventCloseDuringLoading is true
    if (isLoading && preventCloseDuringLoading) return;
    if (closeOnBackdrop && e.target === backdropRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={backdropRef}
      className={`fixed inset-0 z-50 overflow-y-auto transition-opacity duration-300 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleBackdropClick}
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Animated Backdrop with Blur */}
      <div
        className={`fixed inset-0 bg-gradient-to-br from-gray-900/60 via-gray-900/70 to-gray-900/80 backdrop-blur-sm transition-opacity duration-300 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={modalRef}
          className={`relative w-full ${maxWidth} transform transition-all duration-300 ${
            isAnimating
              ? 'scale-100 opacity-100 translate-y-0'
              : 'scale-95 opacity-0 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glassmorphism Modal */}
          <div
            className={`
              relative
              bg-white/80
              backdrop-blur-xl
              backdrop-saturate-150
              rounded-2xl
              border
              ${styles.border}
              ${styles.shadow}
              ${styles.glow}
              shadow-2xl
              overflow-hidden
            `}
          >
            {/* Gradient Overlay for Depth */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent pointer-events-none" />
            
            {/* Content Container */}
            <div className="relative">
              {children}
              
              {/* Loading Overlay */}
              {isLoading && (
                <ModalLoadingOverlay
                  isLoading={isLoading}
                  message={loadingMessage}
                  progress={loadingProgress}
                  variant={variant}
                />
              )}
            </div>

            {/* Close Button */}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/50 backdrop-blur-sm hover:bg-white/70 text-gray-500 hover:text-gray-700 transition-all duration-200 border border-white/20 hover:border-white/40"
                aria-label="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

