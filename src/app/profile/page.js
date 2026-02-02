/**
 * Profile Page
 * User profile management page
 * Route: /profile
 * Auth: All authenticated users
 */

 'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner } from '@/components/loading';
import { ProfileHeader } from '@/components/profile/profile-header';
import { ProfileInfo } from '@/components/profile/profile-info';
import { NotificationPreferences } from '@/components/profile/notification-preferences';
import { NotificationStatusCard } from '@/components/push-notifications/notification-status-indicator';
import { ActivitySummary } from '@/components/profile/activity-summary';
import { ChangePassword } from '@/components/profile/change-password';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/profile');
      const data = await response.json();

      if (!data.success) {
        if (data.error === 'Unauthorized' || response.status === 401) {
          router.push('/auth/login');
          return;
        }
        throw new Error(data.error || 'Failed to load profile');
      }

      setUser(data.data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = (updatedUser) => {
    setUser(updatedUser);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading profile..." />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
          <button
            onClick={fetchProfile}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Try Again
          </button>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            My Profile
          </h1>
          <p className="text-gray-600 mt-1">
            Manage your account information and preferences
          </p>
        </div>

        {/* Profile Header */}
        <ProfileHeader user={user} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Profile Information */}
            <ProfileInfo user={user} onUpdate={handleProfileUpdate} />

            {/* Activity Summary */}
            <ActivitySummary user={user} />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Browser Notifications Status */}
            <NotificationStatusCard onRefresh={fetchProfile} />

            {/* Notification Preferences */}
            <NotificationPreferences
              user={user}
              onUpdate={handleProfileUpdate}
            />

            {/* Change Password */}
            <ChangePassword />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

