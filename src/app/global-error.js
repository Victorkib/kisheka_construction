/**
 * Global Error Page Component (Next.js App Router)
 * Handles errors at the root level that ErrorBoundary might miss
 * This is the last resort error handler
 * 
 * Route: Automatically used by Next.js for root-level errors
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function GlobalError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    // Store error for reporting
    try {
      const errorData = {
        message: error?.message || error?.toString() || 'Unknown error',
        stack: error?.stack || '',
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        type: 'global_error',
      };
      
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('lastError', JSON.stringify(errorData));
        
        // Dispatch notification event
        window.dispatchEvent(new CustomEvent('error-notification', {
          detail: {
            errorType: 'global_error',
            errorMessage: errorData.message,
          },
        }));
      }
    } catch (storageError) {
      console.error('Failed to store error data:', storageError);
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 sm:p-8 text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
              Critical Error
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              A critical error occurred. Please try refreshing the page or contact support if the problem persists.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reset}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors text-sm font-medium touch-manipulation focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Try again"
              >
                Try Again
              </button>
              <Link
                href="/error-report?auto=true"
                className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors text-sm font-medium touch-manipulation focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 text-center"
                aria-label="Report this error"
              >
                Report Error
              </Link>
              <Link
                href="/"
                className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 active:bg-gray-400 transition-colors text-sm font-medium touch-manipulation focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-center"
                aria-label="Go to home page"
              >
                Go Home
              </Link>
            </div>

            {process.env.NODE_ENV === 'development' && error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 mb-2">
                  Error Details (Development Only)
                </summary>
                <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono text-red-600 overflow-auto max-h-48">
                  <p className="font-semibold mb-1">Error:</p>
                  <pre className="whitespace-pre-wrap break-words">
                    {error.toString()}
                  </pre>
                  {error.stack && (
                    <>
                      <p className="font-semibold mt-3 mb-1">Stack Trace:</p>
                      <pre className="whitespace-pre-wrap break-words">
                        {error.stack}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
