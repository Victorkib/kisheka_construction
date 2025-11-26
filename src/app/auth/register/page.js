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
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Create Account</h1>
        <p className="text-gray-600 mt-2">Join the Kisheka system</p>
      </div>

      <RegisterForm />

      <div className="text-center text-sm">
        <p className="text-gray-600">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
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
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  );
}

