/**
 * Error Report Page
 * Allows users to report errors with auto-detected context
 * 
 * Route: /error-report
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingButton } from '@/components/loading';
import { useToast } from '@/components/toast';
import { useErrorContext, getStoredError, clearStoredError } from '@/hooks/use-error-context';

export default function ErrorReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const context = useErrorContext();
  const isAutoReport = searchParams?.get('auto') === 'true';

  const [formData, setFormData] = useState({
    userDescription: '',
    stepsToReproduce: '',
    additionalInfo: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [storedError, setStoredError] = useState(null);

  useEffect(() => {
    // Get stored error if available
    const error = getStoredError();
    if (error) {
      setStoredError(error);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const errorData = {
        errorMessage: storedError?.message || 'User-reported error',
        errorStack: storedError?.stack || '',
        errorType: storedError?.type || 'user_reported',
        componentStack: storedError?.componentStack || '',
        userDescription: formData.userDescription.trim(),
        stepsToReproduce: formData.stepsToReproduce.trim(),
        url: context.url || window.location.href,
        userAgent: context.userAgent || navigator.userAgent,
        screenSize: context.screenSize || `${window.innerWidth}x${window.innerHeight}`,
        timestamp: storedError?.timestamp || new Date().toISOString(),
        user: context.user,
        project: context.project,
        additionalInfo: formData.additionalInfo.trim(),
      };

      const response = await fetch('/api/error-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send error report');
      }

      // Clear stored error
      clearStoredError();
      setSubmitted(true);
      toast.showSuccess('Error report sent successfully! Thank you for helping us improve.');

      // Auto-redirect after 3 seconds if auto-report
      if (isAutoReport) {
        setTimeout(() => {
          router.push('/dashboard');
        }, 3000);
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.showError(`Failed to send error report: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (submitted) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-4 py-12">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-xl p-8 border border-green-200">
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Thank You!</h1>
              <p className="text-lg text-gray-600 mb-6">
                Your error report has been sent successfully. Our team will review it and work on a fix.
              </p>
              {isAutoReport && (
                <p className="text-sm text-gray-500 mb-6">
                  Redirecting to dashboard in a few seconds...
                </p>
              )}
              <div className="flex flex-wrap gap-3 justify-center">
                <Link
                  href="/dashboard"
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Dashboard
                </Link>
                <Link
                  href="/projects"
                  className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  View Projects
                </Link>
                <button
                  onClick={() => router.back()}
                  className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-8">
            <div className="flex items-center gap-4">
              <div className="text-5xl">⚠️</div>
              <div>
                <h1 className="text-3xl font-bold mb-2">Report an Error</h1>
                <p className="text-red-100">
                  Help us improve by reporting errors you encounter. All information is automatically collected.
                </p>
              </div>
            </div>
          </div>

          {/* Auto-detected Error Info */}
          {storedError && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 px-6 py-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-yellow-800">Error Detected</h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p className="font-mono break-all">{storedError.message || 'Unknown error'}</p>
                    {storedError.type && (
                      <p className="mt-1 text-xs">Type: {storedError.type}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-8 space-y-6">
            {/* User Description */}
            <div>
              <label htmlFor="userDescription" className="block text-sm font-medium text-gray-700 mb-2">
                What were you trying to do? <span className="text-red-500">*</span>
              </label>
              <textarea
                id="userDescription"
                name="userDescription"
                rows={4}
                value={formData.userDescription}
                onChange={handleChange}
                required
                placeholder="Describe what you were doing when the error occurred..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 text-gray-900"
              />
              <p className="mt-1 text-xs text-gray-500">
                This helps us understand the context of the error.
              </p>
            </div>

            {/* Steps to Reproduce */}
            <div>
              <label htmlFor="stepsToReproduce" className="block text-sm font-medium text-gray-700 mb-2">
                Steps to Reproduce (Optional)
              </label>
              <textarea
                id="stepsToReproduce"
                name="stepsToReproduce"
                rows={4}
                value={formData.stepsToReproduce}
                onChange={handleChange}
                placeholder="1. Go to...&#10;2. Click on...&#10;3. Error occurs..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 text-gray-900"
              />
              <p className="mt-1 text-xs text-gray-500">
                Help us reproduce the error by listing the steps you took.
              </p>
            </div>

            {/* Additional Info */}
            <div>
              <label htmlFor="additionalInfo" className="block text-sm font-medium text-gray-700 mb-2">
                Additional Information (Optional)
              </label>
              <textarea
                id="additionalInfo"
                name="additionalInfo"
                rows={3}
                value={formData.additionalInfo}
                onChange={handleChange}
                placeholder="Any other details that might be helpful..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 text-gray-900"
              />
            </div>

            {/* Auto-collected Info Display */}
            <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                Auto-collected Information (Click to view)
              </summary>
              <div className="mt-4 space-y-2 text-xs text-gray-600">
                <div>
                  <span className="font-medium">URL:</span> {context.url || 'Not available'}
                </div>
                <div>
                  <span className="font-medium">User:</span>{' '}
                  {context.user ? `${context.user.name || context.user.email} (${context.user.role})` : 'Not logged in'}
                </div>
                <div>
                  <span className="font-medium">Project:</span>{' '}
                  {context.project ? context.project.id : 'No project context'}
                </div>
                <div>
                  <span className="font-medium">Screen Size:</span> {context.screenSize || 'Not available'}
                </div>
                <div>
                  <span className="font-medium">Timestamp:</span> {new Date(context.timestamp || Date.now()).toLocaleString()}
                </div>
              </div>
            </details>

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <LoadingButton
                type="submit"
                isLoading={submitting}
                loadingText="Sending Report..."
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Error Report
              </LoadingButton>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>

          {/* Navigation Links */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
            <p className="text-sm text-gray-600 mb-3">Quick Navigation:</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/projects"
                className="px-4 py-2 text-sm bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Projects
              </Link>
              <Link
                href="/"
                className="px-4 py-2 text-sm bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Home
              </Link>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 text-sm bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
