/**
 * Worker Detail Drawer Component
 * Slide-out drawer for viewing worker details
 * 
 * Features:
 * - Fetches worker data on open
 * - Displays all worker information
 * - Quick action buttons
 * - Statistics cards
 * - Related links
 * - Loading states
 * - Error handling
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Drawer } from '@/components/drawer';
import { WorkerDetailSkeleton } from './WorkerDetailSkeleton';
import { LoadingSpinner } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast/toast-container';
import {
  Edit,
  Plus,
  Eye,
  FileText,
  Clock,
  DollarSign,
  CheckCircle,
  User,
  Phone,
  Mail,
  Calendar,
  Briefcase,
} from 'lucide-react';
import {
  getSkillTypeLabel,
  getWorkerTypeLabel,
} from '@/lib/constants/labour-constants';

/**
 * Worker Detail Drawer
 * @param {Object} props
 * @param {string} props.workerId - Worker ID to display
 * @param {boolean} props.isOpen - Is drawer open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onEdit - Edit handler (receives workerId)
 */
export function WorkerDetailDrawer({ workerId, isOpen, onClose, onEdit }) {
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch worker data when drawer opens
  useEffect(() => {
    if (isOpen && workerId) {
      fetchWorker();
    } else {
      // Reset state when drawer closes
      setWorker(null);
      setError(null);
    }
  }, [isOpen, workerId]);

  const fetchWorker = async (isRefresh = false) => {
    if (!workerId) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(`/api/labour/workers/${workerId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch worker details');
      }

      setWorker(data.data);
    } catch (err) {
      console.error('Error fetching worker:', err);
      setError(err.message);
      toast.showError('Failed to load worker details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchWorker(true);
  };

  const stats = worker?.statistics || {};

  // Determine drawer title
  const drawerTitle = worker
    ? `${worker.workerName}${worker.employeeId ? ` (${worker.employeeId})` : ''}`
    : 'Worker Details';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={drawerTitle}
      size="lg"
      isLoading={loading && !worker}
      loadingMessage="Loading worker information..."
      closeOnBackdrop={true}
      preventCloseDuringLoading={true}
      footer={
        worker && (
          <div className="flex items-center justify-end gap-3">
            {canAccess('edit_worker_profile') && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(workerId);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit Worker
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {refreshing ? (
                <>
                  <LoadingSpinner size="sm" />
                  Refreshing...
                </>
              ) : (
                'Refresh'
              )}
            </button>
          </div>
        )
      }
    >
      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm">{error}</p>
          <button
            onClick={() => fetchWorker()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !worker && <WorkerDetailSkeleton />}

      {/* Worker Content */}
      {worker && !loading && (
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
            {canAccess('create_labour_entry') && (
              <>
                <Link
                  href={`/labour/entries/new?workerId=${worker.userId || worker._id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                  onClick={onClose}
                >
                  <Plus className="w-4 h-4" />
                  Create Entry
                </Link>
                <Link
                  href={`/labour/batches/new?workerId=${worker.userId || worker._id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  onClick={onClose}
                >
                  <FileText className="w-4 h-4" />
                  Add to Bulk Entry
                </Link>
              </>
            )}
            <Link
              href={`/labour/entries?workerId=${worker.userId || worker._id}`}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              onClick={onClose}
            >
              <Eye className="w-4 h-4" />
              View All Entries
            </Link>
          </div>

          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Name</label>
                <p className="text-gray-900 font-medium mt-1">{worker.workerName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Employee ID</label>
                <p className="text-gray-900 mt-1">{worker.employeeId || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Worker Type</label>
                <p className="text-gray-900 mt-1">{getWorkerTypeLabel(worker.workerType)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <span
                  className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${
                    worker.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : worker.status === 'inactive'
                      ? 'bg-gray-100 text-gray-800'
                      : worker.status === 'terminated'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {worker.status?.charAt(0).toUpperCase() + worker.status?.slice(1).replace(/_/g, ' ')}
                </span>
              </div>
              {worker.phoneNumber && (
                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    Phone
                  </label>
                  <p className="text-gray-900 mt-1">{worker.phoneNumber}</p>
                </div>
              )}
              {worker.email && (
                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    Email
                  </label>
                  <p className="text-gray-900 mt-1">{worker.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* Skills & Rates */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills & Rates</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Skills</label>
                <div className="flex flex-wrap gap-2">
                  {(worker.skillTypes || []).length > 0 ? (
                    worker.skillTypes.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {getSkillTypeLabel(skill)}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">No skills assigned</span>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Hourly Rate</label>
                <p className="text-gray-900 font-semibold text-lg mt-1">
                  {worker.defaultHourlyRate?.toLocaleString() || '0'} KES/hr
                </p>
              </div>
              {worker.defaultDailyRate && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Daily Rate</label>
                  <p className="text-gray-900 font-semibold mt-1">
                    {worker.defaultDailyRate.toLocaleString()} KES/day
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">Employment Type</label>
                <p className="text-gray-900 mt-1 capitalize">
                  {worker.employmentType?.replace(/_/g, ' ') || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Total Hours</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.totalHoursWorked?.toFixed(1) || '0'}
                </div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Total Earned</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {stats.totalEarned?.toLocaleString() || '0'} KES
                </div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Entries</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {stats.entryCount || '0'}
                </div>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-medium text-gray-700">Rating</span>
                </div>
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.averageRating?.toFixed(1) || '0'}/5
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

export default WorkerDetailDrawer;
