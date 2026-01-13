/**
 * Drawer Component
 * Slide-out panel component for detail views and forms
 * 
 * Features:
 * - Smooth slide animation from right
 * - Backdrop with blur
 * - Keyboard navigation (Escape to close)
 * - Loading overlay support
 * - Responsive width
 * - Mobile optimization
 * - Focus trap for accessibility
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoadingSpinner } from '@/components/loading';
import { X } from 'lucide-react';

/**
 * Drawer Component
 * @param {Object} props
 * @param {boolean} props.isOpen - Is drawer open
 * @param {Function} props.onClose - Close handler
 * @param {string} props.title - Drawer title
 * @param {React.ReactNode} props.children - Drawer content
 * @param {React.ReactNode} props.footer - Footer content (optional)
 * @param {boolean} props.isLoading - Show loading overlay (default: false)
 * @param {string} props.loadingMessage - Loading message (default: 'Loading...')
 * @param {string} props.size - Size variant: 'sm' | 'md' | 'lg' | 'xl' (default: 'lg')
 * @param {boolean} props.closeOnBackdrop - Close on backdrop click (default: true)
 * @param {boolean} props.closeOnEscape - Close on Escape key (default: true)
 * @param {boolean} props.preventCloseDuringLoading - Prevent close during loading (default: true)
 * @param {boolean} props.showCloseButton - Show close button in header (default: true)
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  footer = null,
  isLoading = false,
  loadingMessage = 'Loading...',
  size = 'lg',
  closeOnBackdrop = true,
  closeOnEscape = true,
  preventCloseDuringLoading = true,
  showCloseButton = true,
}) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [mounted, setMounted] = useState(false);
  const drawerRef = useRef(null);
  const backdropRef = useRef(null);
  const previousActiveElementRef = useRef(null);

  // Handle mount/unmount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle open/close with animation
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Store previous active element for focus return
      previousActiveElementRef.current = document.activeElement;
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
    if (isLoading && preventCloseDuringLoading) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose, isLoading, preventCloseDuringLoading]);

  // Prevent body scroll when drawer is open
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

  // Focus management
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      // Focus first focusable element in drawer
      const firstFocusable = drawerRef.current.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (firstFocusable) {
        firstFocusable.focus();
      }
    } else if (!isOpen && previousActiveElementRef.current) {
      // Return focus to previous element
      previousActiveElementRef.current.focus();
    }
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;

    const handleTab = (e) => {
      const focusableElements = drawerRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    drawerRef.current.addEventListener('keydown', handleTab);
    return () => {
      if (drawerRef.current) {
        drawerRef.current.removeEventListener('keydown', handleTab);
      }
    };
  }, [isOpen]);

  if (!mounted || !shouldRender) return null;

  const handleBackdropClick = (e) => {
    // Prevent closing during loading if configured
    if (isLoading && preventCloseDuringLoading) return;
    
    // Only close if backdrop is clicked directly (not child elements)
    if (closeOnBackdrop && e.target === backdropRef.current) {
      onClose();
    }
  };

  const handleDrawerClick = (e) => {
    // Prevent clicks inside drawer from bubbling to backdrop
    e.stopPropagation();
  };

  // Size variants
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const drawerContent = (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-all duration-200 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        } ${
          closeOnBackdrop && !(isLoading && preventCloseDuringLoading)
            ? 'cursor-pointer hover:bg-black/70 active:bg-black/75'
            : 'cursor-default'
        }`}
        onClick={handleBackdropClick}
        onMouseDown={(e) => {
          // Prevent text selection when clicking backdrop
          if (e.target === backdropRef.current) {
            e.preventDefault();
          }
        }}
        aria-hidden="true"
        role="button"
        tabIndex={-1}
        aria-label={closeOnBackdrop && !(isLoading && preventCloseDuringLoading) ? 'Click to close drawer' : undefined}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-screen ${sizeClasses[size]} w-full bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isAnimating ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onClick={handleDrawerClick}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          {title && (
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 id="drawer-title" className="text-2xl font-bold text-gray-900">
                {title}
              </h2>
              <div className="flex items-center gap-2">
                {isLoading && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <LoadingSpinner size="sm" />
                    <span>{loadingMessage}</span>
                  </div>
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    disabled={isLoading && preventCloseDuringLoading}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Close drawer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {children}
            </div>
          </div>

          {/* Footer */}
          {footer && (
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 z-10">
              {footer}
            </div>
          )}

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="flex flex-col items-center gap-4">
                <LoadingSpinner size="lg" />
                {loadingMessage && (
                  <p className="text-sm font-medium text-gray-700">{loadingMessage}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  // Render to portal
  return mounted ? createPortal(drawerContent, document.body) : null;
}

export default Drawer;
