/**
 * Invite User Page
 * Owner can invite new users with specific roles
 * 
 * Route: /dashboard/users/invite
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';

export default function InviteUserPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    role: 'site_clerk',
    firstName: '',
    lastName: '',
  });

  // Fetch user and check permissions
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        const data = await response.json();
        if (data.success) {
          setUser(data.data);
          const role = data.data.role?.toLowerCase();
          if (role !== 'owner') {
            router.push('/dashboard');
          }
        } else {
          router.push('/auth/login');
        }
      } catch (err) {
        console.error('Fetch user error:', err);
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSuccess(false);

    // Validation
    if (!formData.email || !formData.email.includes('@')) {
      setError('Valid email is required');
      setSending(false);
      return;
    }

    if (!formData.role) {
      setError('Role is required');
      setSending(false);
      return;
    }

    try {
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      setSuccess(true);
      setFormData({
        email: '',
        role: 'site_clerk',
        firstName: '',
        lastName: '',
      });

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    } catch (err) {
      setError(err.message || 'Failed to send invitation');
      console.error('Invite user error:', err);
    } finally {
      setSending(false);
    }
  };

  if (loading || !user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner />
        </div>
      </AppLayout>
    );
  }

  const roleOptions = [
    { value: 'site_clerk', label: 'Clerk' },
    { value: 'pm', label: 'Project Manager' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'accountant', label: 'Accountant' },
    { value: 'investor', label: 'Investor' },
    { value: 'supplier', label: 'Supplier' },
  ];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/dashboard/users" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Users
        </Link>

        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invite User</h1>
          <p className="text-gray-700 mb-6">
            Send an invitation to a new user. They will receive an email with a link to create their account.
          </p>

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
              <p className="font-semibold">✅ Invitation sent successfully!</p>
              <p className="text-sm mt-1">The user will receive an email with instructions to create their account.</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={sending}
                placeholder="user@example.com"
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 placeholder:text-gray-500"
              />
              <p className="text-sm text-gray-700 mt-1 leading-normal">The user will receive an invitation email at this address</p>
            </div>

            <div>
              <label htmlFor="role" className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
                disabled={sending}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-700 mt-1 leading-normal">The user will be assigned this role upon registration</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                  First Name (Optional)
                </label>
                <input
                  id="firstName"
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  disabled={sending}
                  placeholder="John"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 placeholder:text-gray-500"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                  Last Name (Optional)
                </label>
                <input
                  id="lastName"
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  disabled={sending}
                  placeholder="Doe"
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 placeholder:text-gray-500"
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>ℹ️ Note:</strong> The invitation will expire in 7 days. The user must accept it before then.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={sending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition"
              >
                {sending ? 'Sending Invitation...' : 'Send Invitation'}
              </button>
              <Link
                href="/dashboard/users"
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
