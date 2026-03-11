/**
 * New Worker Page
 * Create a new worker profile
 * 
 * Route: /labour/workers/new
 */

'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast/toast-container';
import { ArrowLeft, Save, X } from 'lucide-react';
import { 
  VALID_SKILL_TYPES, 
  VALID_WORKER_TYPES,
  VALID_EMPLOYMENT_TYPES,
  VALID_WORKER_STATUSES,
  getSkillTypeLabel, 
  getWorkerTypeLabel 
} from '@/lib/constants/labour-constants';

function NewWorkerPageContent() {
  const router = useRouter();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    workerName: '',
    employeeId: '',
    workerType: 'internal',
    phoneNumber: '',
    email: '',
    nationalId: '',
    skillTypes: [],
    defaultHourlyRate: 0,
    defaultDailyRate: '',
    overtimeMultiplier: 1.5,
    employmentType: 'casual',
    status: 'active',
    hireDate: '',
  });

  // Check permissions
  if (!canAccess('create_worker_profile')) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-500/10 border border-red-400/60 rounded-lg p-6 text-center">
            <p className="text-red-200">You do not have permission to create worker profiles.</p>
            <Link href="/labour/workers" className="ds-text-accent-primary hover:ds-text-accent-hover mt-4 inline-block">
              ← Back to Workers
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Prepare data
      const submitData = {
        ...formData,
        defaultHourlyRate: parseFloat(formData.defaultHourlyRate) || 0,
        defaultDailyRate: formData.defaultDailyRate ? parseFloat(formData.defaultDailyRate) : null,
        overtimeMultiplier: parseFloat(formData.overtimeMultiplier) || 1.5,
        hireDate: formData.hireDate ? new Date(formData.hireDate).toISOString() : null,
        nationalId: formData.nationalId || null,
        phoneNumber: formData.phoneNumber || null,
        email: formData.email || null,
      };

      const response = await fetch('/api/labour/workers', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create worker');
      }

      toast.showSuccess('Worker created successfully');
      router.push('/labour/workers');
    } catch (err) {
      console.error('Error creating worker:', err);
      toast.showError(err.message || 'Failed to create worker');
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skill) => {
    setFormData(prev => ({
      ...prev,
      skillTypes: prev.skillTypes.includes(skill)
        ? prev.skillTypes.filter(s => s !== skill)
        : [...prev.skillTypes, skill],
    }));
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/labour/workers"
            className="inline-flex items-center gap-2 ds-text-secondary hover:ds-text-primary mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Workers
          </Link>
          <h1 className="text-3xl font-bold ds-text-primary">Add New Worker</h1>
          <p className="ds-text-secondary mt-1">Create a new worker profile</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="ds-bg-surface rounded-lg shadow border ds-border-subtle p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-xl font-semibold ds-text-primary mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">
                  Worker Name *
                </label>
                <input
                  type="text"
                  value={formData.workerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, workerName: e.target.value }))}
                  required
                  minLength={2}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">
                  Employee ID *
                </label>
                <input
                  type="text"
                  value={formData.employeeId}
                  onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                  required
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted"
                  placeholder="EMP001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">
                  Worker Type *
                </label>
                <select
                  value={formData.workerType}
                  onChange={(e) => setFormData(prev => ({ ...prev, workerType: e.target.value }))}
                  required
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus"
                >
                  {VALID_WORKER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {getWorkerTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  required
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus"
                >
                  {VALID_WORKER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted"
                  placeholder="+254 700 000 000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted"
                  placeholder="worker@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">
                  National ID
                </label>
                <input
                  type="text"
                  value={formData.nationalId}
                  onChange={(e) => setFormData(prev => ({ ...prev, nationalId: e.target.value }))}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted"
                  placeholder="12345678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">
                  Hire Date
                </label>
                <input
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, hireDate: e.target.value }))}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus"
                />
              </div>
            </div>
          </div>

          {/* Employment Details */}
          <div>
            <h2 className="text-xl font-semibold ds-text-primary mb-4">Employment Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">
                  Employment Type *
                </label>
                <select
                  value={formData.employmentType}
                  onChange={(e) => setFormData(prev => ({ ...prev, employmentType: e.target.value }))}
                  required
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus"
                >
                  {VALID_EMPLOYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Rates */}
          <div>
            <h2 className="text-xl font-semibold ds-text-primary mb-4">Rates</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">
                  Hourly Rate (KES) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.defaultHourlyRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultHourlyRate: parseFloat(e.target.value) || 0 }))}
                  required
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted"
                  placeholder="500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">
                  Daily Rate (KES)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.defaultDailyRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultDailyRate: e.target.value ? parseFloat(e.target.value) : '' }))}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted"
                  placeholder="4000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium ds-text-secondary mb-1">
                  Overtime Multiplier
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={formData.overtimeMultiplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, overtimeMultiplier: parseFloat(e.target.value) || 1.5 }))}
                  className="w-full px-3 py-2 ds-bg-surface ds-text-primary border ds-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-ds-accent-focus focus:border-ds-accent-focus placeholder:ds-text-muted"
                  placeholder="1.5"
                />
              </div>
            </div>
          </div>

          {/* Skills */}
          <div>
            <h2 className="text-xl font-semibold ds-text-primary mb-4">Skills</h2>
            <div className="border ds-border-subtle rounded-lg p-4 max-h-64 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {VALID_SKILL_TYPES.map((skill) => (
                  <label key={skill} className="flex items-center gap-2 cursor-pointer hover:ds-bg-surface-muted p-2 rounded">
                    <input
                      type="checkbox"
                      checked={formData.skillTypes.includes(skill)}
                      onChange={() => toggleSkill(skill)}
                      className="rounded ds-border-subtle text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm ds-text-secondary">{getSkillTypeLabel(skill)}</span>
                  </label>
                ))}
              </div>
            </div>
            {formData.skillTypes.length > 0 && (
              <p className="mt-2 text-sm ds-text-secondary">
                {formData.skillTypes.length} skill{formData.skillTypes.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Link
              href="/labour/workers"
              className="px-4 py-2 border ds-border-subtle ds-text-secondary rounded-lg hover:ds-bg-surface-muted"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 ds-bg-accent-primary text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Create Worker
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function NewWorkerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center ds-bg-app">
        <div className="text-center">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      </div>
    }>
      <NewWorkerPageContent />
    </Suspense>
  );
}
