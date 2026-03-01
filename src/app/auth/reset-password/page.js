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
        <h1 className="text-2xl font-bold ds-text-primary">Set New Password</h1>
        <p className="ds-text-secondary mt-2">Enter your new password below</p>
      </div>

      <ResetPasswordForm />

      <div className="text-center">
        <Link href="/auth/login" className="ds-text-accent-primary hover:underline text-sm">
          Back to login
        </Link>
      </div>
    </div>
  );
}

