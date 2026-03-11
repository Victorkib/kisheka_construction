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
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">Doshaki</h1>
        <p className="text-base md:text-lg ds-text-secondary mt-1 leading-relaxed">Construction Accountability</p>
        <p className="text-sm ds-text-secondary mt-3 leading-normal">Sign in to continue</p>
      </div>

      {verified && (
        <div className="bg-green-50 border border-green-400/60 text-green-700 px-4 py-3 rounded text-sm">
          <p className="font-semibold">✓ Email verified successfully!</p>
          <p className="mt-1">You can now sign in to your account.</p>
        </div>
      )}

      {registered && !verified && (
        <div className="bg-blue-50 border border-blue-400/60 text-blue-700 px-4 py-3 rounded text-sm">
          <p className="font-semibold">📧 Check your email</p>
          <p className="mt-1">
            We've sent you a verification email. Please verify your email address before signing in.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded text-sm">
          {decodeURIComponent(error)}
        </div>
      )}

      <LoginForm />

      <div className="space-y-3 text-center text-sm">
        <p className="ds-text-secondary">
          Don't have an account?{' '}
          <Link href="/auth/register" className="ds-text-accent-primary hover:underline font-medium">
            Create one
          </Link>
        </p>
        <p>
          <Link href="/auth/forgot-password" className="ds-text-accent-primary hover:underline">
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
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">Doshaki</h1>
          <p className="ds-text-secondary mt-1">Construction Accountability</p>
          <p className="text-sm ds-text-muted mt-3">Loading...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

