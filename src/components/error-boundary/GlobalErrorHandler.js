/**
 * Global Error Handler Component
 * Initializes global error handlers on client side and shows notifications
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initGlobalErrorHandlers, interceptFetchErrors } from '@/lib/error-handler';
import { useToast } from '@/components/toast';

export function GlobalErrorHandler() {
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    // Initialize global error handlers
    initGlobalErrorHandlers();
    interceptFetchErrors();

    // Listen for error notification events
    const handleErrorNotification = (event) => {
      const { errorType, errorMessage } = event.detail || {};
      
      // Show notification with link to error report
      const message = errorMessage 
        ? `An error occurred: ${errorMessage.substring(0, 100)}${errorMessage.length > 100 ? '...' : ''}`
        : 'An error occurred. Would you like to report it?';
      
      toast.showError(message, {
        duration: 12000,
        title: 'Error Detected',
        action: {
          label: 'Report Error',
          onClick: () => {
            router.push('/error-report?auto=true');
          },
        },
      });
    };

    window.addEventListener('error-notification', handleErrorNotification);

    return () => {
      window.removeEventListener('error-notification', handleErrorNotification);
    };
  }, [toast, router]);

  return null; // This component doesn't render anything
}
