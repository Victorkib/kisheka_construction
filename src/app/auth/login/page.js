/**
 * Login Page
 * User authentication page
 */

'use client';

import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const registered = searchParams.get('registered');
  const verified = searchParams.get('verified');

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Doshaki</h1>
        <p className="text-base md:text-lg text-gray-700 mt-1 leading-relaxed">Construction Accountability</p>
        <p className="text-sm text-gray-600 mt-3 leading-normal">Sign in to continue</p>
      </div>

      {verified && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
          <p className="font-semibold">✓ Email verified successfully!</p>
          <p className="mt-1">You can now sign in to your account.</p>
        </div>
      )}

      {registered && !verified && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">
          <p className="font-semibold">📧 Check your email</p>
          <p className="mt-1">
            We've sent you a verification email. Please verify your email address before signing in.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {decodeURIComponent(error)}
        </div>
      )}

      <LoginForm />

      <div className="space-y-3 text-center text-sm">
        <p className="text-gray-600">
          Don't have an account?{' '}
          <Link href="/auth/register" className="text-blue-600 hover:underline font-medium">
            Create one
          </Link>
        </p>
        <p>
          <Link href="/auth/forgot-password" className="text-blue-600 hover:underline">
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Doshaki</h1>
          <p className="text-gray-600 mt-1">Construction Accountability</p>
          <p className="text-sm text-gray-500 mt-3">Loading...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

