/**
 * Error Boundary Component
 * Catches React component errors and displays user-friendly error UI
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

class ErrorBoundaryClass extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Store error for error reporting page
    if (typeof window !== 'undefined') {
      try {
        const errorData = {
          message: error?.message || 'Unknown error',
          stack: error?.stack || '',
          componentStack: errorInfo?.componentStack || '',
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
          type: 'react_error',
        };
        sessionStorage.setItem('lastError', JSON.stringify(errorData));
      } catch (e) {
        console.error('Failed to store error data:', e);
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={() => {
            this.setState({ hasError: false, error: null, errorInfo: null });
          }}
        />
      );
    }

    return this.props.children;
  }
}

function ErrorFallback({ error, errorInfo, onReset }) {
  const router = useRouter();

  const handleReportError = () => {
    try {
      // Ensure error is stored before navigation
      if (typeof window !== 'undefined') {
        try {
          const errorData = {
            message: error?.message || 'Unknown error',
            stack: error?.stack || '',
            componentStack: errorInfo?.componentStack || '',
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            type: 'react_error',
          };
          sessionStorage.setItem('lastError', JSON.stringify(errorData));
        } catch (e) {
          console.error('Failed to store error data:', e);
        }
      }
      
      // Use window.location directly for more reliable navigation in error context
      // Router might not work properly in error boundary context
      window.location.href = '/error-report?auto=true';
    } catch (err) {
      console.error('Error in handleReportError:', err);
      // Last resort: direct navigation
      if (typeof window !== 'undefined') {
        window.location.href = '/error-report?auto=true';
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-xl p-8 border border-red-200">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-lg text-gray-600">
            We're sorry, but something unexpected happened. Our team has been notified.
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800 font-medium mb-2">Error Details:</p>
          <p className="text-sm text-red-700 font-mono break-all">
            {error?.message || 'An unknown error occurred'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <button
            onClick={onReset}
            className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={handleReportError}
            className="flex-1 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Report Error
          </button>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <p className="text-sm text-gray-600 mb-4">Quick Navigation:</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/projects"
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Projects
            </Link>
            <Link
              href="/"
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Home
            </Link>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>

        {process.env.NODE_ENV === 'development' && errorInfo && (
          <details className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <summary className="text-sm font-medium text-gray-700 cursor-pointer">
              Technical Details (Development Only)
            </summary>
            <pre className="mt-2 text-xs text-gray-600 overflow-auto max-h-64">
              {error?.stack}
              {'\n\n'}
              {errorInfo.componentStack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

export default function ErrorBoundary({ children }) {
  return <ErrorBoundaryClass>{children}</ErrorBoundaryClass>;
}
