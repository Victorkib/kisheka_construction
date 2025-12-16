/**
 * Toast Notification Container
 * 
 * A modern toast notification system for displaying
 * success, error, warning, and info messages
 * 
 * Features:
 * - Multiple toast support
 * - Auto-dismiss with configurable duration
 * - Manual dismiss
 * - Beautiful animations
 * - Different variants (success, error, warning, info)
 * - Accessible
 */

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createContext, useContext } from 'react';

// Toast context
const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

// Toast Provider Component
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    const newToast = {
      id,
      ...toast,
      duration: toast.duration || 5000,
    };
    
    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }, [removeToast]);

  const showSuccess = useCallback((message, options = {}) => {
    return addToast({ ...options, message, variant: 'success' });
  }, [addToast]);

  const showError = useCallback((message, options = {}) => {
    return addToast({ ...options, message, variant: 'error' });
  }, [addToast]);

  const showWarning = useCallback((message, options = {}) => {
    return addToast({ ...options, message, variant: 'warning' });
  }, [addToast]);

  const showInfo = useCallback((message, options = {}) => {
    return addToast({ ...options, message, variant: 'info' });
  }, [addToast]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  }), [toasts, addToast, removeToast, showSuccess, showError, showWarning, showInfo]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

// Toast Container Component
function ToastContainer({ toasts, removeToast }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full sm:w-auto"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

// Individual Toast Item
function ToastItem({ toast, onRemove }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300); // Match animation duration
  };

  const variantStyles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      text: 'text-green-800',
      title: 'text-green-900',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      text: 'text-red-800',
      title: 'text-red-900',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      text: 'text-yellow-800',
      title: 'text-yellow-900',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      text: 'text-blue-800',
      title: 'text-blue-900',
    },
  };

  const styles = variantStyles[toast.variant] || variantStyles.info;

  // Icons
  const Icon = () => {
    const iconClass = `w-5 h-5 ${styles.iconColor}`;
    
    if (toast.variant === 'success') {
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    
    if (toast.variant === 'error') {
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    
    if (toast.variant === 'warning') {
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    }
    
    return (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  return (
    <div
      className={`
        ${styles.bg} ${styles.border} border rounded-lg shadow-lg p-4
        transform transition-all duration-300 ease-in-out
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
        flex items-start gap-3 min-w-[300px] max-w-md
      `}
      role="alert"
    >
      {/* Icon */}
      <div className={`flex-shrink-0 ${styles.iconBg} rounded-full p-1.5`}>
        <Icon />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <h4 className={`text-sm font-semibold ${styles.title} mb-1`}>
            {toast.title}
          </h4>
        )}
        <p className={`text-sm ${styles.text}`}>{toast.message}</p>
      </div>

      {/* Close button */}
      <button
        onClick={handleRemove}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Close notification"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

