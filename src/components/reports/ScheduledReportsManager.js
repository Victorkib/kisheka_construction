/**
 * Scheduled Reports Manager Component
 * Manages scheduled report generation
 */

'use client';

import { useState, useEffect } from 'react';

export function ScheduledReportsManager({ projectId }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    reportType: 'financial',
    frequency: 'weekly',
    dayOfWeek: 1, // Monday
    dayOfMonth: 1,
    time: '09:00',
    recipients: '',
    includeForecast: true,
    includeTrends: true,
    includeRecommendations: true,
  });

  useEffect(() => {
    if (projectId) {
      fetchSchedules();
    }
  }, [projectId]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/projects/${projectId}/reports/schedule`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch scheduled reports');
      }

      setSchedules(result.data.schedules || []);
    } catch (err) {
      console.error('Fetch scheduled reports error:', err);
      setError(err.message || 'Failed to load scheduled reports');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const recipients = formData.recipients
        .split(',')
        .map(r => r.trim())
        .filter(r => r);

      const createResponse = await fetch(`/api/projects/${projectId}/reports/schedule`, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          ...formData,
          recipients: recipients,
        }),
      });

      const result = await createResponse.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create scheduled report');
      }

      setShowCreateForm(false);
      setFormData({
        reportType: 'financial',
        frequency: 'weekly',
        dayOfWeek: 1,
        dayOfMonth: 1,
        time: '09:00',
        recipients: '',
        includeForecast: true,
        includeTrends: true,
        includeRecommendations: true,
      });
      fetchSchedules();
    } catch (err) {
      setError(err.message);
      console.error('Create scheduled report error:', err);
    }
  };

  const handleToggleActive = async (scheduleId, isActive) => {
    try {
      const toggleResponse = await fetch(`/api/projects/${projectId}/reports/schedule/${scheduleId}`, {
        method: 'PATCH',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({ isActive: !isActive }),
      });

      const result = await toggleResponse.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update scheduled report');
      }

      fetchSchedules();
    } catch (err) {
      console.error('Toggle schedule error:', err);
      alert(err.message || 'Failed to update schedule');
    }
  };

  const handleDelete = async (scheduleId) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) {
      return;
    }

    try {
      const deleteResponse = await fetch(`/api/projects/${projectId}/reports/schedule/${scheduleId}`, {
        method: 'DELETE',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      const result = await deleteResponse.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete scheduled report');
      }

      fetchSchedules();
    } catch (err) {
      console.error('Delete schedule error:', err);
      alert(err.message || 'Failed to delete schedule');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-KE');
  };

  const getFrequencyLabel = (frequency, dayOfWeek, dayOfMonth) => {
    if (frequency === 'daily') return 'Daily';
    if (frequency === 'weekly') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `Weekly on ${days[dayOfWeek]}`;
    }
    if (frequency === 'monthly') {
      return `Monthly on day ${dayOfMonth}`;
    }
    return frequency;
  };

  const reportTypeLabels = {
    financial: 'Comprehensive Financial',
    summary: 'Cost Category Summary',
    phases: 'Phase-Wise',
  };

  if (loading) {
    return (
      <div className="ds-bg-surface rounded-lg shadow p-6 border-2 ds-border-subtle">
        <div className="animate-pulse">
          <div className="h-6 ds-bg-surface-muted rounded w-1/3 mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-bg-surface rounded-lg shadow p-6 border-2 ds-border-subtle">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold ds-text-primary flex items-center gap-2">
          <svg className="w-5 h-5 ds-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Scheduled Reports
        </h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
        >
          {showCreateForm ? 'Cancel' : 'Schedule New Report'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-400/60 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 ds-bg-surface-muted rounded-lg border ds-border-subtle">
          <h4 className="font-semibold ds-text-primary mb-4">Schedule New Report</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">
                Report Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.reportType}
                onChange={(e) => setFormData({ ...formData, reportType: e.target.value })}
                required
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="financial">Comprehensive Financial</option>
                <option value="summary">Cost Category Summary</option>
                <option value="phases">Phase-Wise</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">
                Frequency <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                required
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {formData.frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-semibold ds-text-secondary mb-1">
                  Day of Week <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}
                  required
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </div>
            )}

            {formData.frequency === 'monthly' && (
              <div>
                <label className="block text-sm font-semibold ds-text-secondary mb-1">
                  Day of Month <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dayOfMonth}
                  onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })}
                  required
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">
                Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                required
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold ds-text-secondary mb-1">
                Recipients (comma-separated emails)
              </label>
              <input
                type="text"
                value={formData.recipients}
                onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                placeholder="email1@example.com, email2@example.com"
                className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {formData.reportType === 'financial' && (
            <div className="mb-4 p-3 ds-bg-surface rounded border ds-border-subtle">
              <p className="text-sm font-semibold ds-text-secondary mb-2">Report Options</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.includeForecast}
                    onChange={(e) => setFormData({ ...formData, includeForecast: e.target.checked })}
                    className="w-4 h-4 text-blue-600 ds-border-subtle rounded"
                  />
                  <span className="text-sm ds-text-secondary">Include Forecast</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.includeTrends}
                    onChange={(e) => setFormData({ ...formData, includeTrends: e.target.checked })}
                    className="w-4 h-4 text-blue-600 ds-border-subtle rounded"
                  />
                  <span className="text-sm ds-text-secondary">Include Trends</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.includeRecommendations}
                    onChange={(e) => setFormData({ ...formData, includeRecommendations: e.target.checked })}
                    className="w-4 h-4 text-blue-600 ds-border-subtle rounded"
                  />
                  <span className="text-sm ds-text-secondary">Include Recommendations</span>
                </label>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            Create Schedule
          </button>
        </form>
      )}

      {/* Schedules List */}
      {schedules.length === 0 ? (
        <div className="text-center py-8 ds-text-muted">
          <p>No scheduled reports yet.</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="mt-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            Schedule your first report
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <div
              key={schedule._id}
              className="border ds-border-subtle rounded-lg p-4 hover:ds-bg-surface-muted transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold ds-text-primary">
                      {reportTypeLabels[schedule.reportType] || schedule.reportType} Report
                    </h4>
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      schedule.isActive ? 'bg-green-100 text-green-800' : 'ds-bg-surface-muted ds-text-primary'
                    }`}>
                      {schedule.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <p className="text-sm ds-text-secondary mb-1">
                    {getFrequencyLabel(schedule.frequency, schedule.dayOfWeek, schedule.dayOfMonth)} at {schedule.time}
                  </p>
                  {schedule.recipients && schedule.recipients.length > 0 && (
                    <p className="text-xs ds-text-muted mb-1">
                      Recipients: {schedule.recipients.join(', ')}
                    </p>
                  )}
                  <p className="text-xs ds-text-muted">
                    Next run: {formatDate(schedule.nextRun)}
                    {schedule.lastRun && ` | Last run: ${formatDate(schedule.lastRun)}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(schedule._id, schedule.isActive)}
                    className={`px-3 py-1 text-xs font-medium rounded transition ${
                      schedule.isActive
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {schedule.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(schedule._id)}
                    className="px-3 py-1 text-xs font-medium rounded bg-red-100 text-red-800 hover:bg-red-200 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
