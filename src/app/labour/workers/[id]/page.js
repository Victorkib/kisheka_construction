/**
 * Worker Detail Page
 * View detailed worker profile with statistics, entries, and history
 * 
 * Route: /labour/workers/[id]
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { LoadingSpinner, LoadingButton } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast/toast-container';
import { 
  ArrowLeft, Edit, Trash2, Plus, Eye, 
  Users, Clock, DollarSign, TrendingUp, User,
  Phone, Mail, Calendar, Briefcase, FileText,
  CheckCircle, XCircle
} from 'lucide-react';
import { ConfirmationModal } from '@/components/modals';
import { AssignWorkItemsModal } from '@/components/workers/assign-work-items-modal';
import { 
  getSkillTypeLabel, 
  getWorkerTypeLabel 
} from '@/lib/constants/labour-constants';

function WorkerDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const workerId = params?.id;

  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entriesPagination, setEntriesPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [assignedWorkItems, setAssignedWorkItems] = useState([]);
  const [assignedWorkItemsLoading, setAssignedWorkItemsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (workerId) {
      fetchWorker();
      fetchEntries();
      fetchAssignedWorkItems();
    }
  }, [workerId, entriesPagination.page]);

  const fetchWorker = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/labour/workers/${workerId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch worker');
      }

      setWorker(data.data);
      // Fetch assigned work items after worker is loaded
      if (data.data) {
        fetchAssignedWorkItems(data.data);
      }
    } catch (err) {
      console.error('Error fetching worker:', err);
      setError(err.message);
      toast.showError('Failed to load worker details');
    } finally {
      setLoading(false);
    }
  };

  const fetchEntries = async () => {
    try {
      setEntriesLoading(true);

      const queryParams = new URLSearchParams({
        workerId: workerId,
        page: entriesPagination.page.toString(),
        limit: entriesPagination.limit.toString(),
      });

      const response = await fetch(`/api/labour/entries?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch entries');
      }

      setEntries(data.data?.entries || []);
      setEntriesPagination(prev => ({
        ...prev,
        total: data.data?.pagination?.total || 0,
        totalPages: data.data?.pagination?.totalPages || 0,
      }));
    } catch (err) {
      console.error('Error fetching entries:', err);
      toast.showError('Failed to load entries');
    } finally {
      setEntriesLoading(false);
    }
  };

  const fetchAssignedWorkItems = async (workerData = null) => {
    try {
      setAssignedWorkItemsLoading(true);
      
      // Get worker's userId (could be _id or userId field)
      const effectiveWorker = workerData || worker;
      const effectiveWorkerId = effectiveWorker?.userId || effectiveWorker?._id || workerId;
      
      if (!effectiveWorkerId) return;
      
      const response = await fetch(`/api/work-items?assignedTo=${effectiveWorkerId}`);
      const data = await response.json();
      
      if (data.success) {
        setAssignedWorkItems(data.data?.workItems || []);
      }
    } catch (err) {
      console.error('Error fetching assigned work items:', err);
    } finally {
      setAssignedWorkItemsLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/labour/workers/${workerId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete worker');
      }

      toast.showSuccess('Worker deleted successfully');
      router.push('/labour/workers');
    } catch (err) {
      console.error('Error deleting worker:', err);
      toast.showError(err.message || 'Failed to delete worker');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading worker details..." />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !worker) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 mb-4">{error || 'Worker not found'}</p>
            <Link
              href="/labour/workers"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Workers
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const stats = worker.statistics || {};

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/labour/workers"
            className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Workers
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{worker.workerName}</h1>
                <span
                  className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
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
              {worker.employeeId && (
                <p className="text-gray-600">Employee ID: {worker.employeeId}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canAccess('create_labour_entry') && (
                <Link
                  href={`/labour/entries/new?workerId=${worker.userId || worker._id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create Entry
                </Link>
              )}
              {canAccess('edit_worker_profile') && (
                <button
                  onClick={() => router.push(`/labour/workers?edit=${worker._id}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              )}
              {canAccess('delete_worker_profile') && (
                <LoadingButton
                  onClick={() => setShowDeleteModal(true)}
                  isLoading={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </LoadingButton>
              )}
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-gray-600">Total Hours</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {stats.totalHoursWorked?.toFixed(1) || '0'} hrs
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <p className="text-sm text-gray-600">Total Earned</p>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalEarned || 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <p className="text-sm text-gray-600">Total Entries</p>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {stats.entryCount || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <p className="text-sm text-gray-600">Avg Rating</p>
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {stats.averageRating?.toFixed(1) || '0'}/5
            </p>
          </div>
        </div>

        {/* Assigned Work Items Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-600" />
              Assigned Work Items ({assignedWorkItems.length})
            </h2>
            {canAccess('create_work_item') && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Assign Work Items
              </button>
            )}
          </div>
          
          {assignedWorkItemsLoading ? (
            <div className="text-center py-8">
              <LoadingSpinner />
            </div>
          ) : assignedWorkItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="font-medium">No work items assigned</p>
              <p className="text-sm mt-1">This worker has no assigned work items yet.</p>
              {canAccess('create_work_item') && (
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                >
                  Assign Work Items
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {assignedWorkItems.map((workItem) => {
                const progressPercentage = workItem.estimatedHours > 0
                  ? Math.round((workItem.actualHours / workItem.estimatedHours) * 100)
                  : 0;
                
                return (
                  <div
                    key={workItem._id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Link
                            href={`/work-items/${workItem._id}`}
                            className="font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            {workItem.name}
                          </Link>
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                            workItem.status === 'completed' ? 'bg-green-100 text-green-800' :
                            workItem.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            workItem.status === 'blocked' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {workItem.status?.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          {workItem.phaseName && (
                            <p>
                              Phase: <Link href={`/phases/${workItem.phaseId}`} className="text-blue-600 hover:text-blue-800">
                                {workItem.phaseName}
                              </Link>
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs">
                              Progress: {progressPercentage}% ({workItem.actualHours || 0}/{workItem.estimatedHours || 0} hrs)
                            </span>
                            {workItem.estimatedCost > 0 && (
                              <span className="text-xs">
                                Cost: {workItem.actualCost?.toLocaleString() || 0} / {workItem.estimatedCost.toLocaleString()} KES
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {canAccess('create_labour_entry') && (
                          <Link
                            href={`/labour/entries/new?workItemId=${workItem._id}&workerId=${worker?.userId || worker?._id}`}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium"
                            title="Create Entry"
                          >
                            + Entry
                          </Link>
                        )}
                        <Link
                          href={`/work-items/${workItem._id}`}
                          className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-medium"
                          title="View Work Item"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Worker Information */}
          <div className="lg:col-span-1 space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Worker Type</label>
                  <p className="text-gray-900">{getWorkerTypeLabel(worker.workerType)}</p>
                </div>
                {worker.phoneNumber && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      Phone
                    </label>
                    <p className="text-gray-900">{worker.phoneNumber}</p>
                  </div>
                )}
                {worker.email && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      Email
                    </label>
                    <p className="text-gray-900">{worker.email}</p>
                  </div>
                )}
                {worker.nationalId && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">National ID</label>
                    <p className="text-gray-900">{worker.nationalId}</p>
                  </div>
                )}
                {worker.hireDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Hire Date
                    </label>
                    <p className="text-gray-900">{formatDate(worker.hireDate)}</p>
                  </div>
                )}
                {worker.employmentType && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                      <Briefcase className="w-4 h-4" />
                      Employment Type
                    </label>
                    <p className="text-gray-900 capitalize">
                      {worker.employmentType.replace(/_/g, ' ')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Skills & Rates */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Skills & Rates</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Skills</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {(worker.skillTypes || []).map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                      >
                        {getSkillTypeLabel(skill)}
                      </span>
                    ))}
                    {(!worker.skillTypes || worker.skillTypes.length === 0) && (
                      <span className="text-gray-400 text-sm">No skills specified</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Hourly Rate</label>
                  <p className="text-gray-900 font-medium">
                    {formatCurrency(worker.defaultHourlyRate || 0)}/hr
                  </p>
                </div>
                {worker.defaultDailyRate && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Daily Rate</label>
                    <p className="text-gray-900 font-medium">
                      {formatCurrency(worker.defaultDailyRate)}/day
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-700">Overtime Multiplier</label>
                  <p className="text-gray-900">{worker.overtimeMultiplier || 1.5}x</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Entries */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recent Entries</h2>
                <Link
                  href={`/labour/entries?workerId=${worker.userId || worker._id}`}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  View All →
                </Link>
              </div>

              {entriesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" text="Loading entries..." />
                </div>
              ) : entries.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No entries found for this worker</p>
                  {canAccess('create_labour_entry') && (
                    <Link
                      href={`/labour/entries/new?workerId=${worker.userId || worker._id}`}
                      className="inline-block px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Create First Entry
                    </Link>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Project/Phase
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Hours
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Cost
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {entries.map((entry) => (
                          <tr key={entry._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {formatDate(entry.entryDate)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              <div>
                                {entry.projectName && (
                                  <div className="font-medium">{entry.projectName}</div>
                                )}
                                {entry.phaseName && (
                                  <div className="text-xs text-gray-500">{entry.phaseName}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {entry.totalHours?.toFixed(1)} hrs
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                              {formatCurrency(entry.totalCost || 0)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  entry.status === 'approved' || entry.status === 'paid'
                                    ? 'bg-green-100 text-green-800'
                                    : entry.status === 'draft'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {entry.status?.charAt(0).toUpperCase() + entry.status?.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              <Link
                                href={`/labour/entries/${entry._id}`}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                              >
                                View →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {entriesPagination.totalPages > 1 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Showing {((entriesPagination.page - 1) * entriesPagination.limit) + 1} to{' '}
                        {Math.min(entriesPagination.page * entriesPagination.limit, entriesPagination.total)} of{' '}
                        {entriesPagination.total} entries
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEntriesPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                          disabled={entriesPagination.page === 1}
                          className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-gray-700">
                          Page {entriesPagination.page} of {entriesPagination.totalPages}
                        </span>
                        <button
                          onClick={() => setEntriesPagination(prev => ({ ...prev, page: Math.min(entriesPagination.totalPages, prev.page + 1) }))}
                          disabled={entriesPagination.page >= entriesPagination.totalPages}
                          className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Delete Worker"
          message={`Are you sure you want to delete ${worker.workerName}? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
          isLoading={deleting}
        />

        {/* Assign Work Items Modal */}
        {worker && (
          <AssignWorkItemsModal
            isOpen={showAssignModal}
            onClose={() => setShowAssignModal(false)}
            workerId={worker.userId || worker._id}
            workerName={worker.workerName || 'Worker'}
            onAssignComplete={() => {
              fetchAssignedWorkItems(worker);
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}

export default function WorkerDetailPage() {
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
      <WorkerDetailPageContent />
    </Suspense>
  );
}
