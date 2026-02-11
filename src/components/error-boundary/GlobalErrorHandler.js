/**
 * Global Error Handler Component
 * Initializes global error handlers on client side
 */

'use client';

import { useEffect } from 'react';
import { initGlobalErrorHandlers, interceptFetchErrors } from '@/lib/error-handler';

export function GlobalErrorHandler() {
  useEffect(() => {
    // Initialize global error handlers
    initGlobalErrorHandlers();
    interceptFetchErrors();
  }, []);

  return null; // This component doesn't render anything
}
