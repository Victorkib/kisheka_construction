/**
 * Registration Success Component
 * Displays after successful registration with email verification instructions
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function RegistrationSuccess({ email, isInvitation = false }) {
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState(null);

  const handleResendVerification = async () => {
    setResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResendError(data.error || 'Failed to resend verification email');
        return;
      }

      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err) {
      setResendError('An error occurred. Please try again.');
      console.error('Resend verification error:', err);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
        <div className="mb-4">
          <svg
            className="mx-auto h-16 w-16 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-green-800 mb-2">
          Account Created Successfully!
        </h2>
        {isInvitation ? (
          <p className="text-green-700 mb-4">
            Your account has been created. You can now log in to access the system.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-green-700 mb-4">
              We've sent a verification email to:
            </p>
            <p className="text-lg font-semibold text-green-800 bg-green-100 px-4 py-2 rounded inline-block">
              {email}
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 text-left">
              <p className="text-blue-800 font-semibold mb-2">📧 Next Steps:</p>
              <ol className="list-decimal list-inside space-y-2 text-blue-700 text-sm">
                <li>Check your email inbox (and spam folder)</li>
                <li>Click the verification link in the email</li>
                <li>Return here to log in once verified</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {!isInvitation && (
        <div className="space-y-3">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-3">
              Didn't receive the email?
            </p>
            <button
              onClick={handleResendVerification}
              disabled={resending || resendSuccess}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition"
            >
              {resending
                ? 'Sending...'
                : resendSuccess
                ? '✓ Email Sent!'
                : 'Resend Verification Email'}
            </button>
          </div>

          {resendSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm text-center">
              ✓ Verification email sent! Please check your inbox.
            </div>
          )}

          {resendError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm text-center">
              {resendError}
            </div>
          )}
        </div>
      )}

      <div className="pt-4 border-t border-gray-200">
        <div className="space-y-3">
          <Link
            href="/auth/login"
            className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg transition text-center"
          >
            Go to Login Page
          </Link>
          <p className="text-center text-xs text-gray-500">
            Already verified?{' '}
            <Link href="/auth/login" className="text-blue-600 hover:underline">
              Sign in now
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}


