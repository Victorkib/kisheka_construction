/**
 * Registration Form Component
 * Handles new user account creation
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OAuthButtons } from './oauth-buttons';
import { RegistrationSuccess } from './registration-success';

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get('token');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingInvitation, setLoadingInvitation] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState(null);

  // Fetch invitation details if token exists
  useEffect(() => {
    if (invitationToken) {
      fetchInvitation();
    }
  }, [invitationToken]);

  const fetchInvitation = async () => {
    try {
      setLoadingInvitation(true);
      const response = await fetch(`/api/users/invitations/${invitationToken}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid invitation');
        return;
      }

      setInvitation(data.data);
      // Pre-fill form with invitation data
      setFormData((prev) => ({
        ...prev,
        email: data.data.email || prev.email,
        firstName: data.data.firstName || prev.firstName,
        lastName: data.data.lastName || prev.lastName,
      }));
    } catch (err) {
      setError('Failed to verify invitation');
      console.error('Fetch invitation error:', err);
    } finally {
      setLoadingInvitation(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Client-side validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          ...(invitationToken && { invitationToken }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      // Store the registered email and show success component
      setRegisteredEmail(formData.email);
      setSuccess(true);
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (success && registeredEmail) {
    return (
      <RegistrationSuccess
        email={registeredEmail}
        isInvitation={!!invitation}
      />
    );
  }

  // Show loading state while fetching invitation
  if (loadingInvitation) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-sm text-gray-600">Verifying invitation...</p>
      </div>
    );
  }

  // Show invitation info if available
  const roleDisplay = invitation?.role
    ? {
        owner: 'Owner',
        investor: 'Investor',
        pm: 'Project Manager',
        project_manager: 'Project Manager',
        supervisor: 'Supervisor',
        site_clerk: 'Clerk',
        accountant: 'Accountant',
        supplier: 'Supplier',
      }[invitation.role] || invitation.role
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {invitation && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">
          <p className="font-semibold">You've been invited!</p>
          <p className="mt-1">
            {invitation.invitedBy} has invited you to join as <strong>{roleDisplay}</strong>
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
            First Name
          </label>
          <input
            id="firstName"
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            required
            disabled={loading}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:bg-gray-100 disabled:text-gray-500"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
            Last Name
          </label>
          <input
            id="lastName"
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            required
            disabled={loading}
            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:bg-gray-100 disabled:text-gray-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          disabled={loading || !!invitation}
          className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:bg-gray-100 disabled:text-gray-500"
        />
        {invitation && (
          <p className="text-xs text-gray-500 mt-1">Email is pre-filled from your invitation</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          required
          disabled={loading}
          minLength={8}
          className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:bg-gray-100 disabled:text-gray-500"
        />
        <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
          disabled={loading}
          minLength={8}
          className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:bg-gray-100 disabled:text-gray-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition"
      >
        {loading ? 'Creating account...' : 'Create account'}
      </button>

      <OAuthButtons mode="register" />
    </form>
  );
}

