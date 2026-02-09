/**
 * Bulk Worker Creation Page
 * Create multiple worker profiles at once
 * 
 * Route: /labour/workers/bulk/new
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast/toast-container';
import { ArrowLeft, Plus, Trash2, Save, Users } from 'lucide-react';
import { 
  VALID_SKILL_TYPES, 
  VALID_WORKER_TYPES,
  VALID_EMPLOYMENT_TYPES,
  VALID_WORKER_STATUSES,
  getSkillTypeLabel, 
  getWorkerTypeLabel 
} from '@/lib/constants/labour-constants';

function BulkWorkerCreationPageContent() {
  const router = useRouter();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [errors, setErrors] = useState({});

  // Check permissions
  if (!canAccess('create_worker_profile')) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">You do not have permission to create worker profiles.</p>
            <Link href="/labour/workers" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
              ← Back to Workers
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Initialize with one empty row
  useEffect(() => {
    if (workers.length === 0) {
      setWorkers([createEmptyWorker()]);
    }
  }, []);

  function createEmptyWorker() {
    return {
      workerName: '',
      employeeId: '',
      workerType: 'internal',
      phoneNumber: '',
      email: '',
      nationalId: '',
      skillTypes: [],
      defaultHourlyRate: '',
      defaultDailyRate: '',
      overtimeMultiplier: 1.5,
      employmentType: 'casual',
      status: 'active',
      hireDate: '',
    };
  }

  const addWorker = () => {
    setWorkers([...workers, createEmptyWorker()]);
  };

  const removeWorker = (index) => {
    if (workers.length > 1) {
      const newWorkers = workers.filter((_, i) => i !== index);
      setWorkers(newWorkers);
      // Clear errors for removed worker
      const newErrors = { ...errors };
      delete newErrors[index];
      setErrors(newErrors);
    } else {
      toast.showError('At least one worker is required');
    }
  };

  const updateWorker = (index, field, value) => {
    const newWorkers = [...workers];
    if (field === 'skillTypes') {
      // Toggle skill
      const currentSkills = newWorkers[index].skillTypes || [];
      if (currentSkills.includes(value)) {
        newWorkers[index].skillTypes = currentSkills.filter(s => s !== value);
      } else {
        newWorkers[index].skillTypes = [...currentSkills, value];
      }
    } else {
      newWorkers[index][field] = value;
    }
    setWorkers(newWorkers);
    
    // Clear error for this field
    const newErrors = { ...errors };
    if (newErrors[index] && newErrors[index][field]) {
      delete newErrors[index][field];
      if (Object.keys(newErrors[index]).length === 0) {
        delete newErrors[index];
      }
    }
    setErrors(newErrors);
  };

  const validateWorker = (worker, index) => {
    const workerErrors = {};
    
    if (!worker.workerName || worker.workerName.trim().length < 2) {
      workerErrors.workerName = 'Worker name is required (min 2 characters)';
    }
    
    if (!worker.employeeId || worker.employeeId.trim().length === 0) {
      workerErrors.employeeId = 'Employee ID is required';
    }
    
    if (!worker.defaultHourlyRate || parseFloat(worker.defaultHourlyRate) <= 0) {
      workerErrors.defaultHourlyRate = 'Valid hourly rate is required';
    }
    
    // Check for duplicate employee IDs within the form
    const duplicateIndex = workers.findIndex(
      (w, i) => i !== index && w.employeeId && w.employeeId.trim() === worker.employeeId.trim()
    );
    if (duplicateIndex !== -1) {
      workerErrors.employeeId = 'Duplicate employee ID in this form';
    }
    
    return workerErrors;
  };

  const validateAll = () => {
    const allErrors = {};
    let isValid = true;
    
    workers.forEach((worker, index) => {
      const workerErrors = validateWorker(worker, index);
      if (Object.keys(workerErrors).length > 0) {
        allErrors[index] = workerErrors;
        isValid = false;
      }
    });
    
    setErrors(allErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateAll()) {
      toast.showError('Please fix all errors before submitting');
      return;
    }

    setLoading(true);

    try {
      // Prepare data for API
      const workersData = workers.map(worker => ({
        workerName: worker.workerName.trim(),
        employeeId: worker.employeeId.trim(),
        workerType: worker.workerType,
        phoneNumber: worker.phoneNumber?.trim() || null,
        email: worker.email?.trim() || null,
        nationalId: worker.nationalId?.trim() || null,
        skillTypes: worker.skillTypes || [],
        defaultHourlyRate: parseFloat(worker.defaultHourlyRate) || 0,
        defaultDailyRate: worker.defaultDailyRate ? parseFloat(worker.defaultDailyRate) : null,
        overtimeMultiplier: parseFloat(worker.overtimeMultiplier) || 1.5,
        employmentType: worker.employmentType,
        status: worker.status,
        hireDate: worker.hireDate ? new Date(worker.hireDate).toISOString() : null,
      }));

      const response = await fetch('/api/labour/workers/bulk', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        body: JSON.stringify({ workers: workersData }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create workers');
      }

      const createdCount = data.data?.created?.length || 0;
      const failedCount = data.data?.failed?.length || 0;
      
      if (createdCount > 0) {
        toast.showSuccess(
          `Successfully created ${createdCount} worker profile${createdCount !== 1 ? 's' : ''}${
            failedCount > 0 ? `. ${failedCount} failed.` : ''
          }`
        );
      }
      
      if (failedCount > 0 && data.data?.failed) {
        const failedNames = data.data.failed.map(f => f.workerName || f.employeeId).join(', ');
        toast.showError(`Failed to create: ${failedNames}`);
      }

      // Redirect to workers page
      router.push('/labour/workers');
    } catch (err) {
      console.error('Error creating workers:', err);
      toast.showError(err.message || 'Failed to create workers');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/labour/workers"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Workers
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Bulk Create Workers</h1>
          <p className="text-gray-600 mt-1">Create multiple worker profiles at once</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow">
          {/* Header Actions */}
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Worker Profiles</h2>
              <p className="text-sm text-gray-600 mt-1">
                Add worker information below. All fields marked with * are required.
              </p>
            </div>
            <button
              type="button"
              onClick={addWorker}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Worker
            </button>
          </div>

          {/* Workers Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Worker Name *
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee ID *
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hourly Rate *
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Daily Rate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workers.map((worker, index) => (
                  <tr key={index} className={errors[index] ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={worker.workerName}
                        onChange={(e) => updateWorker(index, 'workerName', e.target.value)}
                        placeholder="John Doe"
                        className={`w-full px-3 py-2 text-sm bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 ${
                          errors[index]?.workerName ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors[index]?.workerName && (
                        <p className="text-xs text-red-600 mt-1">{errors[index].workerName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={worker.employeeId}
                        onChange={(e) => updateWorker(index, 'employeeId', e.target.value)}
                        placeholder="EMP001"
                        className={`w-full px-3 py-2 text-sm bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 ${
                          errors[index]?.employeeId ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors[index]?.employeeId && (
                        <p className="text-xs text-red-600 mt-1">{errors[index].employeeId}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={worker.workerType}
                        onChange={(e) => updateWorker(index, 'workerType', e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {VALID_WORKER_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {getWorkerTypeLabel(type)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={worker.defaultHourlyRate}
                        onChange={(e) => updateWorker(index, 'defaultHourlyRate', e.target.value)}
                        placeholder="500"
                        className={`w-full px-3 py-2 text-sm bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 ${
                          errors[index]?.defaultHourlyRate ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors[index]?.defaultHourlyRate && (
                        <p className="text-xs text-red-600 mt-1">{errors[index].defaultHourlyRate}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={worker.defaultDailyRate}
                        onChange={(e) => updateWorker(index, 'defaultDailyRate', e.target.value)}
                        placeholder="4000"
                        className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="tel"
                        value={worker.phoneNumber}
                        onChange={(e) => updateWorker(index, 'phoneNumber', e.target.value)}
                        placeholder="+254 700 000 000"
                        className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="email"
                        value={worker.email}
                        onChange={(e) => updateWorker(index, 'email', e.target.value)}
                        placeholder="worker@example.com"
                        className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={worker.status}
                        onChange={(e) => updateWorker(index, 'status', e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {VALID_WORKER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeWorker(index)}
                        disabled={workers.length === 1}
                        className="text-red-600 hover:text-red-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Remove worker"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Additional Fields Section (Collapsible) */}
          <div className="border-t border-gray-200 px-6 py-4">
            <details className="space-y-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                Additional Fields (Optional) - Click to expand
              </summary>
              <div className="mt-4 space-y-4">
                {workers.map((worker, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-medium text-gray-900">{worker.workerName || `Worker ${index + 1}`}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          National ID
                        </label>
                        <input
                          type="text"
                          value={worker.nationalId}
                          onChange={(e) => updateWorker(index, 'nationalId', e.target.value)}
                          placeholder="12345678"
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Employment Type
                        </label>
                        <select
                          value={worker.employmentType}
                          onChange={(e) => updateWorker(index, 'employmentType', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {VALID_EMPLOYMENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Overtime Multiplier
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          value={worker.overtimeMultiplier}
                          onChange={(e) => updateWorker(index, 'overtimeMultiplier', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Hire Date
                        </label>
                        <input
                          type="date"
                          value={worker.hireDate}
                          onChange={(e) => updateWorker(index, 'hireDate', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Skills
                        </label>
                        <div className="border border-gray-300 rounded-lg p-3 max-h-32 overflow-y-auto">
                          <div className="grid grid-cols-3 gap-2">
                            {VALID_SKILL_TYPES.map((skill) => (
                              <label key={skill} className="flex items-center gap-2 cursor-pointer text-xs">
                                <input
                                  type="checkbox"
                                  checked={worker.skillTypes?.includes(skill) || false}
                                  onChange={() => updateWorker(index, 'skillTypes', skill)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-gray-700">{getSkillTypeLabel(skill)}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>

          {/* Summary */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-700">
                <Users className="w-5 h-5" />
                <span className="font-medium">{workers.length} worker{workers.length !== 1 ? 's' : ''} to create</span>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/labour/workers"
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Create {workers.length} Worker{workers.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}

export default function BulkWorkerCreationPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading..." />
          </div>
        </div>
      </AppLayout>
    }>
      <BulkWorkerCreationPageContent />
    </Suspense>
  );
}
