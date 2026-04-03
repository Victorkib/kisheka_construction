/**
 * Login Form Component
 * Handles user authentication via email and password
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OAuthButtons } from './oauth-buttons';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const router = useRouter();
  
  const isVerificationError = error?.toLowerCase().includes('verify') || 
                              error?.toLowerCase().includes('verification') ||
                              error?.toLowerCase().includes('check your inbox');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      // Redirect to dashboard on success
      router.push('/dashboard');
      router.refresh(); // Refresh to update auth state
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    setResending(true);
    setResendSuccess(false);
    setError(null);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to resend verification email');
        return;
      }

      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Resend verification error:', err);
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="ds-bg-danger border ds-border-danger ds-text-danger px-4 py-3 rounded text-sm">
          <p>{error}</p>
          {isVerificationError && email && (
            <div className="mt-3 pt-3 border-t ds-border-danger">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending || resendSuccess}
                className="text-sm ds-text-info hover:ds-text-info-muted underline disabled:ds-text-muted"
              >
                {resending
                  ? 'Sending...'
                  : resendSuccess
                  ? '✓ Email sent!'
                  : 'Resend verification email'}
              </button>
            </div>
          )}
        </div>
      )}

      {resendSuccess && !error && (
        <div className="ds-bg-success border ds-border-success ds-text-success px-4 py-3 rounded text-sm">
          ✓ Verification email sent! Please check your inbox.
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium ds-text-secondary mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
          disabled={loading}
          className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted disabled:bg-opacity-70 disabled:ds-text-muted"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium ds-text-secondary mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          disabled={loading}
          className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted disabled:bg-opacity-70 disabled:ds-text-muted"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-500 text-white font-medium py-2 rounded-lg transition"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>

      <OAuthButtons mode="login" />
    </form>
  );
}

