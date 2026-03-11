/**
 * Registration Page
 * New user account creation page
 */

'use client';

import { Suspense } from 'react';
import { RegisterForm } from '@/components/auth/register-form';
import Link from 'next/link';

function RegisterPageContent() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold ds-text-primary leading-tight">Create Account</h1>
        <p className="ds-text-secondary mt-2">Join the Doshaki system</p>
      </div>

      <RegisterForm />

      <div className="text-center text-sm">
        <p className="ds-text-secondary">
          Already have an account?{' '}
          <Link href="/auth/login" className="ds-text-accent-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-ds-accent-primary"></div>
        </div>
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  );
}

