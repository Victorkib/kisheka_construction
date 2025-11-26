/**
 * Forgot Password Page
 * Password reset request page
 */

'use client';

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
        <p className="text-gray-600 mt-2">Enter your email to receive instructions</p>
      </div>

      <ForgotPasswordForm />

      <div className="text-center">
        <Link href="/auth/login" className="text-blue-600 hover:underline text-sm">
          Back to login
        </Link>
      </div>
    </div>
  );
}

