/**
 * Reset Password Form Component
 * Handles password reset completion (accessed via email link)
 */

'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ResetPasswordFormContent() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Client-side validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    if (!token) {
      setError('Reset token is missing. Please use the link from your email.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        return;
      }

      router.push('/auth/login?reset=success');
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Reset password error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {!token && (
        <div className="bg-yellow-50 border border-yellow-400/60 text-yellow-700 px-4 py-3 rounded text-sm">
          ⚠️ No reset token found. Please use the link from your email.
        </div>
      )}

      <div>
        <label htmlFor="password" className="block text-sm font-medium ds-text-secondary mb-1">
          New Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading || !token}
          minLength={8}
          className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted disabled:ds-bg-surface-muted disabled:ds-text-muted"
        />
        <p className="text-xs ds-text-muted mt-1">Must be at least 8 characters</p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium ds-text-secondary mb-1">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading || !token}
          minLength={8}
          className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:ds-text-muted disabled:ds-bg-surface-muted disabled:ds-text-muted"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !token}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-500 text-white font-medium py-2 rounded-lg transition"
      >
        {loading ? 'Updating...' : 'Update password'}
      </button>
    </form>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="ds-bg-surface-muted border ds-border-subtle ds-text-secondary px-4 py-3 rounded text-sm">
          Loading reset form...
        </div>
      </div>
    }>
      <ResetPasswordFormContent />
    </Suspense>
  );
}

