/**
 * Reset Password Page
 * Password reset completion page (accessed via email link)
 */

'use client';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import Link from 'next/link';

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Set New Password</h1>
        <p className="text-gray-600 mt-2">Enter your new password below</p>
      </div>

      <ResetPasswordForm />

      <div className="text-center">
        <Link href="/auth/login" className="text-blue-600 hover:underline text-sm">
          Back to login
        </Link>
      </div>
    </div>
  );
}

