/**
 * Notification Preferences Component
 * Allows users to manage their notification preferences
 */

'use client';

import { useState, useEffect } from 'react';

export function NotificationPreferences({ user, onUpdate }) {
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    approvalAlerts: true,
    budgetAlerts: true,
    dailyReports: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user?.notificationPreferences) {
      setPreferences({
        emailNotifications:
          user.notificationPreferences.emailNotifications !== false,
        approvalAlerts: user.notificationPreferences.approvalAlerts !== false,
        budgetAlerts: user.notificationPreferences.budgetAlerts !== false,
        dailyReports: user.notificationPreferences.dailyReports === true,
      });
    }
  }, [user]);

  const handleToggle = (key) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setSuccess(false);
    setError(null);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationPreferences: preferences,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update preferences');
      }

      setSuccess(true);
      if (onUpdate) {
        onUpdate(data.data);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update preferences');
    } finally {
      setLoading(false);
    }
  };

  const ToggleSwitch = ({ enabled, onChange, label, description }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0">
      <div className="flex-1">
        <label className="text-sm font-medium text-gray-900 cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          enabled ? 'bg-blue-600' : 'bg-gray-200'
        }`}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Notification Preferences
      </h2>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
          Preferences saved successfully!
        </div>
      )}

      <div className="space-y-0">
        <ToggleSwitch
          enabled={preferences.emailNotifications}
          onChange={() => handleToggle('emailNotifications')}
          label="Email Notifications"
          description="Receive notifications via email"
        />
        <ToggleSwitch
          enabled={preferences.approvalAlerts}
          onChange={() => handleToggle('approvalAlerts')}
          label="Approval Alerts"
          description="Get notified when approvals are needed or completed"
        />
        <ToggleSwitch
          enabled={preferences.budgetAlerts}
          onChange={() => handleToggle('budgetAlerts')}
          label="Budget Alerts"
          description="Receive alerts about budget warnings and discrepancies"
        />
        <ToggleSwitch
          enabled={preferences.dailyReports}
          onChange={() => handleToggle('dailyReports')}
          label="Daily Reports"
          description="Receive daily summary reports"
        />
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}























